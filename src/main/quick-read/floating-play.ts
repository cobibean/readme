import type { ProviderId } from '../../shared/types.js';
import type {
  FloatingReadmePlayReason,
  FloatingReadmePlayResult,
  QuickReadGeneratedAudio
} from '../../shared/types.js';
import type { QuickReadDraft } from './quick-read.js';

export interface FloatingPlayDependencies {
  loadLatest: () => Promise<QuickReadDraft> | QuickReadDraft;
  hasProviderAccess: (providerId: ProviderId) => Promise<boolean> | boolean;
  getCachedAudio: (quickRead: QuickReadDraft) => Promise<QuickReadGeneratedAudio | null>;
  generateAudio: (quickRead: QuickReadDraft) => Promise<QuickReadGeneratedAudio>;
  openMain: (state: { quickRead: QuickReadDraft | null; message: string }) => void;
  describeError?: (error: unknown) => string;
}

const messageFromError = (error: unknown): string =>
  error instanceof Error ? error.message : 'Could not read the latest Codex response.';

const block = (
  reason: FloatingReadmePlayReason,
  quickRead: QuickReadDraft | null,
  message: string,
  openMain: FloatingPlayDependencies['openMain']
): FloatingReadmePlayResult => {
  openMain({ quickRead, message });
  return {
    status: 'blocked',
    reason,
    message,
    ...(quickRead ? { quickRead: quickRead.preview } : {})
  };
};

export const playLatestCodexQuickRead = async ({
  loadLatest,
  hasProviderAccess,
  getCachedAudio,
  generateAudio,
  openMain,
  describeError = messageFromError
}: FloatingPlayDependencies): Promise<FloatingReadmePlayResult> => {
  let quickRead: QuickReadDraft;

  try {
    quickRead = await loadLatest();
  } catch (error) {
    return block('no-response', null, describeError(error), openMain);
  }

  if (quickRead.preview.estimate.capExceeded) {
    return block(
      'cap-exceeded',
      quickRead,
      `Estimated read cost $${quickRead.preview.estimate.estimatedCostUsd.toFixed(2)} exceeds cap $${quickRead.preview.costCapUsd.toFixed(2)}.`,
      openMain
    );
  }

  if (!(await hasProviderAccess(quickRead.preview.providerId))) {
    return block(
      'missing-provider-key',
      quickRead,
      'OpenAI key required for this voice. Save a key in readme before using the floating button.',
      openMain
    );
  }

  const cachedAudio = await getCachedAudio(quickRead);
  if (cachedAudio) {
    return {
      status: 'playing',
      message: 'Playing latest Codex response.',
      quickRead: quickRead.preview,
      audio: cachedAudio,
      reusedAudio: true
    };
  }

  try {
    const audio = await generateAudio(quickRead);
    return {
      status: 'playing',
      message: 'Playing latest Codex response.',
      quickRead: quickRead.preview,
      audio,
      reusedAudio: false
    };
  } catch (error) {
    return {
      ...block('generation-failed', quickRead, describeError(error), openMain),
      status: 'error'
    };
  }
};
