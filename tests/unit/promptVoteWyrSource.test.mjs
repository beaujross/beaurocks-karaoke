import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const gameSource = readFileSync('src/games/PromptVote/Game.jsx', 'utf8');
const tvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('WYR TV uses a neutral base with teal and pink split lanes', () => {
  assert.match(gameSource, /bg-\[linear-gradient\(145deg,#06090f,#0b1018_38%,#111827\)\]/);
  assert.match(gameSource, /border border-teal-300\/35 text-teal-100/);
  assert.match(gameSource, /border border-pink-300\/35 text-pink-100/);
  assert.match(gameSource, /bg-\[linear-gradient\(145deg,rgba\(8,10,18,0\.96\),rgba\(15,23,42,0\.94\)\)\]/);
  assert.match(tvSource, /border border-teal-300\/35/);
  assert.match(tvSource, /border border-pink-300\/35/);
});
