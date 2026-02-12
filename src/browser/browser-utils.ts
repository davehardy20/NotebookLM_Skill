/**
 * Browser Utilities for NotebookLM TypeScript Skill
 * Handles browser launching, stealth features, resource blocking, and response detection
 * Async-first implementation with Playwright
 */

import { chromium, type Browser, type BrowserContext, type Page, type Route, type Request } from 'playwright';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { createChildLogger } from '../core/logger.js';
import { getConfig } from '../core/config.js';
import type { BrowserOptions } from '../types/browser.js';

const logger = createChildLogger('BrowserUtils');

/**
 * Factory for creating configured browser contexts with anti-detection features
 */
export class BrowserFactory {
  /**
   * Launch a persistent browser context with anti-detection features
   * and cookie workaround for Playwright bug #36139
   */
  static async launchPersistentContext(
    options: BrowserOptions = {}
  ): Promise<{ browser: Browser; context: BrowserContext }> {
    const config = getConfig();
    const mergedOptions = { ...options };

    logger.debug('Launching persistent browser context', {
      headless: mergedOptions.headless,
      userAgent: mergedOptions.userAgent ? 'custom' : 'default',
    });

    const browser = await chromium.launch({
      headless: mergedOptions.headless ?? true,
      args: config.browserArgs,
      slowMo: mergedOptions.slowMo ?? 0,
    });

    const viewport = mergedOptions.viewport ?? { width: 1280, height: 720 };
    const context = await browser.newContext({
      userAgent: mergedOptions.userAgent ?? config.userAgent,
      viewport: viewport as { width: number; height: number },
      ignoreHTTPSErrors: mergedOptions.ignoreHttpsErrors ?? false,
      locale: mergedOptions.locale ?? 'en-US',
      timezoneId: mergedOptions.timezoneId,
      acceptDownloads: mergedOptions.acceptDownloads ?? false,
    });

    // Cookie Workaround for Playwright bug #36139
    // Session cookies (expires=-1) don't persist in user_data_dir automatically
    await this._injectCookies(context);

    logger.debug('Browser context launched successfully');
    return { browser, context };
  }

  /**
   * Inject cookies from state.json if available
   * Workaround for Playwright session cookie persistence issue
   */
  private static async _injectCookies(context: BrowserContext): Promise<void> {
    const config = getConfig();
    const stateFile = config.stateFile;

    if (!existsSync(stateFile)) {
      logger.debug('State file not found, skipping cookie injection', { stateFile });
      return;
    }

    try {
      const stateContent = await readFile(stateFile, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const state = JSON.parse(stateContent) as { cookies?: Array<{ name: string; value: string }> };

      if (state.cookies && Array.isArray(state.cookies) && state.cookies.length > 0) {
        await context.addCookies(state.cookies);
        logger.debug('Injected cookies from state.json', { count: state.cookies.length });
      }
    } catch (error) {
      logger.warn('Could not load state.json for cookie injection', {
        error: error instanceof Error ? error.message : String(error),
      });
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
 * Setup resource blocking to improve page load performance
 * Blocks images, fonts, analytics, ads, and social widgets
 * Safe for text-based apps like NotebookLM
 */
export async function setupResourceBlocking(page: Page): Promise<void> {
  const blockedPatterns = [
    // Images
    /\.png$/i,
    /\.jpg$/i,
    /\.jpeg$/i,
    /\.gif$/i,
    /\.webp$/i,
    /\.svg$/i,
    /\.ico$/i,
    // Fonts
    /\.woff$/i,
    /\.woff2$/i,
    /\.ttf$/i,
    /\.otf$/i,
    /\.eot$/i,
    // Analytics/Tracking
    /google-analytics/i,
    /gtm\.js/i,
    /ga\.js/i,
    /analytics/i,
    /tracking/i,
    /telemetry/i,
    // Ads
    /ads/i,
    /adzerk/i,
    /doubleclick/i,
    // Social widgets
    /facebook/i,
    /twitter/i,
    /linkedin/i,
  ];

  const blockedResourceTypes = ['image', 'font', 'media'];

  await page.route('**/*', async (route: Route) => {
    const request: Request = route.request();
    const resourceType = request.resourceType();
    const url = request.url();

    // Block by resource type
    if (blockedResourceTypes.includes(resourceType)) {
      await route.abort();
      return;
    }

    // Block by URL pattern
    for (const pattern of blockedPatterns) {
      if (pattern.test(url)) {
        await route.abort();
        return;
      }
    }

    // Allow everything else
    await route.continue();
  });

  logger.debug('Resource blocking enabled');
}

/**
 * Setup minimal resource blocking - only heavy resources
 * Use this if full blocking causes issues
 */
export async function setupMinimalBlocking(page: Page): Promise<void> {
  // Block images
  await page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', async (route: Route) => {
    await route.abort();
  });

  // Block fonts
  await page.route('**/*.{woff,woff2,ttf,otf}', async (route: Route) => {
    await route.abort();
  });

  logger.debug('Minimal resource blocking enabled');
}

/**
 * Wait for response with optimized exponential backoff polling
 * Much faster than fixed-interval polling
 */
export async function waitForResponseOptimized(
  page: Page,
  options: {
    previousAnswer?: string;
    timeout?: number;
    thinkingSelector?: string;
    responseSelector?: string;
  } = {}
): Promise<string> {
  const {
    previousAnswer,
    timeout = 120000,
    thinkingSelector = 'div.thinking-message',
    responseSelector = '.to-user-container .message-text-content',
  } = options;

  const startTime = Date.now();
  let pollInterval = 100; // Start fast (100ms)
  const maxInterval = 1000; // Cap at 1 second
  let stableCount = 0;
  let lastCandidate: string | null = null;
  let lastPollTime = Date.now();

  logger.debug('Starting optimized response polling', {
    timeout,
    thinkingSelector,
    responseSelector,
  });

  while (Date.now() - startTime < timeout) {
    // Adaptive polling - don't poll faster than interval
    const elapsed = Date.now() - lastPollTime;
    if (elapsed < pollInterval) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval - elapsed));
    }

