import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('public TV exposes a full-screen run-of-show release-window vote overlay', () => {
  assert.match(source, /RunOfShowReleaseWindowOverlay/);
  assert.match(source, /isRunOfShowReleaseWindowVotingOpen/);
  assert.match(source, /getRunOfShowReleaseWindowTally/);
  assert.match(source, /getRunOfShowReleaseWindowRemainingMs/);
  assert.match(source, /Audience Song Face-Off/);
  assert.match(source, /Co-Host Song Face-Off/);
  assert.match(source, /total votes/);
  assert.match(source, /Room Code/);
  assert.match(source, /tvReleaseWindowVisible/);
});

test('public TV can render release-window votes as a glass overlay above active games', () => {
  assert.match(source, /buildAudienceDecisionFromReleaseWindow/);
  assert.match(source, /data-tv-audience-decision-type/);
  assert.match(source, /displayMode = 'takeover'/);
  assert.match(source, /data-tv-release-window-display-mode/);
  assert.match(source, /glass_overlay/);
  assert.match(source, /tvReleaseWindowGlassOverlayVisible/);
  assert.match(source, /tvReleaseWindowTakeoverVisible/);
  assert.match(source, /activeGameCartridgeMode/);
  assert.match(source, /displayMode="glass_overlay"/);
});
