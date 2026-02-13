/**
 * Notebook Command Handler
 * CLI commands for managing NotebookLM notebook library
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getNotebookLibrary } from '../notebook/notebook-manager.js';
import { validateNotebookUrl } from '../core/validation.js';

interface AddCommandOptions {
  name?: string;
  description?: string;
  topics?: string;
  contentTypes?: string;
  useCases?: string;
  tags?: string;
}

/**
 * Add the 'notebook' subcommand group to the CLI program
 *
 * @param program - The Commander program instance
 */
export function addNotebookCommand(program: Command): void {
  const notebookCmd = program.command('notebook').description('Manage NotebookLM notebook library');

  notebookCmd
    .command('add <url>')
    .description('Add a new notebook to the library')
    .option('-n, --name <name>', 'Display name for the notebook (required)')
    .option('-d, --description <description>', 'Description of notebook contents')
    .option('-t, --topics <topics>', 'Topics covered (comma-separated)')
    .option('-c, --content-types <types>', 'Content types (comma-separated)')
    .option('-u, --use-cases <cases>', 'Recommended use cases (comma-separated)')
    .option('--tags <tags>', 'Additional tags (comma-separated)')
    .action(async (url: string, options: AddCommandOptions) => {
      try {
        await handleAddCommand(url, options);
      } catch (error) {
        handleError(error);
      }
    });

  notebookCmd
    .command('list')
    .description('List all notebooks in the library')
    .action(async () => {
      try {
        await handleListCommand();
      } catch (error) {
        handleError(error);
      }
    });

  notebookCmd
    .command('search <query>')
    .description('Search notebooks by query')
    .action(async (query: string) => {
      try {
        await handleSearchCommand(query);
      } catch (error) {
        handleError(error);
      }
    });

  notebookCmd
    .command('activate <id>')
    .description('Set a notebook as active')
    .action(async (id: string) => {
      try {
        await handleActivateCommand(id);
      } catch (error) {
        handleError(error);
      }
    });

  notebookCmd
    .command('remove <id>')
    .description('Remove a notebook from the library')
    .action(async (id: string) => {
      try {
        await handleRemoveCommand(id);
      } catch (error) {
        handleError(error);
      }
    });

  notebookCmd
    .command('stats')
    .description('Show library statistics')
    .action(async () => {
      try {
        await handleStatsCommand();
      } catch (error) {
        handleError(error);
      }
    });
}

async function handleAddCommand(url: string, options: AddCommandOptions): Promise<void> {
  if (!options.name) {
    console.error(chalk.red('❌ Error: --name is required'));
    process.exit(1);
  }

  validateNotebookUrl(url);

  const spinner = ora('Adding notebook...').start();

  try {
    const library = getNotebookLibrary();
    await library.initialize();

    const topics = options.topics ? options.topics.split(',').map(t => t.trim()) : [];
    const contentTypes = options.contentTypes
      ? options.contentTypes.split(',').map(t => t.trim())
      : [];
    const useCases = options.useCases ? options.useCases.split(',').map(t => t.trim()) : [];
    const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];

    const notebook = await library.addNotebook(
      url,
      options.name,
      options.description || '',
      topics,
      contentTypes,
      useCases,
      tags
    );

    spinner.succeed(chalk.green('Notebook added successfully'));

    console.log('\n' + chalk.bold('Notebook Details:'));
    console.log(`  ID:          ${chalk.cyan(notebook.id)}`);
    console.log(`  Name:        ${chalk.white(notebook.name)}`);
    console.log(`  URL:         ${chalk.gray(notebook.url)}`);
    console.log(`  Topics:      ${chalk.yellow(notebook.topics.join(', ') || 'None')}`);
    console.log(`  Tags:        ${chalk.magenta(notebook.tags.join(', ') || 'None')}`);
  } catch (error) {
    spinner.fail('Failed to add notebook');
    throw error;
  }
}

async function handleListCommand(): Promise<void> {
  const spinner = ora('Loading notebook library...').start();

  try {
    const library = getNotebookLibrary();
    await library.initialize();

    const notebooks = library.listNotebooks();
    const activeNotebook = library.getActiveNotebook();

    spinner.stop();

    if (notebooks.length === 0) {
      console.log(chalk.yellow('\n⚠️  No notebooks in library'));
      console.log(chalk.gray('  Use "notebooklm notebook add <url>" to add your first notebook\n'));
      return;
    }

    console.log(chalk.bold('\n📚 Notebook Library\n'));

    const maxIdWidth = Math.max(...notebooks.map(n => n.id.length), 8);
    const maxNameWidth = Math.max(...notebooks.map(n => n.name.length), 10);

    console.log(
      chalk.cyan(`  ${padRight('ID', maxIdWidth)}  ${padRight('Name', maxNameWidth)}  Topics  Uses`)
    );
    console.log(
      chalk.gray(`  ${'─'.repeat(maxIdWidth)}  ${'─'.repeat(maxNameWidth)}  ──────  ─────`)
    );

    for (const notebook of notebooks) {
      const isActive = activeNotebook?.id === notebook.id;
      const prefix = isActive ? chalk.green('▸ ') : '  ';
      const id = isActive ? chalk.cyan(notebook.id) : chalk.gray(notebook.id);
      const name = isActive ? chalk.white(notebook.name) : chalk.gray(notebook.name);
      const topics =
        notebook.topics.slice(0, 2).join(', ') + (notebook.topics.length > 2 ? '...' : '');
      const uses = notebook.useCount.toString();

      console.log(
        `${prefix}${padRight(id, maxIdWidth)}  ${padRight(name, maxNameWidth)}  ${padRight(topics || '-', 7)}  ${chalk.magenta(uses)}`
      );
    }

    if (activeNotebook) {
      console.log(`\n  ${chalk.green('▸')} = Active notebook: ${chalk.cyan(activeNotebook.name)}`);
    }

    console.log(
      `\n  Total: ${chalk.bold(notebooks.length.toString())} notebook${notebooks.length === 1 ? '' : 's'}\n`
    );
  } catch (error) {
    spinner.fail('Failed to load notebook library');
    throw error;
  }
}

