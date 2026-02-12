/**
 * Response Cache Module for NotebookLM TypeScript
 * Provides LRU caching for NotebookLM query responses to avoid redundant API calls.
 *
 * Features:
 * - LRU cache with configurable size and TTL
 * - Persistent cache storage across sessions
 * - Cache statistics and management
 * - Automatic cache invalidation based on age
 */

import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { z } from 'zod';
import { Paths } from '../core/paths.js';
import { logger } from '../core/logger.js';
import { CacheEntry, CacheEntrySchema, CacheStats } from '../types/cache.js';

const DEFAULT_MAX_SIZE = 100;
const DEFAULT_TTL_SECONDS = 86400; // 24 hours
const AUTO_SAVE_THRESHOLD = 5;

/**
 * Persisted cache state for JSON serialization with Zod validation
 */
const PersistedCacheStateSchema = z.object({
  entries: z.record(z.string(), CacheEntrySchema),
  stats: z.object({
    hits: z.number().int().nonnegative().default(0),
    misses: z.number().int().nonnegative().default(0),
    evictions: z.number().int().nonnegative().default(0),
    totalQueries: z.number().int().nonnegative().default(0),
  }),
  savedAt: z.number(),
});

type PersistedCacheState = z.infer<typeof PersistedCacheStateSchema>;

/**
 * Internal cache entry with helper methods
 */
class InternalCacheEntry {
  question: string;
  answer: string;
  notebookUrl: string;
  timestamp: number;
  hitCount: number;

  constructor(question: string, answer: string, notebookUrl: string, timestamp?: number, hitCount: number = 0) {
    this.question = question;
    this.answer = answer;
    this.notebookUrl = notebookUrl;
    this.timestamp = timestamp ?? Date.now() / 1000;
    this.hitCount = hitCount;
  }

  isExpired(ttlSeconds: number): boolean {
    return (Date.now() / 1000 - this.timestamp) > ttlSeconds;
  }

  ageSeconds(): number {
    return Date.now() / 1000 - this.timestamp;
  }

  ageFormatted(): string {
    const age = this.ageSeconds();
    if (age < 60) {
      return `${Math.floor(age)}s`;
    } else if (age < 3600) {
      return `${Math.floor(age / 60)}m`;
    } else if (age < 86400) {
      return `${Math.floor(age / 3600)}h`;
    } else {
      return `${Math.floor(age / 86400)}d`;
    }
  }

  toCacheEntry(): CacheEntry {
    return {
      question: this.question,
      answer: this.answer,
      notebookUrl: this.notebookUrl,
      timestamp: this.timestamp,
      hitCount: this.hitCount,
    };
  }
}

/**
 * LRU Cache for NotebookLM responses with persistence.
 *
 * Configuration via environment variables or defaults:
 * - CACHE_ENABLED: Enable/disable caching (default: true)
 * - CACHE_MAX_SIZE: Maximum number of entries (default: 100)
 * - CACHE_TTL_SECONDS: Time-to-live for entries (default: 86400 = 24 hours)
 */
export class ResponseCache {
  private readonly maxSize: number;
  private readonly ttlSeconds: number;
  private readonly cacheFile: string;

