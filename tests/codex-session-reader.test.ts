import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findLatestCodexSessionFile,
  getLatestCodexAssistantMessage,
  prepareCodexSpeechText
} from '../src/main/codex/codex-session-reader';

const assistantRecord = (text: string, phase = 'final') =>
  JSON.stringify({
    type: 'response_item',
    timestamp: '2026-05-26T00:00:00.000Z',
    payload: {
      type: 'message',
      role: 'assistant',
      phase,
      content: [{ type: 'output_text', text }]
    }
  });

describe('codex session reader', () => {
  it('finds the newest jsonl session recursively', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'readme-codex-'));
    const olderDir = path.join(root, 'sessions', '2026', '05', '25');
    const newerDir = path.join(root, 'sessions', '2026', '05', '26');
    await mkdir(olderDir, { recursive: true });
    await mkdir(newerDir, { recursive: true });

    const olderPath = path.join(olderDir, 'older.jsonl');
    const newerPath = path.join(newerDir, 'newer.jsonl');
    await writeFile(olderPath, '');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await writeFile(newerPath, '');

    expect(findLatestCodexSessionFile(root)).toBe(newerPath);
    expect((await stat(newerPath)).mtimeMs).toBeGreaterThanOrEqual((await stat(olderPath)).mtimeMs);
  });

  it('prefers final assistant messages and removes fenced code blocks by default', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'readme-codex-'));
    const sessionPath = path.join(root, 'session.jsonl');
    await writeFile(
      sessionPath,
      [
        assistantRecord('working draft', 'commentary'),
        assistantRecord('## Done\nHere is `thing`.\n```ts\nprivateImplementation();\n```', 'final')
      ].join('\n')
    );

    const message = getLatestCodexAssistantMessage(sessionPath, {
      includeCodeBlocks: false,
      maxCharacters: 1000,
      speakMode: 'final'
    });

    expect(message?.phase).toBe('final');
    expect(message?.text).toBe('Done Here is thing. Code block omitted.');
    expect(message?.text).not.toContain('privateImplementation');
  });

  it('can select the latest assistant message regardless of phase', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'readme-codex-'));
    const sessionPath = path.join(root, 'session.jsonl');
    await writeFile(sessionPath, [assistantRecord('final answer', 'final'), assistantRecord('later note', 'commentary')].join('\n'));

    expect(getLatestCodexAssistantMessage(sessionPath, { speakMode: 'final' })?.text).toBe('final answer');
    expect(getLatestCodexAssistantMessage(sessionPath, { speakMode: 'all' })?.text).toBe('later note');
  });

  it('truncates long Codex text', () => {
    expect(
      prepareCodexSpeechText('a'.repeat(10), {
        includeCodeBlocks: false,
        maxCharacters: 5,
        speakMode: 'final'
      })
    ).toBe('aaaaa...');
  });
});
