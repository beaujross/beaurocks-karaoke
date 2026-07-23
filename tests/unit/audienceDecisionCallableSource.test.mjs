import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const functionsSource = readFileSync('functions/index.js', 'utf8');
const firebaseSource = readFileSync('src/lib/firebase.js', 'utf8');
const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const hostQueueSource = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');

const sourceSection = (source, startMarker, endMarker) => {
  const startIndex = source.indexOf(startMarker);
  assert.notEqual(startIndex, -1, `Missing source marker: ${startMarker}`);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);
  assert.notEqual(endIndex, -1, `Missing source marker: ${endMarker}`);
  return source.slice(startIndex, endIndex);
};

const hostRoomAllowedKeysSource = sourceSection(
  functionsSource,
  'const HOST_ROOM_ALLOWED_ROOT_KEYS',
  'const HOST_ROOM_BOOLEAN_ROOT_KEYS',
);
const hostRoomObjectKeysSource = sourceSection(
  functionsSource,
  'const HOST_ROOM_OBJECT_OR_NULL_ROOT_KEYS',
  'const HOST_ROOM_SEARCH_SOURCE_KEYS',
);
const oneMinuteMicAutomationSource = sourceSection(
  functionsSource,
  'const processOneMinuteMicAutomationRoom',
  'exports.recoverPendingPopTrivia',
);

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
  assert.ok(hostRoomAllowedKeysSource.includes('"audienceDecision"'));
  assert.ok(hostRoomObjectKeysSource.includes('"audienceDecision"'));
  assert.match(hostQueueSource, /audienceDecision: buildContinueOrRotateDecision/);
  assert.ok(oneMinuteMicAutomationSource.includes('buildOneMinuteMicAdvancePlan'));
  assert.ok(oneMinuteMicAutomationSource.includes('buildOneMinuteMicRoomPatch'));
  assert.ok(oneMinuteMicAutomationSource.includes('exports.syncOneMinuteMicRoom = onCall'));
  assert.ok(oneMinuteMicAutomationSource.includes('sync_one_minute_mic_room'));
  assert.ok(oneMinuteMicAutomationSource.includes('processOneMinuteMicAutomationRoom({'));
  assert.ok(oneMinuteMicAutomationSource.includes('roomRef,'));
  assert.ok(oneMinuteMicAutomationSource.includes('roomCode,'));
  assert.ok(oneMinuteMicAutomationSource.includes('nowValue: nowMs(),'));
  assert.match(publicTvSource, /callFunction\('syncOneMinuteMicRoom'/);
  assert.match(publicTvSource, /oneMinuteMicSyncKeyRef/);
  assert.match(publicTvSource, /oneMinuteMicLastDecisionKey/);
  assert.ok(oneMinuteMicAutomationSource.includes('exports.runOneMinuteMicAutomation = onSchedule'));
  assert.ok(oneMinuteMicAutomationSource.includes('where("oneMinuteMicEnabled", "==", true)'));
  assert.ok(oneMinuteMicAutomationSource.includes('where("performanceProgressionMode", "==", "one_minute_mic")'));
  assert.ok(oneMinuteMicAutomationSource.includes('audienceAutomationCommand'));
  assert.ok(oneMinuteMicAutomationSource.includes('advanced: true'));
  assert.ok(oneMinuteMicAutomationSource.includes('performingStartedAt: admin.firestore.FieldValue.serverTimestamp()'));
});