import { writeFile } from 'node:fs/promises';
import OpenAI from 'openai';
import { getToneOption } from '../../shared/tones.js';
import { ProviderAuthError, sanitizeErrorMessage } from '../errors.js';
import type { SynthesizeChunkInput, TtsProvider } from './provider-registry.js';

export class OpenAiTtsProvider implements TtsProvider {
  id = 'openai' as const;
  maxChunkCharacters = 4_000;
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  private toSafeError(error: unknown): Error {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : 0;
    const message = error instanceof Error ? error.message : '';

    if (status === 401 || /incorrect api key|invalid api key|unauthorized/i.test(message)) {
      return new ProviderAuthError();
    }

    return new Error(
      sanitizeErrorMessage(message || 'OpenAI speech generation failed.')
    );
  }

  async synthesizeChunk(input: SynthesizeChunkInput): Promise<void> {
    if (input.signal?.aborted) {
      throw new Error('Job cancelled.');
    }

    const tone = getToneOption(input.tone);
    const body = {
      model: input.voice.model,
      voice: input.voice.voice,
      input: input.chunk.text,
      response_format: 'mp3' as const,
      speed: tone.speed,
      ...(input.voice.supportsInstructions ? { instructions: tone.instructions } : {})
    };

    try {
      const response = await this.client.audio.speech.create(body, { signal: input.signal });
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(input.outputPath, buffer);
    } catch (error) {
      throw this.toSafeError(error);
    }
  }
}
