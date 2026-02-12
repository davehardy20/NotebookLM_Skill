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

export { PerformanceMonitor, getMonitor, resetMonitor } from './performance-monitor.js';
export type { QueryMetrics, SessionMetrics, PerformanceSummary } from '../types/performance.js';
