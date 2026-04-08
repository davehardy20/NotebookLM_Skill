import type { Command } from 'commander';
import { rm } from 'node:fs/promises';
import ora from 'ora';
import { getCache, resetCache } from '../cache/index.js';
import { Paths } from '../core/paths.js';

interface CleanupOptions {
  all?: boolean;
  cache?: boolean;
  browser?: boolean;
  logs?: boolean;
}

export function addCleanupCommand(program: Command): void {
  program
    .command('cleanup')
    .description('Clean up temporary files, cache, and browser data')
    .option('-a, --all', 'Remove all data (cache, browser state, logs)')
    .option('-c, --cache', 'Clear response cache only')
    .option('-b, --browser', 'Clear browser state only')
    .option('-l, --logs', 'Clear logs only')
    .action(async (options: CleanupOptions) => {
      const spinner = ora('Cleaning up...').start();

      try {
        const paths = Paths.getInstance();
        const results: string[] = [];

        const shouldCleanAll = options.all || (!options.cache && !options.browser && !options.logs);

        if (shouldCleanAll || options.cache) {
          const cache = getCache();
          const entryCount = cache.getSize();
          await cache.invalidate();
          resetCache();
          results.push(`Cleared ${entryCount} cache entries`);
        }

        if (shouldCleanAll || options.browser) {
          try {
            await rm(paths.browserStateDir, { recursive: true, force: true });
            results.push('Removed browser state directory');
          } catch {
            // Directory might not exist, ignore
          }
        }

        if (shouldCleanAll || options.logs) {
          try {
            await rm(paths.logsDir, { recursive: true, force: true });
            results.push('Removed logs directory');
          } catch {
            // Directory might not exist, ignore
          }
        }

        spinner.succeed('Cleanup complete');

        if (results.length > 0) {
          console.log('\nActions taken:');
          for (const result of results) {
            console.log(`  ✓ ${result}`);
          }
        } else {
          console.log('\nNo data to clean up');
        }
      } catch (error) {
        spinner.fail('Cleanup failed');
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
