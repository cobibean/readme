import { describe, expect, it } from 'vitest';
import {
  VOICE_OPTIONS,
  buildCostEstimate,
  estimateCostUsd,
  estimateListeningSeconds
} from '../src/shared/costs';
import { TONE_OPTIONS } from '../src/shared/tones';

describe('cost estimates', () => {
  it('estimates dollar cost from provider price per million characters', () => {
    expect(estimateCostUsd(268_758, 30)).toBeCloseTo(8.06274, 6);
    expect(estimateCostUsd(268_758, 15)).toBeCloseTo(4.03137, 6);
  });

  it('estimates listening duration using the provider research ratio', () => {
    expect(estimateListeningSeconds(1_000_000)).toBe(83_280);
    expect(estimateListeningSeconds(268_758)).toBe(22_382);
  });

  it('keeps OpenAI MVP presets in budget, natural, and premium tiers', () => {
    const tiers = VOICE_OPTIONS.filter((voice) => voice.providerId === 'openai').map((voice) => voice.qualityTier);
    expect(tiers).toContain('budget');
    expect(tiers).toContain('natural');
    expect(tiers).toContain('premium');
  });

  it('exposes the current built-in OpenAI gpt-4o mini TTS voices', () => {
    const naturalVoices = VOICE_OPTIONS
      .filter((voice) => voice.model === 'gpt-4o-mini-tts')
      .map((voice) => voice.voice);

    expect(naturalVoices).toEqual([
      'marin',
      'cedar',
      'alloy',
      'ash',
      'ballad',
      'coral',
      'echo',
      'fable',
      'nova',
      'onyx',
      'sage',
      'shimmer',
      'verse'
    ]);
  });

  it('keeps the recommended OpenAI voices on instruction-capable TTS', () => {
    const recommendedVoiceIds = ['openai-natural-marin', 'openai-natural-cedar'];

    for (const voiceId of recommendedVoiceIds) {
      const voice = VOICE_OPTIONS.find((option) => option.id === voiceId);
      expect(voice?.model).toBe('gpt-4o-mini-tts');
      expect(voice?.supportsInstructions).toBe(true);
    }
  });

  it('offers an expanded set of narration tones', () => {
    expect(TONE_OPTIONS).toHaveLength(12);
    expect(TONE_OPTIONS.map((tone) => tone.id)).toContain('documentary');
    expect(TONE_OPTIONS.map((tone) => tone.id)).toContain('bedtime-reading');
    expect(TONE_OPTIONS.map((tone) => tone.id)).toContain('clear-instructional');
  });

  it('flags jobs over the default cap', () => {
    const voice = VOICE_OPTIONS.find((option) => option.id === 'openai-premium-nova');
    expect(voice).toBeDefined();
    const estimate = buildCostEstimate(400_000, 64_000, 120, voice!, 10);
    expect(estimate.capExceeded).toBe(true);
  });
});
