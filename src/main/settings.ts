import { app } from 'electron';
import { DEFAULT_COST_CAP_USD } from '../shared/costs.js';
import { getOpenAiApiKeyStatus, type OpenAiKeySource } from './openai-key.js';

export interface AppSettings {
  defaultProviderId: 'openai';
  defaultVoiceId: string;
  defaultCostCapUsd: number;
  hasOpenAiApiKey: boolean;
  openAiKeySource: OpenAiKeySource;
  outputDirectory: string;
}

export const getSettings = async (): Promise<AppSettings> => {
  const apiKey = await getOpenAiApiKeyStatus();
  return {
    defaultProviderId: 'openai',
    defaultVoiceId: 'openai-natural-marin',
    defaultCostCapUsd: DEFAULT_COST_CAP_USD,
    hasOpenAiApiKey: apiKey.key.length > 0,
    openAiKeySource: apiKey.source,
    outputDirectory: app.isReady() ? app.getPath('documents') : ''
  };
};
