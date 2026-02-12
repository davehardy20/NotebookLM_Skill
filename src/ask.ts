/**
 * NotebookLM Query Interface
 * Main entry point for asking questions to NotebookLM
 * Ports ask_question.py to TypeScript with full feature parity
 * 
 * Features:
 * - Dual-mode execution (browser pool optimized + legacy fallback)
 * - Response caching for faster repeated queries
 * - Performance tracking and metrics
 * - Comprehensive error handling
 */

import { chromium } from 'playwright';
import {
  AuthManager,
  sessionPool,
  AuthExpiredError,
  BrowserCrashedError,
  BrowserFactory,
  setupResourceBlocking,
  StealthUtils,
  waitForResponseOptimized,
  QUERY_INPUT_SELECTORS,
} from './browser/index.js';
import { getCache } from './cache/index.js';
import { getNotebookLibrary } from './notebook/index.js';
import { getMonitor } from './performance/index.js';
import { createChildLogger } from './core/logger.js';

const logger = createChildLogger('AskQuestion');

/**
 * Follow-up reminder text appended to all responses
 * Encourages comprehensive questioning
 */
export const FOLLOW_UP_REMINDER =
  '\n\nEXTREMELY IMPORTANT: Is that ALL you need to know? ' +
  'You can always ask another question! Think about it carefully: ' +
  "before you reply to the user, review their original request and this answer. " +
  'If anything is still unclear or missing, ask me another comprehensive question.';

/**
 * Configuration for query execution
 */
export interface QueryConfig {
  /** Whether to use browser pool (fast path) or legacy mode */
  useSessionPool: boolean;
  /** Whether to enable fast typing mode for short queries */
  fastMode: boolean;
  /** Whether to use response caching */
  useCache: boolean;
  /** Whether to run browser in headless mode */
  headless: boolean;
}

/** Default configuration */
export const DEFAULT_CONFIG: QueryConfig = {
  useSessionPool: true,
  fastMode: true,
  useCache: true,
  headless: true,
};

/**
 * Result of a query operation
 */
export interface QueryResult {
  /** The answer text (without follow-up reminder) */
  answer: string;
  /** Full response with follow-up reminder */
  fullResponse: string;
  /** Duration in seconds */
  duration: number;
  /** Whether result came from cache */
  fromCache: boolean;
  /** Whether browser pool was used */
  usePool: boolean;
  /** Whether query succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Ask a question to NotebookLM using optimized browser pool
 * Fast path - reuses existing browser sessions
 * 
 * @param question - The question to ask
 * @param notebookUrl - URL of the NotebookLM notebook
 * @param config - Query configuration options
 * @returns Query result with answer and metadata
 */
export async function askNotebookLMOptimized(
  question: string,
  notebookUrl: string,
  config: Partial<QueryConfig> = {}
): Promise<QueryResult | null> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const authManager = AuthManager.getInstance();
  const cache = getCache();
  const startTime = Date.now();
  
  logger.info(`💬 Asking (optimized): ${question}`);

  // Check authentication
  const isAuthenticated = await authManager.isAuthenticated();
  if (!isAuthenticated) {
    logger.warn('Not authenticated');
    return null;
  }

  // Check cache first
  if (fullConfig.useCache) {
    const cachedAnswer = await cache.get(question, notebookUrl);
    if (cachedAnswer) {
      logger.info('💾 Cache hit! Serving cached response');
      
      const monitor = await getMonitor();
      await monitor.recordQuery(0, question, cachedAnswer, {
        fromCache: true,
        usePool: true,
        success: true,
        notebookUrl,
      });

      return {
        answer: cachedAnswer,
        fullResponse: cachedAnswer + FOLLOW_UP_REMINDER,
        duration: 0,
        fromCache: true,
        usePool: true,
        success: true,
      };
    }
  }

  // Enable fast mode if configured
  StealthUtils.FAST_MODE = fullConfig.fastMode;

