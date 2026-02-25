/**
 * Browser module exports
 * Centralized exports for all browser utilities
 */

export { AuthManager, getAuthManager, resetAuthManager } from './auth-manager.js';
export {
  AuthExpiredError,
  BrowserCrashedError,
  getPool,
  NotebookLMSession,
  type PoolStats,
  SessionPool,
  type SessionStats,
  sessionPool,
  setupCleanupHandlers,
} from './browser-pool.js';
export {
  BrowserFactory,
  StealthUtils,
  setupMinimalBlocking,
  setupResourceBlocking,
  waitForResponseOptimized,
} from './browser-utils.js';

export {
  ALWAYS_BLOCKED_RESOURCE_TYPES,
  BLOCKED_PATTERNS,
  BROWSER_ARGS,
  CHAT_CONTAINER_SELECTOR,
  ERROR_MESSAGE_SELECTORS,
  LOADING_INDICATOR_SELECTORS,
  LOGIN_BUTTON_SELECTORS,
  NOTEBOOK_TITLE_SELECTOR,
  QUERY_INPUT_SELECTORS,
  RESPONSE_SELECTORS,
  SEND_BUTTON_SELECTORS,
  THINKING_SELECTOR,
  TIMEOUTS,
  USER_AGENT,
} from './selectors.js';
