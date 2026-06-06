import type { CostEstimate, VoiceOption } from './types.js';
import type { TonePreset } from './tones.js';

export const DEFAULT_COST_CAP_USD = 10;
export const DEFAULT_TARGET_CHARS = 3_800;
export const DEFAULT_MAX_CHARS = 4_000;
export const AWS_SECONDS_PER_MILLION_CHARACTERS = 83_280;

const GPT_4O_MINI_TTS_INPUT_TOKEN_RATE = 0.6;
const GPT_4O_MINI_TTS_ESTIMATED_COST_PER_MINUTE = 0.015;
const GPT_4O_MINI_TTS_ESTIMATED_PRICE_PER_MILLION_CHARS = 20.97;
const GPT_4O_MINI_TTS_PRICING_NOTE =
  'OpenAI gpt-4o-mini-tts pricing is token based ($0.60 / 1M text input tokens and $12 / 1M audio output tokens); estimate uses text tokens plus estimated audio duration.';

const openAiGpt4oMiniTtsVoices: Array<{
  voice: string;
  label: string;
  defaultTone: TonePreset;
  recommended?: boolean;
}> = [
  { voice: 'marin', label: 'Marin', defaultTone: 'warm-lecturer', recommended: true },
  { voice: 'cedar', label: 'Cedar', defaultTone: 'calm-narrator', recommended: true },
  { voice: 'alloy', label: 'Alloy', defaultTone: 'gentle-explainer' },
  { voice: 'ash', label: 'Ash', defaultTone: 'documentary' },
  { voice: 'ballad', label: 'Ballad', defaultTone: 'storyteller' },
  { voice: 'coral', label: 'Coral', defaultTone: 'warm-lecturer' },
  { voice: 'echo', label: 'Echo', defaultTone: 'news-reader' },
  { voice: 'fable', label: 'Fable', defaultTone: 'storyteller' },
  { voice: 'nova', label: 'Nova', defaultTone: 'clear-instructional' },
  { voice: 'onyx', label: 'Onyx', defaultTone: 'formal-reading' },
  { voice: 'sage', label: 'Sage', defaultTone: 'academic-lecture' },
  { voice: 'shimmer', label: 'Shimmer', defaultTone: 'reflective-essay' },
  { voice: 'verse', label: 'Verse', defaultTone: 'documentary' }
];

const openAiGpt4oMiniTtsOptions: VoiceOption[] = openAiGpt4oMiniTtsVoices.map((voice) => ({
  id: `openai-natural-${voice.voice}`,
  label: `${voice.label}${voice.recommended ? ' (recommended)' : ''}`,
  providerId: 'openai',
  model: 'gpt-4o-mini-tts',
  voice: voice.voice,
  pricePerMillionCharactersUsd: GPT_4O_MINI_TTS_ESTIMATED_PRICE_PER_MILLION_CHARS,
  qualityTier: 'natural',
  defaultTone: voice.defaultTone,
  supportsInstructions: true,
  maxChunkCharacters: DEFAULT_MAX_CHARS,
  pricingNote: GPT_4O_MINI_TTS_PRICING_NOTE
}));

export const VOICE_OPTIONS: VoiceOption[] = [
  ...openAiGpt4oMiniTtsOptions,
  {
    id: 'openai-budget-alloy',
    label: 'Budget - Alloy (legacy tts-1)',
    providerId: 'openai',
    model: 'tts-1',
    voice: 'alloy',
    pricePerMillionCharactersUsd: 15,
    qualityTier: 'budget',
    defaultTone: 'calm-narrator',
    supportsInstructions: false,
    maxChunkCharacters: DEFAULT_MAX_CHARS,
    pricingNote: 'OpenAI tts-1 historical speech rate: $15 per 1M characters.'
  },
  {
    id: 'openai-premium-nova',
    label: 'Premium - Nova (legacy tts-1-hd)',
    providerId: 'openai',
    model: 'tts-1-hd',
    voice: 'nova',
    pricePerMillionCharactersUsd: 30,
    qualityTier: 'premium',
    defaultTone: 'formal-reading',
    supportsInstructions: false,
    maxChunkCharacters: DEFAULT_MAX_CHARS,
    pricingNote: 'OpenAI tts-1-hd historical speech rate: $30 per 1M characters.'
  },
  {
    id: 'fake-test',
    label: 'Test - local fake audio',
    providerId: 'fake',
    model: 'fake',
    voice: 'fake',
    pricePerMillionCharactersUsd: 0,
    qualityTier: 'test',
    defaultTone: 'calm-narrator',
    supportsInstructions: false,
    maxChunkCharacters: DEFAULT_MAX_CHARS,
    pricingNote: 'Local test provider; no API call.'
  }
];

export const estimateCostUsd = (
  characterCount: number,
  pricePerMillionCharactersUsd: number
): number => (characterCount / 1_000_000) * pricePerMillionCharactersUsd;

export const estimateListeningSeconds = (characterCount: number): number =>
  Math.round((characterCount / 1_000_000) * AWS_SECONDS_PER_MILLION_CHARACTERS);

export const estimateGpt4oMiniTtsUsd = (characterCount: number): number => {
  const estimatedInputTokens = Math.ceil(characterCount / 4);
  const estimatedMinutes = estimateListeningSeconds(characterCount) / 60;
  return (
    (estimatedInputTokens / 1_000_000) * GPT_4O_MINI_TTS_INPUT_TOKEN_RATE +
    estimatedMinutes * GPT_4O_MINI_TTS_ESTIMATED_COST_PER_MINUTE
  );
};

const isGpt4oMiniTtsModel = (model: VoiceOption['model']): boolean =>
  model === 'gpt-4o-mini-tts' || model === 'gpt-4o-mini-tts-2025-12-15';

export const getVoiceOption = (voiceId: string): VoiceOption => {
  const voice = VOICE_OPTIONS.find((option) => option.id === voiceId);
  if (!voice) {
    throw new Error(`Unknown voice: ${voiceId}`);
  }
  return voice;
};

export const buildCostEstimate = (
  characterCount: number,
  wordCount: number,
  chunkCount: number,
  voice: VoiceOption,
  costCapUsd = DEFAULT_COST_CAP_USD
): CostEstimate => {
  const estimatedCostUsd =
    isGpt4oMiniTtsModel(voice.model)
      ? estimateGpt4oMiniTtsUsd(characterCount)
      : estimateCostUsd(characterCount, voice.pricePerMillionCharactersUsd);

  return {
    characterCount,
    wordCount,
    chunkCount,
    estimatedCostUsd,
    estimatedListeningSeconds: estimateListeningSeconds(characterCount),
    pricePerMillionCharactersUsd: voice.pricePerMillionCharactersUsd,
    costCapUsd,
    capExceeded: estimatedCostUsd > costCapUsd,
    pricingNote: voice.pricingNote
  };
};