  try {
    // Get session from pool
    const session = await sessionPool.getSession(notebookUrl, fullConfig.headless);
    const page = await session.getPage();

    // Validate auth on session
    const isValid = await session.validateAuth();
    if (!isValid) {
      throw new AuthExpiredError('Session authentication expired');
    }

    // Navigate if needed
    if (page.url() !== notebookUrl) {
      logger.debug('Navigating to notebook URL');
      await page.goto(notebookUrl, { waitUntil: 'domcontentloaded' });
    }

    // Wait for query input
    logger.debug('Waiting for query input...');
    let inputSelector: string | null = null;
    
    for (const selector of QUERY_INPUT_SELECTORS) {
      try {
        const element = await page.waitForSelector(selector, {
          timeout: 5000,
          state: 'visible',
        });
        if (element) {
          inputSelector = selector;
          logger.debug(`Found input: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!inputSelector) {
      logger.warn('Could not find query input, falling back to legacy mode');
      throw new BrowserCrashedError('Input element not found');
    }

    // Type question
    logger.debug('Typing question...');
    await StealthUtils.humanType(page, inputSelector, question);

    // Submit
    logger.debug('Submitting query...');
    await page.keyboard.press('Enter');
    await StealthUtils.randomDelay(100, 300);

    // Wait for response
    logger.debug('Waiting for response...');
    const answer = await waitForResponseOptimized(page);

    const duration = (Date.now() - startTime) / 1000;
    logger.info(`✅ Got answer! (${answer.length} chars) in ${duration.toFixed(2)}s`);

    // Store in cache
    if (fullConfig.useCache) {
      await cache.set(question, answer, notebookUrl);
    }

    // Record metrics
    const monitor = await getMonitor();
    await monitor.recordQuery(duration, question, answer, {
      fromCache: false,
      usePool: true,
      success: true,
      notebookUrl,
    });

    return {
      answer,
      fullResponse: answer + FOLLOW_UP_REMINDER,
      duration,
      fromCache: false,
      usePool: true,
      success: true,
    };

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    
    // Handle specific error types
    if (error instanceof AuthExpiredError || error instanceof BrowserCrashedError) {
      logger.warn(`Session error: ${error.message}`);
      
      // Record fallback
      const monitor = await getMonitor();
      monitor.recordFallback();
      
      // Close all sessions and retry with legacy
      await sessionPool.closeAll();
      logger.info('Falling back to fresh session (legacy mode)...');
      
      return askNotebookLMLegacy(question, notebookUrl, config);
    }

    // Other errors - log and return null
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in optimized query: ${errorMessage}`);
    
    const monitor = await getMonitor();
    await monitor.recordQuery(duration, question, '', {
      fromCache: false,
      usePool: true,
      success: false,
      error: errorMessage,
      notebookUrl,
    });

    return null;
  }
}

/**
 * Ask a question using legacy mode (fresh browser each time)
 * Fallback when browser pool fails
 * 
 * @param question - The question to ask
 * @param notebookUrl - URL of the NotebookLM notebook
 * @param config - Query configuration options
 * @returns Query result with answer and metadata
 */
export async function askNotebookLMLegacy(
  question: string,
  notebookUrl: string,
  config: Partial<QueryConfig> = {}
): Promise<QueryResult | null> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const authManager = AuthManager.getInstance();
  const cache = getCache();
  const startTime = Date.now();
  
  logger.info(`💬 Asking (legacy): ${question}`);

  // Check authentication
  const isAuthenticated = await authManager.isAuthenticated();
  if (!isAuthenticated) {
    logger.warn('Not authenticated');
    return null;
  }

  // Check cache first
  if (fullConfig.useCache) {
    const cachedAnswer = await cache.get(question, notebookUrl);
    if (cachedAnswer) {
      logger.info('💾 Cache hit! Serving cached response');
      
      const monitor = await getMonitor();
      await monitor.recordQuery(0, question, cachedAnswer, {
        fromCache: true,
        usePool: false,
        success: true,
        notebookUrl,
      });

      return {
        answer: cachedAnswer,
        fullResponse: cachedAnswer + FOLLOW_UP_REMINDER,
        duration: 0,
        fromCache: true,
        usePool: false,
        success: true,
      };
    }
  }

  // Enable fast mode if configured
  StealthUtils.FAST_MODE = fullConfig.fastMode;

  let context = null;
  
  try {
    // Launch fresh browser context
    const { Paths } = await import('./core/paths.js');
    const pathsInstance = Paths.getInstance();
    
    context = await BrowserFactory.launchPersistentContext(
      chromium,
      pathsInstance.browserProfileDir,
      fullConfig.headless
    );

    const page = await context.newPage();
    
    // Navigate to notebook
    logger.debug('Opening notebook...');
    await page.goto(notebookUrl, { waitUntil: 'domcontentloaded' });
    
    // Wait for NotebookLM domain
    await page.waitForURL(/^https:\/\/notebooklm\.google\.com\//, {
      timeout: 10000,
    });

    // Wait for query input
    logger.debug('Waiting for query input...');
    let inputSelector: string | null = null;
    
    for (const selector of QUERY_INPUT_SELECTORS) {
      try {
        const element = await page.waitForSelector(selector, {
          timeout: 5000,
          state: 'visible',
        });
        if (element) {
          inputSelector = selector;
          logger.debug(`Found input: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!inputSelector) {
      logger.error('Could not find query input');
      return null;
    }

    // Apply resource blocking for speed
    setupResourceBlocking(page);

    // Type question
    logger.debug('Typing question...');
    await StealthUtils.humanType(page, inputSelector, question);

    // Submit
    logger.debug('Submitting query...');
    await page.keyboard.press('Enter');
    await StealthUtils.randomDelay(300, 800);

    // Wait for response
    logger.debug('Waiting for response...');
    const answer = await waitForResponseOptimized(page);

    const duration = (Date.now() - startTime) / 1000;
    logger.info(`✅ Got answer! (${answer.length} chars) in ${duration.toFixed(2)}s`);

    // Store in cache
    if (fullConfig.useCache) {
      await cache.set(question, answer, notebookUrl);
    }

    // Record metrics
    const monitor = await getMonitor();
    await monitor.recordQuery(duration, question, answer, {
      fromCache: false,
      usePool: false,
      success: true,
      notebookUrl,
    });

    return {
      answer,
      fullResponse: answer + FOLLOW_UP_REMINDER,
      duration,
      fromCache: false,
      usePool: false,
      success: true,
    };

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error(`Error in legacy query: ${errorMessage}`);
    
    const monitor = await getMonitor();
    await monitor.recordQuery(duration, question, '', {
      fromCache: false,
      usePool: false,
      success: false,
      error: errorMessage,
      notebookUrl,
    });

    return null;

  } finally {
    // Always close context
    if (context) {
      try {
        await context.close();
      } catch (closeError) {
        logger.warn('Error closing browser context', {
          error: closeError instanceof Error ? closeError.message : 'Unknown',
        });
      }
    }
  }
}

/**
 * Unified entry point for asking questions
 * Uses browser pool by default with automatic fallback to legacy mode
 * 
 * @param question - The question to ask
 * @param notebookUrl - URL of the NotebookLM notebook
 * @param config - Query configuration options
 * @returns Query result with answer and metadata, or null on failure
 */
export async function askNotebookLM(
  question: string,
  notebookUrl: string,
  config: Partial<QueryConfig> = {}
): Promise<QueryResult | null> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (fullConfig.useSessionPool) {
    return askNotebookLMOptimized(question, notebookUrl, config);
  } else {
    return askNotebookLMLegacy(question, notebookUrl, config);
  }
}

/**
 * Resolve notebook URL from various sources
 * Supports: direct URL, notebook ID, active notebook
 * 
 * @param options - Resolution options
 * @returns Resolved notebook URL or null if not found
 */
export async function resolveNotebookUrl(options: {
  notebookUrl?: string;
  notebookId?: string;
  useActive?: boolean;
}): Promise<string | null> {
  const { notebookUrl, notebookId, useActive = true } = options;

  // Direct URL provided
  if (notebookUrl) {
    return notebookUrl;
  }

  const library = getNotebookLibrary();
  await library.initialize();

  // Lookup by ID
  if (notebookId) {
    const notebook = library.getNotebook(notebookId);
    if (notebook) {
      return notebook.url;
    }
    logger.warn(`Notebook '${notebookId}' not found in library`);
    return null;
  }

  // Use active notebook
  if (useActive) {
    const active = library.getActiveNotebook();
    if (active) {
      logger.info(`Using active notebook: ${active.name}`);
      return active.url;
    }
  }

  return null;
}

/**
 * Get list of available notebooks for display
 * 
 * @returns Array of notebook info objects
 */
export async function getAvailableNotebooks(): Promise<
  Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>
> {
  const library = getNotebookLibrary();
  await library.initialize();
  
  const notebooks = library.listNotebooks();
  const activeId = library.getActiveNotebook()?.id;

  return notebooks.map((nb: { id: string; name: string }) => ({
    id: nb.id,
    name: nb.name,
    isActive: nb.id === activeId,
  }));
}

/**
 * Simple convenience function - just get the answer text
 * 
 * @param question - The question to ask
 * @param notebookUrl - URL of the NotebookLM notebook
 * @returns Answer text or null on failure
 */
export async function query(
  question: string,
  notebookUrl: string
): Promise<string | null> {
  const result = await askNotebookLM(question, notebookUrl);
  return result?.answer || null;
}


