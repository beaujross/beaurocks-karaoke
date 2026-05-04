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
    /if \(applauseMode === 'applause_countdown' && !\['celebrate', 'measuring'\]\.includes\(applauseStep\)\)/,
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
  assert.match(
    source,
    /const applauseOverlayVisible = applauseModeActive \|\| applauseStep !== 'idle';/,
    'PublicTV should treat applause mode itself as enough to mount the overlay during fresh screen renders.',
  );
  assert.match(
    source,
    /const applauseSubject = room\?\.applauseSubject \|\| current \|\| room\?\.lastPerformance \|\| null;/,
    'PublicTV should prefer the explicit applause subject over a potentially stale current performer lookup.',
  );
  assert.match(
    source,
    /const visualizerActive = \(started \|\| applauseModeActive \|\| applauseStep !== 'idle'\) && visualizerEnabled;/,
    'PublicTV should keep the applause mic analyser active as soon as the room enters applause mode.',
  );
  assert.match(
    source,
    /!\s*showVisualizerTv && \(showAmbientFx \|\| applauseOverlayVisible\)/,
    'PublicTV should still mount the applause analyser even when ambient FX are disabled.',
  );
  assert.match(
    source,
    /if \(!applauseOverlayVisible && tvPreviewOverlay && !tvPreviewExpired\)/,
    'PublicTV should not let preview takeovers hide applause once applause mode is active.',
  );
  assert.match(
    source,
    /if \(!applauseOverlayVisible && recap\)/,
    'PublicTV should not let recap overlays swallow applause mode.',
  );
  assert.match(
    source,
    /\{applauseOverlayVisible && \(/,
    'PublicTV should render the applause meter whenever the room is in an applause phase, even before local timers rehydrate.',
  );
});
