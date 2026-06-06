import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createJobManifest, saveJobManifest } from '../src/main/jobs/job-store';

describe('job-store', () => {
  it('writes a resumable manifest without secrets', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'longread-job-'));
    const manifest = createJobManifest({
      jobId: 'job-1',
      title: 'Example',
      sourceUrl: 'https://example.com',
      sourceTextSha256: 'abc123',
      outputPath: path.join(dir, 'example.mp3'),
      chunks: [],
      estimatedCostUsd: 0.12,
      pricePerMillionCharactersUsd: 15
    });

    const manifestPath = await saveJobManifest(dir, manifest);
    const saved = JSON.parse(await readFile(manifestPath, 'utf8'));

    expect(saved.jobId).toBe('job-1');
    expect(saved.status).toBe('running');
    expect(saved.completedChunkIds).toEqual([]);
    expect(JSON.stringify(saved)).not.toContain('OPENAI_API_KEY');
  });
});
