#!/usr/bin/env node

/**
 * NotebookLM CLI wrapper script
 * Runs the compiled CLI using system Node.js (required for Playwright)
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const cliPath = path.join(__dirname, '..', 'dist', 'cli.cjs');

const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', code => {
  process.exit(code ?? 0);
});