  // Map maintains insertion order in ES6+, perfect for LRU
  private cache: Map<string, InternalCacheEntry> = new Map();

  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalQueries: 0,
  };

  private writesSinceLastSave = 0;
  private isLoaded = false;

  constructor(
    maxSize?: number,
    ttlSeconds?: number,
    cacheFile?: string
  ) {
    this.maxSize = maxSize ?? DEFAULT_MAX_SIZE;
    this.ttlSeconds = ttlSeconds ?? DEFAULT_TTL_SECONDS;

    if (cacheFile) {
      this.cacheFile = cacheFile;
    } else {
      const paths = Paths.getInstance();
      this.cacheFile = paths.cacheFile;
    }
  }

  /**
   * Initialize the cache by loading persisted data
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) return;
    await this.load();
    this.isLoaded = true;
  }

  /**
   * Generate a cache key from question and notebook URL
   */
  private generateKey(question: string, notebookUrl: string): string {
    const normalized = question.toLowerCase().trim();
    const keyData = `${normalized}:${notebookUrl}`;
    return createHash('md5').update(keyData).digest('hex');
  }

  /**
   * Load cache from disk
   */
  private async load(): Promise<void> {
    try {
      const data = await readFile(this.cacheFile, 'utf-8');
      const parsed = JSON.parse(data);
      const state = PersistedCacheStateSchema.parse(parsed);

      for (const [key, entry] of Object.entries(state.entries)) {
        const internalEntry = new InternalCacheEntry(
          entry.question,
          entry.answer,
          entry.notebookUrl,
          entry.timestamp,
          entry.hitCount
        );
        if (!internalEntry.isExpired(this.ttlSeconds)) {
          this.cache.set(key, internalEntry);
        }
      }

      this.stats = { ...state.stats } as typeof this.stats;
      logger.info(`Loaded ${this.cache.size} cached responses`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Cache file does not exist, starting with empty cache');
      } else {
        logger.warn(`Could not load cache: ${error}`);
        this.cache.clear();
      }
    }
  }

  /**
   * Save cache to disk
   */
  private async persistToFile(): Promise<void> {
    try {
      await mkdir(dirname(this.cacheFile), { recursive: true });

      const entries: Record<string, CacheEntry> = {};
      for (const [key, entry] of Array.from(this.cache.entries())) {
        entries[key] = entry.toCacheEntry();
      }

      const state: PersistedCacheState = {
        entries,
        stats: this.stats,
        savedAt: Date.now() / 1000,
      };

      await writeFile(this.cacheFile, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      logger.warn(`Could not save cache: ${error}`);
    }
  }

  /**
   * Get cached response if available and not expired
   */
  async get(question: string, notebookUrl: string): Promise<string | null> {
    await this.initialize();

    this.stats.totalQueries++;
    const key = this.generateKey(question, notebookUrl);

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (entry.isExpired(this.ttlSeconds)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    entry.hitCount++;
    this.cache.set(key, entry);
    this.stats.hits++;

    return entry.answer;
  }

  /**
   * Store a response in the cache
   */
  async set(
    question: string,
    answer: string,
    notebookUrl: string
  ): Promise<void> {
    await this.initialize();

    const key = this.generateKey(question, notebookUrl);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value as string;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    // Store new entry
    const entry = new InternalCacheEntry(question, answer, notebookUrl);

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    // Persist periodically (every 5 writes)
    this.writesSinceLastSave++;
    if (this.writesSinceLastSave % AUTO_SAVE_THRESHOLD === 0) {
      await this.persistToFile();
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(
    question?: string,
    notebookUrl?: string
  ): Promise<number> {
    await this.initialize();

    if (!question && !notebookUrl) {
      const count = this.cache.size;
      this.cache.clear();
      await this.persistToFile();
      return count;
    }

    const toRemove: string[] = [];
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (notebookUrl && entry.notebookUrl === notebookUrl) {
        toRemove.push(key);
      } else if (
        question &&
        entry.question.toLowerCase().trim() ===
          question.toLowerCase().trim()
      ) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      this.cache.delete(key);
    }

    if (toRemove.length > 0) {
      await this.persistToFile();
    }

    return toRemove.length;
  }

  /**
   * Remove all expired entries
   */
  async cleanupExpired(): Promise<number> {
    await this.initialize();

    const expiredKeys: string[] = [];
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.isExpired(this.ttlSeconds)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      await this.persistToFile();
    }

    return expiredKeys.length;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    await this.initialize();

    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      totalQueries: this.stats.totalQueries,
      hitRate,
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Get list of cache entries for inspection
   */
  async getEntries(limit?: number): Promise<CacheEntry[]> {
    await this.initialize();

    const entries = Array.from(this.cache.values())
      .map((e) => e.toCacheEntry())
      .sort((a, b) => b.timestamp - a.timestamp);

    return limit ? entries.slice(0, limit) : entries;
  }

  /**
   * Explicitly save cache to disk
   */
  async save(): Promise<void> {
    await this.persistToFile();
  }

  /**
   * Get current cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Check if cache is enabled
   */
  static isEnabled(): boolean {
    return process.env.CACHE_ENABLED !== 'false';
  }
}

// Global cache instance
let globalCache: ResponseCache | null = null;

/**
 * Get or create the global response cache instance
 */
export function getCache(): ResponseCache {
  if (!globalCache) {
    globalCache = new ResponseCache();
  }
  return globalCache;
}

/**
 * Reset the global cache instance (useful for testing)
 */
export function resetCache(): void {
  globalCache = null;
}
