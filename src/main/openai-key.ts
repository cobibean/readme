import { readFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { ProviderAuthError, sanitizeErrorMessage } from './errors.js';
import { openAiKeychain, type KeychainStore } from './keychain.js';

export type OpenAiKeySource = 'env' | 'keychain' | 'dotenv' | 'missing';

export interface OpenAiApiKeyResolution {
  key: string;
  source: OpenAiKeySource;
}

export interface OpenAiKeyValidation {
  ok: boolean;
  message: string;
}

interface ResolveOpenAiApiKeyOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  keychain?: KeychainStore;
}

let cachedOpenAiApiKey = '';

const parseEnvLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }
  const index = trimmed.indexOf('=');
  if (index === -1) {
    return null;
  }
  const key = trimmed.slice(0, index).trim();
  const value = trimmed
    .slice(index + 1)
    .trim()
    .replace(/^['"]|['"]$/g, '');
  return [key, value];
};

const readDotEnvOpenAiKey = async (cwd: string): Promise<string> => {
  try {
    const envPath = path.join(cwd, '.env');
    const env = await readFile(envPath, 'utf8');
    for (const line of env.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (parsed?.[0] === 'OPENAI_API_KEY') {
        return parsed[1];
      }
    }
  } catch {
    return '';
  }

  return '';
};

export const resolveOpenAiApiKey = async (
  options: ResolveOpenAiApiKeyOptions = {}
): Promise<OpenAiApiKeyResolution> => {
  const usingDefaultSources = !options.env && !options.cwd && !options.keychain;
  const envKey = options.env?.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (envKey) {
    return { key: envKey, source: 'env' };
  }

  if (usingDefaultSources && cachedOpenAiApiKey) {
    return { key: cachedOpenAiApiKey, source: 'keychain' };
  }

  const keychain = options.keychain ?? openAiKeychain;
  const keychainKey = await keychain.getPassword();
  if (keychainKey) {
    if (usingDefaultSources) {
      cachedOpenAiApiKey = keychainKey;
    }
    return { key: keychainKey, source: 'keychain' };
  }

  const dotEnvKey = await readDotEnvOpenAiKey(options.cwd ?? process.cwd());
  if (dotEnvKey) {
    return { key: dotEnvKey, source: 'dotenv' };
  }

  return { key: '', source: 'missing' };
};

export const getOpenAiApiKey = async (): Promise<string> =>
  (await resolveOpenAiApiKey()).key;

export const getOpenAiApiKeyStatus = async (): Promise<OpenAiApiKeyResolution> => {
  if (process.env.OPENAI_API_KEY) {
    return { key: 'configured', source: 'env' };
  }

  if (cachedOpenAiApiKey || (await openAiKeychain.hasPassword())) {
    return { key: 'configured', source: 'keychain' };
  }

  const dotEnvKey = await readDotEnvOpenAiKey(process.cwd());
  if (dotEnvKey) {
    return { key: 'configured', source: 'dotenv' };
  }

  return { key: '', source: 'missing' };
};

export const saveOpenAiApiKey = async (apiKey: string): Promise<OpenAiApiKeyResolution> => {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('Enter an OpenAI API key before saving.');
  }
  if (!trimmed.startsWith('sk-')) {
    throw new Error('OpenAI API keys usually start with sk-. Paste the full key value from the OpenAI dashboard.');
  }
  if (trimmed.includes('*') || trimmed.includes('...')) {
    throw new Error('That looks like a masked key. Paste the full OpenAI API key value.');
  }

  await openAiKeychain.setPassword(trimmed);
  cachedOpenAiApiKey = trimmed;
  return { key: trimmed, source: 'keychain' };
};

export const clearOpenAiApiKey = async (): Promise<OpenAiApiKeyResolution> => {
  await openAiKeychain.deletePassword();
  cachedOpenAiApiKey = '';
  return getOpenAiApiKeyStatus();
};

export const validateOpenAiApiKey = async (apiKey?: string): Promise<OpenAiKeyValidation> => {
  const resolvedKey = apiKey?.trim() || (await getOpenAiApiKey());
  if (!resolvedKey) {
    throw new Error('OpenAI API key is missing. Save a key before checking it.');
  }

  try {
    const client = new OpenAI({ apiKey: resolvedKey });
    await client.models.list();
    return { ok: true, message: 'OpenAI accepted the saved API key.' };
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : 0;
    const message = error instanceof Error ? error.message : '';

    if (status === 401 || /incorrect api key|invalid api key|unauthorized/i.test(message)) {
      throw new ProviderAuthError();
    }

    throw new Error(sanitizeErrorMessage(message || 'Could not validate the OpenAI API key.'));
  }
};
