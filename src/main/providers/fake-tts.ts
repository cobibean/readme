import { writeSilentMp3 } from '../audio/ffmpeg.js';
import type { SynthesizeChunkInput, TtsProvider } from './provider-registry.js';

export class FakeTtsProvider implements TtsProvider {
  id = 'fake' as const;
  maxChunkCharacters = 4_000;

  async synthesizeChunk(input: SynthesizeChunkInput): Promise<void> {
    if (input.signal?.aborted) {
      throw new Error('Job cancelled.');
    }
    const duration = Math.min(1.5, Math.max(0.25, input.chunk.characterCount / 8_000));
    await writeSilentMp3(input.outputPath, duration);
  }
}
