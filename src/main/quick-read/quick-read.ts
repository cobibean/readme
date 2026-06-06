import { createHash } from 'node:crypto';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runNarrationJob, estimateNarrationJob } from '../jobs/job-runner.js';
import type { ProviderSecrets } from '../providers/provider-registry.js';
import { quickReadTitleForMode, truncateQuickReadText } from '../../shared/quick-read.js';
import { makeSourceDocumentFromText } from '../../shared/text-normalize.js';
import type {
  JobProgress,
  ProviderId,
  QuickReadEstimate,
  QuickReadGeneratedAudio,
  QuickReadSource,
  SourceDocument,
  TonePreset
} from '../../shared/types.js';

export interface QuickReadSettings {
  providerId: ProviderId;
  voiceId: string;
  tone: TonePreset;
  costCapUsd: number;
}

export interface QuickReadDraft {
  source: QuickReadSource;
  document: SourceDocument;
  preview: QuickReadEstimate;
}

const hashId = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 16);

export const getQuickReadOutputPath = ({
  quickRead,
  quickReadRootDir
}: {
  quickRead: QuickReadDraft;
  quickReadRootDir: string;
}): string => {
  const sourceDir = path.join(quickReadRootDir, 'sources', hashId(quickRead.source.id));
  return path.join(sourceDir, 'quick-read.mp3');
};

export const getCachedQuickReadAudio = async ({
  quickRead,
  quickReadRootDir
}: {
  quickRead: QuickReadDraft;
  quickReadRootDir: string;
}): Promise<QuickReadGeneratedAudio | null> => {
  const outputPath = getQuickReadOutputPath({ quickRead, quickReadRootDir });

  try {
    await access(outputPath);
  } catch {
    return null;
  }

  return {
    sourceId: quickRead.source.id,
    outputPath,
    audioUrl: pathToFileURL(outputPath).toString(),
    actualCostUsd: quickRead.preview.estimate.estimatedCostUsd,
    generatedCharacters: quickRead.document.characterCount
  };
};

export const createQuickReadEstimate = ({
  source,
  settings
}: {
  source: QuickReadSource;
  settings: QuickReadSettings;
}): QuickReadDraft => {
  const safeText = truncateQuickReadText(source.text);
  const title = source.title || quickReadTitleForMode(source.mode);
  const safeSource = { ...source, text: safeText, title };
  const document = makeSourceDocumentFromText(safeText, title);
  const estimate = estimateNarrationJob({
    source: document,
    providerId: settings.providerId,
    voiceId: settings.voiceId,
    tone: settings.tone,
    outputPath: '',
    costCapUsd: settings.costCapUsd,
    keepChunkFiles: false
  });

  return {
    source: safeSource,
    document,
    preview: {
      id: hashId(`${safeSource.id}:${settings.providerId}:${settings.voiceId}:${settings.tone}:${settings.costCapUsd}`),
      sourceId: safeSource.id,
      mode: safeSource.mode,
      title,
      characterCount: document.characterCount,
      wordCount: document.wordCount,
      estimate,
      ...settings,
      receivedAtIso: safeSource.receivedAtIso
    }
  };
};

export const generateQuickReadAudio = async ({
  quickRead,
  quickReadRootDir,
  providerSecrets,
  onProgress,
  signal
}: {
  quickRead: QuickReadDraft;
  quickReadRootDir: string;
  providerSecrets?: ProviderSecrets;
  onProgress: (progress: JobProgress) => void;
  signal?: AbortSignal;
}): Promise<QuickReadGeneratedAudio> => {
  if (quickRead.preview.estimate.capExceeded) {
    throw new Error(
      `Estimated read cost $${quickRead.preview.estimate.estimatedCostUsd.toFixed(2)} exceeds cap $${quickRead.preview.costCapUsd.toFixed(2)}.`
    );
  }

  const outputPath = getQuickReadOutputPath({ quickRead, quickReadRootDir });
  const sourceDir = path.dirname(outputPath);
  await mkdir(sourceDir, { recursive: true });

  const manifest = await runNarrationJob({
    request: {
      source: quickRead.document,
      providerId: quickRead.preview.providerId,
      voiceId: quickRead.preview.voiceId,
      tone: quickRead.preview.tone,
      outputPath,
      costCapUsd: quickRead.preview.costCapUsd,
      keepChunkFiles: false
    },
    jobRootDir: path.join(quickReadRootDir, 'jobs'),
    providerSecrets,
    onProgress,
    signal
  });

  return {
    sourceId: quickRead.source.id,
    outputPath,
    audioUrl: pathToFileURL(outputPath).toString(),
    actualCostUsd: manifest.actualCostUsd,
    generatedCharacters: manifest.generatedCharacters
  };
};
