// NotebookLM Skill - TypeScript Edition
// Main entry point for programmatic API usage

export * from './types/index.js';

// Core exports
export { config, getConfig, resetConfig, type Config } from './core/config.js';
export { logger, createChildLogger, type LogLevel } from './core/logger.js';
export {
  AppError,
  AuthError,
  BrowserError,
  NotebookError,
  ConfigError,
  TimeoutError,
  ValidationError,
  NotFoundError,
  isAppError,
} from './core/errors.js';
export { Paths } from './core/paths.js';

// Browser exports
export {
  AuthManager,
  getAuthManager,
  resetAuthManager,
} from './browser/auth-manager.js';
export {
  BrowserFactory,
  StealthUtils,
  setupResourceBlocking,
  setupMinimalBlocking,
  waitForResponseOptimized,
} from './browser/browser-utils.js';
export {
  NotebookLMSession,
  SessionPool,
  sessionPool,
  getPool,
  AuthExpiredError,
  BrowserCrashedError,
} from './browser/browser-pool.js';

// Cache exports
export { ResponseCache, getCache, resetCache } from './cache/response-cache.js';

// Notebook exports
export {
  NotebookLibrary,
  getNotebookLibrary,
  resetNotebookLibrary,
} from './notebook/notebook-manager.js';

// Performance exports
export {
  PerformanceMonitor,
  getMonitor,
  resetMonitor,
} from './performance/performance-monitor.js';

// Query interface exports (main API)
export {
  askNotebookLM,
  askNotebookLMOptimized,
  askNotebookLMLegacy,
  query,
  resolveNotebookUrl,
  getAvailableNotebooks,
  FOLLOW_UP_REMINDER,
  DEFAULT_CONFIG,
  type QueryConfig,
  type QueryResult,
} from './ask.js';

// Version
export const VERSION = '1.0.0';
