/**
 * Performance Monitoring Module for NotebookLM TypeScript
 * Tracks query timing, success rates, and performance metrics.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Paths } from '../core/paths.js';
import {
  QueryMetrics,
  SessionMetrics,
  PerformanceSummary,
  QueryMetricsSchema,
  PerformanceSummarySchema,
} from '../types/performance.js';

/**
 * Counters for tracking query statistics
 */
interface Counters {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  cachedQueries: number;
  poolQueries: number;
  legacyQueries: number;
  sessionFallbacks: number;
}

/**
 * Timing accumulators for performance tracking
 */
interface Timing {
  totalDuration: number;
  poolDuration: number;
  legacyDuration: number;
  cacheDuration: number;
}

/**
 * Persisted metrics data structure
 */
interface PersistedMetrics {
  counters: Counters;
  timing: Timing;
  startTime: number;
  savedAt: number;
}

/**
 * PerformanceMonitor - Track and analyze NotebookLM query performance
 *
 * Tracks:
 * - Query duration (total, browser pool, legacy)
 * - Cache hit/miss rates
 * - Success/failure rates
 * - Session statistics
 * - Average response times
 */
export class PerformanceMonitor {
  private static readonly DEFAULT_HISTORY_SIZE = 1000;
  private static readonly METRICS_FILE = 'performance_metrics.json';

  private readonly historySize: number;
  private readonly metricsFilePath: string;
  private readonly queryHistory: QueryMetrics[] = [];
  private readonly sessionHistory: SessionMetrics[] = [];
  private currentSession: SessionMetrics | null = null;
  private startTime: number;

