import chalk from 'chalk';
import ora from 'ora';
import { askQuestion } from './ask.js';
import { config } from './core/config.js';
import { ValidationError } from './core/errors.js';
import { getNotebookLibrary } from './notebook/notebook-manager.js';

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
}

export async function queryMultipleNotebooks(
  question: string,
  notebookIds: string[],
  options: ParallelQueryOptions = {}
): Promise<ParallelQueryResult[]> {
  const library = getNotebookLibrary();
  await library.initialize();

  if (notebookIds.length > config.maxParallelQueries) {
    throw new ValidationError(
      `Cannot query more than ${config.maxParallelQueries} notebooks at once. ` +
        `Requested: ${notebookIds.length}`
    );
  }

  const results: ParallelQueryResult[] = [];

  console.log(chalk.blue(`\n🔄 Querying ${notebookIds.length} notebooks in parallel...\n`));

  const queryPromises = notebookIds.map(async notebookId => {
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
      const result = await askQuestion(question, notebookId, {
        useCache: options.useCache ?? true,
      });

      const duration = Date.now() - startTime;

      if (result.success) {
        spinner.succeed(`${notebook.name} (${duration}ms)`);
        return {
          notebookId,
          notebookName: notebook.name,
          answer: result.answer,
          success: true,
          duration,
        };
      } else {
        spinner.fail(`${notebook.name} - ${result.error || 'No response'}`);
        return {
          notebookId,
          notebookName: notebook.name,
          answer: null,
          success: false,
          error: result.error || 'No response received',
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

  const settledResults = await Promise.allSettled(queryPromises);

  settledResults.forEach(result => {
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

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  console.log(chalk.green(`\n✓ Completed: ${successful} successful, ${failed} failed`));
  console.log(chalk.gray(`  Average duration: ${Math.round(avgDuration)}ms\n`));

  return results;
}

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
      lines.push(chalk.red(`⚠️  Failed: ${result.error ?? 'Unknown error'}`));
      lines.push('');
    }
  }

  return lines.join('\n');
}
