import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { AuthenticationError } from '../api/errors.js';
import { NotebookClient } from '../api/notebooks.js';
import type { AuthTokens } from '../api/types.js';
import { getAuthManager } from '../auth/auth-manager.js';
import { getCliErrorMessage } from '../core/cli-errors.js';

interface AuthImportOptions {
  file?: string;
  clipboard?: boolean;
}

interface AuthLoginOptions {
  port?: string;
}

export function addAuthCommand(program: Command): void {
  const authCommand = program.command('auth').description('Authentication management commands');

  authCommand
    .command('login')
    .description('Authenticate using Chrome DevTools Protocol (CDP)')
    .option('-p, --port <number>', 'Chrome remote debugging port', '9222')
    .action(async (options: AuthLoginOptions) => {
      try {
        await handleLoginCommand(options);
      } catch (error) {
        handleError(error);
      }
    });

  authCommand
    .command('import')
    .description('Import authentication cookies from file')
    .option('-f, --file <path>', 'Path to cookies file (Netscape format or JSON)')
    .option('-c, --clipboard', 'Read cookies from clipboard')
    .action(async (options: AuthImportOptions) => {
      try {
        await handleImportCommand(options);
      } catch (error) {
        handleError(error);
      }
    });

  authCommand
    .command('status')
    .description('Check authentication status')
    .action(async () => {
      try {
        await handleStatusCommand();
      } catch (error) {
        handleError(error);
      }
    });

  authCommand
    .command('validate')
    .description('Test if authentication is still valid')
    .action(async () => {
      try {
        await handleValidateCommand();
      } catch (error) {
        handleError(error);
      }
    });

  authCommand
    .command('clear')
    .description('Remove all authentication data')
    .action(async () => {
      try {
        await handleClearCommand();
      } catch (error) {
        handleError(error);
      }
    });
}

async function handleImportCommand(options: AuthImportOptions): Promise<void> {
  const spinner = ora('Importing authentication cookies...').start();

  try {
    const authManager = getAuthManager();
    let tokens: AuthTokens;

    if (options.file) {
      spinner.text = `Reading cookies from ${options.file}...`;
      tokens = await authManager.importFromFile(options.file);

      // Log what cookies were imported
      console.log(chalk.dim('\nImported cookies:'), Object.keys(tokens.cookies).join(', '));
    } else if (options.clipboard) {
      spinner.fail('Clipboard import not yet implemented');
      console.log(chalk.yellow('Please use --file option instead'));
      process.exit(1);
    } else {
      spinner.fail('No input source specified');
      console.log(chalk.yellow('\nUsage:'));
      console.log('  notebooklm auth import --file cookies.txt');
      console.log('\nTo export cookies from Chrome:');
      console.log('  1. Open Chrome and go to https://notebooklm.google.com');
      console.log('  2. Open DevTools (F12) → Application → Cookies');
      console.log('  3. Export cookies or use a browser extension');
      process.exit(1);
    }

    spinner.text = 'Validating cookies...';

    const client = new NotebookClient(tokens);
    await client.refreshCSRFToken();

    spinner.text = 'Saving authentication...';
    await authManager.saveAuth(tokens);

    spinner.succeed(chalk.green('Authentication successful!'));
    console.log('\n✓ You are now authenticated with NotebookLM');
    console.log(chalk.dim('  CSRF token refreshed and saved'));
  } catch (error) {
    spinner.fail('Authentication import failed');
    if (error instanceof AuthenticationError) {
      console.error(chalk.red(`\n${getCliErrorMessage(error)}`));
    } else {
      console.error(chalk.red(`\nError: ${getCliErrorMessage(error)}`));
    }
    process.exit(1);
  }
}

async function handleStatusCommand(): Promise<void> {
  const spinner = ora('Checking authentication status...').start();

  try {
    const authManager = getAuthManager();
    const status = await authManager.getAuthStatus();

    spinner.stop();

    if (status.authenticated) {
      console.log(chalk.green.bold('\n✓ Authentication Status: Authenticated\n'));

      if (status.expiresAt) {
        const daysUntilExpiry = Math.floor(
          (status.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        console.log(`Expires in: ${daysUntilExpiry} days (${status.expiresAt.toISOString()})`);
      }

      if (status.csrfToken) {
        console.log(chalk.dim('CSRF token: Available'));
      }
    } else {
      console.log(chalk.red.bold('\n✗ Authentication Status: Not Authenticated\n'));
      console.log('Run "notebooklm auth import --file cookies.txt" to authenticate');
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Error checking authentication status');
    throw error;
  }
}

async function handleValidateCommand(): Promise<void> {
  const spinner = ora('Validating authentication...').start();

  try {
    const authManager = getAuthManager();
    const tokens = await authManager.loadAuth();

    if (!tokens) {
      spinner.fail(chalk.red('No authentication found'));
      console.log('\nRun "notebooklm auth import --file cookies.txt" to authenticate');
      process.exit(1);
    }

    spinner.text = 'Testing authentication with NotebookLM...';
    const client = new NotebookClient(tokens);
    await client.listNotebooks();

    spinner.succeed(chalk.green('Authentication is valid'));
    console.log('\n✓ Your credentials are working correctly');
  } catch (_error) {
    spinner.fail(chalk.red('Authentication is invalid'));
    console.log('\n✗ Your session may have expired');
    console.log('Run "notebooklm auth import --file cookies.txt" to re-authenticate');
    process.exit(1);
  }
}

async function handleClearCommand(): Promise<void> {
  const spinner = ora('Clearing authentication data...').start();

  try {
    const authManager = getAuthManager();
    const success = await authManager.clearAuth();

    if (success) {
      spinner.succeed(chalk.green('Authentication data cleared'));
      console.log('\n✓ All authentication data has been removed');
      console.log('Run "notebooklm auth import --file cookies.txt" to authenticate again');
    } else {
      spinner.fail(chalk.red('Failed to clear authentication'));
      console.log('\n✗ Authentication file could not be removed');
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Error clearing authentication');
    throw error;
  }
}

async function handleLoginCommand(options: AuthLoginOptions): Promise<void> {
  const port = options.port ? parseInt(options.port, 10) : 9222;

  console.log(chalk.blue('\n🔐 NotebookLM CDP Authentication\n'));
  console.log('This will connect to Chrome and extract authentication cookies.');
  console.log(chalk.dim(`Using Chrome remote debugging port: ${port}\n`));

  const authManager = getAuthManager();
  const result = await authManager.loginWithCDP(port);

  if (!result.success) {
    console.log(chalk.red('\n❌ Authentication failed'));
    console.log(chalk.yellow(getCliErrorMessage(result.error)));

    if (result.needsLogin) {
      console.log(chalk.dim('\nPlease make sure you are logged in to NotebookLM in Chrome.'));
    } else {
      console.log(chalk.dim('\nTo start Chrome with remote debugging:'));
      console.log(
        chalk.dim(
          '  macOS: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222'
        )
      );
      console.log(chalk.dim('  Linux: google-chrome --remote-debugging-port=9222'));
    }

    process.exit(1);
  }

  console.log(chalk.green('\n✓ Authentication successful!'));
  console.log(chalk.dim('Cookies have been saved and are ready to use.'));
}

function handleError(error: unknown): void {
  console.error('\n' + chalk.red('❌ Error:') + ' ' + getCliErrorMessage(error));

  process.exit(1);
}
