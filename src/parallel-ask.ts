/**
 * Parallel query execution for NotebookLM
 * Query multiple notebooks simultaneously and aggregate results
 */

import { askNotebookLM } from './ask.js';
import { getNotebookLibrary } from './notebook/notebook-manager.js';
import ora from 'ora';
import chalk from 'chalk';

export interface ParallelQueryResult {
  notebookId: string;
  notebookName: string;
  answer: string | null;
  success: boolean;
  error?: string;
  duration: number;
}

export interface ParallelQueryOptions {
  useCache?: boolean;
  usePool?: boolean;
}

/**
 * Query multiple notebooks in parallel
 */
export async function queryMultipleNotebooks(
  question: string,
  notebookIds: string[],
  options: ParallelQueryOptions = {}
): Promise<ParallelQueryResult[]> {
  const library = getNotebookLibrary();
  await library.initialize();

  const results: ParallelQueryResult[] = [];
  
  console.log(chalk.blue(`\n🔄 Querying ${notebookIds.length} notebooks in parallel...\n`));

  // Create promises for all queries
  const queryPromises = notebookIds.map(async (notebookId) => {
    const notebook = library.getNotebook(notebookId);
    if (!notebook) {
      return {
        notebookId,
        notebookName: notebookId,
        answer: null,
        success: false,
        error: 'Notebook not found',
        duration: 0,
      };
    }

    const startTime = Date.now();
    const spinner = ora({
      text: `Querying ${notebook.name}...`,
      prefixText: chalk.gray(`[${notebookId}]`),
    }).start();

    try {
      const result = await askNotebookLM({
        question,
        notebookUrl: notebook.url,
        useCache: options.useCache ?? true,
        usePool: options.usePool ?? true,
      });

      const duration = Date.now() - startTime;

      if (result) {
        spinner.succeed(`${notebook.name} (${duration}ms)`);
        return {
          notebookId,
          notebookName: notebook.name,
          answer: result.answer,
          success: true,
          duration,
        };
      } else {
        spinner.fail(`${notebook.name} - No response`);
        return {
          notebookId,
          notebookName: notebook.name,
          answer: null,
          success: false,
          error: 'No response received',
          duration,
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`${notebook.name} - ${errorMessage}`);
      
      return {
        notebookId,
        notebookName: notebook.name,
        answer: null,
        success: false,
        error: errorMessage,
        duration,
      };
    }
  });

  // Execute all queries in parallel
  const settledResults = await Promise.allSettled(queryPromises);

  // Process results
  settledResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      results.push({
        notebookId: 'unknown',
        notebookName: 'Unknown',
        answer: null,
        success: false,
        error: result.reason?.message || 'Query failed',
        duration: 0,
      });
    }
  });

  // Display summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  console.log(chalk.green(`\n✓ Completed: ${successful} successful, ${failed} failed`));
  console.log(chalk.gray(`  Average duration: ${Math.round(avgDuration)}ms\n`));

  return results;
}

/**
 * Format parallel query results for display
 */
export function formatParallelResults(results: ParallelQueryResult[]): string {
  const lines: string[] = [];
  
  lines.push(chalk.bold('\n📊 Results:\n'));
  
  for (const result of results) {
    if (result.success && result.answer) {
      lines.push(chalk.green(`## ${result.notebookName}`));
      lines.push(result.answer);
      lines.push(chalk.gray(`⏱️  ${result.duration}ms\n`));
    } else {
      lines.push(chalk.red(`## ${result.notebookName}`));
      lines.push(chalk.red(`⚠️  Failed: ${result.error || 'Unknown error'}`));
      lines.push('');
    }
  }

  return lines.join('\n');
}
