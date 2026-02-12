/**
 * Authentication Manager for NotebookLM TypeScript Skill
 * Handles Google login and browser state persistence
 * Based on the MCP server implementation
 *
 * Implements hybrid auth approach:
 * - Persistent browser profile (userDataDir) for fingerprint consistency
 * - Manual cookie injection from state.json for session cookies (Playwright bug workaround)
 * See: https://github.com/microsoft/playwright/issues/36139
 *
 * Async-first implementation with Playwright
 */

import { existsSync } from 'fs';
import { readFile, writeFile, stat, unlink, rm } from 'fs/promises';
import { chromium, type BrowserContext } from 'playwright';
import { AuthInfoSchema, type AuthInfo } from '../types/auth.js';
import { AuthError, BrowserError } from '../core/errors.js';
import { createChildLogger } from '../core/logger.js';
import { Paths } from '../core/paths.js';
import { BrowserFactory } from './browser-utils.js';

const logger = createChildLogger('AuthManager');

/**
 * Interface for auth info file structure
 */
interface AuthInfoFile {
  authenticatedAt: number;
  authenticatedAtIso: string;
}

/**
 * Manages authentication and browser state for NotebookLM
 *
 * Features:
 * - Interactive Google login
 * - Browser state persistence
 * - Session restoration
 * - Account switching
 *
 * Uses singleton pattern for consistent auth state
 */
export class AuthManager {
  private static instance: AuthManager | null = null;

  private paths: Paths;
  private stateFile: string;
  private authInfoFile: string;
  private browserStateDir: string;

  /**
   * Private constructor - use getInstance() or getAuthManager()
   */
  private constructor() {
    this.paths = Paths.getInstance();
    this.stateFile = this.paths.stateFile;
    this.authInfoFile = this.paths.authInfoFile;
    this.browserStateDir = this.paths.browserStateDir;

    logger.debug('AuthManager initialized', {
      stateFile: this.stateFile,
      authInfoFile: this.authInfoFile,
      browserStateDir: this.browserStateDir,
    });
  }

