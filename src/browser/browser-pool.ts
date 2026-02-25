/**
 * Browser Pool Module for NotebookLM TypeScript Skill
 * Manages persistent browser sessions for performance optimization.
 *
 * This module provides session reuse capabilities that eliminate the 3-5 second
 * browser launch overhead per query by keeping contexts alive between questions.
 * Async-first implementation with Playwright.
 */

import { createHash } from 'node:crypto';
import type { BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { AuthError, BrowserError } from '../core/errors.js';
import { createChildLogger } from '../core/logger.js';
import { Paths } from '../core/paths.js';
import { BrowserFactory, setupResourceBlocking } from './browser-utils.js';
import { QUERY_INPUT_SELECTORS } from './selectors.js';

const logger = createChildLogger('BrowserPool');

/** Default idle timeout in milliseconds (15 minutes) */
const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** Default navigation timeout in milliseconds */
const DEFAULT_NAVIGATION_TIMEOUT = 30000;

/** Default page timeout in milliseconds */
const DEFAULT_PAGE_TIMEOUT = 10000;

/**
 * Error thrown when authentication has expired
 */
export class AuthExpiredError extends AuthError {
  constructor(message: string = 'Session authentication expired') {
    super(message);
    this.code = 'AUTH_EXPIRED';
    this.statusCode = 401;
    Object.setPrototypeOf(this, AuthExpiredError.prototype);
  }
}

/**
 * Error thrown when browser context crashes
 */
export class BrowserCrashedError extends BrowserError {
  constructor(message: string = 'Browser context crashed') {
    super(message);
    this.code = 'BROWSER_CRASHED';
    Object.setPrototypeOf(this, BrowserCrashedError.prototype);
  }
}

/**
 * Statistics for a single session
 */
export interface SessionStats {
  id: string;
  url: string;
  idleSeconds: number;
  initialized: boolean;
}

/**
 * Statistics for the entire pool
 */
export interface PoolStats {
  activeSessions: number;
  sessions: SessionStats[];
}

/**
 * Manages a persistent NotebookLM session with automatic cleanup.
 * Each session maintains a single browser context and page for a specific notebook URL.
 */
export class NotebookLMSession {
  /** Unique session identifier (MD5 hash of notebook URL) */
  readonly id: string;

  /** Notebook URL this session is associated with */
  notebookUrl: string;

  /** Whether to run browser in headless mode */
  readonly headless: boolean;

  /** Idle timeout in milliseconds */
  readonly idleTimeoutMs: number;

  private _context: BrowserContext | null = null;
  private _page: Page | null = null;
  private _lastUsed: number;
  private _initialized = false;
  private _initializationPromise: Promise<void> | null = null;

  /**
   * Create a new NotebookLM session
   * @param notebookUrl - The notebook URL to associate with this session
   * @param headless - Whether to run browser in headless mode (default: true)
   * @param idleTimeoutMs - Idle timeout in milliseconds (default: 15 minutes)
   */
  constructor(
    notebookUrl: string,
    headless: boolean = true,
    idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS
  ) {
    this.notebookUrl = notebookUrl;
    this.headless = headless;
    this.idleTimeoutMs = idleTimeoutMs;
    this.id = this._generateSessionId(notebookUrl);
    this._lastUsed = Date.now();
  }

  /**
   * Generate a unique session ID from notebook URL
   * Uses MD5 hash for consistency with response cache
   */
  private _generateSessionId(url: string): string {
    return createHash('md5').update(url).digest('hex').substring(0, 8);
  }

  /**
   * Lazy initialization - called on first use.
   * Creates browser context, page, and navigates to notebook.
   * Thread-safe via promise-based locking.
   */
  async initialize(): Promise<void> {
    // Return immediately if already initialized
    if (this._initialized) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this._initializationPromise) {
      return this._initializationPromise;
    }

    // Start initialization
    this._initializationPromise = this._doInitialization();

    try {
      await this._initializationPromise;
    } finally {
      this._initializationPromise = null;
    }
  }

  /**
   * Actual initialization logic
   */
  private async _doInitialization(): Promise<void> {
    logger.debug(`Initializing session ${this.id}`, { url: this.notebookUrl });

    try {
      const paths = Paths.getInstance();

      // Launch persistent browser context
      this._context = await BrowserFactory.launchPersistentContext(
        chromium,
        paths.browserProfileDir,
        this.headless
      );

      // Create new page
      this._page = await this._context.newPage();

      // Optimize page for speed
      setupResourceBlocking(this._page);
      this._page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT);
      this._page.setDefaultNavigationTimeout(DEFAULT_NAVIGATION_TIMEOUT);

      // Navigate once and keep warm
      await this._page.goto(this.notebookUrl, { waitUntil: 'domcontentloaded' });
      await this._waitForReady();

      this._initialized = true;
      this._lastUsed = Date.now();

      logger.info(`Session ${this.id} initialized successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize session ${this.id}`, { error: message });

      // Clean up on failure
      await this.close();

      throw new BrowserError(`Failed to initialize session: ${message}`);
    }
  }

  /**
   * Wait for NotebookLM to be ready by checking for query input
   */
  private async _waitForReady(): Promise<void> {
    if (!this._page) {
      throw new BrowserError('Page not initialized');
    }

    for (const selector of QUERY_INPUT_SELECTORS) {
      try {
        await this._page.waitForSelector(selector, {
          timeout: 10000,
          state: 'visible',
        });
        return;
      } catch {
        /* continue to next selector */
      }
    }

    throw new BrowserError('NotebookLM not ready - query input not found');
  }

  /**
   * Get or initialize the page.
   * Updates last used timestamp.
   */
  async getPage(): Promise<Page> {
    if (!this._initialized) {
      await this.initialize();
    }

    if (!this._page) {
      throw new BrowserError('Page not available');
    }

    this._lastUsed = Date.now();
    return this._page;
  }

  /**
   * Check if we need to navigate to a different notebook.
   * Returns true if navigation occurred.
   */
  async resetIfNeeded(notebookUrl: string): Promise<boolean> {
    if (notebookUrl !== this.notebookUrl) {
      logger.debug(`Navigating to new notebook URL`, {
        from: this.notebookUrl,
        to: notebookUrl,
      });

      this.notebookUrl = notebookUrl;

      if (this._page) {
        await this._page.goto(notebookUrl, { waitUntil: 'domcontentloaded' });
        await this._waitForReady();
      }

      return true;
    }
    return false;
  }

  /**
   * Check if session is still authenticated.
   * Validates by checking URL doesn't redirect to Google accounts.
   */
  async validateAuth(): Promise<boolean> {
    if (!this._page) {
      return false;
    }

    try {
      const currentUrl = this._page.url();

      // Quick check - if we're on accounts.google.com, auth expired
      if (currentUrl.includes('accounts.google.com')) {
        logger.warn('Auth validation failed - on Google accounts page');
        return false;
      }

      // Navigate to NotebookLM and check if we get redirected
      await this._page.goto('https://notebooklm.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 5000,
      });

      const newUrl = this._page.url();
      const isAuthenticated = !newUrl.includes('accounts.google.com');

      if (!isAuthenticated) {
        logger.warn('Auth validation failed - redirected to Google accounts');
      }

      return isAuthenticated;
    } catch (error) {
      logger.warn('Auth validation error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Validate auth and throw if expired
   */
  async ensureAuthenticated(): Promise<void> {
    const isValid = await this.validateAuth();
    if (!isValid) {
      throw new AuthExpiredError();
    }
  }

  /**
   * Check if session has been idle too long
   */
  isExpired(): boolean {
    return Date.now() - this._lastUsed > this.idleTimeoutMs;
  }

  /**
   * Get idle time in milliseconds
   */
  getIdleTimeMs(): number {
    return Date.now() - this._lastUsed;
  }

  /**
   * Soft reset - clear page state without closing browser.
   * Clears storage and reloads page.
   */
  async softReset(): Promise<void> {
    if (!this._page) {
      return;
    }

    logger.debug(`Performing soft reset on session ${this.id}`);

    try {
      await this._page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage.clear();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).sessionStorage.clear();
      });
      // Reload page
      await this._page.reload({ waitUntil: 'domcontentloaded' });
      await this._waitForReady();

      this._lastUsed = Date.now();

      logger.debug(`Soft reset completed for session ${this.id}`);
    } catch (error) {
      logger.warn(`Soft reset failed for session ${this.id}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clean up resources and close browser context
   */
  async close(): Promise<void> {
    logger.debug(`Closing session ${this.id}`);

    try {
      if (this._context) {
        await this._context.close();
        this._context = null;
      }
    } catch (error) {
      logger.warn(`Error closing context for session ${this.id}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this._page = null;
    this._initialized = false;
    this._initializationPromise = null;
  }

  /**
   * Get current session statistics
   */
  getStats(): SessionStats {
    return {
      id: this.id,
      url: this.notebookUrl,
      idleSeconds: Math.floor(this.getIdleTimeMs() / 1000),
      initialized: this._initialized,
    };
  }
}