  private counters: Counters = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    cachedQueries: 0,
    poolQueries: 0,
    legacyQueries: 0,
    sessionFallbacks: 0,
  };

  private timing: Timing = {
    totalDuration: 0,
    poolDuration: 0,
    legacyDuration: 0,
    cacheDuration: 0,
  };

  constructor(historySize?: number) {
    this.historySize = historySize || PerformanceMonitor.DEFAULT_HISTORY_SIZE;
    const paths = Paths.getInstance();
    this.metricsFilePath = join(paths.dataDir, PerformanceMonitor.METRICS_FILE);
    this.startTime = Date.now() / 1000;
  }

  /**
   * Initialize the monitor by loading persisted metrics
   */
  async initialize(): Promise<void> {
    await this.loadMetrics();
  }

  /**
   * Load persisted metrics from disk
   */
  private async loadMetrics(): Promise<void> {
    try {
      const data = await fs.readFile(this.metricsFilePath, 'utf-8');
      const parsed = JSON.parse(data) as PersistedMetrics;

      this.counters = { ...this.counters, ...parsed.counters };
      this.timing = { ...this.timing, ...parsed.timing };
      this.startTime = parsed.startTime;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        console.warn(`⚠️ Could not load metrics: ${error.message}`);
      }
    }
  }

  /**
   * Save metrics to disk
   */
  private async saveMetrics(): Promise<void> {
    try {
      const paths = Paths.getInstance();
      await fs.mkdir(paths.dataDir, { recursive: true });

      const data: PersistedMetrics = {
        counters: this.counters,
        timing: this.timing,
        startTime: this.startTime,
        savedAt: Date.now() / 1000,
      };

      await fs.writeFile(
        this.metricsFilePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.warn(
        `⚠️ Could not save metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Start a new browser session
   */
  startSession(sessionId: string): void {
    this.currentSession = {
      sessionId,
      startTime: Date.now() / 1000,
      endTime: null,
      queriesCount: 0,
      errorsCount: 0,
    };
  }

  /**
   * End the current browser session
   */
  async endSession(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.endTime = Date.now() / 1000;
      this.sessionHistory.push(this.currentSession);

      if (this.sessionHistory.length > 100) {
        this.sessionHistory.shift();
      }

      this.currentSession = null;
      await this.saveMetrics();
    }
  }

  /**
   * Record metrics for a completed query
   */
  async recordQuery(
    durationSeconds: number,
    question: string,
    answer: string,
    options: {
      fromCache?: boolean;
      usePool?: boolean;
      success?: boolean;
      error?: string;
      notebookUrl?: string;
    } = {}
  ): Promise<void> {
    const {
      fromCache = false,
      usePool = true,
      success = true,
      error,
      notebookUrl,
    } = options;

    this.counters.totalQueries += 1;

    if (success) {
      this.counters.successfulQueries += 1;
    } else {
      this.counters.failedQueries += 1;
    }

    if (fromCache) {
      this.counters.cachedQueries += 1;
      this.timing.cacheDuration += durationSeconds;
    }

    if (usePool) {
      this.counters.poolQueries += 1;
      this.timing.poolDuration += durationSeconds;
    } else {
      this.counters.legacyQueries += 1;
      this.timing.legacyDuration += durationSeconds;
    }

    this.timing.totalDuration += durationSeconds;

    if (this.currentSession) {
      this.currentSession.queriesCount += 1;
      if (!success) {
        this.currentSession.errorsCount += 1;
      }
    }

    const metrics: QueryMetrics = {
      timestamp: Date.now() / 1000,
      questionLength: question.length,
      answerLength: answer.length,
      durationSeconds,
      fromCache,
      success,
      errorType: error || null,
      notebookUrl: notebookUrl || null,
    };

    const validated = QueryMetricsSchema.parse(metrics);
    this.queryHistory.push(validated);

    if (this.queryHistory.length > this.historySize) {
      this.queryHistory.shift();
    }

    if (this.counters.totalQueries % 10 === 0) {
      await this.saveMetrics();
    }
  }

  /**
   * Record when a fallback from pool to legacy occurred
   */
  recordFallback(): void {
    this.counters.sessionFallbacks += 1;
  }

  /**
   * Get a summary of performance metrics
   */
  getSummary(): PerformanceSummary {
    const total = this.counters.totalQueries;

    const avgTotal = this.timing.totalDuration / Math.max(total, 1);

    const successRate = this.counters.successfulQueries / Math.max(total, 1);
    const cacheHitRate = this.counters.cachedQueries / Math.max(total, 1);

    const summary: PerformanceSummary = {
      totalQueries: total,
      successfulQueries: this.counters.successfulQueries,
      failedQueries: this.counters.failedQueries,
      cachedQueries: this.counters.cachedQueries,
      poolQueries: this.counters.poolQueries,
      legacyQueries: this.counters.legacyQueries,
      sessionFallbacks: this.counters.sessionFallbacks,
      totalDurationSeconds: this.timing.totalDuration,
      poolDurationSeconds: this.timing.poolDuration,
      legacyDurationSeconds: this.timing.legacyDuration,
      cacheDurationSeconds: this.timing.cacheDuration,
      averageDurationSeconds: avgTotal,
      successRate,
      cacheHitRate,
    };

    return PerformanceSummarySchema.parse(summary);
  }

  /**
   * Get recent query metrics
   */
  getRecentQueries(count: number = 10): QueryMetrics[] {
    return this.queryHistory.slice(-count);
  }

  /**
   * Get the slowest queries
   */
  getSlowQueries(
    thresholdSeconds: number = 30,
    count: number = 10
  ): QueryMetrics[] {
    return this.queryHistory
      .filter((q) => q.durationSeconds >= thresholdSeconds)
      .sort((a, b) => b.durationSeconds - a.durationSeconds)
      .slice(0, count);
  }

  /**
   * Print a formatted performance report
   */
  printReport(): void {
    const summary = this.getSummary();

    let poolSpeedup = 0;
    if (
      this.counters.legacyQueries > 0 &&
      this.counters.poolQueries > 0
    ) {
      const avgLegacy =
        this.timing.legacyDuration / this.counters.legacyQueries;
      const avgPool = this.timing.poolDuration / this.counters.poolQueries;
      poolSpeedup = ((avgLegacy - avgPool) / avgLegacy) * 100;
    }

    let timeSaved = 0;
    if (this.counters.cachedQueries > 0) {
      const avgUncached =
        (this.timing.totalDuration - this.timing.cacheDuration) /
        Math.max(this.counters.totalQueries - this.counters.cachedQueries, 1);
      const avgCache =
        this.timing.cacheDuration / this.counters.cachedQueries;
      timeSaved = this.counters.cachedQueries * (avgUncached - avgCache);
    }

    const uptimeHours = (Date.now() / 1000 - this.startTime) / 3600;

    console.log('\n' + '='.repeat(60));
    console.log('📊 NOTEBOOKLM PERFORMANCE REPORT');
    console.log('='.repeat(60));

    console.log('\n📈 Query Statistics:');
    console.log(`  Total queries: ${summary.totalQueries}`);
    console.log(`  Success rate: ${(summary.successRate * 100).toFixed(1)}%`);
    console.log(`  Failed: ${summary.failedQueries}`);

    console.log('\n💾 Cache Performance:');
    console.log(`  Cached queries: ${summary.cachedQueries}`);
    console.log(`  Cache hit rate: ${(summary.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`  Time saved: ${timeSaved.toFixed(2)}s`);

    console.log('\n🚀 Browser Pool Performance:');
    console.log(`  Pool queries: ${summary.poolQueries}`);
    console.log(`  Legacy queries: ${summary.legacyQueries}`);
    const poolUsageRate =
      (summary.poolQueries / Math.max(summary.totalQueries, 1)) * 100;
    console.log(`  Pool usage: ${poolUsageRate.toFixed(1)}%`);
    console.log(`  Session fallbacks: ${summary.sessionFallbacks}`);
    console.log(`  Pool speedup: ${poolSpeedup.toFixed(1)}%`);

    console.log('\n⏱️ Timing Statistics:');
    console.log(`  Average query: ${summary.averageDurationSeconds.toFixed(2)}s`);
    console.log(
      `  Pool average: ${(summary.poolDurationSeconds / Math.max(summary.poolQueries, 1)).toFixed(2)}s`
    );
    console.log(
      `  Legacy average: ${(summary.legacyDurationSeconds / Math.max(summary.legacyQueries, 1)).toFixed(2)}s`
    );
    console.log(
      `  Cache average: ${(summary.cacheDurationSeconds / Math.max(summary.cachedQueries, 1)).toFixed(2)}s`
    );

    console.log('\n🕐 System:');
    console.log(`  Uptime: ${uptimeHours.toFixed(2)} hours`);

    console.log('='.repeat(60));
  }
}

/**
 * Global performance monitor instance
 */
let globalMonitor: PerformanceMonitor | null = null;

/**
 * Get or create the global performance monitor instance
 */
export async function getMonitor(): Promise<PerformanceMonitor> {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor();
    await globalMonitor.initialize();
  }
  return globalMonitor;
}

/**
 * Reset the global monitor (useful for testing)
 */
export function resetMonitor(): void {
  globalMonitor = null;
}
