import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_ROOT = 'src';
const CHUNK_SIZE = 1;
const ESLINT_MAX_OLD_SPACE_MB = Math.max(
  2048,
  Number(process.env.LINT_ESLINT_MAX_OLD_SPACE_MB || 8192) || 8192,
);

const collectSourceFiles = (dir) => {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(js|jsx)$/.test(entry)) files.push(fullPath);
  }
  return files;
};

const eslintBin = join('node_modules', 'eslint', 'bin', 'eslint.js');

const files = collectSourceFiles(SOURCE_ROOT).sort();
let failed = false;

const printMessages = (results = []) => {
  for (const result of results) {
    const messages = Array.isArray(result.messages) ? result.messages : [];
    if (!messages.length) continue;
    console.log(`\n${result.filePath}`);
    for (const message of messages) {
      const severity = message.severity === 2 ? 'error' : 'warning';
      console.log(`  ${message.line || 0}:${message.column || 0}  ${severity}  ${message.message.split('\n')[0]}  ${message.ruleId || ''}`.trimEnd());
    }
  }
};

for (let i = 0; i < files.length; i += CHUNK_SIZE) {
  const chunk = files.slice(i, i + CHUNK_SIZE);
  const result = spawnSync(process.execPath, [
    `--max-old-space-size=${ESLINT_MAX_OLD_SPACE_MB}`,
    eslintBin,
    '--format',
    'json',
    ...chunk,
  ], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.stderr) process.stderr.write(result.stderr);

  let results = [];
  try {
    results = result.stdout ? JSON.parse(result.stdout) : [];
  } catch (error) {
    failed = true;
    if (result.stdout) process.stdout.write(result.stdout);
    console.error(`[lint:src] Could not parse ESLint JSON for files ${i + 1}-${i + chunk.length}: ${error.message}`);
  }

  printMessages(results);

  const errorCount = results.reduce((sum, item) => sum + Number(item?.errorCount || 0), 0);
  if (errorCount > 0) failed = true;

  if ((result.status == null || result.error || result.signal) && errorCount === 0) {
    failed = true;
    if (result.error) {
      console.error(`[lint:src] ${result.error.message}`);
    }
    if (result.status == null) {
      console.error(`[lint:src] eslint terminated unexpectedly on files ${i + 1}-${i + chunk.length}.`);
    }
  }
}

if (failed) process.exit(1);
