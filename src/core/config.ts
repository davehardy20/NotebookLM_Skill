/**
 * Configuration management for NotebookLM TypeScript skill
 * Loads from environment variables with Zod validation
 */

import 'dotenv/config';
import { z } from 'zod';
import { Paths } from './paths.js';

/**
 * Zod schema for configuration validation
 */
const ConfigSchema = z.object({
  // Paths
  dataDir: z.string().describe('Data directory for notebooks and auth'),
  browserStateDir: z.string().describe('Browser state and cookies directory'),
  browserProfileDir: z.string().describe('Browser profile directory'),
  stateFile: z.string().describe('Browser state JSON file'),
  authInfoFile: z.string().describe('Authentication info JSON file'),
  libraryFile: z.string().describe('Notebook library JSON file'),

  // NotebookLM Selectors
  queryInputSelectors: z.array(z.string()).describe('CSS selectors for query input'),
  responseSelectors: z.array(z.string()).describe('CSS selectors for response'),

  // Browser Configuration
  browserArgs: z.array(z.string()).describe('Browser launch arguments'),
  userAgent: z.string().describe('User agent string for browser'),

  // Timeouts (milliseconds)
  timeouts: z.object({
    login: z.number().int().positive().describe('Login timeout in ms'),
    query: z.number().int().positive().describe('Query timeout in ms'),
    pageLoad: z.number().int().positive().describe('Page load timeout in ms'),
  }),

  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).describe('Node environment'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).describe('Log level'),

  stateEncryptionKey: z
    .string()
    .optional()
    .describe('Encryption key for browser state (32+ chars)'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): Config {
  const paths = Paths.getInstance();

  const config = {
    // Paths
    dataDir: process.env.NOTEBOOKLM_DATA_DIR || paths.dataDir,
    browserStateDir: process.env.NOTEBOOKLM_BROWSER_STATE_DIR || paths.browserStateDir,
    browserProfileDir: process.env.NOTEBOOKLM_BROWSER_PROFILE_DIR || paths.browserProfileDir,
    stateFile: process.env.NOTEBOOKLM_STATE_FILE || paths.stateFile,
    authInfoFile: process.env.NOTEBOOKLM_AUTH_INFO_FILE || paths.authInfoFile,
    libraryFile: process.env.NOTEBOOKLM_LIBRARY_FILE || paths.libraryFile,

    // NotebookLM Selectors
    queryInputSelectors:
      (process.env.NOTEBOOKLM_QUERY_SELECTORS || '').split(',').filter(Boolean).length > 0
        ? (process.env.NOTEBOOKLM_QUERY_SELECTORS || '').split(',').filter(Boolean)
        : [
            'textarea.query-box-input',
            'textarea[aria-label="Feld für Anfragen"]',
            'textarea[aria-label="Input for queries"]',
          ],

    responseSelectors:
      (process.env.NOTEBOOKLM_RESPONSE_SELECTORS || '').split(',').filter(Boolean).length > 0
        ? (process.env.NOTEBOOKLM_RESPONSE_SELECTORS || '').split(',').filter(Boolean)
        : [
            '.to-user-container .message-text-content',
            "[data-message-author='bot']",
            "[data-message-author='assistant']",
          ],

    // Browser Configuration
    browserArgs:
      (process.env.NOTEBOOKLM_BROWSER_ARGS || '').split(',').filter(Boolean).length > 0
        ? (process.env.NOTEBOOKLM_BROWSER_ARGS || '').split(',').filter(Boolean)
        : [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--no-first-run',
            '--no-default-browser-check',
          ],

    userAgent:
      process.env.NOTEBOOKLM_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

    // Timeouts
    timeouts: {
      login: parseInt(process.env.NOTEBOOKLM_LOGIN_TIMEOUT || '600000', 10),
      query: parseInt(process.env.NOTEBOOKLM_QUERY_TIMEOUT || '120000', 10),
      pageLoad: parseInt(process.env.NOTEBOOKLM_PAGE_LOAD_TIMEOUT || '30000', 10),
    },

    // Environment
    nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',

    stateEncryptionKey: process.env.STATE_ENCRYPTION_KEY,
  };

  // Validate configuration
  const result = ConfigSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * Singleton configuration instance
 */
let configInstance: Config | null = null;

/**
 * Get the global configuration instance
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (mainly for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

// Export singleton instance
export const config = getConfig();
