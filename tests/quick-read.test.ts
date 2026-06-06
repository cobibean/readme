import { existsSync } from 'node:fs';
import { mkdtemp, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createQuickReadEstimate,
  generateQuickReadAudio
} from '../src/main/quick-read/quick-read';

describe('quick read', () => {
  it('creates a Codex estimate without generating audio', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'readme-quick-read-'));
    const quickRead = createQuickReadEstimate({
      source: {
        id: 'codex-1',
        mode: 'codex',
        title: 'Latest Codex Response',
        text: 'A local response waits for explicit confirmation before narration.',
        receivedAtIso: '2026-05-26T00:00:00.000Z'
      },
      settings: {
        providerId: 'fake',
        voiceId: 'fake-test',
        tone: 'calm-narrator',
        costCapUsd: 10
      }
    });

    expect(quickRead.preview.title).toBe('Latest Codex Response');
    expect(quickRead.preview.estimate.estimatedCostUsd).toBe(0);
    expect(quickRead.preview.mode).toBe('codex');
    expect(await readdir(root)).toEqual([]);
  });

  it('generates temporary fake-provider audio after explicit request', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'readme-quick-read-'));
    const quickRead = createQuickReadEstimate({
      source: {
        id: 'codex-1',
        mode: 'codex',
        title: 'Latest Codex Response',
        text: 'The latest answer is ready to become spoken audio.',
        receivedAtIso: '2026-05-26T00:00:00.000Z'
      },
      settings: {
        providerId: 'fake',
        voiceId: 'fake-test',
        tone: 'calm-narrator',
        costCapUsd: 10
      }
    });

    const generated = await generateQuickReadAudio({
      quickRead,
      quickReadRootDir: root,
      providerSecrets: {},
      onProgress: () => undefined
    });

    expect(generated.sourceId).toBe('codex-1');
    expect(generated.audioUrl.startsWith('file://')).toBe(true);
    expect(generated.generatedCharacters).toBe(quickRead.document.characterCount);
    expect(existsSync(generated.outputPath)).toBe(true);
    expect((await stat(generated.outputPath)).size).toBeGreaterThan(0);
  }, 20_000);
});
