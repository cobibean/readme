import type { QuickReadMode } from './types.js';

export const QUICK_READ_MAX_CHARACTERS = 60_000;

export const quickReadTitleForMode = (mode: QuickReadMode): string => {
  if (mode === 'codex') {
    return 'Latest Codex Response';
  }

  return 'Quick Read';
};

export const truncateQuickReadText = (text: string): string => {
  const normalized = text.trim();
  if (normalized.length <= QUICK_READ_MAX_CHARACTERS) {
    return normalized;
  }

  return normalized.slice(0, QUICK_READ_MAX_CHARACTERS).trim();
};
