import { beforeEach, describe, expect, it, vi } from 'vitest';
import { safeErrorMessage } from '../../src/core/security.js';
import { QueryHistory, resetQueryHistory } from '../../src/history/query-history.js';

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  chmod: vi.fn(),
}));

vi.mock('node:fs', () => ({
  promises: {
    readFile: mocks.readFile,
    writeFile: mocks.writeFile,
    mkdir: mocks.mkdir,
  },
}));

vi.mock('node:fs/promises', () => ({
  chmod: mocks.chmod,
}));

vi.mock('../../src/core/paths.js', () => ({
  Paths: {
    getInstance: vi.fn(() => ({
      dataDir: '/mock/data',
      isUnix: () => true,
    })),
  },
}));

vi.mock('../../src/core/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createChildLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('security hardening regressions', () => {
  beforeEach(() => {
    resetQueryHistory();
    vi.clearAllMocks();
    process.env.STATE_ENCRYPTION_KEY = '12345678901234567890123456789012';
    mocks.readFile.mockRejectedValue({ code: 'ENOENT' });
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.chmod.mockResolvedValue(undefined);
  });

  it('encrypts history data and redacts sensitive query content', async () => {
    const history = QueryHistory.getInstance();

    const record = await history.logQuery({
      question: 'My password is hunter2',
      answer: 'Use this access_token=secret-value for login',
      notebookId: 'nb-1',
      notebookName: 'Security Notebook',
      duration: 1200,
      fromCache: false,
    });

    expect(record.question).toBe('[REDACTED SENSITIVE QUESTION]');
    expect(record.answer).toBe('[REDACTED SENSITIVE ANSWER]');
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);

    const [, serialized] = mocks.writeFile.mock.calls[0];
    expect(serialized).toContain('ENC:v1:');
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('secret-value');
  });

  it('sanitizes secrets and file paths from user-facing errors', () => {
    const message = safeErrorMessage(
      new Error(
        'Failed to load /Users/dave/tools/notebooklm-ts/auth.json with Cookie: SID=abc123 and STATE_ENCRYPTION_KEY=my-secret-key'
      )
    );

    expect(message).not.toContain('/Users/dave/tools/notebooklm-ts/auth.json');
    expect(message).not.toContain('abc123');
    expect(message).not.toContain('my-secret-key');
    expect(message).toContain('[path]');
    expect(message).toContain('[REDACTED]');
  });
});