/**
 * Manages multiple persistent NotebookLM sessions.
 * Implements singleton pattern for global access.
 */
export class SessionPool {
  private static _instance: SessionPool | null = null;
  private _sessions: Map<string, NotebookLMSession>;
  private _idleTimeoutMs: number;

  /**
   * Private constructor - use getInstance() or getPool() instead
   */
  private constructor(idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS) {
    this._sessions = new Map();
    this._idleTimeoutMs = idleTimeoutMs;
  }

  /**
   * Get the singleton SessionPool instance
   */
  static getInstance(idleTimeoutMs?: number): SessionPool {
    if (!SessionPool._instance) {
      SessionPool._instance = new SessionPool(idleTimeoutMs);
    }
    return SessionPool._instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  static resetInstance(): void {
    SessionPool._instance = null;
  }

  /**
   * Generate session key from notebook URL and headless mode
   */
  private _getSessionKey(notebookUrl: string, headless: boolean): string {
    return `${notebookUrl}:${headless}`;
  }

  /**
   * Get or create a session for the given notebook URL.
   * Validates auth before returning existing sessions.
   */
  async getSession(notebookUrl: string, headless: boolean = true): Promise<NotebookLMSession> {
    const sessionKey = this._getSessionKey(notebookUrl, headless);

    // Check if session exists
    let session = this._sessions.get(sessionKey);

    if (!session) {
      // Create new session
      logger.debug(`Creating new session for ${notebookUrl}`);
      session = new NotebookLMSession(notebookUrl, headless, this._idleTimeoutMs);
      this._sessions.set(sessionKey, session);
    } else {
      logger.debug(`Reusing existing session ${session.id}`);

      // Validate auth before returning
      const isValid = await session.validateAuth();
      if (!isValid) {
        logger.warn(`Session ${session.id} auth invalid, recreating`);
        await session.close();

        // Create new session
        session = new NotebookLMSession(notebookUrl, headless, this._idleTimeoutMs);
        this._sessions.set(sessionKey, session);
      }
    }

    // Ensure we're on the right notebook URL
    await session.resetIfNeeded(notebookUrl);

    return session;
  }

  /**
   * Remove expired sessions to free memory.
   * Sessions idle longer than timeout are closed and removed.
   */
  async cleanupExpired(): Promise<number> {
    const expired: string[] = [];

    for (const [key, session] of this._sessions.entries()) {
      if (session.isExpired()) {
        expired.push(key);
      }
    }

    // Close and remove expired sessions
    for (const key of expired) {
      const session = this._sessions.get(key);
      if (session) {
        logger.debug(`Cleaning up expired session ${session.id}`);
        await session.close();
        this._sessions.delete(key);
      }
    }

    if (expired.length > 0) {
      logger.info(`Cleaned up ${expired.length} expired sessions`);
    }

    return expired.length;
  }

  /**
   * Close all sessions and clear the pool
   */
  async closeAll(): Promise<void> {
    logger.info(`Closing all ${this._sessions.size} sessions`);

    const closePromises: Promise<void>[] = [];

    for (const session of this._sessions.values()) {
      closePromises.push(session.close());
    }

    // Wait for all sessions to close
    await Promise.all(closePromises);

    this._sessions.clear();

    logger.info('All sessions closed');
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const sessions: SessionStats[] = [];

    for (const session of this._sessions.values()) {
      sessions.push(session.getStats());
    }

    return {
      activeSessions: this._sessions.size,
      sessions,
    };
  }

  /**
   * Get the number of active sessions
   */
  get size(): number {
    return this._sessions.size;
  }
}

/** Global session pool instance */
export const sessionPool = SessionPool.getInstance();

/**
 * Convenience function to get the global session pool
 */
export function getPool(): SessionPool {
  return sessionPool;
}

/**
 * Setup cleanup handlers to prevent zombie Chrome processes
 */
export function setupCleanupHandlers(): void {
  let isCleaningUp = false;

  /**
   * Perform cleanup
   */
  async function cleanup(): Promise<void> {
    if (isCleaningUp) {
      return;
    }

    isCleaningUp = true;

    try {
      logger.info('Cleaning up browser sessions...');
      await sessionPool.closeAll();
      logger.info('Cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Sync cleanup on exit
  process.on('exit', () => {
    logger.info('Process exiting, performing sync cleanup');
    // Note: Can't use async here, but context close is best effort anyway
    sessionPool.closeAll().catch(() => {
      // Ignore errors during exit
    });
  });

  // Async cleanup on SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    void (async () => {
      logger.info('Received SIGINT, cleaning up...');
      await cleanup();
      process.exit(0);
    })();
  });

  // Async cleanup on SIGTERM
  process.on('SIGTERM', () => {
    void (async () => {
      logger.info('Received SIGTERM, cleaning up...');
      await cleanup();
      process.exit(0);
    })();
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', error => {
    logger.error('Uncaught exception', {
      error: error instanceof Error ? error.message : String(error),
    });
    void cleanup().then(() => process.exit(1));
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    const errorMessage =
      reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
    logger.error('Unhandled rejection', {
      error: errorMessage,
      reasonType: typeof reason,
      promise: String(promise),
    });
    console.error('Unhandled Rejection:', errorMessage);
    void cleanup().then(() => process.exit(1));
  });

  logger.debug('Cleanup handlers registered');
}

// Setup cleanup handlers on module import
setupCleanupHandlers();
