/**
 * Chrome DevTools Protocol (CDP) Authentication
 * Extracts cookies from Chrome using CDP for NotebookLM authentication
 */

import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PAGE_FETCH_HEADERS, REQUIRED_COOKIES } from '../api/constants.js';
import type { AuthTokens } from '../api/types.js';
import { AuthError, TimeoutError } from '../core/errors.js';
import { logger } from '../core/logger.js';
import { Paths } from '../core/paths.js';

const AUTH_FILE = 'auth.json';
const CDP_VERSION_URL = 'http://localhost:{port}/json/version';
const CDP_LIST_URL = 'http://localhost:{port}/json/list';
const NOTEBOOKLM_URL = 'https://notebooklm.google.com';
const DEFAULT_CDP_PORT = 9222;
const WS_TIMEOUT_MS = 30000;
const LOGIN_WAIT_MS = 5000;

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
 * CDP Cookie object from Network.getCookies response
 */
interface CDPCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  size: number;
  httpOnly: boolean;
  secure: boolean;
  session: boolean;
  priority: string;
  sameParty: boolean;
  sourceScheme: string;
  sourcePort: number;
  partitionKey?: string;
  partitionKeyOpaque?: boolean;
}

/**
 * Result from CDP authentication attempt
 */
export interface CDPAuthResult {
  success: boolean;
  tokens?: AuthTokens;
  error?: string;
  needsLogin?: boolean;
}

/**
 * Chrome DevTools Protocol Authentication Manager
 * Connects to Chrome via CDP and extracts cookies for NotebookLM
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
   * Check if Chrome is running with remote debugging enabled
   */
  async isChromeRunning(): Promise<boolean> {
    try {
      const versionUrl = CDP_VERSION_URL.replace('{port}', String(this.port));
      const response = await fetch(versionUrl, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get Chrome version information
   */
  async getChromeVersion(): Promise<CDPVersion | null> {
    try {
      const versionUrl = CDP_VERSION_URL.replace('{port}', String(this.port));
      const response = await fetch(versionUrl, { method: 'GET' });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as CDPVersion;
    } catch (error) {
      logger.debug('Failed to get Chrome version:', error);
      return null;
    }
  }

  /**
   * Get list of available CDP targets (pages)
   */
  async getTargets(): Promise<CDPTarget[]> {
    const listUrl = CDP_LIST_URL.replace('{port}', String(this.port));
    const response = await fetch(listUrl, { method: 'GET' });
    if (!response.ok) {
      throw new AuthError(`Failed to get CDP targets: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as CDPTarget[];
  }

  /**
   * Find a target that matches NotebookLM or create a new one
   */
  async findOrCreateNotebookLMTarget(): Promise<CDPTarget> {
    const targets = await this.getTargets();

    // First, look for an existing NotebookLM page
    const notebookLMTarget = targets.find(
      t => t.url.includes('notebooklm.google.com') || t.title.includes('NotebookLM')
    );

    if (notebookLMTarget) {
      logger.debug('Found existing NotebookLM target:', notebookLMTarget.id);
      return notebookLMTarget;
    }

    // Look for any page we can use
    const usableTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);

    if (usableTarget) {
      logger.debug('Using existing page target:', usableTarget.id);
      return usableTarget;
    }

    throw new AuthError('No usable Chrome pages found. Please open a tab in Chrome and try again.');
  }

  /**
   * Connect to a CDP target via WebSocket and execute commands
   */
  async connectToTarget<T>(
    target: CDPTarget,
    command: (
      ws: import('ws').WebSocket,
      resolve: (value: T) => void,
      reject: (error: Error) => void
    ) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const wsUrl = target.webSocketDebuggerUrl;

      // Dynamically import ws for WebSocket support
      import('ws')
        .then(({ default: WebSocket }) => {
          const ws = new WebSocket(wsUrl);
          const timeout = setTimeout(() => {
            ws.close();
            reject(new TimeoutError('CDP WebSocket connection timed out'));
          }, WS_TIMEOUT_MS);

          ws.on('open', () => {
            logger.debug('CDP WebSocket connected');
            clearTimeout(timeout);
            command(ws, resolve, reject);
          });

          ws.on('error', (error: Error) => {
            clearTimeout(timeout);
            reject(new AuthError(`CDP WebSocket error: ${error.message}`));
          });

          ws.on('close', () => {
            logger.debug('CDP WebSocket closed');
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
              const cdpCookies: CDPCookie[] = response.result.cookies || [];

              for (const cookie of cdpCookies) {
                if (
                  cookie.domain === 'notebooklm.google.com' ||
                  cookie.domain === '.google.com' ||
                  cookie.domain === 'accounts.google.com'
                ) {
                  cookieMap[cookie.name] = cookie.value;
                  logger.debug(`Found cookie: ${cookie.name}`);
                }
              }

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

      // Set a timeout for navigation
      setTimeout(() => {
        if (!pageNavigated) {
          ws.close();
          resolve(false);
        }
      }, WS_TIMEOUT_MS);
    });
  }

  /**
   * Check if user is logged in by looking for authentication cookies
   */
  async isUserLoggedIn(target: CDPTarget): Promise<boolean> {
    const cookies = await this.extractCookies(target);
    const requiredCount = REQUIRED_COOKIES.length;
    const foundCount = REQUIRED_COOKIES.filter(name => cookies[name]).length;

    logger.debug(`Found ${foundCount}/${requiredCount} required cookies`);
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
    await writeFile(this.authPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  }

  /**
   * Load authentication tokens from file
   */
  async loadAuth(): Promise<AuthTokens | null> {
    try {
      const content = readFileSync(this.authPath, 'utf-8');
      return JSON.parse(content) as AuthTokens;
    } catch {
      return null;
    }
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
