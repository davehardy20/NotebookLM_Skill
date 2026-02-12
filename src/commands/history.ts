/**
 * History Command Handler
 * CLI commands for managing query history
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { QueryHistory, resetQueryHistory } from '../history/query-history.js';
import { askNotebookLM } from '../ask.js';
import { getNotebookLibrary } from '../notebook/notebook-manager.js';
import ora from 'ora';

/**
 * Add the 'history' command to the CLI program
 */
export function addHistoryCommand(program: Command): void {
  const historyCommand = program
    .command('history')
    .description('Manage query history - browse, search, and replay past queries');

  historyCommand
    .command('list')
    .description('List recent queries')
    .option('-l, --limit <n>', 'number of queries to show', '20')
    .action(async (options: { limit: string }) => {
      try {
        await handleListCommand(parseInt(options.limit, 10));
      } catch (error) {
        handleError(error);
      }
    });

  historyCommand
    .command('search <query>')
    .description('Search through query history')
    .action(async (query: string) => {
      try {
        await handleSearchCommand(query);
      } catch (error) {
        handleError(error);
      }
    });

  historyCommand
    .command('replay <id>')
    .description('Replay a query from history by ID')
    .option('--no-cache', 'disable response caching')
    .option('--no-pool', 'disable browser pool (use legacy mode)')
    .action(async (id: string, options: { cache: boolean; pool: boolean }) => {
      try {
        await handleReplayCommand(id, {
          useCache: options.cache,
          usePool: options.pool,
        });
      } catch (error) {
        handleError(error);
      }
    });

  historyCommand
    .command('export')
    .description('Export query history to Markdown')
    .option('-o, --output <path>', 'output file path')
    .action(async (options: { output?: string }) => {
      try {
        await handleExportCommand(options.output);
      } catch (error) {
        handleError(error);
      }
    });

  historyCommand
    .command('clear')
    .description('Clear all query history')
    .option('-f, --force', 'skip confirmation prompt')
    .action(async (options: { force?: boolean }) => {
      try {
        await handleClearCommand(options.force);
      } catch (error) {
        handleError(error);
      }
    });
}

/**
 * Handle the list command
 */
async function handleListCommand(limit: number): Promise<void> {
  const history = QueryHistory.getInstance();
  await history.initialize();

  const queries = await history.list(limit);

  if (queries.length === 0) {
    console.log(chalk.yellow('\n📭 No queries in history yet.\n'));
    return;
  }

  console.log(chalk.bold(`\n📜 Query History (showing ${queries.length} most recent):\n`));

  for (const query of queries) {
    const date = new Date(query.timestamp).toLocaleString();
    const cacheIndicator = query.fromCache ? chalk.gray(' [cache]') : '';
    
    console.log(`${chalk.cyan(query.id)} ${chalk.gray(date)}${cacheIndicator}`);
    console.log(`  ${chalk.bold('Q:')} ${query.question}`);
    console.log(`  ${chalk.gray('Notebook:')} ${query.notebookName}`);
    console.log(`  ${chalk.gray('Duration:')} ${query.duration}ms`);
    
    // Show first 100 chars of answer
    const preview = query.answer.substring(0, 100).replace(/\n/g, ' ');
    const ellipsis = query.answer.length > 100 ? '...' : '';
    console.log(`  ${chalk.gray('A:')} ${preview}${ellipsis}`);
    console.log();
  }
}

/**
 * Handle the search command
 */
async function handleSearchCommand(queryStr: string): Promise<void> {
  const history = QueryHistory.getInstance();
  await history.initialize();

  const results = await history.search(queryStr);

  if (results.length === 0) {
    console.log(chalk.yellow(`\n🔍 No queries found matching "${queryStr}"\n`));
    return;
  }

  console.log(chalk.bold(`\n🔍 Found ${results.length} query(s) matching "${queryStr}":\n`));

  for (const query of results) {
    const date = new Date(query.timestamp).toLocaleString();
    const cacheIndicator = query.fromCache ? chalk.gray(' [cache]') : '';
    
    console.log(`${chalk.cyan(query.id)} ${chalk.gray(date)}${cacheIndicator}`);
    console.log(`  ${chalk.bold('Q:')} ${query.question}`);
    console.log(`  ${chalk.gray('Notebook:')} ${query.notebookName}`);
    console.log();
  }
}

