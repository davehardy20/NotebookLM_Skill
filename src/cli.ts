import { Command } from 'commander';
import packageJson from '../package.json' with { type: 'json' };
import { addAskCommand } from './commands/ask.js';
import { addNotebookCommand } from './commands/notebook.js';
import { addCacheCommand } from './commands/cache.js';
import { addPerfCommand } from './commands/perf.js';

const program = new Command();

program
  .name('notebooklm')
  .description('CLI tool for interacting with Google NotebookLM')
  .version(packageJson.version);

program
  .option('-v, --verbose', 'enable verbose logging')
  .option('-c, --config <path>', 'path to configuration file');

program
  .command('auth <command>')
  .description('Manage authentication (setup, status, refresh, logout)')
  .action((command: string) => {
    console.log(`auth ${command}: Not implemented`);
  });

addNotebookCommand(program);
addAskCommand(program);
addCacheCommand(program);

addPerfCommand(program);

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
