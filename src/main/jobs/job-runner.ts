import { randomUUID, createHash } from 'node:crypto';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { concatMp3Files } from '../audio/ffmpeg.js';
import { errorMessage } from '../errors.js';
import {
  createProvider,
  getVoiceOption,
  type ProviderSecrets
} from '../providers/provider-registry.js';
import { chunkTextForNarration } from '../../shared/chunker.js';
import { buildCostEstimate, DEFAULT_TARGET_CHARS, estimateCostUsd } from '../../shared/costs.js';
import type {
  GenerateSampleRequest,
  GeneratedSample,
  JobProgress,
  NarrationJobRequest,
  TextChunk
} from '../../shared/types.js';
import {
  createJobManifest,
  loadJobManifest,
  saveJobManifest,
  saveOutputManifest,
  type JobManifest
} from './job-store.js';

export interface RunNarrationJobOptions {
  request: NarrationJobRequest;
  jobRootDir: string;
  providerSecrets?: ProviderSecrets;
  onProgress: (progress: JobProgress) => void;
  signal?: AbortSignal;
  resumeManifestPath?: string;
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isCancellationError = (error: unknown): boolean =>
  error instanceof Error && /cancelled|aborted|aborterror/i.test(error.message);

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const withChunkRetries = async (operation: () => Promise<void>): Promise<void> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      if (isCancellationError(error)) {
        throw error;
      }
      lastError = error;
      if (attempt === 3) {
        break;
      }
      await sleep(500 * attempt + Math.floor(Math.random() * 300));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Chunk generation failed.');
};

const progressFromManifest = (
  manifest: JobManifest,
  totalChunks: number,
  manifestPath: string,
  message: string
): JobProgress => ({
  jobId: manifest.jobId,
  status: manifest.status,
  completedChunks: manifest.completedChunkIds.length,
  totalChunks,
  generatedCharacters: manifest.generatedCharacters,
  estimatedCostUsd: manifest.estimatedCostUsd,
  actualCostUsd: manifest.actualCostUsd,
  currentMessage: message,
  outputPath: manifest.outputPath,
  manifestPath
});

const validateResumeChunks = (manifest: JobManifest, chunks: TextChunk[]): void => {
  const expected = chunks.map((chunk) => `${chunk.id}:${chunk.sha256}`).join('|');
  const saved = manifest.chunks.map((chunk) => `${chunk.id}:${chunk.sha256}`).join('|');
  if (expected !== saved) {
    throw new Error('The current source text no longer matches the saved job manifest.');
  }
};

export const estimateNarrationJob = (request: NarrationJobRequest) => {
  const voice = getVoiceOption(request.voiceId);
  const chunks = chunkTextForNarration(request.source.text, {
    targetChars: Math.min(DEFAULT_TARGET_CHARS, voice.maxChunkCharacters),
    maxChars: voice.maxChunkCharacters
  });
  return buildCostEstimate(
    request.source.characterCount,
    request.source.wordCount,
    chunks.length,
    voice,
    request.costCapUsd
  );
};

export const getSampleText = (text: string): string => {
  const normalized = text.trim();
  if (normalized.length <= 1_200) {
    return normalized;
  }
  const slice = normalized.slice(0, 1_200);
  const sentenceEnd = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
  return slice.slice(0, sentenceEnd > 700 ? sentenceEnd + 1 : 1_000).trim();
};

export const generateSample = async (options: {
  request: GenerateSampleRequest;
  sampleRootDir: string;
  providerSecrets?: ProviderSecrets;
  signal?: AbortSignal;
}): Promise<GeneratedSample> => {
  const voice = getVoiceOption(options.request.voiceId);
  const provider = createProvider(options.request.providerId, options.providerSecrets);
  const sampleText = getSampleText(options.request.source.text);
  const estimate = buildCostEstimate(
    sampleText.length,
    0,
    1,
    voice,
    options.request.costCapUsd
  );
  if (estimate.capExceeded) {
    throw new Error('The sample estimate exceeds the configured cost cap.');
  }

  await mkdir(options.sampleRootDir, { recursive: true });
  const samplePath = path.join(options.sampleRootDir, `sample-${randomUUID()}.mp3`);
  await provider.synthesizeChunk({
    chunk: {
      id: 'sample',
      index: 0,
      text: sampleText,
      characterCount: sampleText.length,
      sha256: sha256(sampleText),
      sectionTitle: ''
    },
    voice,
    tone: options.request.tone,
    outputPath: samplePath,
    signal: options.signal
  });

  return {
    samplePath,
    sampleUrl: pathToFileURL(samplePath).toString(),
    characterCount: sampleText.length,
    estimatedCostUsd: estimate.estimatedCostUsd
  };
};

