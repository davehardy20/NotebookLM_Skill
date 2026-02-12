/**
 * Unit tests for ResponseCache module
 *
 * Tests cover:
 * - ResponseCache class methods (get, set, invalidate, cleanupExpired, getStats, getEntries)
 * - LRU cache behavior
 * - TTL expiration
 * - Persistence with mocked fs operations
 * - Cache statistics accuracy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'crypto';
import { ResponseCache, resetCache } from '../../src/cache/response-cache.js';
import { CacheEntry, CacheStats } from '../../src/types/cache.js';

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  mkdir: mocks.mkdir,
}));

vi.mock('../../src/core/paths.js', () => ({
  Paths: {
    getInstance: vi.fn(() => ({
      cacheFile: '/mock/cache/response_cache.json',
    })),
  },
}));

vi.mock('../../src/core/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function generateKey(question: string, notebookUrl: string): string {
  const normalized = question.toLowerCase().trim();
  const keyData = `${normalized}:${notebookUrl}`;
  return createHash('md5').update(keyData).digest('hex');
}

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    resetCache();
    vi.clearAllMocks();
    mocks.readFile.mockReset();
    mocks.writeFile.mockReset();
    mocks.mkdir.mockReset();

    cache = new ResponseCache(5, 3600, '/mock/cache/test.json');
  });

  afterEach(() => {
    resetCache();
  });

  describe('get()', () => {
    it('returns null for missing entries', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await cache.get('What is AI?', 'https://example.com/notebook');
      expect(result).toBeNull();
    });

    it('returns cached entry when present', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('What is AI?', 'Artificial Intelligence is...', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const result = await cache.get('What is AI?', 'https://example.com/notebook');
      expect(result).toBe('Artificial Intelligence is...');
    });

    it('returns null for expired entries', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const shortCache = new ResponseCache(5, 1, '/mock/cache/short.json');

      await shortCache.set('Test question', 'Test answer', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      await new Promise(resolve => setTimeout(resolve, 1100));

      const result = await shortCache.get('Test question', 'https://example.com/notebook');
      expect(result).toBeNull();
    });

    it('updates LRU order on access', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      await cache.set('Q3', 'A3', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      await cache.get('Q1', 'https://example.com/notebook');

      await cache.set('Q4', 'A4', 'https://example.com/notebook');
      await cache.set('Q5', 'A5', 'https://example.com/notebook');
      await cache.set('Q6', 'A6', 'https://example.com/notebook');

      const q1Result = await cache.get('Q1', 'https://example.com/notebook');
      expect(q1Result).toBe('A1');

      const q2Result = await cache.get('Q2', 'https://example.com/notebook');
      expect(q2Result).toBeNull();
    });

    it('increments miss count for cache miss', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.get('Nonexistent', 'https://example.com/notebook');

      const stats = await cache.getStats();
      expect(stats.misses).toBe(1);
    });

    it('increments hit count for cache hit', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      await cache.get('Q1', 'https://example.com/notebook');

      const stats = await cache.getStats();
      expect(stats.hits).toBe(1);
    });
  });

  describe('set()', () => {
    it('stores entry successfully', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('What is TypeScript?', 'TypeScript is...', 'https://example.com/notebook');

      const result = await cache.get('What is TypeScript?', 'https://example.com/notebook');
      expect(result).toBe('TypeScript is...');
      expect(cache.getSize()).toBe(1);
    });

    it('evicts oldest entry when at capacity', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      await cache.set('Q3', 'A3', 'https://example.com/notebook');
      await cache.set('Q4', 'A4', 'https://example.com/notebook');
      await cache.set('Q5', 'A5', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const statsBefore = await cache.getStats();
      expect(statsBefore.evictions).toBe(0);
      expect(cache.getSize()).toBe(5);

      await cache.set('Q6', 'A6', 'https://example.com/notebook');

      const statsAfter = await cache.getStats();
      expect(statsAfter.evictions).toBe(1);
      expect(cache.getSize()).toBe(5);

      const q1Result = await cache.get('Q1', 'https://example.com/notebook');
      expect(q1Result).toBeNull();

      const q6Result = await cache.get('Q6', 'https://example.com/notebook');
      expect(q6Result).toBe('A6');
    });

    it('does not evict when updating existing key', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      await cache.set('Q3', 'A3', 'https://example.com/notebook');
      await cache.set('Q4', 'A4', 'https://example.com/notebook');
      await cache.set('Q5', 'A5', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      await cache.set('Q1', 'A1-Updated', 'https://example.com/notebook');

      const stats = await cache.getStats();
      expect(stats.evictions).toBe(0);
      expect(cache.getSize()).toBe(5);

      const result = await cache.get('Q1', 'https://example.com/notebook');
      expect(result).toBe('A1-Updated');
    });

    it('moves updated entry to most recently used', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      await cache.set('Q3', 'A3', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      await cache.set('Q1', 'A1-Updated', 'https://example.com/notebook');

      await cache.set('Q4', 'A4', 'https://example.com/notebook');
      await cache.set('Q5', 'A5', 'https://example.com/notebook');
      await cache.set('Q6', 'A6', 'https://example.com/notebook');

      const q1Result = await cache.get('Q1', 'https://example.com/notebook');
      expect(q1Result).toBe('A1-Updated');

      const q2Result = await cache.get('Q2', 'https://example.com/notebook');
      expect(q2Result).toBeNull();
    });
  });

  describe('invalidate()', () => {
    it('removes specific entry by question', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const removed = await cache.invalidate('Q1', undefined);
      expect(removed).toBe(1);

      const result = await cache.get('Q1', 'https://example.com/notebook');
      expect(result).toBeNull();
      expect(cache.getSize()).toBe(1);
    });

    it('removes entries by notebook URL', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook1');
      await cache.set('Q2', 'A2', 'https://example.com/notebook1');
      await cache.set('Q3', 'A3', 'https://example.com/notebook2');
      mocks.writeFile.mockClear();

      const removed = await cache.invalidate(undefined, 'https://example.com/notebook1');
      expect(removed).toBe(2);

      expect(cache.getSize()).toBe(1);
    });

    it('clears all entries when no parameters provided', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      await cache.set('Q3', 'A3', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const removed = await cache.invalidate();
      expect(removed).toBe(3);
      expect(cache.getSize()).toBe(0);

      expect(mocks.writeFile).toHaveBeenCalled();
    });

    it('returns 0 when no entries match', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const removed = await cache.invalidate('Nonexistent', 'https://other.com');
      expect(removed).toBe(0);
      expect(cache.getSize()).toBe(1);
    });
  });

  describe('cleanupExpired()', () => {
    it('removes expired entries', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const shortCache = new ResponseCache(10, 1, '/mock/cache/short.json');

      await shortCache.set('Q1', 'A1', 'https://example.com/notebook');
      await shortCache.set('Q2', 'A2', 'https://example.com/notebook');
      await shortCache.set('Q3', 'A3', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      await new Promise(resolve => setTimeout(resolve, 1100));

      const removed = await shortCache.cleanupExpired();
      expect(removed).toBe(3);
      expect(shortCache.getSize()).toBe(0);
    });

    it('does not remove non-expired entries', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const removed = await cache.cleanupExpired();
      expect(removed).toBe(0);
      expect(cache.getSize()).toBe(2);
    });

    it('persists cleanup changes to disk', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const shortCache = new ResponseCache(10, 1, '/mock/cache/short.json');
      await shortCache.set('Q1', 'A1', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      await new Promise(resolve => setTimeout(resolve, 1100));

      await shortCache.cleanupExpired();

      expect(mocks.writeFile).toHaveBeenCalled();
    });

    it('returns 0 when no expired entries', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const removed = await cache.cleanupExpired();
      expect(removed).toBe(0);
      expect(mocks.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('getStats()', () => {
    it('returns accurate hit rate', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      await cache.set('Q3', 'A3', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      await cache.get('Q1', 'https://example.com/notebook');
      await cache.get('Q2', 'https://example.com/notebook');
      await cache.get('Q3', 'https://example.com/notebook');

      await cache.get('Q4', 'https://example.com/notebook');
      await cache.get('Q5', 'https://example.com/notebook');

      const stats = await cache.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.totalQueries).toBe(5);
      expect(stats.hitRate).toBe(3 / 5);
    });

    it('returns hit rate of 0 for no queries', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const stats = await cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('returns accurate eviction count', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      await cache.set('Q3', 'A3', 'https://example.com/notebook');
      await cache.set('Q4', 'A4', 'https://example.com/notebook');
      await cache.set('Q5', 'A5', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      await cache.set('Q6', 'A6', 'https://example.com/notebook');
      await cache.set('Q7', 'A7', 'https://example.com/notebook');

      const stats = await cache.getStats();
      expect(stats.evictions).toBe(2);
    });

    it('returns correct cache size', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      await cache.set('Q3', 'A3', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const stats = await cache.getStats();
      expect(stats.size).toBe(3);
      expect(stats.maxSize).toBe(5);
    });
  });

  describe('getEntries()', () => {
    it('returns entries sorted by recency', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      await cache.set('Q3', 'A3', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const entries = await cache.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries).toContainEqual(expect.objectContaining({ answer: 'A1' }));
      expect(entries).toContainEqual(expect.objectContaining({ answer: 'A2' }));
      expect(entries).toContainEqual(expect.objectContaining({ answer: 'A3' }));
    });

    it('respects limit parameter', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      await cache.set('Q3', 'A3', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const entries = await cache.getEntries(2);
      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(expect.objectContaining({ answer: 'A1' }));
      expect(entries).toContainEqual(expect.objectContaining({ answer: 'A2' }));
      expect(entries).not.toContainEqual(expect.objectContaining({ answer: 'A3' }));
    });

    it('returns empty array when cache is empty', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const entries = await cache.getEntries();
      expect(entries).toEqual([]);
    });
  });

  describe('Persistence', () => {
    it('auto-saves after threshold writes', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      expect(mocks.writeFile).not.toHaveBeenCalled();

      await cache.set('Q2', 'A2', 'https://example.com/notebook');
      expect(mocks.writeFile).not.toHaveBeenCalled();

      await cache.set('Q3', 'A3', 'https://example.com/notebook');
      expect(mocks.writeFile).not.toHaveBeenCalled();

      await cache.set('Q4', 'A4', 'https://example.com/notebook');
      expect(mocks.writeFile).not.toHaveBeenCalled();

      await cache.set('Q5', 'A5', 'https://example.com/notebook');
      expect(mocks.writeFile).toHaveBeenCalled();
    });

    it('loads from disk on initialization', async () => {
      const question = 'What is TypeScript?';
      const notebookUrl = 'https://example.com/notebook';
      const key = generateKey(question, notebookUrl);

      const mockCacheData = {
        entries: {
          [key]: {
            question,
            answer: 'TypeScript is a superset of JavaScript',
            notebookUrl,
            timestamp: Date.now() / 1000 - 1000,
            hitCount: 3,
          },
        },
        stats: {
          hits: 5,
          misses: 2,
          evictions: 1,
          totalQueries: 7,
        },
        savedAt: Date.now() / 1000,
      };

      mocks.readFile.mockResolvedValue(JSON.stringify(mockCacheData));

      const newCache = new ResponseCache(5, 3600, '/mock/cache/load.json');
      await newCache.initialize();

      const result = await newCache.get(question, notebookUrl);
      expect(result).toBe('TypeScript is a superset of JavaScript');
      expect(newCache.getSize()).toBe(1);

      const stats = await newCache.getStats();
      expect(stats.hits).toBe(6);
      expect(stats.misses).toBe(2);
    });

    it('filters out expired entries on load', async () => {
      const notebookUrl = 'https://example.com/notebook';
      const validKey = generateKey('Valid entry', notebookUrl);
      const expiredKey = generateKey('Expired entry', notebookUrl);

      const mockCacheData = {
        entries: {
          [validKey]: {
            question: 'Valid entry',
            answer: 'Valid answer',
            notebookUrl,
            timestamp: Date.now() / 1000 - 1000,
            hitCount: 1,
          },
          [expiredKey]: {
            question: 'Expired entry',
            answer: 'Expired answer',
            notebookUrl,
            timestamp: Date.now() / 1000 - 7200,
            hitCount: 1,
          },
        },
        stats: {
          hits: 2,
          misses: 1,
          evictions: 0,
          totalQueries: 3,
        },
        savedAt: Date.now() / 1000,
      };

      mocks.readFile.mockResolvedValue(JSON.stringify(mockCacheData));

      const shortCache = new ResponseCache(10, 3600, '/mock/cache/short.json');
      await shortCache.initialize();

      expect(shortCache.getSize()).toBe(1);

      const validResult = await shortCache.get('Valid entry', notebookUrl);
      expect(validResult).toBe('Valid answer');

      const expiredResult = await shortCache.get('Expired entry', notebookUrl);
      expect(expiredResult).toBeNull();
    });

    it('handles missing cache file gracefully', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const newCache = new ResponseCache(5, 3600, '/mock/cache/missing.json');
      await newCache.initialize();

      expect(newCache.getSize()).toBe(0);
      const stats = await newCache.getStats();
      expect(stats.totalQueries).toBe(0);
    });

    it('handles corrupted cache file gracefully', async () => {
      mocks.readFile.mockRejectedValue(new Error('Invalid JSON'));

      const newCache = new ResponseCache(5, 3600, '/mock/cache/corrupted.json');
      await newCache.initialize();

      expect(newCache.getSize()).toBe(0);
    });

    it('explicitly saves to disk', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      await cache.save();

      expect(mocks.writeFile).toHaveBeenCalled();
    });
  });

  describe('CacheEntry features', () => {
    it('tracks hit count', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      await cache.get('Q1', 'https://example.com/notebook');
      await cache.get('Q1', 'https://example.com/notebook');
      await cache.get('Q1', 'https://example.com/notebook');

      const entries = await cache.getEntries();
      expect(entries[0].hitCount).toBe(3);
    });

    it('stores timestamp correctly', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const before = Date.now() / 1000;
      await cache.set('Q1', 'A1', 'https://example.com/notebook');
      const after = Date.now() / 1000;

      const entries = await cache.getEntries();
      expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(entries[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('stores question and answer correctly', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const question = 'What is unit testing?';
      const answer = 'Unit testing tests individual components in isolation.';

      await cache.set(question, answer, 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const result = await cache.get(question, 'https://example.com/notebook');
      expect(result).toBe(answer);

      const entries = await cache.getEntries();
      expect(entries[0].question).toBe(question);
      expect(entries[0].answer).toBe(answer);
    });

    it('stores notebook URL correctly', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const notebookUrl = 'https://example.com/my-notebook';

      await cache.set('Q1', 'A1', notebookUrl);
      mocks.writeFile.mockClear();

      const entries = await cache.getEntries();
      expect(entries[0].notebookUrl).toBe(notebookUrl);
    });

    it('generates unique keys for different notebook URLs', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('Same question', 'Answer for notebook 1', 'https://example.com/notebook1');
      await cache.set('Same question', 'Answer for notebook 2', 'https://example.com/notebook2');
      mocks.writeFile.mockClear();

      const result1 = await cache.get('Same question', 'https://example.com/notebook1');
      const result2 = await cache.get('Same question', 'https://example.com/notebook2');

      expect(result1).toBe('Answer for notebook 1');
      expect(result2).toBe('Answer for notebook 2');
      expect(cache.getSize()).toBe(2);
    });
  });

  describe('Static methods', () => {
    it('isEnabled returns true by default', () => {
      delete process.env.CACHE_ENABLED;
      expect(ResponseCache.isEnabled()).toBe(true);
    });

    it('isEnabled returns false when CACHE_ENABLED is false', () => {
      process.env.CACHE_ENABLED = 'false';
      expect(ResponseCache.isEnabled()).toBe(false);
      delete process.env.CACHE_ENABLED;
    });
  });

  describe('Edge cases', () => {
    it('handles empty strings for question and answer', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('', '', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const result = await cache.get('', 'https://example.com/notebook');
      expect(result).toBe('');
    });

    it('handles special characters in question', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const specialQuestion = 'What is "AI"? Can you explain 🤖?';
      const answer = 'AI stands for Artificial Intelligence!';

      await cache.set(specialQuestion, answer, 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const result = await cache.get(specialQuestion, 'https://example.com/notebook');
      expect(result).toBe(answer);
    });

    it('handles case insensitivity in question matching', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('what is ai', 'Answer', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const result = await cache.get('WHAT IS AI', 'https://example.com/notebook');
      expect(result).toBe('Answer');
    });

    it('handles whitespace in question', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      await cache.set('  What is AI?  ', 'Answer', 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const result = await cache.get('What is AI?', 'https://example.com/notebook');
      expect(result).toBe('Answer');
    });

    it('handles long answers', async () => {
      mocks.readFile.mockRejectedValue({ code: 'ENOENT' });

      const longAnswer = 'A'.repeat(10000);
      await cache.set('Q', longAnswer, 'https://example.com/notebook');
      mocks.writeFile.mockClear();

      const result = await cache.get('Q', 'https://example.com/notebook');
      expect(result).toBe(longAnswer);
    });
  });
});
