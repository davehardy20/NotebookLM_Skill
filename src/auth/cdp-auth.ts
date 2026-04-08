/**
 * Chrome DevTools Protocol (CDP) Authentication
 * Extracts cookies from Chrome using CDP for NotebookLM authentication
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PAGE_FETCH_HEADERS, REQUIRED_COOKIES } from '../api/constants.js';
import type { AuthTokens } from '../api/types.js';
import { requireEncryptionKeyFromEnv, serializeStateData } from '../core/crypto.js';
import { AuthError, TimeoutError } from '../core/errors.js';
import { logger } from '../core/logger.js';
import { Paths } from '../core/paths.js';
import { loadAuthFromFile } from './auth-utils.js';

const AUTH_FILE = 'auth.json';
const CDP_VERSION_URL = 'http://localhost:{port}/json/version';
const CDP_LIST_URL = 'http://localhost:{port}/json/list';
const NOTEBOOKLM_URL = 'https://notebooklm.google.com';
const DEFAULT_CDP_PORT = 9222;
const WS_TIMEOUT_MS = 30000;
const LOGIN_WAIT_MS = 5000;

/**
 * Validated localhost hostnames for CDP connections
 * Prevents DNS rebinding and connection hijacking attacks
 */
const ALLOWED_CDP_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '[0:0:0:0:0:0:0:1]']);

/**
 * CDP Target info from /json/list endpoint
 */
interface CDPTarget {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
  devtoolsFrontendUrl?: string;
  faviconUrl?: string;
  thumbnailUrl?: string;
}

/**
 * CDP Version info from /json/version endpoint
 */
interface CDPVersion {
  Browser: string;
  'Protocol-Version': string;
  'User-Agent': string;
  'V8-Version': string;
  'WebKit-Version': string;
  webSocketDebuggerUrl: string;
}

/**
 * CDP Cookie structure from Network.getAllCookies
 */
interface CDPCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
}

/**
 * CDP authentication result
 */
export interface CDPAuthResult {
  success: boolean;
  tokens?: AuthTokens;
  error?: string;
  needsLogin: boolean;
}

/**
 * Validates that a WebSocket URL is safe to connect to
 * Only allows connections to localhost to prevent DNS rebinding attacks
 *
 * @param wsUrl - The WebSocket URL to validate
 * @throws AuthError if URL is not localhost
 */
function validateWebSocketUrl(wsUrl: string): void {
  try {
    const url = new URL(wsUrl);

    // Only allow WebSocket protocols
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      throw new AuthError(`Invalid WebSocket protocol: ${url.protocol}`);
    }

    // Only allow localhost connections for security
    // This prevents DNS rebinding attacks where an attacker could redirect
    // to an external server
    if (!ALLOWED_CDP_HOSTS.has(url.hostname)) {
      throw new AuthError(
        `CDP WebSocket connection refused: ${url.hostname} is not localhost. ` +
          'For security, only local Chrome debugging connections are allowed.'
      );
    }

    // Validate port is in valid range (Chrome uses high ports for debugging)
    const port = parseInt(url.port, 10);
    if (isNaN(port) || port < 1024 || port > 65535) {
      throw new AuthError(`Invalid CDP port: ${url.port}`);
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(`Invalid WebSocket URL: ${error}`);
  }
}

/**
 * Manages authentication using Chrome DevTools Protocol
 * Extracts cookies from a running Chrome instance
 */
export class CDPAuthManager {
  private paths: Paths;
  private authPath: string;
  private port: number;

  constructor(port: number = DEFAULT_CDP_PORT) {
    this.paths = Paths.getInstance();
    this.authPath = join(this.paths.dataDir, AUTH_FILE);
    this.port = port;
  }

  /**
   * Check if Chrome is running with CDP enabled
   */
  async isChromeRunning(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(CDP_VERSION_URL.replace('{port}', String(this.port)), {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return false;
      }

      const version = (await response.json()) as CDPVersion;
      logger.debug('Chrome CDP available', {
        browser: version.Browser,
        protocolVersion: version['Protocol-Version'],
      });

      return true;
    } catch (error) {
      logger.debug('Chrome not running or CDP not enabled:', error);
      return false;
    }
  }

