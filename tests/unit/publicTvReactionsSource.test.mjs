import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('PublicTV keeps floating reaction emojis visible in simple profile while trimming the heavier labels', () => {
  assert.match(
    source,
    /\{reactions\.map\(r => \(/,
    'Reaction rendering should not be gated behind ambient-fx mode alone.',
  );
  assert.doesNotMatch(
    source,
    /\{showAmbientFx && reactions\.map\(r => \(/,
    'Simple TV mode should still render reaction emojis even when ambient fx are disabled.',
  );
  assert.match(
    source,
    /isSimpleTvProfile \? \(/,
    'Simple TV profile should use its own lighter reaction label treatment.',
  );
  assert.match(
    source,
    /<span className="text-lg leading-none">\{r\.avatar \|\| EMOJI\.sparkle\}<\/span>/,
    'Simple TV reactions should still show the audience avatar emoji chip.',
  );
});
