import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

test('support reward rate uses the active room currency label', () => {
  const source = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
  assert.match(source, /roomWideSupportRate\} \{roomCurrencyPresentation\.shortLabel\} \/ \$1/);
});
