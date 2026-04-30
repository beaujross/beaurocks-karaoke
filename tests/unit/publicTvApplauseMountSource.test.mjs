import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('PublicTV rehydrates applause overlay state from live room mode transitions', () => {
  assert.match(
    source,
    /const applauseModeActive = applauseMode === 'applause_countdown' \|\| applauseMode === 'applause' \|\| applauseMode === 'applause_result';/,
    'PublicTV should explicitly track whether a room is in any applause-phase mode.',
  );
  assert.match(
    source,
    /if \(applauseMode === 'applause_countdown' && !\['celebrate', 'countdown', 'measuring'\]\.includes\(applauseStep\)\)/,
    'PublicTV should rebuild the applause countdown when local overlay state is stale.',
  );
  assert.match(
    source,
    /if \(applauseMode === 'applause_result' && applauseStep === 'idle'\)/,
    'PublicTV should still mount applause results after a fresh screen mount or recovered TV session.',
  );
  assert.match(
    source,
    /if \(applauseMode === 'applause' && applauseStep === 'idle'\)/,
    'PublicTV should recover directly into the live measuring phase when the TV reconnects mid-applause.',
  );
  assert.match(
    source,
    /if \(!applauseModeActive && applauseStep !== 'idle'\)/,
    'PublicTV should clear stale applause overlay state after the room exits applause mode.',
  );
});
