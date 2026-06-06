import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runNarrationJob } from '../src/main/jobs/job-runner';
import { makeSourceDocumentFromText } from '../src/shared/text-normalize';

describe('runNarrationJob', () => {
  it('generates and resumes fake-provider MP3 jobs with a manifest', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'longread-runner-'));
    const source = makeSourceDocumentFromText(
      Array.from({ length: 18 }, (_, index) => `Sentence ${index + 1} has enough text for chunking.`).join(' ')
    );
    const outputPath = path.join(root, 'out.mp3');
    const progress = [];

    const manifest = await runNarrationJob({
      request: {
        source,
        providerId: 'fake',
        voiceId: 'fake-test',
        tone: 'calm-narrator',
        outputPath,
        costCapUsd: 10,
        keepChunkFiles: false
      },
      jobRootDir: path.join(root, 'jobs'),
      onProgress: (event) => progress.push(event)
    });

    expect(manifest.status).toBe('complete');
    expect(manifest.completedChunkIds.length).toBeGreaterThan(0);
    expect(progress.at(-1)?.status).toBe('complete');
  }, 20_000);
});
