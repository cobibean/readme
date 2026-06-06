import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchReadableFromUrl } from './extraction/fetch-readable.js';
import { generateSample, runNarrationJob, estimateNarrationJob } from './jobs/job-runner.js';
import { loadJobManifest } from './jobs/job-store.js';
import {
  clearOpenAiApiKey,
  getOpenAiApiKey,
  saveOpenAiApiKey,
  validateOpenAiApiKey
} from './openai-key.js';
import { getSettings } from './settings.js';
import { IPC_CHANNELS } from '../shared/ipc-channels.js';
import type {
  GeneratedNarrationAudio,
  GenerateSampleRequest,
  JobProgress,
  NarrationJobRequest
} from '../shared/types.js';

const activeJobControllers = new Map<string, AbortController>();

const appSupportPath = (...parts: string[]): string => path.join(app.getPath('userData'), ...parts);

const safeFilename = (name: string): string =>
  name
    .replace(/[^a-z0-9-_ ]+/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/^-|-$/g, '') || 'readme';

const defaultOutputName = (title: string): string => {
  const date = new Date().toISOString().slice(0, 10);
  return `${safeFilename(title)}-${date}.mp3`;
};

const generatedOutputName = (title: string): string => {
  const parsed = path.parse(defaultOutputName(title));
  return `${parsed.name}-${Date.now()}.mp3`;
};

const outputDialogDefaultPath = (titleOrFilename: string): string => {
  const filename = titleOrFilename.toLowerCase().endsWith('.mp3')
    ? `${safeFilename(path.parse(titleOrFilename).name)}.mp3`
    : defaultOutputName(titleOrFilename);
  return path.join(os.homedir(), 'Music', filename);
};

const sidecarManifestPath = (outputPath: string): string => {
  const parsed = path.parse(outputPath);
  return path.join(parsed.dir, `${parsed.name}.longread-job.json`);
};

const copySidecarManifest = async (sourcePath: string, destinationPath: string): Promise<void> => {
  let raw = '';
  try {
    raw = await readFile(sidecarManifestPath(sourcePath), 'utf8');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  const destinationManifestPath = sidecarManifestPath(destinationPath);
  const manifest = JSON.parse(raw) as { outputPath?: string; manifestPath?: string };
  await writeFile(
    destinationManifestPath,
    `${JSON.stringify(
      { ...manifest, outputPath: destinationPath, manifestPath: destinationManifestPath },
      null,
      2
    )}\n`,
    'utf8'
  );
};

const providerSecrets = async () => ({
  openAiApiKey: await getOpenAiApiKey()
});

export interface RegisterIpcHandlersOptions {
  showMainWindow?: () => BrowserWindow;
  getMainWindow?: () => BrowserWindow | null;
}

export const registerIpcHandlers = (options: RegisterIpcHandlersOptions = {}): void => {
  const resolveOutputPath = async (
    request: NarrationJobRequest,
    resumeManifestPath?: string
  ): Promise<string> => {
    if (request.outputPath) {
      return request.outputPath;
    }

    if (resumeManifestPath) {
      const manifest = await loadJobManifest(resumeManifestPath);
      if (manifest.outputPath) {
        return manifest.outputPath;
      }
    }

    const outputDir = appSupportPath('generated-audio');
    await mkdir(outputDir, { recursive: true });
    return path.join(outputDir, generatedOutputName(request.source.title));
  };

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => getSettings());

  ipcMain.handle(IPC_CHANNELS.SETTINGS_OPENAI_KEY_SAVE, async (_event, apiKey: string) => {
    await saveOpenAiApiKey(apiKey);
    return getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_OPENAI_KEY_CLEAR, async () => {
    await clearOpenAiApiKey();
    return getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_OPENAI_KEY_VALIDATE, async () =>
    validateOpenAiApiKey()
  );

  ipcMain.handle(IPC_CHANNELS.SOURCE_EXTRACT_URL, async (_event, sourceUrl: string) => {
    return fetchReadableFromUrl(sourceUrl);
  });

  ipcMain.handle(IPC_CHANNELS.JOB_ESTIMATE, async (_event, request: NarrationJobRequest) => {
    return estimateNarrationJob(request);
  });

  ipcMain.handle(IPC_CHANNELS.JOB_GENERATE_SAMPLE, async (_event, request: GenerateSampleRequest) => {
    return generateSample({
      request,
      sampleRootDir: appSupportPath('samples'),
      providerSecrets: await providerSecrets()
    });
  });

  ipcMain.handle(IPC_CHANNELS.OUTPUT_PICK_FILE, async (_event, title: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Save narrated MP3',
      defaultPath: outputDialogDefaultPath(title),
      filters: [{ name: 'MP3 Audio', extensions: ['mp3'] }]
    });

    return result.canceled ? '' : result.filePath ?? '';
  });

  ipcMain.handle(IPC_CHANNELS.OUTPUT_SAVE_COPY, async (_event, sourcePath: string, title: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Save narrated MP3',
      defaultPath: outputDialogDefaultPath(title),
      filters: [{ name: 'MP3 Audio', extensions: ['mp3'] }]
    });

    if (result.canceled || !result.filePath) {
      return '';
    }

    await copyFile(sourcePath, result.filePath);
    await copySidecarManifest(sourcePath, result.filePath);
    return result.filePath;
  });

  const start = async (
    event: Electron.IpcMainInvokeEvent,
    request: NarrationJobRequest,
    resumeManifestPath?: string
  ): Promise<GeneratedNarrationAudio | { status: 'cancelled' }> => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    const controller = new AbortController();
    const requestWithOutput: NarrationJobRequest = {
      ...request,
      outputPath: await resolveOutputPath(request, resumeManifestPath)
    };

    const forwardProgress = (progress: JobProgress) => {
      activeJobControllers.set(progress.jobId, controller);
      sender?.webContents.send(IPC_CHANNELS.JOB_PROGRESS, progress);
    };

    try {
      const manifest = await runNarrationJob({
        request: requestWithOutput,
        resumeManifestPath,
        jobRootDir: appSupportPath('jobs'),
        providerSecrets: await providerSecrets(),
        signal: controller.signal,
        onProgress: forwardProgress
      });
      activeJobControllers.delete(manifest.jobId);
      return {
        outputPath: manifest.outputPath,
        audioUrl: pathToFileURL(manifest.outputPath).toString(),
        actualCostUsd: manifest.actualCostUsd,
        generatedCharacters: manifest.generatedCharacters,
        manifestPath: manifest.manifestPath ?? resumeManifestPath ?? ''
      };
    } catch (error) {
      if (controller.signal.aborted) {
        return { status: 'cancelled' };
      }
      throw error;
    }
  };

  ipcMain.handle(IPC_CHANNELS.JOB_START, async (event, request: NarrationJobRequest) =>
    start(event, request)
  );

  ipcMain.handle(
    IPC_CHANNELS.JOB_RESUME,
    async (event, request: NarrationJobRequest, manifestPath: string) =>
      start(event, request, manifestPath)
  );

  ipcMain.handle(IPC_CHANNELS.JOB_CANCEL, async (_event, jobId: string) => {
    activeJobControllers.get(jobId)?.abort();
    activeJobControllers.delete(jobId);
  });

  ipcMain.handle(IPC_CHANNELS.OUTPUT_REVEAL, async (_event, outputPath: string) => {
    shell.showItemInFolder(outputPath);
  });

  ipcMain.handle(IPC_CHANNELS.OUTPUT_OPEN_FILE, async (_event, outputPath: string) => {
    const error = await shell.openPath(outputPath);
    if (error) {
      throw new Error(error);
    }
  });
};
