import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const gameSource = readFileSync('src/games/PromptVote/Game.jsx', 'utf8');
const tvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('WYR TV uses the same A/B color identity as audience phones', () => {
  assert.match(gameSource, /data-wyr-choice="A"[\s\S]*from-\[#EC4899\]/);
  assert.match(gameSource, /data-wyr-choice="B"[\s\S]*from-\[#00C4D9\]/);
  assert.match(gameSource, /border border-pink-300\/35 text-pink-100 rounded-full px-3 py-1 font-bold">A/);
  assert.match(gameSource, /border border-teal-300\/35 text-teal-100 rounded-full px-3 py-1 font-bold">B/);
  assert.match(tvSource, /border border-pink-300\/35 rounded-xl px-4 py-6 text-center font-bold">Sing every duet/);
  assert.match(tvSource, /border border-teal-300\/35 rounded-xl px-4 py-6 text-center font-bold">Run the DJ booth/);
});
