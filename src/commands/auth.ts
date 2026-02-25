/**
 * Auth Command Handler
 * CLI commands for authentication management
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { getAuthManager } from '../browser/auth-manager.js';

/**
 * Options for auth setup command
 */
interface AuthSetupOptions {
  headless?: boolean;
  timeout?: string;
}

/**
 * Options for auth validate command
 */
interface AuthValidateOptions {
  headless?: boolean;
  timeout?: string;
}

/**
 * Add 'auth' subcommands to the CLI program
 *
 * @param program - The Commander program instance
 */
export function addAuthCommand(program: Command): void {
  const authCommand = program.command('auth').description('Authentication management commands');

  authCommand
    .command('setup')
    .description('Run interactive authentication setup (opens browser)')
    .option('--headless', 'run browser in headless mode (not recommended for login)')
    .option('-t, --timeout <minutes>', 'maximum time to wait for login (default: 10)')
    .action(async (options: AuthSetupOptions) => {
      try {
        await handleSetupCommand(options);
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
    .option('--headless', 'run browser in headless mode')
    .option('-t, --timeout <minutes>', 'validation timeout (default: 1)')
    .action(async (options: AuthValidateOptions) => {
      try {
        await handleValidateCommand(options);
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

  authCommand
    .command('reauth')
    .description('Clear authentication and re-authenticate')
    .option('--headless', 'run browser in headless mode (not recommended for login)')
    .option('-t, --timeout <minutes>', 'maximum time to wait for login (default: 10)')
    .action(async (options: AuthSetupOptions) => {
      try {
        await handleReauthCommand(options);
      } catch (error) {
        handleError(error);
      }
    });
}

/**
 * Handle auth setup command
 *
 * @param options - Command options
 */
async function handleSetupCommand(options: AuthSetupOptions): Promise<void> {
  const timeout = options.timeout ? parseInt(options.timeout, 10) : 10;
  const spinner = ora('Opening browser for authentication...').start();

  try {
    const authManager = getAuthManager();

    spinner.text = 'Waiting for login...';
    const success = await authManager.setupAuth(options.headless, timeout);

    if (success) {
      spinner.succeed(chalk.green('Authentication successful!'));
      console.log('\n✓ You are now authenticated with NotebookLM');
    } else {
      spinner.fail(chalk.red('Authentication failed'));
      console.log('\n✗ Authentication timed out or failed');
      console.log('Please try again or check your internet connection');
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Error during authentication setup');
    throw error;
  }
}

/**
 * Handle auth status command
 */
async function handleStatusCommand(): Promise<void> {
  const spinner = ora('Checking authentication status...').start();

  try {
    const authManager = getAuthManager();
    const authInfo = await authManager.getAuthInfo();

    spinner.stop();

    if (authInfo.authenticated) {
      console.log(chalk.green.bold('\n✓ Authentication Status: Authenticated\n'));

      if (authInfo.authenticatedAtIso) {
        console.log(`Last authenticated: ${authInfo.authenticatedAtIso}`);
      }

      if (authInfo.stateAgeHours) {
        const ageHours = authInfo.stateAgeHours;
        const ageDays = ageHours / 24;

        let ageText: string;
        if (ageDays >= 1) {
          ageText = `${ageDays.toFixed(1)} days ago`;
        } else {
          ageText = `${ageHours.toFixed(1)} hours ago`;
        }

        console.log(`Session age: ${ageText}`);

        // Warning if session is old
        if (ageDays > 7) {
          console.log(chalk.yellow(`⚠ Warning: Session is ${ageDays.toFixed(1)} days old`));
          console.log(
            chalk.yellow(
              '  Consider running "notebooklm auth validate" or "notebooklm auth reauth"'
            )
          );
        }
      }

      if (authInfo.stateFile) {
        console.log(`State file: ${authInfo.stateFile}`);
      }
    } else {
      console.log(chalk.red.bold('\n✗ Authentication Status: Not Authenticated\n'));
      console.log('Run "notebooklm auth setup" to authenticate');
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Error checking authentication status');
    throw error;
  }
}

/**
 * Handle auth validate command
 *
 * @param options - Command options
 */
async function handleValidateCommand(_options: AuthValidateOptions): Promise<void> {
  const spinner = ora('Validating authentication...').start();

  try {
    const authManager = getAuthManager();

    const isAuthenticated = await authManager.isAuthenticated();
    if (!isAuthenticated) {
      spinner.fail(chalk.red('No authentication found'));
      console.log('\nRun "notebooklm auth setup" to authenticate');
      process.exit(1);
    }

    spinner.text = 'Testing authentication with NotebookLM...';
    const isValid = await authManager.validateAuth();

    if (isValid) {
      spinner.succeed(chalk.green('Authentication is valid'));
      console.log('\n✓ Your credentials are working correctly');
    } else {
      spinner.fail(chalk.red('Authentication is invalid'));
      console.log('\n✗ Your session may have expired');
      console.log('Run "notebooklm auth reauth" to re-authenticate');
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Error validating authentication');
    throw error;
  }
}

/**
 * Handle auth clear command
 */
async function handleClearCommand(): Promise<void> {
  const spinner = ora('Clearing authentication data...').start();

  try {
    const authManager = getAuthManager();
    const success = await authManager.clearAuth();

    if (success) {
      spinner.succeed(chalk.green('Authentication data cleared'));
      console.log('\n✓ All authentication data has been removed');
      console.log('Run "notebooklm auth setup" to authenticate again');
    } else {
      spinner.fail(chalk.red('Failed to clear authentication'));
      console.log('\n✗ Some authentication files could not be removed');
      console.log('You may need to manually delete the following directories:');
      console.log('  - ~/.local/state/notebooklm/');
      console.log('  - ~/.local/share/notebooklm/');
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Error clearing authentication');
    throw error;
  }
}

/**
 * Handle auth reauth command
 *
 * @param options - Command options
 */
async function handleReauthCommand(options: AuthSetupOptions): Promise<void> {
  const timeout = options.timeout ? parseInt(options.timeout, 10) : 10;
  const spinner = ora('Clearing existing authentication...').start();

  try {
    const authManager = getAuthManager();

    spinner.text = 'Clearing existing authentication...';
    await authManager.clearAuth();

    spinner.text = 'Opening browser for authentication...';
    const success = await authManager.setupAuth(options.headless, timeout);

    if (success) {
      spinner.succeed(chalk.green('Re-authentication successful!'));
      console.log('\n✓ You are now authenticated with NotebookLM');
    } else {
      spinner.fail(chalk.red('Re-authentication failed'));
      console.log('\n✗ Authentication timed out or failed');
      console.log('Please try again or check your internet connection');
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Error during re-authentication');
    throw error;
  }
}

/**
 * Handle errors from auth commands
 *
 * @param error - The error to handle
 */
function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`\n${chalk.red('❌ Error:')} ${error.message}`);
  } else {
    console.error(`\n${chalk.red('❌ Unknown error occurred')}`);
  }

  process.exit(1);
}
