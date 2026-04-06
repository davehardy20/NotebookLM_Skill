import type { Command } from 'commander';
import ora from 'ora';
import { askQuestion } from '../ask.js';
import { AuthError, NotFoundError } from '../core/errors.js';
import { extractNotebookIdFromUrl, validateNotebookUrl } from '../core/validation.js';
import { getNotebookLibrary } from '../notebook/index.js';

interface AskCommandOptions {
  notebook?: string;
  notebookUrl?: string;
  notebookId?: string;
  noCache?: boolean;
}

export function addAskCommand(program: Command): void {
  program
    .command('ask <question>')
    .description('Ask a question to NotebookLM')
    .option('-n, --notebook <id>', 'Notebook ID to query')
    .option('-u, --notebook-url <url>', 'Notebook URL to query')
    .option('--no-cache', 'Skip cache and force fresh query')
    .action(async (question: string, options: AskCommandOptions) => {
      try {
        await handleAskCommand(question, options);
      } catch (error) {
        handleError(error);
      }
    });
}

async function handleAskCommand(question: string, options: AskCommandOptions): Promise<void> {
  const notebookId = await resolveNotebookId(options);

  if (!notebookId) {
    console.error('Error: No notebook specified. Use -n or -u option, or set an active notebook.');
    process.exit(1);
  }

  const spinner = ora('Asking NotebookLM...').start();

  try {
    const result = await askQuestion(question, notebookId, {
      useCache: !options.noCache,
    });

    if (!result.success) {
      spinner.fail('Query failed');
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }

    spinner.succeed('Got answer');

    console.log('\n' + result.answer);

    if (result.fromCache) {
      console.log('\n[Cached result]');
    }

    console.log(`\n[Query took ${result.duration.toFixed(2)}s]`);
  } catch (error) {
    spinner.fail('Query failed');
    throw error;
  }
}

async function resolveNotebookId(options: AskCommandOptions): Promise<string | null> {
  if (options.notebookId || options.notebook) {
    return options.notebookId || options.notebook || null;
  }

  if (options.notebookUrl) {
    validateNotebookUrl(options.notebookUrl);
    return extractNotebookIdFromUrl(options.notebookUrl);
  }

  const library = getNotebookLibrary();
  await library.initialize();
  const active = library.getActiveNotebook();

  if (!active) {
    return null;
  }

  return extractNotebookIdFromUrl(active.url);
}

function handleError(error: unknown): void {
  if (error instanceof AuthError) {
    console.error(`Authentication error: ${error.message}`);
    console.error('Run "notebooklm auth import --file cookies.txt" to authenticate');
  } else if (error instanceof NotFoundError) {
    console.error(`Not found: ${error.message}`);
  } else if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error('An unknown error occurred');
  }

  process.exit(1);
}