  /**
   * Find an existing NotebookLM tab or create a new one
   */
  async findOrCreateNotebookLMTarget(): Promise<CDPTarget> {
    // First, try to find an existing NotebookLM tab
    const targets = await this.listCDPTargets();

    const notebookLMTarget = targets.find(
      (target: CDPTarget) =>
        target.url.includes('notebooklm.google.com') || target.title.includes('NotebookLM')
    );

    if (notebookLMTarget) {
      logger.debug('Found existing NotebookLM tab', {
        id: notebookLMTarget.id,
        title: notebookLMTarget.title,
      });
      return notebookLMTarget;
    }

    // No existing tab, create a new one
    logger.debug('Creating new NotebookLM tab...');
    return this.createNewTab(NOTEBOOKLM_URL);
  }

  /**
   * List all CDP targets/tabs
   */
  async listCDPTargets(): Promise<CDPTarget[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(CDP_LIST_URL.replace('{port}', String(this.port)), {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new AuthError(`Failed to list CDP targets: ${response.status}`);
      }

      return (await response.json()) as CDPTarget[];
    } catch (error) {
      clearTimeout(timeout);
      throw new AuthError(`Failed to list CDP targets: ${error}`);
    }
  }

  /**
   * Create a new tab via CDP
   */
  async createNewTab(url: string): Promise<CDPTarget> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `http://localhost:${this.port}/json/new?${encodeURIComponent(url)}`,
        {
          method: 'PUT',
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        throw new AuthError(`Failed to create new tab: ${response.status}`);
      }

      const target = (await response.json()) as CDPTarget;
      logger.debug('Created new tab', { id: target.id, url: target.url });

