import { z } from 'zod';

/**
 * Configuration for a NotebookLM browser session
 */
export const SessionConfigSchema = z.object({
  sessionId: z.string().describe('Unique session identifier'),
  notebookUrl: z.string().url().describe('NotebookLM notebook URL'),
  headless: z.boolean().default(true).describe('Run browser in headless mode'),
  timeout: z.number().int().positive().default(120).describe('Query timeout in seconds'),
  usePool: z.boolean().default(true).describe('Use browser pool for session reuse'),
  idleTimeout: z.number().int().positive().default(900).describe('Session idle timeout in seconds'),
  maxRetries: z.number().int().nonnegative().default(3).describe('Maximum retry attempts'),
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

/**
 * Browser launch and configuration options
 */
export const BrowserOptionsSchema = z.object({
  headless: z.boolean().default(true).describe('Run browser in headless mode'),
  slowMo: z.number().nonnegative().default(0).describe('Slow down actions by N milliseconds'),
  timeout: z.number().int().positive().default(30000).describe('Default timeout in milliseconds'),
  navigationTimeout: z
    .number()
    .int()
    .positive()
    .default(30000)
    .describe('Navigation timeout in milliseconds'),
  userAgent: z.string().optional().describe('Custom user agent string'),
  viewport: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional()
    .describe('Viewport dimensions'),
  blockResources: z.boolean().default(true).describe('Block images, fonts, and analytics'),
  blockResourceTypes: z
    .array(z.string())
    .default(['image', 'font', 'stylesheet'])
    .describe('Resource types to block'),
  acceptDownloads: z.boolean().default(false).describe('Accept file downloads'),
  ignoreHttpsErrors: z.boolean().default(false).describe('Ignore HTTPS errors'),
  locale: z.string().default('en-US').describe('Browser locale'),
  timezoneId: z.string().optional().describe('Timezone ID'),
});

export type BrowserOptions = z.infer<typeof BrowserOptionsSchema>;

/**
 * Browser pool configuration
 */
export const BrowserPoolConfigSchema = z.object({
  maxSessions: z.number().int().positive().default(5).describe('Maximum concurrent sessions'),
  sessionIdleTimeout: z
    .number()
    .int()
    .positive()
    .default(900)
    .describe('Session idle timeout in seconds'),
  cleanupInterval: z
    .number()
    .int()
    .positive()
    .default(60)
    .describe('Cleanup check interval in seconds'),
  enableMetrics: z.boolean().default(true).describe('Enable performance metrics'),
  enableCache: z.boolean().default(true).describe('Enable response caching'),
});

export type BrowserPoolConfig = z.infer<typeof BrowserPoolConfigSchema>;
