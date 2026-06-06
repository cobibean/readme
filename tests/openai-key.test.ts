import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveOpenAiApiKey, saveOpenAiApiKey } from '../src/main/openai-key';
import type { KeychainStore } from '../src/main/keychain';

const fakeKeychain = (password: string): KeychainStore => ({
  hasPassword: async () => password.length > 0,
  getPassword: async () => password,
  setPassword: async () => undefined,
  deletePassword: async () => undefined
});

describe('resolveOpenAiApiKey', () => {
  it('prefers process environment over Keychain and dotenv', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'longread-settings-'));
    await writeFile(path.join(dir, '.env'), 'OPENAI_API_KEY=sk-dotenv\n');

    const result = await resolveOpenAiApiKey({
      env: { OPENAI_API_KEY: 'sk-env' },
      cwd: dir,
      keychain: fakeKeychain('sk-keychain')
    });

    expect(result).toEqual({ key: 'sk-env', source: 'env' });
  });

  it('uses Keychain before local dotenv fallback', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'longread-settings-'));
    await writeFile(path.join(dir, '.env'), 'OPENAI_API_KEY=sk-dotenv\n');

    const result = await resolveOpenAiApiKey({
      env: {},
      cwd: dir,
      keychain: fakeKeychain('sk-keychain')
    });

    expect(result).toEqual({ key: 'sk-keychain', source: 'keychain' });
  });

  it('keeps dotenv as a local development fallback', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'longread-settings-'));
    await writeFile(path.join(dir, '.env'), 'OPENAI_API_KEY=\"sk-dotenv\"\n');

    const result = await resolveOpenAiApiKey({
      env: {},
      cwd: dir,
      keychain: fakeKeychain('')
    });

    expect(result).toEqual({ key: 'sk-dotenv', source: 'dotenv' });
  });

  it('rejects masked API keys before saving', async () => {
    await expect(saveOpenAiApiKey('sk-proj-********')).rejects.toThrow('masked key');
  });
});