export const runNarrationJob = async ({
  request,
  jobRootDir,
  providerSecrets,
  onProgress,
  signal,
  resumeManifestPath
}: RunNarrationJobOptions): Promise<JobManifest> => {
  if (!request.outputPath) {
    throw new Error('Narration jobs require a resolved output path.');
  }

  const voice = getVoiceOption(request.voiceId);
  const provider = createProvider(request.providerId, providerSecrets);
  const maxChunkCharacters = Math.min(voice.maxChunkCharacters, provider.maxChunkCharacters);
  const chunks = chunkTextForNarration(request.source.text, {
    targetChars: Math.min(DEFAULT_TARGET_CHARS, maxChunkCharacters),
    maxChars: maxChunkCharacters
  });
  const estimate = buildCostEstimate(
    request.source.characterCount,
    request.source.wordCount,
    chunks.length,
    voice,
    request.costCapUsd
  );

  if (estimate.capExceeded) {
    throw new Error(
      `Estimated job cost $${estimate.estimatedCostUsd.toFixed(2)} exceeds cap $${request.costCapUsd.toFixed(2)}.`
    );
  }

  const sourceTextSha256 = sha256(request.source.text);
  const jobId = resumeManifestPath ? (await loadJobManifest(resumeManifestPath)).jobId : randomUUID();
  const jobDir = resumeManifestPath ? path.dirname(resumeManifestPath) : path.join(jobRootDir, jobId);
  const chunkDir = path.join(jobDir, 'chunks');
  await mkdir(chunkDir, { recursive: true });

  let manifest = resumeManifestPath
    ? await loadJobManifest(resumeManifestPath)
    : createJobManifest({
        jobId,
        title: request.source.title,
        sourceUrl: request.source.sourceUrl,
        sourceTextSha256,
        outputPath: request.outputPath,
        chunks,
        estimatedCostUsd: estimate.estimatedCostUsd,
        pricePerMillionCharactersUsd: voice.pricePerMillionCharactersUsd
      });

  if (resumeManifestPath) {
    validateResumeChunks(manifest, chunks);
    manifest = {
      ...manifest,
      status: 'running',
      outputPath: request.outputPath,
      estimatedCostUsd: estimate.estimatedCostUsd,
      lastError: undefined
    };
  }

  let manifestPath = await saveJobManifest(jobDir, manifest);
  onProgress(progressFromManifest(manifest, chunks.length, manifestPath, 'Job ready'));

  const chunkPaths: string[] = [];

  try {
    for (const chunk of chunks) {
      const chunkPath = path.join(chunkDir, `${chunk.id}-${chunk.sha256.slice(0, 10)}.mp3`);
      const alreadyComplete = manifest.completedChunkIds.includes(chunk.id) && (await fileExists(chunkPath));
      if (alreadyComplete) {
        chunkPaths.push(chunkPath);
        onProgress(progressFromManifest(manifest, chunks.length, manifestPath, 'Continuing audio'));
        continue;
      }

      if (signal?.aborted) {
        manifest.status = 'cancelled';
        manifestPath = await saveJobManifest(jobDir, manifest);
        onProgress(progressFromManifest(manifest, chunks.length, manifestPath, 'Job cancelled'));
        throw new Error('Job cancelled.');
      }

      const projectedActualCost = estimateCostUsd(
        manifest.generatedCharacters + chunk.characterCount,
        voice.pricePerMillionCharactersUsd
      );
      if (projectedActualCost > request.costCapUsd) {
        throw new Error('Stopping before the next audio segment; projected generated cost exceeds the cap.');
      }

      await withChunkRetries(() =>
        provider.synthesizeChunk({
          chunk,
          voice,
          tone: request.tone,
          outputPath: chunkPath,
          signal
        })
      );

      chunkPaths.push(chunkPath);
      manifest.completedChunkIds = Array.from(new Set([...manifest.completedChunkIds, chunk.id]));
      manifest.generatedCharacters += chunk.characterCount;
      manifest.actualCostUsd = estimateCostUsd(
        manifest.generatedCharacters,
        voice.pricePerMillionCharactersUsd
      );
      manifestPath = await saveJobManifest(jobDir, manifest);
      onProgress(progressFromManifest(manifest, chunks.length, manifestPath, 'Generating audio'));
    }

    await concatMp3Files(chunkPaths, request.outputPath);
    manifest.status = 'complete';
    manifestPath = await saveJobManifest(jobDir, manifest);
    manifest.manifestPath = manifestPath;
    await saveOutputManifest(manifest);
    onProgress(progressFromManifest(manifest, chunks.length, manifestPath, 'MP3 complete'));
    return manifest;
  } catch (error) {
    if (signal?.aborted || isCancellationError(error)) {
      manifest.status = 'cancelled';
      manifestPath = await saveJobManifest(jobDir, manifest);
      manifest.manifestPath = manifestPath;
      onProgress(progressFromManifest(manifest, chunks.length, manifestPath, 'Job cancelled'));
    } else if (manifest.status !== 'cancelled') {
      manifest.status = 'failed';
      manifest.lastError = errorMessage(error, 'Unknown job failure');
      manifestPath = await saveJobManifest(jobDir, manifest);
      manifest.manifestPath = manifestPath;
    } else {
      manifestPath = await saveJobManifest(jobDir, manifest);
      manifest.manifestPath = manifestPath;
    }
    throw error;
  }
};
