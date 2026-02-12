/**
 * Cache Command Handler
 * CLI command for managing the response cache
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getCache, ResponseCache } from '../cache/response-cache.js';
import type { CacheStats, CacheEntry } from '../types/cache.js';

/**
 * Add 'cache' command with subcommands to the CLI program
 *
 * @param program - The Commander program instance
 */
export function addCacheCommand(program: Command): void {
  const cache = new Command('cache')
    .description('Manage response cache (stats, list, clear, cleanup)');

  cache
    .command('stats')
    .description('Show cache statistics (hits, misses, hit rate, size)')
    .action(async () => {
      await handleStatsCommand();
    });

  cache
    .command('list')
    .description('List cached entries with age and hit count')
    .option('-l, --limit <number>', 'maximum number of entries to show', '20')
    .action(async (options: { limit: string }) => {
      await handleListCommand(parseInt(options.limit, 10));
    });

  cache
    .command('clear')
    .description('Clear all cache entries with confirmation')
    .action(async () => {
      await handleClearCommand();
    });

  cache
    .command('cleanup')
    .description('Remove expired entries only')
    .action(async () => {
      await handleCleanupCommand();
    });

  program.addCommand(cache);
}

/**
 * Handle the cache stats command
 */
async function handleStatsCommand(): Promise<void> {
  const spinner = ora('Loading cache statistics...').start();

  try {
    const cache = getCache();
    const stats = await cache.getStats();

    spinner.stop();

    console.log('\n' + chalk.bold.blue('📊 Cache Statistics\n'));

    const hitRatePercent = (stats.hitRate * 100).toFixed(2);

    console.log(`  ${chalk.cyan('Total Queries:')}  ${stats.totalQueries}`);
    console.log(`  ${chalk.green('Hits:')}           ${stats.hits}`);
    console.log(`  ${chalk.red('Misses:')}         ${stats.misses}`);
    console.log(`  ${chalk.yellow('Evictions:')}     ${stats.evictions}`);
    console.log(`  ${chalk.magenta('Hit Rate:')}       ${hitRatePercent}%`);
    console.log(`  ${chalk.blue('Current Size:')}   ${stats.size}/${stats.maxSize}`);

    console.log('\n' + chalk.bold('Cache Health:'));
    if (stats.hitRate > 0.8) {
      console.log(`  ${chalk.green.bold('●')} Excellent (${hitRatePercent}% hit rate)`);
    } else if (stats.hitRate > 0.5) {
      console.log(`  ${chalk.yellow.bold('●')} Good (${hitRatePercent}% hit rate)`);
    } else if (stats.hitRate > 0.2) {
      console.log(`  ${chalk.hex('#FFA500').bold('●')} Fair (${hitRatePercent}% hit rate)`);
    } else {
      console.log(`  ${chalk.red.bold('●')} Poor (${hitRatePercent}% hit rate)`);
    }

    console.log('');
  } catch (error) {
    spinner.fail('Failed to load cache statistics');
    throw error;
  }
}

/**
 * Handle the cache list command
 *
 * @param limit - Maximum number of entries to display
 */
async function handleListCommand(limit: number): Promise<void> {
  const spinner = ora('Loading cached entries...').start();

  try {
    const cache = getCache();
    const entries = await cache.getEntries(limit);

    spinner.stop();

    if (entries.length === 0) {
      console.log('\n' + chalk.yellow('⚠ No cached entries found.\n'));
      return;
    }

    console.log(`\n${chalk.bold.blue(`📝 Cached Entries (${entries.length})`)}\n`);

    entries.forEach((entry, index) => {
      const age = formatAge(entry.timestamp);
      const prefix = `${index + 1}.`.padEnd(4);
      const hitBadge = entry.hitCount > 0
        ? chalk.green(`[${entry.hitCount} hit${entry.hitCount > 1 ? 's' : ''}]`)
        : chalk.gray('[unused]');

      console.log(`  ${chalk.bold(prefix)} ${chalk.cyan(truncate(entry.question, 50))}`);
      console.log(`     ${chalk.gray(hitBadge)} ${chalk.gray(age)} old`);
      console.log(`     ${chalk.dim('→')} ${chalk.gray(truncate(entry.answer, 60))}`);
      console.log('');
    });
  } catch (error) {
    spinner.fail('Failed to load cached entries');
    throw error;
  }
}

/**
 * Handle the cache clear command
 */
async function handleClearCommand(): Promise<void> {
  const spinner = ora();

  try {
    const cache = getCache();
    const stats = await cache.getStats();

    if (stats.size === 0) {
      console.log('\n' + chalk.yellow('⚠ Cache is already empty.\n'));
      return;
    }

    console.log(
      chalk.yellow(`\n⚠ You are about to clear ${stats.size} cached entries.\n`)
    );
    console.log(chalk.gray('This action cannot be undone.\n'));

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(chalk.cyan('Are you sure? (y/N): '), (input) => {
        rl.close();
        resolve(input.trim().toLowerCase());
      });
    });

    if (answer !== 'y') {
      console.log(chalk.gray('\n✖ Cache clear cancelled.\n'));
      return;
    }

    spinner.start('Clearing cache...');

    const cleared = await cache.invalidate();

    spinner.stop();

    console.log(chalk.green(`\n✓ Cleared ${cleared} entries from cache.\n`));
  } catch (error) {
    spinner.fail('Failed to clear cache');
    throw error;
  }
}

/**
 * Handle the cache cleanup command
 */
async function handleCleanupCommand(): Promise<void> {
  const spinner = ora('Cleaning up expired entries...').start();

  try {
    const cache = getCache();
    const removed = await cache.cleanupExpired();

    spinner.stop();

    if (removed === 0) {
      console.log('\n' + chalk.green('✓ No expired entries found.\n'));
    } else {
      console.log(chalk.green(`\n✓ Removed ${removed} expired entries from cache.\n`));
    }
  } catch (error) {
    spinner.fail('Failed to cleanup cache');
    throw error;
  }
}

/**
 * Format age from timestamp to human-readable string
 *
 * @param timestamp - Unix timestamp
 * @returns Formatted age string (e.g., "2h 30m")
 */
function formatAge(timestamp: number): string {
  const ageSeconds = Math.floor(Date.now() / 1000 - timestamp);

  if (ageSeconds < 60) {
    return `${ageSeconds}s`;
  } else if (ageSeconds < 3600) {
    const minutes = Math.floor(ageSeconds / 60);
    return `${minutes}m`;
  } else if (ageSeconds < 86400) {
    const hours = Math.floor(ageSeconds / 3600);
    const minutes = Math.floor((ageSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  } else {
    const days = Math.floor(ageSeconds / 86400);
    const hours = Math.floor((ageSeconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  }
}

/**
 * Truncate text to maximum length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}
