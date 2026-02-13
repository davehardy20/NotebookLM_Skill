/**
 * Browser Utilities for NotebookLM TypeScript Skill
 * Handles browser launching, stealth features, resource blocking, and response detection
 * Async-first implementation with Playwright
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { BrowserContext, Page, Route, Request, BrowserType } from 'playwright';
import { BrowserError, TimeoutError } from '../core/errors.js';
import { createChildLogger } from '../core/logger.js';
import { parseStateData } from '../core/crypto.js';
import {
  BLOCKED_PATTERNS,
  ALWAYS_BLOCKED_RESOURCE_TYPES,
  BROWSER_ARGS,
  USER_AGENT,
  THINKING_SELECTOR,
  RESPONSE_SELECTORS,
} from './selectors.js';

const logger = createChildLogger('BrowserUtils');

/**
 * Interface for browser state (cookies, localStorage, etc.)
 */
interface BrowserState {
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  origins?: unknown[];
}

/**
 * Factory for creating configured browser contexts with anti-detection features
 */
export class BrowserFactory {
  /**
   * Launch a persistent browser context with anti-detection features
   * and cookie workaround for Playwright bug #36139
   *
   * Uses playwright.chromium.launchPersistentContext for true persistence
   * (like Python implementation)
   */
  static async launchPersistentContext(
    chromium: BrowserType,
    userDataDir: string,
    headless: boolean = true
  ): Promise<BrowserContext> {
    logger.debug('Launching persistent browser context', { userDataDir, headless });

    try {
      if (!existsSync(userDataDir)) {
        await mkdir(userDataDir, { recursive: true });
        logger.debug('Created user data directory', { userDataDir });
      }

      const context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless,
        viewport: null,
        ignoreDefaultArgs: ['--enable-automation'],
        userAgent: USER_AGENT,
        args: [...BROWSER_ARGS],
      });

      // Cookie Workaround for Playwright bug #36139
      // Session cookies (expires=-1) don't persist in user_data_dir automatically
      await BrowserFactory.injectCookies(context, userDataDir);

