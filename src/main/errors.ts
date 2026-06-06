const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{3,}\*{6,}[A-Za-z0-9_*.-]*/g,
  /\bsk-[A-Za-z0-9_-]{4,}\b/g
];

export class ProviderAuthError extends Error {
  constructor(message = 'OpenAI rejected the saved API key. Clear it, then save a newly copied full key from the OpenAI dashboard.') {
    super(message);
    this.name = 'ProviderAuthError';
  }
}

export const sanitizeErrorMessage = (message: string): string => {
  let sanitized = message.replace(
    /^Error invoking remote method '[^']+': (?:(?:[A-Za-z][\w.]*Error|Error): )?/i,
    ''
  );

  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[redacted-api-key]');
  }

  return sanitized;
};

export const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }
  return fallback;
};
