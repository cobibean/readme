import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { QUICK_READ_MAX_CHARACTERS } from '../../shared/quick-read.js';
import type { CodexSessionMessage } from '../../shared/types.js';

export interface CodexSpeechTextOptions {
  includeCodeBlocks?: boolean;
  maxCharacters?: number;
  speakMode?: 'final' | 'all';
}

const defaultCodexHome = (): string => process.env.CODEX_HOME || path.join(homedir(), '.codex');

const resolveSessionsDir = (codexHome = defaultCodexHome()): string =>
  path.basename(codexHome) === 'sessions' ? codexHome : path.join(codexHome, 'sessions');

export const findLatestCodexSessionFile = (codexHome?: string): string | null => {
  const sessionsDir = resolveSessionsDir(codexHome);
  if (!existsSync(sessionsDir)) {
    return null;
  }

  let latestPath: string | null = null;
  let latestMtimeMs = Number.NEGATIVE_INFINITY;

  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
        continue;
      }

      const stats = statSync(fullPath);
      if (stats.mtimeMs > latestMtimeMs) {
        latestPath = fullPath;
        latestMtimeMs = stats.mtimeMs;
      }
    }
  };

  visit(sessionsDir);
  return latestPath;
};

const extractMessageText = (content: unknown): string => {
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((part) => {
      if (typeof part?.text === 'string') {
        return part.text;
      }
      if (typeof part?.output_text === 'string') {
        return part.output_text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
};

const messageKey = (sessionFile: string, lineIndex: number, text: string): string => {
  const digest = createHash('sha256').update(text).digest('hex').slice(0, 16);
  return `${sessionFile}:${lineIndex}:${digest}`;
};

export const prepareCodexSpeechText = (
  text: string,
  options: CodexSpeechTextOptions = {}
): string => {
  const includeCodeBlocks = options.includeCodeBlocks === true;
  const maxCharacters = options.maxCharacters ?? QUICK_READ_MAX_CHARACTERS;

  let output = text;

  if (!includeCodeBlocks) {
    output = output.replace(/```[\s\S]*?```/g, ' Code block omitted. ');
  }

  output = output
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (output.length > maxCharacters) {
    return `${output.slice(0, maxCharacters).trim()}...`;
  }

  return output;
};

export const getLatestCodexAssistantMessage = (
  sessionFile: string | null,
  options: CodexSpeechTextOptions = {}
): CodexSessionMessage | null => {
  if (!sessionFile || !existsSync(sessionFile)) {
    return null;
  }

  const lines = readFileSync(sessionFile, 'utf8').split(/\r?\n/);
  const messages: CodexSessionMessage[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      continue;
    }

    let record: {
      type?: unknown;
      timestamp?: unknown;
      payload?: {
        type?: unknown;
        role?: unknown;
        phase?: unknown;
        content?: unknown;
      };
    };
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    const payload = record?.payload;
    if (
      record?.type !== 'response_item' ||
      payload?.type !== 'message' ||
      payload.role !== 'assistant'
    ) {
      continue;
    }

    const rawText = extractMessageText(payload.content);
    if (!rawText.trim()) {
      continue;
    }

    messages.push({
      key: messageKey(sessionFile, index, rawText),
      sessionFile,
      line: index + 1,
      phase: typeof payload.phase === 'string' ? payload.phase : 'unknown',
      timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
      rawText,
      text: prepareCodexSpeechText(rawText, options)
    });
  }

  if (messages.length === 0) {
    return null;
  }

  if (options.speakMode === 'all') {
    return messages.at(-1) ?? null;
  }

  return [...messages].reverse().find((message) => message.phase === 'final') ?? messages.at(-1) ?? null;
};

export const getLatestCodexAssistantMessageFromHome = (
  codexHome?: string,
  options: CodexSpeechTextOptions = {}
): CodexSessionMessage | null => {
  return getLatestCodexAssistantMessage(findLatestCodexSessionFile(codexHome), options);
};
