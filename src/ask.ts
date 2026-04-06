import { NotebookClient } from './api/notebooks.js';
import { getAuthManager } from './auth/auth-manager.js';
import { getCache } from './cache/index.js';
import { createChildLogger } from './core/logger.js';
import { getMonitor } from './performance/index.js';

const logger = createChildLogger('AskQuestion');

export interface QueryResult {
  answer: string;
  fullResponse: string;
  duration: number;
  fromCache: boolean;
  usePool: boolean;
  success: boolean;
  error?: string;
}

export interface QueryConfig {
  useCache: boolean;
  conversationId?: string;
}

export const DEFAULT_CONFIG: QueryConfig = {
  useCache: true,
};

export async function askQuestion(
  question: string,
  notebookId: string,
  config: Partial<QueryConfig> = {}
): Promise<QueryResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  try {
    if (fullConfig.useCache) {
      const cached = await checkCache(question, notebookId);
      if (cached) {
        return {
          answer: cached.answer,
          fullResponse: cached.answer,
          duration: (Date.now() - startTime) / 1000,
          fromCache: true,
          usePool: false,
          success: true,
        };
      }
    }

    const authManager = getAuthManager();
    const tokens = await authManager.loadAuth();

    if (!tokens) {
      throw new Error('Not authenticated. Run "notebooklm auth import --file cookies.txt" first.');
    }

    const client = new NotebookClient(tokens);

    if (!tokens.csrfToken || client.needsTokenRefresh()) {
      logger.info('Refreshing CSRF token...');
      await client.refreshCSRFToken();
      await authManager.saveAuth(tokens);
    }

    const result = await client.query(notebookId, question, undefined, config.conversationId);

    const duration = (Date.now() - startTime) / 1000;

    if (fullConfig.useCache && result?.answer) {
      await saveToCache(question, notebookId, result.answer);
    }

    const monitor = await getMonitor();
    await monitor.recordQuery(duration, question, result.answer, {
      fromCache: false,
      usePool: false,
      success: true,
    });

    return {
      answer: result?.answer || 'No answer received',
      fullResponse: result?.answer || 'No answer received',
      duration,
      fromCache: false,
      usePool: false,
      success: true,
    };
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;

    logger.error('Query failed:', error);

    const monitor = await getMonitor();
    await monitor.recordQuery(duration, question, '', {
      fromCache: false,
      usePool: false,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      answer: '',
      fullResponse: '',
      duration,
      fromCache: false,
      usePool: false,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkCache(
  question: string,
  notebookId: string
): Promise<{ answer: string } | null> {
  try {
    const cache = getCache();
    const cached = await cache.get(question, notebookId);
    if (cached) {
      logger.info('Cache hit for query');
      return { answer: cached };
    }
  } catch (error) {
    logger.warn('Cache check failed:', error);
  }
  return null;
}

async function saveToCache(question: string, notebookId: string, answer: string): Promise<void> {
  try {
    const cache = getCache();
    await cache.set(question, notebookId, answer);
    logger.info('Response cached');
  } catch (error) {
    logger.warn('Cache save failed:', error);
  }
}
