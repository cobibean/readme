import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractReadableFromHtml } from '../src/main/extraction/fetch-readable';

describe('extractReadableFromHtml', () => {
  it('extracts article text without navigation clutter', () => {
    const html = readFileSync(path.join(process.cwd(), 'tests/fixtures/vatican-sample.html'), 'utf8');
    const result = extractReadableFromHtml(html, 'https://example.com/letter');

    expect(result.title).toContain('Example Letter');
    expect(result.text).toContain('First paragraph of the letter');
    expect(result.text).not.toContain('Home Search Donate');
    expect(result.wordCount).toBeGreaterThan(20);
  });
});
