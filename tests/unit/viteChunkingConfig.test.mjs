import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const viteConfigSource = readFileSync('vite.config.js', 'utf8');

test('vite build splits firebase package subpaths by service', () => {
  assert.match(viteConfigSource, /packagePath\.startsWith\('firebase\/'\)/);
  assert.match(viteConfigSource, /const serviceName = packagePath\.split\('\/'\)\[1\] \|\| ''/);
  assert.match(viteConfigSource, /return `vendor-firebase-\$\{sanitizedService\}`/);
});
