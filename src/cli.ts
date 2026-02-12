import { Command } from 'commander';
import packageJson from '../package.json' with { type: 'json' };
import { addAuthCommand } from './commands/auth.js';
import { addAskCommand } from './commands/ask.js';
import { addNotebookCommand } from './commands/notebook.js';
import { addCacheCommand } from './commands/cache.js';
import { addPerfCommand } from './commands/perf.js';
import { addHistoryCommand } from './commands/history.js';

const program = new Command();

program
  .name('notebooklm')
  .description('CLI tool for interacting with Google NotebookLM')
  .version(packageJson.version);

program
  .option('-v, --verbose', 'enable verbose logging')
  .option('-c, --config <path>', 'path to configuration file');

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

program.on('command:*', (operands) => {
  console.error(`error: unknown command '${operands[0]}'`);
  console.error('Run "notebooklm --help" to see available commands');
  process.exit(1);
});

export function parse(args?: string[]): void {
  program.parse(args);
}

parse();
