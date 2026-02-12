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
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { Paths } from '../core/paths';
import { CacheEntry, CacheStats } from '../types/cache';

/**
 * Internal cache entry with metadata
 */
interface InternalCacheEntry extends CacheEntry {
  ageSeconds(): number;
  ageFormatted(): string;
  isExpired(ttlSeconds: number): boolean;
}

/**
 * Persisted cache state
 */
interface PersistedCacheState {
  entries: Record<string, CacheEntry>;
  stats: {
    hits: number;
    misses: number;
    evictions: number;
    totalQueries: number;
  };
  savedAt: number;
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
  private static readonly DEFAULT_MAX_SIZE = 100;
  private static readonly DEFAULT_TTL_SECONDS = 86400; // 24 hours

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
    this.maxSize = maxSize ?? ResponseCache.DEFAULT_MAX_SIZE;
    this.ttlSeconds = ttlSeconds ?? ResponseCache.DEFAULT_TTL_SECONDS;

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
      const data = await fs.readFile(this.cacheFile, 'utf-8');
      const state: PersistedCacheState = JSON.parse(data);

      // Load cache entries, skipping expired ones
      Object.entries(state.entries).forEach(([key, entry]) => {
        const internalEntry = this.createInternalEntry(entry);
        if (!internalEntry.isExpired(this.ttlSeconds)) {
          this.cache.set(key, internalEntry);
        }
      });

      // Load stats
      if (state.stats) {
        this.stats = { ...state.stats };
      }

      console.log(`  📦 Loaded ${this.cache.size} cached responses`);
    } catch (error) {
      // File doesn't exist or is invalid - start fresh
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`  ⚠️ Could not load cache: ${error}`);
      }
      this.cache.clear();
    }
  }

  /**
   * Save cache to disk
   */
  private async persistToFile(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(this.cacheFile), { recursive: true });

      const entries: Record<string, CacheEntry> = {};
      this.cache.forEach((entry, key) => {
        entries[key] = {
          question: entry.question,
          answer: entry.answer,
          notebookUrl: entry.notebookUrl,
          timestamp: entry.timestamp,
          hitCount: entry.hitCount,
        };
      });

      const state: PersistedCacheState = {
        entries,
        stats: this.stats,
        savedAt: Date.now(),
      };

      await fs.writeFile(
        this.cacheFile,
        JSON.stringify(state, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.warn(`  ⚠️ Could not save cache: ${error}`);
    }
  }

  /**
   * Create an internal cache entry with helper methods
   */
  private createInternalEntry(entry: CacheEntry): InternalCacheEntry {
    return {
      ...entry,
      ageSeconds: function () {
        return (Date.now() - this.timestamp) / 1000;
      },
      ageFormatted: function () {
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
      },
      isExpired: function (ttlSeconds: number) {
        return this.ageSeconds() > ttlSeconds;
      },
    };
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

    // Check expiration
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
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }

    // Store new entry
    const entry = this.createInternalEntry({
      question,
      answer,
      notebookUrl,
      timestamp: Date.now(),
      hitCount: 0,
    });

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    // Persist periodically (every 5 writes)
    this.writesSinceLastSave++;
    if (this.writesSinceLastSave % 5 === 0) {
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
      // Clear all
      const count = this.cache.size;
      this.cache.clear();
      await this.persistToFile();
      return count;
    }

    // Selective invalidation
    const toRemove: string[] = [];
    this.cache.forEach((entry, key) => {
      if (notebookUrl && entry.notebookUrl === notebookUrl) {
        toRemove.push(key);
      } else if (
        question &&
        entry.question.toLowerCase().trim() ===
          question.toLowerCase().trim()
      ) {
        toRemove.push(key);
      }
    });

    toRemove.forEach((key) => {
      this.cache.delete(key);
    });

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
    this.cache.forEach((entry, key) => {
      if (entry.isExpired(this.ttlSeconds)) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach((key) => {
      this.cache.delete(key);
    });

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

    const entries = Array.from(this.cache.values());
    // Sort by most recent first
    entries.sort((a, b) => b.timestamp - a.timestamp);

    if (limit) {
      return entries.slice(0, limit);
    }

    return entries;
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
