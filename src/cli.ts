import { Command } from 'commander';
import packageJson from '../package.json' with { type: 'json' };
import { setupCleanupHandlers } from './browser/browser-pool.js';
import { addAskCommand } from './commands/ask.js';
import { addAuthCommand } from './commands/auth.js';
import { addCacheCommand } from './commands/cache.js';
import { addHistoryCommand } from './commands/history.js';
import { addNotebookCommand } from './commands/notebook.js';
import { addPerfCommand } from './commands/perf.js';
import { logger } from './core/logger.js';
import { Paths } from './core/paths.js';

const program = new Command();

program
  .name('notebooklm')
  .description('CLI tool for interacting with Google NotebookLM')
  .version(packageJson.version);

program
  .option('-v, --verbose', 'enable verbose logging')
  .option('-c, --config <path>', 'path to configuration file')
  .hook('preAction', async () => {
    setupCleanupHandlers();

    const paths = Paths.getInstance();
    try {
      await paths.ensureSecurePermissions();
    } catch (error) {
      logger.warn('Could not verify permissions', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

addAuthCommand(program);
addNotebookCommand(program);
addAskCommand(program);
addCacheCommand(program);
addPerfCommand(program);
addHistoryCommand(program);

program
  .command('cleanup')
  .description('Clean up temporary files, cache, and browser data')
  .action(() => {
    console.log('cleanup: Not implemented');
  });

program.on('command:*', operands => {
  console.error(`error: unknown command '${operands[0]}'`);
  console.error('Run "notebooklm --help" to see available commands');
  process.exit(1);
});

export function parse(args?: string[]): void {
  const argv = args || process.argv;
  const hasCommand = argv.slice(2).some(arg => !arg.startsWith('-') && arg.length > 0);

  if (!hasCommand) {
    program.help();
    process.exit(0);
  }

  program.parse(args);
}

parse();