  /**
   * Get the singleton instance of AuthManager
   */
  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    AuthManager.instance = null;
  }

  /**
   * Check if valid authentication exists
   * Validates state file existence and age (warns if > 7 days)
   */
  async isAuthenticated(): Promise<boolean> {
    // Check if state file exists
    if (!existsSync(this.stateFile)) {
      logger.debug('State file does not exist', { stateFile: this.stateFile });
      return false;
    }

    try {
      // Check if state file is not too old (7 days)
      const stats = await stat(this.stateFile);
      const ageDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

      if (ageDays > 7) {
        logger.warn(`Browser state is ${ageDays.toFixed(1)} days old, may need re-authentication`);
      }

      return true;
    } catch (error) {
      logger.warn('Could not stat state file', {
        stateFile: this.stateFile,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get authentication information
   * Returns structured auth info including state file age and last auth time
   */
  async getAuthInfo(): Promise<AuthInfo> {
    const authenticated = await this.isAuthenticated();

    const info: AuthInfo = {
      authenticated,
      stateFile: this.stateFile,
      stateExists: existsSync(this.stateFile),
      stateAgeHours: null,
      authenticatedAtIso: null,
    };

    // Load saved auth info if exists
    if (existsSync(this.authInfoFile)) {
      try {
        const content = await readFile(this.authInfoFile, 'utf-8');
        const savedInfo: AuthInfoFile = JSON.parse(content);
        info.authenticatedAtIso = savedInfo.authenticatedAtIso;
      } catch (error) {
        logger.warn('Could not parse auth info file', {
          authInfoFile: this.authInfoFile,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Calculate state file age
    if (info.stateExists) {
      try {
        const stats = await stat(this.stateFile);
        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        info.stateAgeHours = ageHours;
      } catch {
        // Non-critical, ignore errors
      }
    }

    // Validate and return
    return AuthInfoSchema.parse(info);
  }

  /**
   * Perform interactive authentication setup
   *
   * @param headless - Run browser in headless mode (false for login)
   * @param timeoutMinutes - Maximum time to wait for login
   * @returns True if authentication successful
   */
  async setupAuth(
    headless: boolean = false,
    timeoutMinutes: number = 10
  ): Promise<boolean> {
    logger.info('Starting authentication setup...', {
      headless,
      timeoutMinutes,
    });

    // Use non-headless for login (user needs to interact)
    const launchHeadless = headless && false; // Force false for interactive login

    try {
      // Launch persistent browser context using factory
      const context = await BrowserFactory.launchPersistentContext(
        chromium,
        this.paths.browserProfileDir,
        launchHeadless
      );

      try {
        // Navigate to NotebookLM
        const page = await context.newPage();
        await page.goto('https://notebooklm.google.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        // Check if already authenticated
        const url = page.url();
        if (url.includes('notebooklm.google.com') && !url.includes('accounts.google.com')) {
          logger.info('Already authenticated!');
          await this._saveBrowserState(context);
          return true;
        }

        // Wait for manual login
        logger.info('Please log in to your Google account...');
        logger.info(`Waiting up to ${timeoutMinutes} minutes for login...`);

        try {
          // Wait for URL to change to NotebookLM (ensures it's the actual domain)
          await page.waitForURL(/^https:\/\/notebooklm\.google\.com\//, {
            timeout: timeoutMinutes * 60 * 1000,
          });

          logger.info('Login successful!');

          // Save authentication state
          await this._saveBrowserState(context);
          await this._saveAuthInfo();

          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Authentication timeout', { error: message });
          return false;
        }
      } finally {
        // Clean up browser context
        await context.close().catch((error) => {
          logger.warn('Error closing browser context', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during authentication setup', { error: message });
      throw new BrowserError(`Authentication setup failed: ${message}`);
    }
  }

  /**
   * Save browser state to disk
   * Persists storage state (cookies, localStorage) for session restoration
   */
  private async _saveBrowserState(context: BrowserContext): Promise<void> {
    try {
      // Save storage state (cookies, localStorage)
      const state = await context.storageState();
      await writeFile(this.stateFile, JSON.stringify(state, null, 2));
      logger.info('Saved browser state', { stateFile: this.stateFile });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to save browser state', { error: message });
      throw new AuthError(`Failed to save browser state: ${message}`);
    }
  }

  /**
   * Save authentication metadata
   * Records timestamp of successful authentication
   */
  private async _saveAuthInfo(): Promise<void> {
    try {
      const info: AuthInfoFile = {
        authenticatedAt: Date.now(),
        authenticatedAtIso: new Date().toISOString(),
      };
      await writeFile(this.authInfoFile, JSON.stringify(info, null, 2));
      logger.debug('Saved auth info', { authInfoFile: this.authInfoFile });
    } catch (error) {
      // Non-critical, just log the error
      logger.warn('Could not save auth info', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clear all authentication data
   * Removes state file, auth info, and browser profile directory
   *
   * @returns True if cleared successfully
   */
  async clearAuth(): Promise<boolean> {
    logger.info('Clearing authentication data...');

    try {
      // Remove browser state file
      if (existsSync(this.stateFile)) {
        await unlink(this.stateFile);
        logger.info('Removed browser state file', { stateFile: this.stateFile });
      }

      // Remove auth info file
      if (existsSync(this.authInfoFile)) {
        await unlink(this.authInfoFile);
        logger.info('Removed auth info file', { authInfoFile: this.authInfoFile });
      }

      // Clear entire browser state directory
      if (existsSync(this.browserStateDir)) {
        await rm(this.browserStateDir, { recursive: true, force: true });
        logger.info('Cleared browser state directory', { browserStateDir: this.browserStateDir });
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error clearing auth', { error: message });
      return false;
    }
  }

  /**
   * Perform re-authentication (clear and setup)
   *
   * @param headless - Run browser in headless mode
   * @param timeoutMinutes - Login timeout in minutes
   * @returns True if successful
   */
  async reAuth(
    headless: boolean = false,
    timeoutMinutes: number = 10
  ): Promise<boolean> {
    logger.info('Starting re-authentication...');

    // Clear existing auth
    await this.clearAuth();

    // Setup new auth
    return this.setupAuth(headless, timeoutMinutes);
  }

  /**
   * Validate that stored authentication works
   * Uses persistent context to match actual usage pattern
   *
   * @returns True if authentication is valid
   */
  async validateAuth(): Promise<boolean> {
    const authenticated = await this.isAuthenticated();
    if (!authenticated) {
      logger.info('No authentication found to validate');
      return false;
    }

    logger.info('Validating authentication...');

    try {
      // Launch persistent context using factory
      const context = await BrowserFactory.launchPersistentContext(
        chromium,
        this.paths.browserProfileDir,
        true // headless for validation
      );

      try {
        // Try to access NotebookLM
        const page = await context.newPage();
        await page.goto('https://notebooklm.google.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        // Check if we can access NotebookLM
        const url = page.url();
        if (url.includes('notebooklm.google.com') && !url.includes('accounts.google.com')) {
          logger.info('Authentication is valid');
          return true;
        } else {
          logger.warn('Authentication is invalid (redirected to login)');
          return false;
        }
      } finally {
        // Clean up
        await context.close().catch((error) => {
          logger.warn('Error closing browser context', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Validation failed', { error: message });
      return false;
    }
  }
}

/**
 * Get the global AuthManager instance (convenience function)
 */
export function getAuthManager(): AuthManager {
  return AuthManager.getInstance();
}

/**
 * Reset the global AuthManager instance (useful for testing)
 */
export function resetAuthManager(): void {
  AuthManager.resetInstance();
}
