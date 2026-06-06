import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TextChunk } from '../../shared/types.js';

export interface JobManifest {
  jobId: string;
  title: string;
  sourceUrl: string;
  sourceTextSha256: string;
  outputPath: string;
  status: 'running' | 'cancelled' | 'failed' | 'complete';
  chunks: TextChunk[];
  completedChunkIds: string[];
  generatedCharacters: number;
  estimatedCostUsd: number;
  actualCostUsd: number;
  pricePerMillionCharactersUsd: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  manifestPath?: string;
}

export const getManifestPath = (jobDir: string, jobId: string): string =>
  path.join(jobDir, `${jobId}.longread-job.json`);

export const createJobManifest = (input: {
  jobId: string;
  title: string;
  sourceUrl: string;
  sourceTextSha256: string;
  outputPath: string;
  chunks: TextChunk[];
  estimatedCostUsd: number;
  pricePerMillionCharactersUsd: number;
}): JobManifest => {
  const now = new Date().toISOString();
  return {
    jobId: input.jobId,
    title: input.title,
    sourceUrl: input.sourceUrl,
    sourceTextSha256: input.sourceTextSha256,
    outputPath: input.outputPath,
    status: 'running',
    chunks: input.chunks,
    completedChunkIds: [],
    generatedCharacters: 0,
    estimatedCostUsd: input.estimatedCostUsd,
    actualCostUsd: 0,
    pricePerMillionCharactersUsd: input.pricePerMillionCharactersUsd,
    createdAt: now,
    updatedAt: now
  };
};

export const saveJobManifest = async (
  jobDir: string,
  manifest: JobManifest
): Promise<string> => {
  await mkdir(jobDir, { recursive: true });
  const updated = {
    ...manifest,
    updatedAt: new Date().toISOString()
  };
  const manifestPath = getManifestPath(jobDir, manifest.jobId);
  await writeFile(manifestPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  return manifestPath;
};

export const loadJobManifest = async (manifestPath: string): Promise<JobManifest> => {
  const raw = await readFile(manifestPath, 'utf8');
  return JSON.parse(raw) as JobManifest;
};

export const saveOutputManifest = async (manifest: JobManifest): Promise<string> => {
  const parsed = path.parse(manifest.outputPath);
  const manifestPath = path.join(parsed.dir, `${parsed.name}.longread-job.json`);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
};
