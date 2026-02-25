/**
 * Performance Monitoring Module
 *
 * Provides comprehensive performance tracking for NotebookLM queries including:
 * - Query timing (total, pool, legacy, cache)
 * - Success/failure rates
 * - Cache hit rates
 * - Session statistics
 * - Query history
 */

export type { PerformanceSummary, QueryMetrics, SessionMetrics } from '../types/performance.js';
export { getMonitor, PerformanceMonitor, resetMonitor } from './performance-monitor.js';
