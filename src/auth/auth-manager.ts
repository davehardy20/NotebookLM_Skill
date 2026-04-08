import { readFileSync } from 'node:fs';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { REQUIRED_COOKIES } from '../api/constants.js';
import { CookieValidationError } from '../api/errors.js';
import { NotebookClient } from '../api/notebooks.js';
import type { AuthTokens, Cookie } from '../api/types.js';
import { requireEncryptionKeyFromEnv, serializeStateData } from '../core/crypto.js';
import { Paths } from '../core/paths.js';
import { loadAuthFromFile } from './auth-utils.js';
import { CDPAuthManager, type CDPAuthResult } from './cdp-auth.js';

const AUTH_FILE = 'auth.json';
const MAX_IMPORT_FILE_SIZE_BYTES = 1024 * 1024;

export interface AuthStatus {
  authenticated: boolean;
  email?: string;
  expiresAt?: Date;
  csrfToken?: string;
}

export class AuthManager {
  private paths: Paths;
  private authPath: string;

  constructor() {
    this.paths = Paths.getInstance();
    this.authPath = join(this.paths.dataDir, AUTH_FILE);
  }

  async importFromFile(filePath: string): Promise<AuthTokens> {
    const validatedPath = await this.validateImportPath(filePath);
    const content = readFileSync(validatedPath, 'utf-8');

    // Try JSON format first
    try {
      const json = JSON.parse(content);
      if (Array.isArray(json)) {
        return this.parseNetscapeCookies(json);
      }
      if (json.cookies) {
        return this.parseJsonCookies(json);
      }
    } catch {
      // Not JSON, fall through to Netscape format
    }

    // Parse as Netscape cookies.txt format
    return this.parseNetscapeText(content);
  }

  async importFromNetscape(content: string): Promise<AuthTokens> {
    return this.parseNetscapeText(content);
  }

  private parseNetscapeCookies(cookies: Cookie[]): AuthTokens {
    const cookieMap: Record<string, string> = {};

    for (const cookie of cookies) {
      if (REQUIRED_COOKIES.includes(cookie.name)) {
        cookieMap[cookie.name] = cookie.value;
      }
    }

    this.validateRequiredCookies(cookieMap);

    return {
      cookies: cookieMap,
      csrfToken: '',
      extractedAt: Date.now(),
    };
  }

  private parseJsonCookies(data: { cookies: Cookie[] }): AuthTokens {
    return this.parseNetscapeCookies(data.cookies);
  }

  private parseNetscapeText(content: string): AuthTokens {
    const cookieMap: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split('\t');
      if (parts.length >= 7) {
        const name = parts[5];
        const value = parts[6];

        if (REQUIRED_COOKIES.includes(name)) {
          cookieMap[name] = value;
        }
      }
    }

    this.validateRequiredCookies(cookieMap);

    return {
      cookies: cookieMap,
      csrfToken: '',
      extractedAt: Date.now(),
    };
  }

  private validateRequiredCookies(cookies: Record<string, string>): void {
    const missing = REQUIRED_COOKIES.filter(name => !cookies[name]);

    if (missing.length > 0) {
      throw new CookieValidationError(`Missing required cookies: ${missing.join(', ')}`, missing);
    }
  }

  private async validateImportPath(filePath: string): Promise<string> {
    if (!filePath || filePath.includes('\0')) {
      throw new Error('Invalid cookies file path.');
    }

    const resolvedPath = resolve(filePath);
    const stats = await lstat(resolvedPath);

    if (stats.isSymbolicLink()) {
      throw new Error(
        'Refusing to import cookies from a symbolic link. Use a regular file instead.'
      );
    }

    if (!stats.isFile()) {
      throw new Error('Cookies import path must point to a regular file.');
    }

    if (stats.size <= 0) {
      throw new Error('Cookies file is empty.');
    }

    if (stats.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      throw new Error(
        'Cookies file is too large. Expected a small JSON or Netscape cookies export.'
      );
    }

    return resolvedPath;
  }

  async saveAuth(tokens: AuthTokens): Promise<void> {
    await mkdir(this.paths.dataDir, { recursive: true });
    const encryptionKey = requireEncryptionKeyFromEnv();
    const serialized = await serializeStateData(tokens, encryptionKey);
    await writeFile(this.authPath, serialized, { mode: 0o600 });
  }

  async loadAuth(): Promise<AuthTokens | null> {
    return loadAuthFromFile(this.authPath);
  }

  async clearAuth(): Promise<boolean> {
    try {
      await (await import('node:fs/promises')).unlink(this.authPath);
      return true;
    } catch {
      return false;
    }
  }

  async getAuthStatus(): Promise<AuthStatus> {
    const tokens = await this.loadAuth();

    if (!tokens) {
      return { authenticated: false };
    }

    const maxAgeMs = 28 * 24 * 60 * 60 * 1000;
    const isExpired = Date.now() - tokens.extractedAt > maxAgeMs;

    return {
      authenticated: !isExpired,
      csrfToken: tokens.csrfToken || undefined,
      expiresAt: new Date(tokens.extractedAt + maxAgeMs),
    };
  }

  /**
   * Authenticate using Chrome DevTools Protocol (CDP)
   * Extracts cookies from Chrome for NotebookLM authentication
   */
  async loginWithCDP(port?: number): Promise<CDPAuthResult> {
    const cdpAuth = new CDPAuthManager(port);
    const result = await cdpAuth.authenticate();

    if (!result.success || !result.tokens) {
      return result;
    }

    const client = new NotebookClient(result.tokens);
    await client.refreshCSRFToken();
    await this.saveAuth(result.tokens);

    return {
      ...result,
      tokens: result.tokens,
    };
  }
}

export function getAuthManager(): AuthManager {
  return new AuthManager();
}
