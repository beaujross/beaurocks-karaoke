import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { auditGameLifecycleCoverage } from '../../src/lib/gameLifecycle.js';

test('every canonical GAMES_META identity has an operational lifecycle contract', () => {
  const source = readFileSync('src/lib/gameRegistry.js', 'utf8');
  const metaSource = source.split('export const GAMES_META = [')[1]?.split('export const GAME_CATEGORIES')[0] || '';
  const ids = [...metaSource.matchAll(/^\s+id: '([^']+)'/gm)].map((match) => match[1]);
  assert.ok(ids.length >= 10);
  assert.deepEqual(auditGameLifecycleCoverage(ids).missing, []);
});
