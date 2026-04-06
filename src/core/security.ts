const SENSITIVE_CONTENT_PATTERNS: readonly RegExp[] = [
  /\b(password|passwd|pwd)\b/i,
  /\b(ssn|social security|credit card|cvv|bank account)\b/i,
  /\b(api[ _-]?key|client[ _-]?secret|secret(?: key)?|access[ _-]?token|refresh[ _-]?token)\b/i,
  /\b(private key|BEGIN [A-Z ]*PRIVATE KEY)\b/i,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/i,
  /\b(?:SID|HSID|SSID|APISID|SAPISID)=\S+/i,
  /\bAuthorization\s*:\s*\S+/i,
  /\bCookie\s*:\s*\S+/i,
  /\bAIza[0-9A-Za-z\-_]{10,}\b/,
  /\bya29\.[0-9A-Za-z\-_]+\b/,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9_-]+/,
];

const ABSOLUTE_PATH_PATTERNS: readonly RegExp[] = [
  /\/Users\/[^\s:'"`]+/g,
  /\/home\/[^\s:'"`]+/g,
  /[A-Za-z]:\\[^\s:'"`]+/g,
];

const SECRET_VALUE_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\b(?:SID|HSID|SSID|APISID|SAPISID)=([^;\s]+)/gi, '$1=[REDACTED]'],
  [/\b(Bearer\s+)[A-Za-z0-9._-]{16,}/gi, '$1[REDACTED]'],
  [/(X-Goog-Csrf-Token\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]'],
  [/(Cookie\s*:\s*)(.+)$/gim, '$1[REDACTED]'],
  [/(STATE_ENCRYPTION_KEY\s*[=:]\s*)([^\s'"`]+)/gi, '$1[REDACTED]'],
  [
    /\b(access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|password|secret)\b(["'\s:=]+)([^\s,"';]+)/gi,
    '$1$2[REDACTED]',
  ],
  [/(ENC:v1:)[A-Za-z0-9+/=]+/g, '$1[REDACTED]'],
];

const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred.';

export function containsSensitiveContent(...values: Array<string | null | undefined>): boolean {
  const content = values.filter((value): value is string => typeof value === 'string').join('\n');
  return SENSITIVE_CONTENT_PATTERNS.some(pattern => pattern.test(content));
}

export function redactSensitiveContent(text: string, label: string): string {
  if (!text) {
    return text;
  }

  if (!containsSensitiveContent(text)) {
    return text;
  }

  return `[REDACTED SENSITIVE ${label.toUpperCase()}]`;
}

export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  for (const [pattern, replacement] of SECRET_VALUE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  for (const pattern of ABSOLUTE_PATH_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[path]');
  }

  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  if (!sanitized) {
    return DEFAULT_ERROR_MESSAGE;
  }

  return sanitized;
}

export function safeErrorMessage(error: unknown, fallback: string = DEFAULT_ERROR_MESSAGE): string {
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message) || fallback;
  }

  if (typeof error === 'string') {
    return sanitizeErrorMessage(error) || fallback;
  }

  return fallback;
}
