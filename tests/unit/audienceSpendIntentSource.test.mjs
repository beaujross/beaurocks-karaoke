import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const source = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');

test('audience wallet explains digital spending separately from financial support', () => {
  assert.match(source, /getRoomSpendIntentGuide/);
  assert.match(source, /data-feature-id="audience-spend-intent-guide"/);
  assert.match(source, /What each action means/);
  assert.match(source, /Digital value and real-money support stay separate/);
  assert.match(source, /roomSpendIntentGuide\.items\.map/);
  assert.match(source, /item\.financial/);
});
