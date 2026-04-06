#!/usr/bin/env node

/**
 * Postinstall hook for published packages.
 *
 * Prefers a Bun-compiled standalone binary when Bun is available, but leaves
 * the Node.js wrapper path intact so installs without Bun still work.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const distCliPath = path.join(rootDir, 'dist', 'cli.cjs');
const binDir = path.join(rootDir, 'bin');
const binaryName = process.platform === 'win32' ? 'notebooklm.exe' : 'notebooklm';
const binaryPath = path.join(binDir, binaryName);

function log(message) {
  process.stdout.write(`[notebooklm] ${message}\n`);
}

if (!fs.existsSync(distCliPath)) {
  log(`Skipping Bun binary build because ${path.relative(rootDir, distCliPath)} is missing.`);
  process.exit(0);
}

const bunCheck = spawnSync('bun', ['--version'], {
  cwd: rootDir,
  stdio: 'ignore',
});

if (bunCheck.status !== 0) {
  log('Bun not found; using the Node.js wrapper fallback.');
  process.exit(0);
}

fs.mkdirSync(binDir, { recursive: true });

const buildResult = spawnSync('bun', ['build', distCliPath, '--compile', '--outfile', binaryPath], {
  cwd: rootDir,
  stdio: 'inherit',
});

if (buildResult.status !== 0) {
  log('Bun binary build failed; continuing with the Node.js wrapper fallback.');
  process.exit(0);
}

if (process.platform !== 'win32') {
  fs.chmodSync(binaryPath, 0o755);
}

log(`Built Bun binary at ${path.relative(rootDir, binaryPath)}.`);
