#!/usr/bin/env node

/**
 * NotebookLM CLI wrapper script.
 *
 * Prefer the Bun-compiled standalone binary when present, but fall back to the
 * tsup-built Node.js CLI so installs without Bun still work.
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const binaryPath = path.join(
  __dirname,
  '..',
  'bin',
  process.platform === 'win32' ? 'notebooklm.exe' : 'notebooklm',
);
const cliPath = path.join(__dirname, '..', 'dist', 'cli.cjs');

function spawnNodeCli() {
  const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', code => {
    process.exit(code ?? 0);
  });

  child.on('error', error => {
    console.error(`[notebooklm] Failed to launch Node.js fallback: ${error.message}`);
    process.exit(1);
  });
}

if (!fs.existsSync(binaryPath)) {
  spawnNodeCli();
} else {
  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', code => {
    process.exit(code ?? 0);
  });

  child.on('error', () => {
    spawnNodeCli();
  });
}
