import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const source = readFileSync('functions/index.js', 'utf8');

test('directory discover suppresses host-published room sessions while preserving official room entries', () => {
  assert.match(
    source,
    /const \{ shouldIncludeDiscoverListing \} = require\("\.\/lib\/discoverVisibility"\);/,
    'Discover filtering should use the extracted discover visibility helper',
  );
  assert.match(
    source,
    /const filtered = hydrated\.filter\(\(item\) => shouldIncludeDiscoverListing\(\{/,
    'Public discover should delegate visibility decisions to the extracted helper',
  );
});
