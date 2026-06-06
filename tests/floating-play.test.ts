import { describe, expect, it } from 'vitest';
import { playLatestCodexQuickRead } from '../src/main/quick-read/floating-play';
import { createQuickReadEstimate, type QuickReadDraft } from '../src/main/quick-read/quick-read';
import type { QuickReadGeneratedAudio } from '../src/shared/types';

type DraftPreviewOverrides = Partial<Omit<QuickReadDraft['preview'], 'estimate'>> & {
  estimate?: Partial<QuickReadDraft['preview']['estimate']>;
};

const makeDraft = (overrides: DraftPreviewOverrides = {}): QuickReadDraft => {
  const draft = createQuickReadEstimate({
    source: {
      id: 'codex-test',
      mode: 'codex',
      title: 'Latest Codex Response',
      text: 'This is a local Codex response prepared for a floating readme button test.',
      receivedAtIso: '2026-05-26T00:00:00.000Z'
    },
    settings: {
      providerId: 'fake',
      voiceId: 'fake-test',
      tone: 'calm-narrator',
      costCapUsd: 10
    }
  });

  return {
    ...draft,
    preview: {
      ...draft.preview,
      ...overrides,
      estimate: {
        ...draft.preview.estimate,
        ...overrides.estimate
      }
    }
  };
};

const makeAudio = (sourceId = 'codex-test'): QuickReadGeneratedAudio => ({
  sourceId,
  outputPath: '/tmp/readme-test.mp3',
  audioUrl: 'file:///tmp/readme-test.mp3',
  actualCostUsd: 0,
  generatedCharacters: 72
});

describe('floating play latest Codex response', () => {
  it('opens the main app instead of generating when the estimate exceeds the cap', async () => {
    const openedStates: string[] = [];
    let generated = false;
    const draft = makeDraft({
      estimate: {
        estimatedCostUsd: 12,
        costCapUsd: 10,
        capExceeded: true
      },
      costCapUsd: 10
    });

    const result = await playLatestCodexQuickRead({
      loadLatest: () => draft,
      hasProviderAccess: () => true,
      getCachedAudio: async () => null,
      generateAudio: async () => {
        generated = true;
        return makeAudio();
      },
      openMain: ({ message }) => openedStates.push(message)
    });

    expect(result.status).toBe('blocked');
    expect(result.reason).toBe('cap-exceeded');
    expect(generated).toBe(false);
    expect(openedStates[0]).toContain('exceeds cap');
  });

  it('opens the main app instead of generating when the provider key is missing', async () => {
    const openedStates: string[] = [];
    const draft = makeDraft({
      providerId: 'openai',
      voiceId: 'openai-natural-marin'
    });

    const result = await playLatestCodexQuickRead({
      loadLatest: () => draft,
      hasProviderAccess: () => false,
      getCachedAudio: async () => null,
      generateAudio: async () => makeAudio(),
      openMain: ({ message }) => openedStates.push(message)
    });

    expect(result.status).toBe('blocked');
    expect(result.reason).toBe('missing-provider-key');
    expect(openedStates[0]).toContain('OpenAI key required');
  });

  it('reuses cached audio for the same latest response when available', async () => {
    let generated = false;
    const cachedAudio = makeAudio();

    const result = await playLatestCodexQuickRead({
      loadLatest: () => makeDraft(),
      hasProviderAccess: () => true,
      getCachedAudio: async () => cachedAudio,
      generateAudio: async () => {
        generated = true;
        return makeAudio();
      },
      openMain: () => undefined
    });

    expect(result.status).toBe('playing');
    expect(result.audio).toBe(cachedAudio);
    expect(result.reusedAudio).toBe(true);
    expect(generated).toBe(false);
  });
});
