import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const matrix = readFileSync('scripts/qa/host-game-matrix-playwright.mjs', 'utf8');
const definitions = readFileSync('scripts/qa/lib/hostGameMatrix.mjs', 'utf8');

test('game matrix selects the lifecycle bundle before requiring a quick-launch card', () => {
  assert.match(matrix, /getGameMomentBundleId/);
  assert.match(matrix, /bingo[^\n]+alongside_karaoke/);
  assert.match(matrix, /host-game-bundle-\$\{bundleId\}/);
  assert.ok(matrix.indexOf('await bundleButton.click') < matrix.indexOf('after selecting ${getGameMomentBundleId(entry.id)}'));
});

test('WYR accepts the current resolved-round completion language', () => {
  assert.match(definitions, /majority pick\|winning side/);
});
test('production matrix can prove incompatible quick launches preserve the live mode', () => {
  assert.match(matrix, /QA_GAME_COLLISION_CHECK/);
  assert.match(matrix, /COLLISION_ACCEPTANCE_CASES/);
  assert.match(matrix, /trivia_pop:[\s\S]*requestedModeId: "bingo"[\s\S]*requestedBundleId: "alongside_karaoke"/);
  assert.match(matrix, /bingo:[\s\S]*requestedModeId: "wyr"[\s\S]*requestedBundleId: "between_songs"/);
  assert.match(matrix, /Blocked \$\{collisionCase\.requestedModeId\} launch changed live mode/);
  assert.match(matrix, /collision_blocked/);
});
