import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthTokens } from '../../src/api/types.js';
import { AuthManager } from '../../src/auth/auth-manager.js';
import { serializeStateData } from '../../src/core/crypto.js';

const mocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  lstat: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: mocks.readFileSync,
}));

vi.mock('node:fs/promises', () => ({
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  mkdir: mocks.mkdir,
  lstat: mocks.lstat,
}));

vi.mock('../../src/core/paths.js', () => ({
  Paths: {
    getInstance: vi.fn(() => ({
      dataDir: '/mock/data',
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

vi.mock('../../src/auth/cdp-auth.js', () => ({
  CDPAuthManager: vi.fn(),
}));

vi.mock('../../src/api/notebooks.js', () => ({
  NotebookClient: vi.fn(),
}));

describe('AuthManager security hardening', () => {
  const tokens: AuthTokens = {
    cookies: {
      SID: 'sid',
      HSID: 'hsid',
      SSID: 'ssid',
      APISID: 'apisid',
      SAPISID: 'sapisid',
    },
    csrfToken: 'csrf-token',
    extractedAt: 1700000000000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STATE_ENCRYPTION_KEY = '12345678901234567890123456789012';
    mocks.mkdir.mockResolvedValue(undefined);
  });

  it('writes encrypted auth data instead of plaintext JSON', async () => {
    mocks.writeFile.mockResolvedValue(undefined);

    const manager = new AuthManager();
    await manager.saveAuth(tokens);

    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    const [, serialized] = mocks.writeFile.mock.calls[0];
    expect(serialized).toContain('ENC:v1:');
    expect(serialized).not.toContain('"SID":"sid"');
  });

  it('requires a configured encryption key before saving auth data', async () => {
    delete process.env.STATE_ENCRYPTION_KEY;

    const manager = new AuthManager();

    await expect(manager.saveAuth(tokens)).rejects.toThrow('STATE_ENCRYPTION_KEY must be set');
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('loads encrypted auth data successfully', async () => {
    mocks.readFile.mockResolvedValue(
      serializeStateData(tokens, '12345678901234567890123456789012')
    );

    const manager = new AuthManager();

    await expect(manager.loadAuth()).resolves.toEqual(tokens);
  });

  it('rejects insecure plaintext auth files', async () => {
    mocks.readFile.mockResolvedValue(JSON.stringify(tokens, null, 2));

    const manager = new AuthManager();

    await expect(manager.loadAuth()).rejects.toThrow('stored insecurely');
  });

  it('rejects cookie imports from symbolic links', async () => {
    mocks.lstat.mockResolvedValue({
      isSymbolicLink: () => true,
      isFile: () => true,
      size: 128,
    });

    const manager = new AuthManager();

    await expect(manager.importFromFile('./cookies.txt')).rejects.toThrow('symbolic link');
    expect(mocks.readFileSync).not.toHaveBeenCalled();
  });
});
