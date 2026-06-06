import { getVoiceOption } from '../../shared/costs.js';
import type { ProviderId, TextChunk, TonePreset, VoiceOption } from '../../shared/types.js';
import { FakeTtsProvider } from './fake-tts.js';
import { OpenAiTtsProvider } from './openai-tts.js';

export interface ProviderSecrets {
  openAiApiKey?: string;
}

export interface SynthesizeChunkInput {
  chunk: TextChunk;
  voice: VoiceOption;
  tone: TonePreset;
  outputPath: string;
  signal?: AbortSignal;
}

export interface TtsProvider {
  id: ProviderId;
  maxChunkCharacters: number;
  synthesizeChunk(input: SynthesizeChunkInput): Promise<void>;
}

export { getVoiceOption };

export const createProvider = (
  providerId: ProviderId,
  secrets: ProviderSecrets = {}
): TtsProvider => {
  if (providerId === 'fake') {
    return new FakeTtsProvider();
  }

  if (providerId === 'openai') {
    if (!secrets.openAiApiKey) {
      throw new Error('OpenAI API key is missing. Save it in Settings before generating audio.');
    }
    return new OpenAiTtsProvider(secrets.openAiApiKey);
  }

  throw new Error(`Provider is not configured: ${providerId}`);
};
