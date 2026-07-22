import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const source = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');

test('high-frequency audience actions disclose intent and active currency at tap time', () => {
  assert.match(source, /formatRoomActionDisclosure/);
  assert.match(source, /intent: 'performer'/);
  assert.match(source, /currencyLabel: roomCurrencyPresentation\.shortLabel/);
  assert.doesNotMatch(source, /currencyLabel: beauBucksIntentEnabled/);
  assert.match(source, /intent: 'influence', free: true/);
  assert.match(source, /intent: 'support', externalCheckout: true/);
  assert.doesNotMatch(source, /return `\$\{Math\.max\(0, Number\(cost \|\| 0\) \|\| 0\)\} PTS`/);
});
