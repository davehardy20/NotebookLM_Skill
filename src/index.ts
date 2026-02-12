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

// Version
export const VERSION = '1.0.0';
