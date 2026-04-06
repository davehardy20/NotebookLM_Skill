// NotebookLM Skill - TypeScript Edition
// Main entry point for programmatic API usage

// API client exports
export { BaseClient, NotebookClient, REQUIRED_COOKIES, RPC_IDS } from './api/index.js';
export type {
  AuthTokens,
  Cookie,
  Notebook,
  QueryResult as APIQueryResult,
  Reference,
  Source,
} from './api/types.js';
// Query interface exports (main API)
export { askQuestion, DEFAULT_CONFIG, type QueryConfig, type QueryResult } from './ask.js';
export type { AuthStatus } from './auth/auth-manager.js';
// Auth exports
export { AuthManager, getAuthManager } from './auth/auth-manager.js';

// Cache exports
export { getCache, ResponseCache, resetCache } from './cache/response-cache.js';

// Core exports
export { type Config, config, getConfig, resetConfig } from './core/config.js';
export {
  AppError,
  AuthError,
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
