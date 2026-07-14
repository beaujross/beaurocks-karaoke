import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/EventCreditsConfigPanel.jsx', 'utf8');

test('host economy setup previews the same spending intent guide as the audience wallet', () => {
  assert.match(source, /getRoomSpendIntentGuide/);
  assert.match(source, /data-room-spend-intent-guide="true"/);
  assert.match(source, /What guest actions mean/);
  assert.match(source, /digital play and which one opens a real-money checkout/);
  assert.match(source, /spendIntentGuide\.items\.map/);
  assert.match(source, /item\.financial/);
});