      return target;
    } catch (error) {
      clearTimeout(timeout);
      throw new AuthError(`Failed to create new tab: ${error}`);
    }
  }

  /**
   * Connect to a CDP target via WebSocket and execute commands
   * Includes retry logic for transient failures and connection state tracking
   */
  async connectToTarget<T>(
    target: CDPTarget,
    command: (
      ws: import('ws').WebSocket,
      resolve: (value: T) => void,
      reject: (error: Error) => void
    ) => void,
    maxRetries: number = 2
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        logger.debug(`Retrying CDP connection (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }

      try {
        return await this.connectToTargetOnce(target, command);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (lastError.message.includes('not running') || lastError.message.includes('refused')) {
          throw lastError;
        }

        logger.debug(`CDP connection attempt ${attempt + 1} failed:`, lastError.message);
      }
    }

    throw lastError || new AuthError('Failed to connect to CDP after multiple attempts');
  }

  private async connectToTargetOnce<T>(
    target: CDPTarget,
    command: (
      ws: import('ws').WebSocket,
      resolve: (value: T) => void,
      reject: (error: Error) => void
    ) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const wsUrl = target.webSocketDebuggerUrl;

      // SECURITY: Validate WebSocket URL before connecting
      // This prevents DNS rebinding attacks by ensuring we only connect to localhost
      try {
        validateWebSocketUrl(wsUrl);
      } catch (error) {
        reject(error);
        return;
      }

      let isConnected = false;
      let isClosed = false;

      // Dynamically import ws for WebSocket support
      import('ws')
        .then(({ default: WebSocket }) => {
          const ws = new WebSocket(wsUrl);

          const timeout = setTimeout(() => {
            if (!isClosed) {
              isClosed = true;
              ws.terminate();
              reject(new TimeoutError('CDP WebSocket connection timed out'));
            }
          }, WS_TIMEOUT_MS);

          ws.on('open', () => {
            isConnected = true;
            logger.debug('CDP WebSocket connected');
            clearTimeout(timeout);
            command(ws, resolve, reject);
          });

          ws.on('error', (error: Error) => {
            if (!isClosed) {
              isClosed = true;
              clearTimeout(timeout);
              ws.terminate();
              reject(new AuthError(`CDP WebSocket error: ${error.message}`));
            }
          });

          ws.on('close', (code: number, _reason: Buffer) => {
            if (!isClosed) {
              isClosed = true;
              clearTimeout(timeout);
              if (!isConnected) {
                reject(new AuthError(`CDP WebSocket closed before connection (code: ${code})`));
              } else {
                logger.debug('CDP WebSocket closed');
              }
            }
          });

          ws.on('unexpected-response', (_request, response) => {
            if (!isClosed) {
              isClosed = true;
              clearTimeout(timeout);
              ws.terminate();
              reject(new AuthError(`CDP unexpected response: ${response.statusCode}`));
            }
          });
        })
        .catch(error => {
          reject(new AuthError(`Failed to load WebSocket module: ${error.message}`));
        });
    });
  }

  /**
   * Extract cookies from Chrome using CDP
   */
  async extractCookies(target: CDPTarget): Promise<Record<string, string>> {
    const cookies = await this.connectToTarget<Record<string, string>>(
      target,
      (ws, resolve, reject) => {
        const cookieMap: Record<string, string> = {};
        const messageId = 1;

        ws.on('message', (data: Buffer) => {
          try {
            const response = JSON.parse(data.toString()) as {
              error?: { message: string };
              id?: number;
              result?: { cookies?: CDPCookie[] };
            };

            if (response.error) {
              reject(new AuthError(`CDP error: ${response.error.message}`));
              ws.close();
              return;
            }

            if (response.id === messageId && response.result) {
              const cdpCookies: CDPCookie[] = response.result.cookies ?? [];

              for (const cookie of cdpCookies) {
                if (
                  cookie.domain === 'notebooklm.google.com' ||
                  cookie.domain === '.google.com' ||
                  cookie.domain === 'accounts.google.com'
                ) {
                  cookieMap[cookie.name] = cookie.value;
                }
              }

              logger.debug('Extracted Chrome cookies for NotebookLM authentication');

              ws.close();
              resolve(cookieMap);
            }
          } catch (error) {
            reject(new AuthError(`Failed to parse CDP response: ${error}`));
            ws.close();
          }
        });

        // Send Network.getCookies command
        const command = {
          id: messageId,
          method: 'Network.getAllCookies',
        };

        ws.send(JSON.stringify(command));
      }
    );

    return cookies;
  }

  /**
   * Navigate to NotebookLM and wait for user to log in
   */
  async navigateAndWaitForLogin(target: CDPTarget): Promise<boolean> {
    return this.connectToTarget<boolean>(target, (ws, resolve) => {
      let messageId = 0;
      let pageNavigated = false;

      // BUG FIX: Store timeout reference so we can clear it on success
      const navigationTimeout = setTimeout(() => {
        if (!pageNavigated) {
          ws.close();
          resolve(false);
        }
      }, WS_TIMEOUT_MS);

      ws.on('message', (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString()) as { error?: unknown; method?: string };

          if (response.error) {
            logger.debug('CDP message error:', response.error);
            return;
          }

          // Check for Page.loadEventFired
          if (response.method === 'Page.loadEventFired') {
            logger.debug('Page loaded');
            pageNavigated = true;

            // BUG FIX: Clear the timeout when navigation succeeds
            clearTimeout(navigationTimeout);

            // Give the page a moment to settle
            setTimeout(() => {
              ws.close();
              resolve(true);
            }, 2000);
          }
        } catch (error) {
          logger.debug('Failed to parse CDP message:', error);
        }
      });

      // Enable Page events
      messageId++;
      ws.send(
        JSON.stringify({
          id: messageId,
          method: 'Page.enable',
        })
      );

      // Navigate to NotebookLM
      messageId++;
      ws.send(
        JSON.stringify({
          id: messageId,
          method: 'Page.navigate',
          params: {
            url: NOTEBOOKLM_URL,
          },
        })
      );
    });
  }

  /**
   * Check if user is logged in by looking for authentication cookies
   */
  async isUserLoggedIn(target: CDPTarget): Promise<boolean> {
    const cookies = await this.extractCookies(target);
    const requiredCount = REQUIRED_COOKIES.length;
    const foundCount = REQUIRED_COOKIES.filter(name => cookies[name]).length;

    logger.debug('Checked Chrome NotebookLM authentication cookies', {
      hasRequiredCookies: foundCount >= requiredCount,
    });
    return foundCount >= 3;
  }

  async hasValidNotebookLMSession(cookies: Record<string, string>): Promise<boolean> {
    try {
      const cookieHeader = Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');

      const response = await fetch(NOTEBOOKLM_URL, {
        headers: {
          ...PAGE_FETCH_HEADERS,
          Cookie: cookieHeader,
        },
        redirect: 'follow',
      });

      return !response.url.includes('accounts.google.com');
    } catch (error) {
      logger.debug('Failed to verify NotebookLM session:', error);
      return false;
    }
  }

  /**
   * Perform full authentication flow using CDP
   */
  async authenticate(): Promise<CDPAuthResult> {
    try {
      // Step 1: Check Chrome is running
      logger.debug('Checking Chrome CDP availability...');
      const isRunning = await this.isChromeRunning();
      if (!isRunning) {
        return {
          success: false,
          error:
            `Chrome is not running with remote debugging on port ${this.port}.\n` +
            'Please start Chrome with:\n' +
            `  chrome --remote-debugging-port=${this.port}\n` +
            'Or on macOS:\n' +
            `  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${this.port}`,
          needsLogin: false,
        };
      }

      // Step 2: Find a target to use
      logger.debug('Finding CDP target...');
      const target = await this.findOrCreateNotebookLMTarget();

      // Step 3: Check if already logged in
      logger.debug('Checking if user is logged in...');
      let isLoggedIn = await this.isUserLoggedIn(target);
      let attemptedInteractiveLogin = false;

      if (!isLoggedIn) {
        attemptedInteractiveLogin = true;
        // Step 4: Navigate to NotebookLM and wait for login
        logger.info('Not logged in. Navigating to NotebookLM...');
        console.log('\nPlease log in to NotebookLM in the Chrome window that opens.');
        console.log('Waiting for you to complete login...\n');

        const navigated = await this.navigateAndWaitForLogin(target);
        if (!navigated) {
          return {
            success: false,
            error: 'Failed to navigate to NotebookLM. Please check your Chrome connection.',
            needsLogin: true,
          };
        }

        // Wait for user to log in
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes total (60 * 5 seconds)

        while (!isLoggedIn && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, LOGIN_WAIT_MS));
          isLoggedIn = await this.isUserLoggedIn(target);
          attempts++;

          if (!isLoggedIn && attempts % 6 === 0) {
            console.log(`Still waiting for login... (${(attempts * 5) / 60} minutes)`);
          }
        }

        if (!isLoggedIn) {
          return {
            success: false,
            error: 'Login timeout. Please try again and complete the login within 5 minutes.',
            needsLogin: true,
          };
        }

        console.log('\n✓ Login detected!');
      } else {
        console.log('\n✓ Already logged in to NotebookLM');
      }

      // Step 5: Extract all cookies
      logger.debug('Extracting cookies...');
      let cookies = await this.extractCookies(target);

      // Validate we have the required cookies
      const missing = REQUIRED_COOKIES.filter(name => !cookies[name]);
      if (missing.length > 0) {
        return {
          success: false,
          error:
            `Missing required cookies: ${missing.join(', ')}.\n` +
            'Please ensure you are fully logged in to NotebookLM.',
          needsLogin: false,
        };
      }

      let hasValidSession = await this.hasValidNotebookLMSession(cookies);

      if (!hasValidSession && !attemptedInteractiveLogin) {
        attemptedInteractiveLogin = true;
        logger.info('Cookies exist but NotebookLM session is invalid. Prompting for login...');
        console.log(
          '\nYour Chrome profile has stale Google cookies. Please complete login in the Chrome window.'
        );

        const navigated = await this.navigateAndWaitForLogin(target);
        if (!navigated) {
          return {
            success: false,
            error: 'Failed to navigate to NotebookLM. Please check your Chrome connection.',
            needsLogin: true,
          };
        }

        let attempts = 0;
        const maxAttempts = 60;

        while (!hasValidSession && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, LOGIN_WAIT_MS));
          cookies = await this.extractCookies(target);
          hasValidSession = await this.hasValidNotebookLMSession(cookies);
          attempts++;
        }
      }

      if (!hasValidSession) {
        return {
          success: false,
          error: 'NotebookLM login was not completed in Chrome. Please sign in and try again.',
          needsLogin: true,
        };
      }

      // Step 6: Create AuthTokens
      const tokens: AuthTokens = {
        cookies,
        csrfToken: '',
        extractedAt: Date.now(),
      };

      // Step 7: Save auth
      await this.saveAuth(tokens);

      return {
        success: true,
        tokens,
        needsLogin: false,
      };
    } catch (error) {
      logger.error('CDP authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during authentication',
        needsLogin: false,
      };
    }
  }

  /**
   * Save authentication tokens to file
   */
  async saveAuth(tokens: AuthTokens): Promise<void> {
    await mkdir(this.paths.dataDir, { recursive: true });
    const encryptionKey = requireEncryptionKeyFromEnv();
    const serialized = serializeStateData(tokens, encryptionKey);
    await writeFile(this.authPath, serialized, { mode: 0o600 });
  }

  /**
   * Load authentication tokens from file
   */
  async loadAuth(): Promise<AuthTokens | null> {
    return loadAuthFromFile(this.authPath);
  }

  /**
   * Get CDP connection instructions for the user
   */
  getInstructions(): string {
    return `
To use CDP authentication, Chrome must be running with remote debugging enabled.

Start Chrome with:
  Linux:   google-chrome --remote-debugging-port=${this.port}
  macOS:   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${this.port}
  Windows: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=${this.port}

Then run: notebooklm auth login
`;
  }
}

/**
 * Get a CDP auth manager instance
 */
export function getCDPAuthManager(port?: number): CDPAuthManager {
  return new CDPAuthManager(port);
}
