import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const functionsSource = readFileSync('functions/index.js', 'utf8');
const firebaseSource = readFileSync('src/lib/firebase.js', 'utf8');
const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const hostQueueSource = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');

test('generic audience-decision vote callable is exposed and validates active room decisions', () => {
  assert.match(functionsSource, /exports\.castAudienceDecisionVote = onCall/);
  assert.match(functionsSource, /cast_audience_decision_vote/);
  assert.match(functionsSource, /getNormalizedRoomAudienceDecision/);
  assert.match(functionsSource, /isAudienceDecisionVotingOpen/);
  assert.match(functionsSource, /audienceDecision\.votesByUid/);
  assert.match(functionsSource, /Join the room before voting/);
  assert.match(functionsSource, /That choice is not available for this decision/);
});

test('client surfaces generic audience-decision voting and TV adapts room decisions', () => {
  assert.match(firebaseSource, /const castAudienceDecisionVote = async/);
  assert.match(firebaseSource, /callFunction\("castAudienceDecisionVote"/);
  assert.match(firebaseSource, /castAudienceDecisionVote,/);
  assert.match(publicTvSource, /buildReleaseWindowFromAudienceDecision/);
  assert.match(publicTvSource, /room\?\.audienceDecision/);
  assert.match(publicTvSource, /activeRoomAudienceReleaseWindow/);
});

test('host and scheduled One-Minute Mic automation open and resolve room audience decisions', () => {
  assert.match(functionsSource, /HOST_ROOM_ALLOWED_ROOT_KEYS[\s\S]*"audienceDecision"/);
  assert.match(functionsSource, /HOST_ROOM_OBJECT_OR_NULL_ROOT_KEYS[\s\S]*"audienceDecision"/);
  assert.match(hostQueueSource, /audienceDecision: buildContinueOrRotateDecision/);
  assert.match(functionsSource, /buildOneMinuteMicAdvancePlan/);
  assert.match(functionsSource, /buildOneMinuteMicRoomPatch/);
  assert.match(functionsSource, /exports\.syncOneMinuteMicRoom = onCall/);
  assert.match(functionsSource, /sync_one_minute_mic_room/);
  assert.match(functionsSource, /processOneMinuteMicAutomationRoom\(\{[\s\S]*roomRef[\s\S]*roomCode[\s\S]*nowValue: nowMs\(\)/);
  assert.match(publicTvSource, /callFunction\('syncOneMinuteMicRoom'/);
  assert.match(publicTvSource, /oneMinuteMicSyncKeyRef/);
  assert.match(publicTvSource, /oneMinuteMicLastDecisionKey/);
  assert.match(functionsSource, /exports\.runOneMinuteMicAutomation = onSchedule/);
  assert.match(functionsSource, /where\("oneMinuteMicEnabled", "==", true\)/);
  assert.match(functionsSource, /where\("performanceProgressionMode", "==", "one_minute_mic"\)/);
  assert.match(functionsSource, /audienceAutomationCommand/);
  assert.match(functionsSource, /processOneMinuteMicAutomationRoom/);
  assert.match(functionsSource, /advanced: true/);
  assert.match(functionsSource, /performingStartedAt: admin\.firestore\.FieldValue\.serverTimestamp\(\)/);
});