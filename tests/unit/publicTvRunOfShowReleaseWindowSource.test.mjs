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
  assert.match(source, /releaseWindowShouldOverlayStage/);
  assert.match(source, /\['continue_or_rotate', 'skip_performance'\]\.includes\(activeReleaseWindowSubjectType\)/);
  assert.match(source, /displayMode="glass_overlay"/);
  assert.match(source, /const isOneMinuteMicDecision = subjectType === 'continue_or_rotate';/);
  assert.match(source, /One-Minute Mic/);
  assert.match(source, /Crowd Rescue Vote/);
  assert.match(source, /fa-forward-step/);
  assert.match(source, /choiceSublines/);
  assert.match(source, /oneMinuteMicRotateFadeActive/);
  assert.match(source, /fade_pending/);
  assert.match(source, /Crowd Picked Next Singer/);
  assert.match(source, /Crowd Unlocked It/);
  assert.match(source, /Live Vote - Phones Now/);
  assert.match(source, /data-tv-vote-choice-card/);
  assert.match(source, /choiceCounts/);
  assert.match(source, /slotSceneCount/);
  assert.match(source, /keepQueueMovingCount/);
  assert.match(source, /timeProgressPct/);
  assert.match(source, /choiceLetter/);
  assert.match(source, /oneMinuteMicRoomModeActive/);
  assert.match(source, /Crowd Decides At 1:00/);
});
