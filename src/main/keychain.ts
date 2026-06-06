import { spawn } from 'node:child_process';
import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const OPENAI_KEYCHAIN_SERVICE = 'app.readme.desktop';
export const OPENAI_KEYCHAIN_ACCOUNT = 'openai-api-key';

export interface KeychainStore {
  hasPassword(): Promise<boolean>;
  getPassword(): Promise<string>;
  setPassword(password: string): Promise<void>;
  deletePassword(): Promise<void>;
}

interface KeychainCommandResult {
  stdout: string;
  stderr: string;
}

export class KeychainCommandError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly stderr: string
  ) {
    super(message);
  }
}

export type KeychainCommandRunner = (
  command: 'exists' | 'get' | 'set' | 'delete',
  stdin?: string
) => Promise<KeychainCommandResult>;

const helperPath = (): string => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'native', 'longread-keychain');
  }

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, '../native/longread-keychain');
};

export const runKeychainCommand: KeychainCommandRunner = (command, stdin) =>
  new Promise((resolve, reject) => {
    const child = spawn(helperPath(), [
      command,
      OPENAI_KEYCHAIN_SERVICE,
      OPENAI_KEYCHAIN_ACCOUNT
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new KeychainCommandError('Keychain command failed.', code, stderr));
    });

    child.stdin.end(stdin ?? '');
  });

const isMissingPasswordError = (error: unknown): boolean =>
  error instanceof KeychainCommandError && error.code === 44;

export const createMacOsKeychainStore = (
  runner: KeychainCommandRunner = runKeychainCommand
): KeychainStore => ({
  async hasPassword() {
    try {
      await runner('exists');
      return true;
    } catch (error) {
      if (isMissingPasswordError(error)) {
        return false;
      }
      throw error;
    }
  },

  async getPassword() {
    try {
      const result = await runner('get');
      return result.stdout.trim();
    } catch (error) {
      if (isMissingPasswordError(error)) {
        return '';
      }
      throw error;
    }
  },

  async setPassword(password) {
    if (/[\r\n]/.test(password)) {
      throw new Error('API key cannot contain line breaks.');
    }

    await runner('set', password);
  },

  async deletePassword() {
    try {
      await runner('delete');
    } catch (error) {
      if (!isMissingPasswordError(error)) {
        throw error;
      }
    }
  }
});

export const openAiKeychain = createMacOsKeychainStore();
