import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const functionsSource = readFileSync('functions/index.js', 'utf8');
const firebaseSource = readFileSync('src/lib/firebase.js', 'utf8');
const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

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

test('scheduled One-Minute Mic automation opens and resolves room audience decisions', () => {
  assert.match(functionsSource, /buildOneMinuteMicAdvancePlan/);
  assert.match(functionsSource, /buildOneMinuteMicRoomPatch/);
  assert.match(functionsSource, /exports\.runOneMinuteMicAutomation = onSchedule/);
  assert.match(functionsSource, /where\("oneMinuteMicEnabled", "==", true\)/);
  assert.match(functionsSource, /where\("performanceProgressionMode", "==", "one_minute_mic"\)/);
  assert.match(functionsSource, /audienceAutomationCommand/);
  assert.match(functionsSource, /processOneMinuteMicAutomationRoom/);
  assert.match(functionsSource, /advanced: true/);
  assert.match(functionsSource, /performingStartedAt: admin\.firestore\.FieldValue\.serverTimestamp\(\)/);
});