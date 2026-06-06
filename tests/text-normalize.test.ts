import { describe, expect, it } from 'vitest';
import { countWords, normalizeNarrationText } from '../src/shared/text-normalize';

describe('normalizeNarrationText', () => {
  it('normalizes whitespace while preserving paragraph breaks', () => {
    const input = ' Title\n\n\nFirst   paragraph.\tSecond sentence.\n\n[1] Footnote.';
    expect(normalizeNarrationText(input)).toBe(
      'Title\n\nFirst paragraph. Second sentence.\n\n[1] Footnote.'
    );
  });

  it('removes obvious footnote backlink clutter', () => {
    expect(normalizeNarrationText('A note. ↩\n\nNext.')).toBe('A note.\n\nNext.');
  });

  it('counts words in long document estimates', () => {
    expect(countWords('One two, three.')).toBe(3);
  });
});
