import type { TonePreset } from './tones.js';

export type { TonePreset } from './tones.js';

export type ProviderId = 'openai' | 'fake';

export type QuickReadMode = 'codex';

export type JobStatus =
  | 'idle'
  | 'estimating'
  | 'sample-ready'
  | 'running'
  | 'cancelled'
  | 'failed'
  | 'complete';

export type OpenAiTtsModel =
  | 'tts-1'
  | 'gpt-4o-mini-tts'
  | 'gpt-4o-mini-tts-2025-12-15'
  | 'tts-1-hd';

export interface VoiceOption {
  id: string;
  label: string;
  providerId: ProviderId;
  model: OpenAiTtsModel | 'fake';
  voice: string;
  pricePerMillionCharactersUsd: number;
  qualityTier: 'budget' | 'natural' | 'premium' | 'test';
  defaultTone: TonePreset;
  supportsInstructions: boolean;
  maxChunkCharacters: number;
  pricingNote: string;
}

export interface SourceDocument {
  title: string;
  sourceUrl: string;
  text: string;
  characterCount: number;
  wordCount: number;
}

export interface CostEstimate {
  characterCount: number;
  wordCount: number;
  chunkCount: number;
  estimatedCostUsd: number;
  estimatedListeningSeconds: number;
  pricePerMillionCharactersUsd: number;
  costCapUsd: number;
  capExceeded: boolean;
  pricingNote: string;
}

export interface TextChunk {
  id: string;
  index: number;
  text: string;
  characterCount: number;
  sha256: string;
  sectionTitle: string;
}

export interface NarrationJobRequest {
  source: SourceDocument;
  providerId: ProviderId;
  voiceId: string;
  tone: TonePreset;
  outputPath?: string;
  costCapUsd: number;
  keepChunkFiles: boolean;
}

export interface JobProgress {
  jobId: string;
  status: JobStatus;
  completedChunks: number;
  totalChunks: number;
  generatedCharacters: number;
  estimatedCostUsd: number;
  actualCostUsd: number;
  currentMessage: string;
  outputPath: string;
  manifestPath: string;
}

export interface GenerateSampleRequest {
  source: SourceDocument;
  providerId: ProviderId;
  voiceId: string;
  tone: TonePreset;
  costCapUsd: number;
}

export interface GeneratedSample {
  samplePath: string;
  sampleUrl: string;
  characterCount: number;
  estimatedCostUsd: number;
}

export interface GeneratedNarrationAudio {
  outputPath: string;
  audioUrl: string;
  actualCostUsd: number;
  generatedCharacters: number;
  manifestPath: string;
}

export interface QuickReadSource {
  id: string;
  mode: QuickReadMode;
  title: string;
  text: string;
  receivedAtIso: string;
}

export interface QuickReadEstimate {
  id: string;
  sourceId: string;
  mode: QuickReadMode;
  title: string;
  characterCount: number;
  wordCount: number;
  estimate: CostEstimate;
  providerId: ProviderId;
  voiceId: string;
  tone: TonePreset;
  costCapUsd: number;
  receivedAtIso: string;
}

export interface QuickReadGeneratedAudio {
  sourceId: string;
  outputPath: string;
  audioUrl: string;
  actualCostUsd: number;
  generatedCharacters: number;
}

export interface CodexQuickReadState {
  quickRead: QuickReadEstimate | null;
  message: string;
}

export type FloatingReadmePlayReason =
  | 'cap-exceeded'
  | 'missing-provider-key'
  | 'no-response'
  | 'generation-failed';

export interface FloatingReadmePlayResult {
  status: 'playing' | 'blocked' | 'error';
  message: string;
  reason?: FloatingReadmePlayReason;
  quickRead?: QuickReadEstimate;
  audio?: QuickReadGeneratedAudio;
  reusedAudio?: boolean;
}

export interface CodexSessionMessage {
  key: string;
  sessionFile: string;
  line: number;
  phase: string;
  timestamp: string | null;
  rawText: string;
  text: string;
}
