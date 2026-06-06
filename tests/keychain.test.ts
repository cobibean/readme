import { describe, expect, it } from 'vitest';
import {
  KeychainCommandError,
  createMacOsKeychainStore,
  type KeychainCommandRunner
} from '../src/main/keychain';

describe('macOS Keychain wrapper', () => {
  it('checks for password existence without reading the password', async () => {
    const calls: string[] = [];
    const runner: KeychainCommandRunner = async (command) => {
      calls.push(command);
      return { stdout: '', stderr: '' };
    };

    await expect(createMacOsKeychainStore(runner).hasPassword()).resolves.toBe(true);
    expect(calls).toEqual(['exists']);
  });

  it('writes the full password through stdin', async () => {
    const calls: Array<{ command: string; stdin?: string }> = [];
    const runner: KeychainCommandRunner = async (command, stdin) => {
      calls.push({ command, stdin });
      return { stdout: '', stderr: '' };
    };
    const longKey = `sk-proj-${'a'.repeat(180)}`;

    await createMacOsKeychainStore(runner).setPassword(longKey);

    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe('set');
    expect(calls[0].stdin).toBe(longKey);
  });

  it('returns an empty password when the Keychain item is missing', async () => {
    const runner: KeychainCommandRunner = async () => {
      throw new KeychainCommandError(
        'Keychain command failed.',
        44,
        ''
      );
    };

    await expect(createMacOsKeychainStore(runner).getPassword()).resolves.toBe('');
  });

  it('rejects API keys with line breaks before spawning security', async () => {
    const runner: KeychainCommandRunner = async () => {
      throw new Error('runner should not be called');
    };

    await expect(createMacOsKeychainStore(runner).setPassword('one\ntwo')).rejects.toThrow(
      'line breaks'
    );
  });
});
