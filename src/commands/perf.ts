/**
 * Performance Command Handler
 * CLI commands for performance monitoring and reporting
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import { getMonitor } from '../performance/performance-monitor.js';

/**
 * Add 'perf' command with subcommands to CLI program
 *
 * @param program - The Commander program instance
 */
export function addPerfCommand(program: Command): void {
  const perfCommand = program.command('perf').description('Performance monitoring and reporting');

  perfCommand
    .command('report')
    .description('Show full performance report with detailed statistics')
    .option('--slow-threshold <seconds>', 'threshold for slow queries in seconds', '30')
    .option('--slow-count <count>', 'number of slow queries to show', '10')
    .option('--recent <count>', 'number of recent queries to show', '10')
    .action(async (options: { slowThreshold: string; slowCount: string; recent: string }) => {
      try {
        await handleReportCommand(options);
      } catch (error) {
        handleError(error);
      }
    });

  perfCommand
    .command('summary')
    .description('Show brief summary statistics')
    .action(async () => {
      try {
        await handleSummaryCommand();
      } catch (error) {
        handleError(error);
      }
    });
}

/**
 * Handle perf report command
 *
 * @param options - Command options
 */
async function handleReportCommand(options: {
  slowThreshold: string;
  slowCount: string;
  recent: string;
}): Promise<void> {
  const monitor = await getMonitor();
  const slowThreshold = parseFloat(options.slowThreshold);
  const slowCount = parseInt(options.slowCount, 10);
  const recentCount = parseInt(options.recent, 10);

  const summary = monitor.getSummary();

  let poolSpeedup = 0;
  if (summary.legacyQueries > 0 && summary.poolQueries > 0) {
    const avgLegacy = summary.legacyDurationSeconds / summary.legacyQueries;
    const avgPool = summary.poolDurationSeconds / summary.poolQueries;
    poolSpeedup = ((avgLegacy - avgPool) / avgLegacy) * 100;
  }

  let timeSaved = 0;
  if (summary.cachedQueries > 0) {
    const avgUncached =
      (summary.totalDurationSeconds - summary.cacheDurationSeconds) /
      Math.max(summary.totalQueries - summary.cachedQueries, 1);
    const avgCache = summary.cacheDurationSeconds / summary.cachedQueries;
    timeSaved = summary.cachedQueries * (avgUncached - avgCache);
  }

  // Approximate uptime based on total duration
  const startTime = Date.now() / 1000 - summary.totalDurationSeconds;
  const uptimeHours = (Date.now() / 1000 - startTime) / 3600;

  console.log('\n' + chalk.bold('='.repeat(60)));
  console.log(chalk.bold.cyan('📊 NOTEBOOKLM PERFORMANCE REPORT'));
  console.log(chalk.bold('='.repeat(60)));

  console.log('\n' + chalk.bold.yellow('📈 Query Statistics:'));
  console.log(`  ${chalk.white('Total queries:')} ${chalk.bold(summary.totalQueries)}`);
  console.log(
    `  ${chalk.white('Success rate:')} ${chalk.bold.green(
      `${(summary.successRate * 100).toFixed(1)}%`
    )}`
  );
  console.log(`  ${chalk.white('Successful:')} ${chalk.green(summary.successfulQueries)}`);
  console.log(`  ${chalk.white('Failed:')} ${chalk.red(summary.failedQueries)}`);

  console.log('\n' + chalk.bold.blue('💾 Cache Performance:'));
  console.log(`  ${chalk.white('Cached queries:')} ${chalk.bold(summary.cachedQueries)}`);
  console.log(
    `  ${chalk.white('Cache hit rate:')} ${chalk.bold.cyan(
      `${(summary.cacheHitRate * 100).toFixed(1)}%`
    )}`
  );
  console.log(`  ${chalk.white('Time saved:')} ${chalk.bold.green(`${timeSaved.toFixed(2)}s`)}`);

  console.log('\n' + chalk.bold.magenta('🚀 Browser Pool Performance:'));
  console.log(`  ${chalk.white('Pool queries:')} ${chalk.bold(summary.poolQueries)}`);
  console.log(`  ${chalk.white('Legacy queries:')} ${chalk.bold(summary.legacyQueries)}`);
  const poolUsageRate = (summary.poolQueries / Math.max(summary.totalQueries, 1)) * 100;
  console.log(`  ${chalk.white('Pool usage:')} ${chalk.bold.cyan(`${poolUsageRate.toFixed(1)}%`)}`);
  console.log(`  ${chalk.white('Session fallbacks:')} ${chalk.red(summary.sessionFallbacks)}`);
  if (poolSpeedup > 0) {
    console.log(
      `  ${chalk.white('Pool speedup:')} ${chalk.bold.green(`+${poolSpeedup.toFixed(1)}%`)}`
    );
  }

  console.log('\n' + chalk.bold.yellow('⏱️ Timing Statistics:'));
  console.log(
    `  ${chalk.white('Average query:')} ${chalk.bold(`${summary.averageDurationSeconds.toFixed(2)}s`)}`
  );
  const avgPool = summary.poolQueries > 0 ? summary.poolDurationSeconds / summary.poolQueries : 0;
  const avgLegacy =
    summary.legacyQueries > 0 ? summary.legacyDurationSeconds / summary.legacyQueries : 0;
  const avgCache =
    summary.cachedQueries > 0 ? summary.cacheDurationSeconds / summary.cachedQueries : 0;

  console.log(`  ${chalk.white('Pool average:')} ${chalk.bold.green(`${avgPool.toFixed(2)}s`)}`);
  console.log(
    `  ${chalk.white('Legacy average:')} ${chalk.bold.yellow(`${avgLegacy.toFixed(2)}s`)}`
  );
  console.log(`  ${chalk.white('Cache average:')} ${chalk.bold.cyan(`${avgCache.toFixed(2)}s`)}`);

  console.log('\n' + chalk.bold.gray('🕐 System:'));
  console.log(`  ${chalk.white('Uptime:')} ${chalk.bold(`${uptimeHours.toFixed(2)} hours`)}`);

  const recentQueries = monitor.getRecentQueries(recentCount);
  if (recentQueries.length > 0) {
    console.log('\n' + chalk.bold.white('📋 Recent Queries:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(
      chalk.gray(
        `  ${'Time'.padEnd(12)} ${'Duration'.padEnd(12)} ${'Q-Len'.padEnd(8)} ${'A-Len'.padEnd(8)} ${'Source'}`
      )
    );
    console.log(chalk.gray('─'.repeat(60)));
    for (const query of recentQueries) {
      const time = new Date(query.timestamp * 1000).toLocaleTimeString();
      const duration = `${query.durationSeconds.toFixed(2)}s`;
      const qLen = query.questionLength;
      const aLen = query.answerLength;
      const source = query.fromCache ? chalk.cyan('CACHE') : chalk.green('NEW');

      console.log(
        `  ${chalk.white(time.padEnd(12))} ${chalk.white(duration.padEnd(12))} ${chalk.gray(
          String(qLen).padEnd(8)
        )} ${chalk.gray(String(aLen).padEnd(8))} ${source}`
      );
    }
  }

  const slowQueries = monitor.getSlowQueries(slowThreshold, slowCount);
  if (slowQueries.length > 0) {
    console.log('\n' + chalk.bold.red('🐌 Slow Queries (>30s):'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(
      chalk.gray(
        `  ${'Time'.padEnd(12)} ${'Duration'.padEnd(12)} ${'Q-Len'.padEnd(8)} ${'A-Len'.padEnd(8)} ${'Status'}`
      )
    );
    console.log(chalk.gray('─'.repeat(60)));
    for (const query of slowQueries) {
      const time = new Date(query.timestamp * 1000).toLocaleTimeString();
      const duration = chalk.red.bold(`${query.durationSeconds.toFixed(2)}s`);
      const qLen = query.questionLength;
      const aLen = query.answerLength;
      const status = query.success ? chalk.green('✓') : chalk.red('✗');

      console.log(
        `  ${chalk.white(time.padEnd(12))} ${duration.padEnd(12)} ${chalk.gray(
          String(qLen).padEnd(8)
        )} ${chalk.gray(String(aLen).padEnd(8))} ${status}`
      );
    }
  }

  console.log(chalk.bold('='.repeat(60)));
  console.log('');
}

/**
 * Handle perf summary command
 */
async function handleSummaryCommand(): Promise<void> {
  const monitor = await getMonitor();
  const summary = monitor.getSummary();

  console.log('');
  console.log(chalk.bold.cyan('📊 Performance Summary'));
  console.log(chalk.gray('─'.repeat(40)));

  console.log(
    `${chalk.white('Queries:')} ${chalk.bold(summary.totalQueries)} ${chalk.gray(
      `(${summary.successfulQueries} ✓, ${summary.failedQueries} ✗)`
    )}`
  );

  const successRate = (summary.successRate * 100).toFixed(1);
  const cacheHitRate = (summary.cacheHitRate * 100).toFixed(1);
  const avgDuration = summary.averageDurationSeconds.toFixed(2);

  console.log(`${chalk.white('Success rate:')} ${chalk.bold.green(`${successRate}%`)}`);
  console.log(`${chalk.white('Cache hit rate:')} ${chalk.bold.cyan(`${cacheHitRate}%`)}`);
  console.log(`${chalk.white('Avg duration:')} ${chalk.bold(`${avgDuration}s`)}`);

  if (summary.poolQueries > 0 || summary.legacyQueries > 0) {
    const poolUsage = ((summary.poolQueries / summary.totalQueries) * 100).toFixed(1);
    console.log(`${chalk.white('Pool usage:')} ${chalk.bold.magenta(`${poolUsage}%`)}`);
  }

  console.log(chalk.gray('─'.repeat(40)));
  console.log('');
}

/**
 * Handle errors from perf commands
 *
 * @param error - The error to handle
 */
function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`\n${chalk.red('❌ Error:')} ${error.message}`);
  } else {
    console.error(`\n${chalk.red('❌ Unknown error occurred')}`);
  }

  process.exit(1);
}
