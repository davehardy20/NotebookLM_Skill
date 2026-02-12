import { z } from 'zod';

/**
 * Metrics for a single query execution
 */
export const QueryMetricsSchema = z.object({
  timestamp: z.number().describe('Unix timestamp when query was executed'),
  questionLength: z.number().int().nonnegative().describe('Length of the question in characters'),
  answerLength: z.number().int().nonnegative().describe('Length of the answer in characters'),
  durationSeconds: z.number().nonnegative().describe('Total query duration in seconds'),
  fromCache: z.boolean().default(false).describe('Whether answer came from cache'),
  success: z.boolean().default(true).describe('Whether query succeeded'),
  errorType: z.string().nullable().describe('Type of error if failed, or null'),
  notebookUrl: z.string().url().nullable().describe('URL of queried notebook, or null'),
});

export type QueryMetrics = z.infer<typeof QueryMetricsSchema>;

/**
 * Metrics for a browser session
 */
export const SessionMetricsSchema = z.object({
  sessionId: z.string().describe('Unique session identifier'),
  startTime: z.number().describe('Unix timestamp of session start'),
  endTime: z.number().nullable().describe('Unix timestamp of session end, or null if active'),
  queriesCount: z.number().int().nonnegative().default(0).describe('Number of queries in session'),
  errorsCount: z.number().int().nonnegative().default(0).describe('Number of errors in session'),
});

export type SessionMetrics = z.infer<typeof SessionMetricsSchema>;

/**
 * Aggregated performance summary
 */
export const PerformanceSummarySchema = z.object({
  totalQueries: z.number().int().nonnegative().default(0).describe('Total queries executed'),
  successfulQueries: z.number().int().nonnegative().default(0).describe('Successful queries'),
  failedQueries: z.number().int().nonnegative().default(0).describe('Failed queries'),
  cachedQueries: z.number().int().nonnegative().default(0).describe('Queries served from cache'),
  poolQueries: z.number().int().nonnegative().default(0).describe('Queries using browser pool'),
  legacyQueries: z.number().int().nonnegative().default(0).describe('Queries using legacy mode'),
  sessionFallbacks: z.number().int().nonnegative().default(0).describe('Times pool fell back to legacy'),
  totalDurationSeconds: z.number().nonnegative().default(0).describe('Total time spent on queries'),
  poolDurationSeconds: z.number().nonnegative().default(0).describe('Time spent in pool queries'),
  legacyDurationSeconds: z.number().nonnegative().default(0).describe('Time spent in legacy queries'),
  cacheDurationSeconds: z.number().nonnegative().default(0).describe('Time spent on cached queries'),
  averageDurationSeconds: z.number().nonnegative().default(0).describe('Average query duration'),
  successRate: z.number().min(0).max(1).default(0).describe('Success rate (0-1)'),
  cacheHitRate: z.number().min(0).max(1).default(0).describe('Cache hit rate (0-1)'),
});

export type PerformanceSummary = z.infer<typeof PerformanceSummarySchema>;