    lastPollTime = Date.now();

    // Check if still thinking (fast path)
    try {
      const thinkingElement = await page.$(thinkingSelector);
      if (thinkingElement) {
        const isVisible = await thinkingElement.isVisible();
        if (isVisible) {
          // Still thinking, increase interval slowly
          pollInterval = Math.min(pollInterval * 1.3, maxInterval);
          continue;
        }
      }
    } catch {
      // Ignore errors in thinking check
    }

    // Check for response
    try {
      const responseElements = await page.$$(responseSelector);
      if (responseElements.length > 0) {
        const latestElement = responseElements[responseElements.length - 1];
        const latestText = (await latestElement.innerText()).trim();

        if (latestText && latestText !== previousAnswer) {
          if (latestText === lastCandidate) {
            stableCount++;
            if (stableCount >= 2) {
              logger.debug('Response detected and stabilized', {
                length: latestText.length,
                stableCount,
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
      // Ignore errors in response check
    }

    // Exponential backoff when no changes
    pollInterval = Math.min(pollInterval * 1.2, maxInterval);
  }

  logger.error('Response detection timeout', { timeout });
  throw new Error(`No response within ${timeout}ms`);
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
    await new Promise((resolve) => setTimeout(resolve, delayMs));
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
   * Uses FAST_MODE toggle for short text (<100 chars)
   */
  static async humanType(
    page: Page,
    selector: string,
    text: string
  ): Promise<void> {
    try {
      let element = await page.$(selector);

      if (!element) {
        try {
          element = await page.waitForSelector(selector, { timeout: 2000 });
        } catch {
          logger.warn('Element not found for typing', { selector });
          return;
        }
      }

      // Fast mode for short text
      if (StealthUtils.FAST_MODE && text.length < 100) {
        await element.fill(text);
        logger.debug('Fast mode typing', { selector, length: text.length });
        return;
      }

      // Human-like typing
      await element.click();

      for (const char of text) {
        // Random delay between 25-75ms per character
        const charDelay = Math.random() * 50 + 25;
        await element.type(char, { delay: charDelay });

        // Occasional longer pauses (5% chance)
        if (Math.random() < 0.05) {
          const pauseMs = Math.random() * 250 + 150;
          await new Promise((resolve) => setTimeout(resolve, pauseMs));
        }
      }

      logger.debug('Human-like typing completed', { selector, length: text.length });
    } catch (error) {
      logger.error('Human type failed', {
        selector,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Click with realistic mouse movement
   */
  static async realisticClick(page: Page, selector: string): Promise<void> {
    try {
      const element = await page.$(selector);
      if (!element) {
        logger.warn('Element not found for click', { selector });
        return;
      }

      // Get element position
      const box = await element.boundingBox();
      if (box) {
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;

        // Move mouse to element with steps for realism
        await page.mouse.move(x, y);
      }

      // Random delay before click
      await this.randomDelay(100, 300);

      // Click
      await element.click();

      // Random delay after click
      await this.randomDelay(100, 300);

      logger.debug('Realistic click completed', { selector });
    } catch (error) {
      logger.error('Realistic click failed', {
        selector,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }


}
