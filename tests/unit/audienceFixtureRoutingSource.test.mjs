import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/App.jsx', 'utf8');

test('mobile audience fixtures keep their deterministic qa uid instead of inheriting auth uid', () => {
  assert.match(
    source,
    /<SingerApp roomCode=\{roomCode\} uid=\{qaAudienceFixtureId \? `qa_\$\{qaAudienceFixtureId\}` : uid\} \/>/,
    'Audience fixture mode should preserve the fixture uid so role-gated surfaces render deterministically',
  );
});