/**
 * Handle replay command
 */
async function handleReplayCommand(
  id: string,
  options: { useCache: boolean; usePool: boolean }
): Promise<void> {
  const history = QueryHistory.getInstance();
  await history.initialize();

  const record = await history.getById(id);

  if (!record) {
    console.log(chalk.yellow(`\n⚠️  Query not found: ${chalk.cyan(id)}\n`));
    console.log(chalk.gray('  Use "notebooklm history list" to see available queries\n'));
    process.exit(1);
  }

  console.log(chalk.bold('\n🔄 Replaying Query\n'));
  console.log(chalk.cyan(`  Question: ${record.question}`));
  console.log(chalk.gray(`  Notebook: ${record.notebookName}`));
  console.log(chalk.gray(`  Original duration: ${record.duration}ms\n`));

  const spinner = ora('Asking NotebookLM...').start();

  try {
    // Get notebook URL from library
    const library = getNotebookLibrary();
    await library.initialize();

    const notebook = library.getNotebook(record.notebookId);
    if (!notebook) {
      spinner.fail(`Notebook "${record.notebookId}" not found in library`);
      process.exit(1);
    }

    const result = await askNotebookLM(record.question, notebook.url, {
      useCache: options.useCache,
      useSessionPool: options.usePool,
    });

    if (!result) {
      spinner.fail('Failed to get answer from NotebookLM');
      process.exit(1);
    }

    spinner.succeed(chalk.green('Query completed'));

    console.log('\n' + chalk.bold('Answer:'));
    console.log(chalk.white(result.answer) + '\n');

    if (result.fromCache) {
      console.log(chalk.gray('  💾 Served from cache'));
    }

    const newDuration = Math.round(result.duration * 1000);
    console.log(chalk.gray(`  Duration: ${newDuration}ms (original: ${record.duration}ms)\n`));
  } catch (error) {
    spinner.fail('Error replaying query');
    throw error;
  }
}

/**
 * Handle the export command
 */
async function handleExportCommand(outputPath?: string): Promise<void> {
  const history = QueryHistory.getInstance();
  await history.initialize();

  const markdown = await history.exportToMarkdown();

  if (outputPath) {
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, markdown, 'utf-8');
    console.log(chalk.green(`\n✓ Exported history to ${outputPath}\n`));
  } else {
    console.log('\n' + markdown);
  }
}

/**
 * Handle clear command
 */
async function handleClearCommand(force?: boolean): Promise<void> {
  const history = QueryHistory.getInstance();
  await history.initialize();

  const queries = await history.list(1);

  if (queries.length === 0) {
    console.log(chalk.yellow('\n📭 History is already empty.\n'));
    return;
  }

  if (!force) {
    console.log(chalk.yellow('\n⚠️  This will permanently delete all query history.'));
    console.log(chalk.gray('   Use --force to skip this confirmation.\n'));

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Are you sure you want to continue? (yes/no): ', (ans) => {
        rl.close();
        resolve(ans.toLowerCase());
      });
    });

    if (answer !== 'yes') {
      console.log(chalk.gray('\n  Operation cancelled\n'));
      return;
    }
  }

  const spinner = ora('Clearing history...').start();

  try {
    const fs = await import('fs/promises');
    const pathModule = await import('path');
    const { Paths } = await import('../core/paths.js');

    const historyFile = pathModule.join(Paths.getInstance().dataDir, 'query_history.json');

    await fs.unlink(historyFile).catch(() => {
    });

    resetQueryHistory();

    spinner.succeed(chalk.green('History cleared'));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to clear history');
    throw error;
  }
}

/**
 * Handle errors from history commands
 */
function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`\n❌ Error: ${error.message}`);
  } else {
    console.error('\n❌ Unknown error occurred');
  }
  process.exit(1);
}
