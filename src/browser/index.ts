/**
 * Browser module exports
 * Centralized exports for all browser utilities
 */

export {
  BrowserFactory,
  setupResourceBlocking,
  setupMinimalBlocking,
  waitForResponseOptimized,
  StealthUtils,
} from './browser-utils.js';

export {
  AuthManager,
  getAuthManager,
  resetAuthManager,
} from './auth-manager.js';

export {
  NotebookLMSession,
  SessionPool,
  sessionPool,
  getPool,
  setupCleanupHandlers,
  AuthExpiredError,
  BrowserCrashedError,
  type SessionStats,
  type PoolStats,
} from './browser-pool.js';

export {
  QUERY_INPUT_SELECTORS,
  RESPONSE_SELECTORS,
  THINKING_SELECTOR,
  CHAT_CONTAINER_SELECTOR,
  SEND_BUTTON_SELECTORS,
  LOGIN_BUTTON_SELECTORS,
  NOTEBOOK_TITLE_SELECTOR,
  ERROR_MESSAGE_SELECTORS,
  LOADING_INDICATOR_SELECTORS,
  BLOCKED_PATTERNS,
  ALWAYS_BLOCKED_RESOURCE_TYPES,
  BROWSER_ARGS,
  USER_AGENT,
  TIMEOUTS,
} from './selectors.js';
