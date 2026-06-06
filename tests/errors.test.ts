import { describe, expect, it } from 'vitest';
import { ProviderAuthError, sanitizeErrorMessage } from '../src/main/errors';

describe('error sanitization', () => {
  it('removes Electron invoke wrappers and redacts OpenAI key material', () => {
    const message = sanitizeErrorMessage(
      "Error invoking remote method 'job:generate-sample': Error: 401 Incorrect API key provided: sk-proj-abcdefghijklmnopqrstuvwxyz0123456789"
    );

    expect(message).toBe('401 Incorrect API key provided: [redacted-api-key]');
  });

  it('removes Electron wrappers for named provider errors', () => {
    const message = sanitizeErrorMessage(
      "Error invoking remote method 'job:generate-sample': ProviderAuthError: OpenAI rejected the saved API key."
    );

    expect(message).toBe('OpenAI rejected the saved API key.');
  });

  it('redacts masked key fragments from provider messages', () => {
    const message = sanitizeErrorMessage(
      'Incorrect API key provided: sk-proj-*************************************'
    );

    expect(message).toBe('Incorrect API key provided: [redacted-api-key]');
  });

  it('uses a user-safe provider auth message', () => {
    expect(new ProviderAuthError().message).toContain('OpenAI rejected the saved API key');
    expect(new ProviderAuthError().message).not.toContain('sk-');
  });
});
