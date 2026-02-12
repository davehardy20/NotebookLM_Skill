// NotebookLM Skill - TypeScript Edition
// Main entry point for programmatic API usage

export * from './types';

// Core exports
export { Config } from './core/config';
export { Logger } from './core/logger';
export { AppError, AuthError, BrowserError, NotebookError } from './core/errors';
export { Paths } from './core/paths';

// Version
export const VERSION = '1.0.0';
