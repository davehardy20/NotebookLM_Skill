// NotebookLM Skill - TypeScript Edition
// Main entry point for programmatic API usage

// Query interface exports (main API)
export {
  askNotebookLM,
  askNotebookLMLegacy,
  askNotebookLMOptimized,
  DEFAULT_CONFIG,
  FOLLOW_UP_REMINDER,
  getAvailableNotebooks,
  type QueryConfig,
  type QueryResult,
  query,
  resolveNotebookUrl,
} from './ask.js';
// Browser exports
export { AuthManager, getAuthManager, resetAuthManager } from './browser/auth-manager.js';
export {
  AuthExpiredError,
  BrowserCrashedError,
  getPool,
  NotebookLMSession,
  SessionPool,
  sessionPool,
} from './browser/browser-pool.js';
export {
  BrowserFactory,
  StealthUtils,
  setupMinimalBlocking,
  setupResourceBlocking,
  waitForResponseOptimized,
} from './browser/browser-utils.js';
// Cache exports
export { getCache, ResponseCache, resetCache } from './cache/response-cache.js';
// Core exports
export { type Config, config, getConfig, resetConfig } from './core/config.js';
export {
  AppError,
  AuthError,
  BrowserError,
  ConfigError,
  isAppError,
  NotebookError,
  NotFoundError,
  TimeoutError,
  ValidationError,
} from './core/errors.js';
export { createChildLogger, type LogLevel, logger } from './core/logger.js';
export { Paths } from './core/paths.js';

// Notebook exports
export {
  getNotebookLibrary,
  NotebookLibrary,
  resetNotebookLibrary,
} from './notebook/notebook-manager.js';

// Performance exports
export { getMonitor, PerformanceMonitor, resetMonitor } from './performance/performance-monitor.js';
export * from './types/index.js';

// Version
export const VERSION = '1.0.0';
