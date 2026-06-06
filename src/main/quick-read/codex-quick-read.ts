import { createHash } from 'node:crypto';
import { getLatestCodexAssistantMessageFromHome } from '../codex/codex-session-reader.js';
import { createQuickReadEstimate, type QuickReadDraft, type QuickReadSettings } from './quick-read.js';
import type { QuickReadSource } from '../../shared/types.js';

const shortHash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 16);

export const createLatestCodexQuickReadDraft = (
  settings: QuickReadSettings,
  codexHome?: string
): QuickReadDraft => {
  const message = getLatestCodexAssistantMessageFromHome(codexHome, {
    includeCodeBlocks: false,
    speakMode: 'final'
  });

  if (!message) {
    throw new Error('No local Codex assistant response was found.');
  }

  if (!message.text.trim()) {
    throw new Error('The latest Codex response was empty after cleanup.');
  }

  const receivedAtIso = message.timestamp || new Date().toISOString();
  const source: QuickReadSource = {
    id: `codex-${shortHash(message.key)}`,
    mode: 'codex',
    title: 'Latest Codex Response',
    text: message.text,
    receivedAtIso
  };

  return createQuickReadEstimate({ source, settings });
};
