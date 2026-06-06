import { describe, expect, it } from 'vitest';
import { chunkTextForNarration } from '../src/shared/chunker';
import { DEFAULT_MAX_CHARS, DEFAULT_TARGET_CHARS } from '../src/shared/costs';

describe('chunkTextForNarration', () => {
  it('keeps short text in one chunk', () => {
    const chunks = chunkTextForNarration('A short paragraph. Another sentence.', {
      targetChars: 80,
      maxChars: 120
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('A short paragraph. Another sentence.');
  });

  it('splits on sentence boundaries before hard max', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
    const chunks = chunkTextForNarration(text, { targetChars: 32, maxChars: 42 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.characterCount <= 42)).toBe(true);
    expect(chunks.map((chunk) => chunk.text).join(' ')).toBe(text);
  });

  it('does not split after common abbreviations when a sentence boundary exists', () => {
    const text = 'Dr. Rivera read the letter aloud. The room got quiet.';
    const chunks = chunkTextForNarration(text, { targetChars: 80, maxChars: 120 });
    expect(chunks[0].text).toBe(text);
  });

  it('keeps a roughly ten minute read to a small number of internal chunks', () => {
    const sentence = 'This sentence is paced like a narrated article and gives the chunker room to split cleanly. ';
    const text = sentence.repeat(Math.ceil(7_200 / sentence.length)).slice(0, 7_200);
    const chunks = chunkTextForNarration(text, {
      targetChars: DEFAULT_TARGET_CHARS,
      maxChars: DEFAULT_MAX_CHARS
    });

    expect(chunks.length).toBeLessThanOrEqual(2);
    expect(chunks.every((chunk) => chunk.characterCount <= DEFAULT_MAX_CHARS)).toBe(true);
  });

  it('hard-splits a single oversized token before provider limits', () => {
    const chunks = chunkTextForNarration('x'.repeat(DEFAULT_MAX_CHARS + 50), {
      targetChars: DEFAULT_TARGET_CHARS,
      maxChars: DEFAULT_MAX_CHARS
    });

    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.characterCount <= DEFAULT_MAX_CHARS)).toBe(true);
  });
});
