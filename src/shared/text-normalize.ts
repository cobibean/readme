const footnoteBacklinkPattern = /[\u21a9\u21b5]+/g;

export const normalizeNarrationText = (input: string): string => {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(footnoteBacklinkPattern, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const countWords = (input: string): number => {
  const matches = input.trim().match(/\b[\p{L}\p{N}'-]+\b/gu);
  return matches ? matches.length : 0;
};

export const makeSourceDocumentFromText = (text: string, title = 'Pasted Text') => {
  const normalized = normalizeNarrationText(text);
  return {
    title,
    sourceUrl: '',
    text: normalized,
    characterCount: normalized.length,
    wordCount: countWords(normalized)
  };
};