      logger.debug('Browser context launched successfully');
      return context;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to launch browser context', { error: message });
      throw new BrowserError(`Failed to launch browser context: ${message}`);
    }
  }

  /**
   * Inject cookies from state.json if available
   * Workaround for Playwright bug #36139
   */
  private static async injectCookies(context: BrowserContext, userDataDir: string): Promise<void> {
    const stateFile = join(dirname(userDataDir), 'state.json');

    if (!existsSync(stateFile)) {
      logger.debug('State file not found, skipping cookie injection', { stateFile });
      return;
    }

    try {
      const stateContent = await readFile(stateFile, 'utf-8');
      const state = parseStateData(stateContent) as BrowserState;

      if (state.cookies && state.cookies.length > 0) {
        const now = Date.now() / 1000;
        const validCookies = state.cookies.filter(cookie => {
          if (!cookie.expires || cookie.expires === -1) {
            return true;
          }
          return cookie.expires > now;
        });

        const expiredCount = state.cookies.length - validCookies.length;
        if (expiredCount > 0) {
          logger.debug(`Filtered out ${expiredCount} expired cookies`);
        }

        if (validCookies.length === 0) {
          logger.warn('No valid cookies found (all expired), skipping injection');
          return;
        }

        await context.addCookies(validCookies);
        logger.debug('Injected cookies from state.json', {
          count: validCookies.length,
          total: state.cookies.length,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Could not load state.json for cookie injection', { error: message });

      if (message.includes('STATE_ENCRYPTION_KEY')) {
        logger.error(
          'Encrypted state file found but STATE_ENCRYPTION_KEY is not set. ' +
            'Please set the encryption key to decrypt browser state.'
        );
      }
    }
  }

  /**
   * Save browser context state (cookies, storage) to file
   */
  static async saveContextState(context: BrowserContext, outputPath: string): Promise<void> {
    try {
      const state = await context.storageState();
      await writeFile(outputPath, JSON.stringify(state, null, 2));
      logger.debug('Context state saved', { outputPath });
    } catch (error) {
      logger.error('Failed to save context state', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Set up resource blocking for faster page loading
 * Blocks images, fonts, analytics, ads, and social widgets
 * Safe for text-based apps like NotebookLM
 */
export function setupResourceBlocking(page: Page): void {
  logger.debug('Setting up resource blocking');

  page.route('**/*', (route: Route, request: Request) => {
    const resourceType = request.resourceType();

    // Always block these resource types
    if (
      ALWAYS_BLOCKED_RESOURCE_TYPES.includes(
        resourceType as (typeof ALWAYS_BLOCKED_RESOURCE_TYPES)[number]
      )
    ) {
      route.abort();
      return;
    }

    // Block by URL pattern
    const url = request.url();
    for (const pattern of BLOCKED_PATTERNS) {
      const patternWithoutWildcard = pattern.replace('**/', '');
      if (url.includes(patternWithoutWildcard) || url.endsWith(patternWithoutWildcard)) {
        route.abort();
        return;
      }
    }

    // Allow everything else
    route.continue();
  });

  logger.debug('Resource blocking configured');
}

/**
 * Set up minimal blocking - only heavy resources
 * Use this if full blocking causes issues
 */
export function setupMinimalBlocking(page: Page): void {
  logger.debug('Setting up minimal resource blocking');

  // Block common image formats
  page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', route => route.abort());

  // Block font files
  page.route('**/*.{woff,woff2,ttf,otf}', route => route.abort());

  logger.debug('Minimal blocking configured');
}

/**
 * Options for waitForResponseOptimized
 */
interface WaitForResponseOptions {
  previousAnswer?: string;
  timeout?: number;
  thinkingSelector?: string;
  responseSelector?: string;
}

/**
 * Wait for response with optimized exponential backoff polling
 * Much faster than fixed-interval polling
 * Ports Python implementation with async/await improvements
 */
export async function waitForResponseOptimized(
  page: Page,
  options: WaitForResponseOptions = {}
): Promise<string> {
  const {
    previousAnswer,
    timeout = 120,
    thinkingSelector = THINKING_SELECTOR,
    responseSelector = RESPONSE_SELECTORS[0],
  } = options;

  logger.debug('Starting optimized response detection', { timeout });

  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
  let pollInterval = 100; // Start fast (100ms)
  const maxInterval = 1000; // Cap at 1 second
  let stableCount = 0;
  let lastCandidate: string | null = null;
  let lastPollTime = 0;

  while (Date.now() - startTime < timeoutMs) {
    // Adaptive polling - don't poll faster than interval
    const elapsed = Date.now() - lastPollTime;
    if (elapsed < pollInterval) {
      await delay(pollInterval - elapsed);
    }

    lastPollTime = Date.now();

    // Check if still thinking (fast path)
    try {
      const thinking = await page.locator(thinkingSelector).first();
      const isVisible = await thinking.isVisible().catch(() => false);
      if (isVisible) {
        // Still thinking, increase interval slowly
        pollInterval = Math.min(pollInterval * 1.3, maxInterval);
        continue;
      }
    } catch {
      // Element not found or other error - continue checking
    }

    // Check for response
    try {
      const responses = await page.locator(responseSelector).all();
      if (responses.length > 0) {
        const latestText = (await responses[responses.length - 1].textContent())?.trim() || '';

        if (latestText && latestText !== previousAnswer) {
          if (latestText === lastCandidate) {
            stableCount++;
            if (stableCount >= 2) {
              logger.debug('Response detected and stabilized', {
                length: latestText.length,
                duration: Date.now() - startTime,
              });
              return latestText;
            }
          } else {
            stableCount = 0;
            lastCandidate = latestText;
            // New content detected, poll faster
            pollInterval = 100;
          }
        }
      }
    } catch {
      // Error querying responses - continue polling
    }

    // Exponential backoff when no changes
    pollInterval = Math.min(pollInterval * 1.2, maxInterval);
  }

  logger.error('Response detection timed out', { timeout });
  throw new TimeoutError(`No response within ${timeout}s`);
}

/**
 * Simple delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Human-like interaction utilities with speed options
 */
export class StealthUtils {
  /**
   * Toggle for speed vs stealth tradeoff
   * When true, uses instant fill for short text instead of human-like typing
   */
  static FAST_MODE = false;

  /**
   * Add random delay (in milliseconds)
   */
  static async randomDelay(minMs: number = 100, maxMs: number = 500): Promise<void> {
    const delayMs = Math.random() * (maxMs - minMs) + minMs;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Fast typing - use for headless/internal automation
   * Instantly fills text without human-like delays
   */
  static async fastType(page: Page, selector: string, text: string): Promise<void> {
    try {
      await page.fill(selector, text);
      logger.debug('Fast typed text', { selector, length: text.length });
    } catch (error) {
      logger.warn('Fast type failed', {
        selector,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Type with human-like speed or fast mode
   * Simulates realistic typing with variable delays based on WPM
   * Uses FAST_MODE toggle for short text (<100 chars)
   */
  static async humanType(
    page: Page,
    selector: string,
    text: string,
    wpmMin: number = 320,
    wpmMax: number = 480
  ): Promise<void> {
    logger.debug('Human typing', {
      selector,
      length: text.length,
      fastMode: StealthUtils.FAST_MODE,
    });

    // Fast path for short text in fast mode
    if (StealthUtils.FAST_MODE && text.length < 100) {
      await StealthUtils.fastType(page, selector, text);
      return;
    }

    // Find the element using locators
    let element = page.locator(selector).first();
    let count = await element.count();

    if (count === 0) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        element = page.locator(selector).first();
        count = await element.count();
      } catch {
        // Timeout waiting for element
      }
    }

    if (count === 0) {
      logger.warn('Element not found for typing', { selector });
      return;
    }

    // Click to focus
    await element.click();

    // Calculate typing delay based on WPM
    const wpm = Math.random() * (wpmMax - wpmMin) + wpmMin;
    const charsPerSecond = (wpm / 60) * 5; // Average 5 chars per word
    const baseDelay = 1000 / charsPerSecond;

    // Type with realistic delays
    for (const char of text) {
      const charDelay = baseDelay * (0.8 + Math.random() * 0.4); // ±20% variation
      await element.press(char);
      await delay(charDelay);

      // Occasional pause (5% chance)
      if (Math.random() < 0.05) {
        const pauseDelay = Math.random() * 250 + 150; // 150-400ms pause
        await delay(pauseDelay);
      }
    }

    logger.debug('Human typing completed', { selector });
  }

  /**
   * Click with realistic mouse movement
   * Moves mouse to element before clicking with natural delays
   */
  static async realisticClick(page: Page, selector: string): Promise<void> {
    logger.debug('Realistic click', { selector });

    const element = page.locator(selector).first();
    const count = await element.count();

    if (count === 0) {
      logger.warn('Element not found for click', { selector });
      return;
    }

    // Move mouse to element center for realism
    const box = await element.boundingBox();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y, { steps: 5 });
    }

    // Small delay before click
    await StealthUtils.randomDelay(100, 300);

    // Perform click
    await element.click();

    // Small delay after click
    await StealthUtils.randomDelay(100, 300);

    logger.debug('Realistic click completed', { selector });
  }
}
