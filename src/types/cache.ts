import { z } from 'zod';

/**
 * A single cached response entry
 */
export const CacheEntrySchema = z.object({
  question: z.string().describe('The question that was asked'),
  answer: z.string().describe('The cached answer from NotebookLM'),
  notebookUrl: z.string().url().describe('URL of notebook queried'),
  timestamp: z.number().describe('Unix timestamp when entry was cached'),
  hitCount: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe('Number of times this entry was retrieved'),
  sensitive: z
    .boolean()
    .optional()
    .describe('Whether entry contains sensitive content and was skipped from caching'),
});

export type CacheEntry = z.infer<typeof CacheEntrySchema>;

/**
 * Cache statistics and performance metrics
 */
export const CacheStatsSchema = z.object({
  hits: z.number().int().nonnegative().default(0).describe('Total cache hits'),
  misses: z.number().int().nonnegative().default(0).describe('Total cache misses'),
  evictions: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe('Total entries evicted due to size limit'),
  totalQueries: z.number().int().nonnegative().default(0).describe('Total queries processed'),
  hitRate: z.number().min(0).max(1).default(0).describe('Cache hit rate (0-1)'),
  size: z.number().int().nonnegative().default(0).describe('Current number of cached entries'),
  maxSize: z.number().int().positive().default(100).describe('Maximum cache size'),
});

export type CacheStats = z.infer<typeof CacheStatsSchema>;

/**
 * Complete cache state with entries and statistics
 */
export const CacheStateSchema = z.object({
  entries: z.array(CacheEntrySchema).default([]).describe('Array of cached entries'),
  stats: CacheStatsSchema.describe('Cache statistics'),
  savedAt: z.number().describe('Unix timestamp of last save'),
});

export type CacheState = z.infer<typeof CacheStateSchema>;