async function handleSearchCommand(query: string): Promise<void> {
  const spinner = ora('Searching notebooks...').start();

  try {
    const library = getNotebookLibrary();
    await library.initialize();

    const results = library.searchNotebooks(query);

    spinner.stop();

    if (results.length === 0) {
      console.log(chalk.yellow(`\n⚠️  No results for: ${chalk.white(query)}\n`));
      return;
    }

    console.log(chalk.bold(`\n🔍 Search Results for "${chalk.white(query)}"\n`));

    for (const notebook of results) {
      console.log(chalk.cyan(`  ${notebook.name}`) + chalk.gray(` (${notebook.id})`));
      console.log(chalk.gray(`    ${notebook.description || 'No description'}`));

      if (notebook.topics.length > 0) {
        console.log(chalk.yellow(`    Topics: ${notebook.topics.join(', ')}`));
      }

      if (notebook.tags.length > 0) {
        console.log(chalk.magenta(`    Tags: ${notebook.tags.join(', ')}`));
      }

      console.log(chalk.gray(`    URL: ${notebook.url}\n`));
    }

    console.log(
      chalk.gray(
        `  Found ${chalk.bold(results.length.toString())} result${results.length === 1 ? '' : 's'}\n`
      )
    );
  } catch (error) {
    spinner.fail('Search failed');
    throw error;
  }
}

async function handleActivateCommand(id: string): Promise<void> {
  const spinner = ora('Activating notebook...').start();

  try {
    const library = getNotebookLibrary();
    await library.initialize();

    const notebook = await library.selectNotebook(id);

    spinner.succeed(chalk.green('Notebook activated'));

    console.log('\n' + chalk.bold('Active Notebook:'));
    console.log(`  Name:  ${chalk.white(notebook.name)}`);
    console.log(`  ID:    ${chalk.cyan(notebook.id)}`);
    console.log(`  URL:   ${chalk.gray(notebook.url)}\n`);
  } catch (error) {
    spinner.fail('Failed to activate notebook');
    throw error;
  }
}

async function handleRemoveCommand(id: string): Promise<void> {
  const spinner = ora('Removing notebook...').start();

  try {
    const library = getNotebookLibrary();
    await library.initialize();

    const notebook = library.getNotebook(id);

    if (!notebook) {
      spinner.fail('Notebook not found');
      console.log(chalk.yellow(`\n⚠️  Notebook not found: ${chalk.cyan(id)}\n`));
      return;
    }

    const removed = await library.removeNotebook(id);

    if (removed) {
      spinner.succeed(chalk.green('Notebook removed'));
      console.log(`\n  Removed: ${chalk.white(notebook.name)} ${chalk.gray(`(${id})`)}\n`);
    } else {
      spinner.fail('Failed to remove notebook');
    }
  } catch (error) {
    spinner.fail('Failed to remove notebook');
    throw error;
  }
}

async function handleStatsCommand(): Promise<void> {
  const spinner = ora('Loading statistics...').start();

  try {
    const library = getNotebookLibrary();
    await library.initialize();

    const stats = library.getStats();

    spinner.stop();

    console.log(chalk.bold('\n📊 Library Statistics\n'));

    const labelWidth = 20;

    console.log(
      `  ${padRight('Total Notebooks:', labelWidth)} ${chalk.bold(stats.totalNotebooks.toString())}`
    );
    console.log(
      `  ${padRight('Total Topics:', labelWidth)} ${chalk.bold(stats.totalTopics.toString())}`
    );
    console.log(
      `  ${padRight('Total Uses:', labelWidth)} ${chalk.bold(stats.totalUseCount.toString())}`
    );

    if (stats.activeNotebook) {
      console.log(
        `  ${padRight('Active Notebook:', labelWidth)} ${chalk.cyan(stats.activeNotebook.name)}`
      );
    } else {
      console.log(`  ${padRight('Active Notebook:', labelWidth)} ${chalk.gray('None')}`);
    }

    if (stats.mostUsedNotebook) {
      console.log(
        `  ${padRight('Most Used:', labelWidth)} ${chalk.cyan(stats.mostUsedNotebook.name)} ${chalk.gray(`(${stats.mostUsedNotebook.useCount} uses)`)}`
      );
    }

    console.log(`  ${padRight('Library File:', labelWidth)} ${chalk.gray(stats.libraryPath)}`);

    console.log('');
  } catch (error) {
    spinner.fail('Failed to load statistics');
    throw error;
  }
}

function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
  } else {
    console.error(chalk.red('\n❌ Unknown error occurred'));
  }

  process.exit(1);
}

function padRight(str: string, width: number): string {
  return str + ' '.repeat(Math.max(0, width - str.length));
}
