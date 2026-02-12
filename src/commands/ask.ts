/**
 * Ask Command Handler
 * CLI command for asking questions to NotebookLM
 */

import { Command } from 'commander';
import ora, { Ora } from 'ora';
import { askNotebookLM, resolveNotebookUrl } from '../ask.js';
import { queryMultipleNotebooks, formatParallelResults } from '../parallel-ask.js';

/**
 * Options for the ask command
 */
interface AskCommandOptions {
  notebook?: string;
  notebookUrl?: string;
  notebookId?: string;
  notebookIds?: string;
  parallel?: boolean;
  noCache?: boolean;
  noPool?: boolean;
}

/**
 * Add the 'ask' command to the CLI program
 *
 * @param program - The Commander program instance
 */
export function addAskCommand(program: Command): void {
  program
    .command('ask <question>')
    .description('Ask a question to NotebookLM with optional notebook selection')
    .option('-n, --notebook <id>', 'notebook ID to use (alias for --notebook-id)')
    .option('--notebook-id <id>', 'notebook ID to use')
    .option('--notebook-url <url>', 'direct notebook URL to use')
    .option('--notebook-ids <ids>', 'comma-separated list of notebook IDs for parallel query')
    .option('--parallel', 'query multiple notebooks in parallel')
    .option('--no-cache', 'disable response caching')
    .option('--no-pool', 'disable browser pool (use legacy mode)')
    .action(async (question: string, options: AskCommandOptions) => {
      try {
        await handleAskCommand(question, options);
      } catch (error) {
        handleError(error);
      }
    });
}

/**
 * Handle the ask command execution
 *
 * @param question - The question to ask
 * @param options - Command options
 */
async function handleAskCommand(
  question: string,
  options: AskCommandOptions
): Promise<void> {
  const spinner = ora('Resolving notebook...').start();

  try {
    // Resolve notebook URL from options
    const notebookUrl = await resolveNotebookUrl({
      notebookUrl: options.notebookUrl,
      notebookId: options.notebookId || options.notebook,
      useActive: true,
    });

    if (!notebookUrl) {
      spinner.fail('No notebook selected. Use --notebook-id, --notebook-url, or select a notebook first.');
      return;
    }

    spinner.text = 'Asking NotebookLM...';

    // Query NotebookLM
    const result = await askNotebookLM(question, notebookUrl, {
      useCache: !options.noCache,
      useSessionPool: !options.noPool,
    });

    if (!result) {
      spinner.fail('Failed to get answer from NotebookLM');
      return;
    }

    spinner.stop();

    // Print the answer
    console.log('\n');
    console.log(result.fullResponse);
    console.log('\n');

    // Print metadata
    const meta = [];
    if (result.fromCache) meta.push('from cache');
    if (result.usePool) meta.push('using browser pool');
    if (meta.length > 0) {
      console.log(`\n[${meta.join(', ')}]`);
    }
    console.log(`Time: ${result.duration.toFixed(2)}s`);
  } catch (error) {
    spinner.fail('Error asking question');
    throw error;
  }
}

/**
 * Handle errors from the ask command
 *
 * @param error - The error to handle
 */
function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`\n❌ Error: ${error.message}`);

    // Check for specific error types
    const errorName = error.constructor.name;
    if (errorName === 'AuthExpiredError' || errorName === 'AuthError') {
      console.error('💡 Hint: Run "notebooklm auth refresh" to refresh authentication');
    } else if (errorName === 'BrowserCrashedError') {
      console.error('💡 Hint: Browser crashed. Try again or use --no-pool flag');
    } else if (errorName === 'NotFoundError') {
      console.error('💡 Hint: Notebook not found. Check --notebook-id or select an active notebook');
    }
  } else {
    console.error('\n❌ Unknown error occurred');
  }

  process.exit(1);
}
