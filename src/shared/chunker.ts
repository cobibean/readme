import { createHash } from 'node:crypto';
import type { TextChunk } from './types.js';

interface ChunkOptions {
  targetChars: number;
  maxChars: number;
}

const abbreviationPattern =
  /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|U\.S|U\.K)\.$/i;
const sentenceSplit = /(?<=[.!?])\s+(?=[A-Z0-9"'])/g;

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

const splitSentences = (paragraph: string): string[] => {
  const raw = paragraph.split(sentenceSplit).map((sentence) => sentence.trim()).filter(Boolean);
  const sentences: string[] = [];

  for (const piece of raw) {
    const previous = sentences.at(-1);
    if (previous && abbreviationPattern.test(previous)) {
      sentences[sentences.length - 1] = `${previous} ${piece}`;
    } else {
      sentences.push(piece);
    }
  }

  return sentences;
};

const splitOversizedText = (text: string, maxChars: number): string[] => {
  if (text.length <= maxChars) {
    return [text];
  }

  const words = text.split(/\s+/);
  const parts: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        parts.push(current);
        current = '';
      }
      for (let offset = 0; offset < word.length; offset += maxChars) {
        parts.push(word.slice(offset, offset + maxChars));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      parts.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
};

export const chunkTextForNarration = (text: string, options: ChunkOptions): TextChunk[] => {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const units = paragraphs.flatMap((paragraph) =>
    splitSentences(paragraph).flatMap((sentence) => splitOversizedText(sentence, options.maxChars))
  );

  const chunks: string[] = [];
  let current = '';

  for (const unit of units) {
    const separator = current.includes('\n\n') || unit.startsWith('#') ? '\n\n' : ' ';
    const next = current ? `${current}${separator}${unit}` : unit;
    if (next.length > options.targetChars && current) {
      chunks.push(current);
      current = unit;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.map((chunk, index) => ({
    id: `chunk-${String(index + 1).padStart(4, '0')}`,
    index,
    text: chunk,
    characterCount: chunk.length,
    sha256: sha256(chunk),
    sectionTitle: ''
  }));
};
