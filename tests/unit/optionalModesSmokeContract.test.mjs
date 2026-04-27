import assert from 'node:assert/strict';
import { test } from 'vitest';

import { HOST_GAME_MATRIX, getHostGameMatrixEntry } from '../../scripts/qa/lib/hostGameMatrix.mjs';

test('optional May 1 modes stay represented in the host game smoke matrix', () => {
  const expected = ['trivia_pop', 'wyr', 'doodle_oke', 'selfie_challenge'];

  for (const id of expected) {
    const entry = getHostGameMatrixEntry(id);
    assert.ok(entry, `${id} should stay in the host game matrix for optional smoke coverage`);
    assert.ok(Array.isArray(entry.expectedHostModes) && entry.expectedHostModes.length > 0, `${id} should declare host modes`);
    assert.ok(entry.audienceRegex instanceof RegExp, `${id} should define an audience smoke regex`);
    assert.ok(entry.tvRegex instanceof RegExp, `${id} should define a TV smoke regex`);
  }

  assert.ok(HOST_GAME_MATRIX.find((entry) => entry.id === 'trivia_pop')?.audienceSelector);
  assert.ok(HOST_GAME_MATRIX.find((entry) => entry.id === 'wyr')?.audienceSelector);
  assert.ok(HOST_GAME_MATRIX.find((entry) => entry.id === 'doodle_oke')?.tvSelector);
  assert.ok(HOST_GAME_MATRIX.find((entry) => entry.id === 'selfie_challenge')?.tvSelector);
});
