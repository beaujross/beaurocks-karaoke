import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const functionsSource = readFileSync('functions/index.js', 'utf8');

test('PublicTV finalizes Doodle-oke awards through the server finalizer', () => {
  assert.match(publicTvSource, /callFunction\('finalizeDoodleOkeRound',[\s\S]*roomCode,[\s\S]*promptId/);
  assert.doesNotMatch(
    publicTvSource,
    /source: 'doodle_oke',[\s\S]{0,180}awards: \[\{ uid: winner\.uid, points \}\]/,
    'Doodle-oke should not send arbitrary winner points through the host-only award callable from PublicTV'
  );
});

test('Doodle-oke finalizer recomputes winner and applies a one-time server award', () => {
  assert.match(functionsSource, /exports\.finalizeDoodleOkeRound = onCall/);
  assert.match(functionsSource, /finalizeDoodleOkeRoundServer/);
  assert.match(functionsSource, /getEffectiveDoodleStatus\(doodle, nowMs\(\)\) !== "reveal"/);
  assert.match(functionsSource, /applyRoomAwardsOnce\([\s\S]*awardKey: `doodle_\$\{safeRoomCode\}_\$\{safePromptId\}`[\s\S]*source: "doodle_oke"/);
});
test('PublicTV finalizes Pop Trivia, Guitar Sync, and Strobe awards through server finalizers', () => {
  assert.match(publicTvSource, /callFunction\('finalizePopTriviaQuestion',[\s\S]*questionId: revealQuestionId/);
  assert.match(publicTvSource, /callFunction\('finalizeGuitarSyncRound',[\s\S]*sessionId/);
  assert.match(publicTvSource, /callFunction\('finalizeStrobeModeRound',[\s\S]*sessionId/);
  assert.doesNotMatch(
    publicTvSource,
    /source: 'pop_trivia',[\s\S]{0,220}awards/,
    'Pop Trivia should not send arbitrary responder points through PublicTV'
  );
  assert.doesNotMatch(
    publicTvSource,
    /source: 'guitar_mode',[\s\S]{0,220}awards/,
    'Guitar Sync should not send arbitrary winner points through PublicTV'
  );
  assert.doesNotMatch(
    publicTvSource,
    /source: 'strobe_mode',[\s\S]{0,220}awards/,
    'Strobe mode should not send arbitrary winner points through PublicTV'
  );
});

test('Crowd Guitar Solo uses phone-authored groove timing and a performance-first TV surface', () => {
  assert.match(publicTvSource, /data-feature-id="tv-guitar-crowd-solo"/);
  assert.match(publicTvSource, /data-feature-id="tv-guitar-solo-reactive-visuals"/);
  assert.match(publicTvSource, /guitarRecentBurstCount[\s\S]*guitarEnergyTier[\s\S]*face_melting/);
  assert.match(publicTvSource, /guitar-solo-(?:aurora|lasers|shockwave|equalizer)/);
  assert.match(publicTvSource, /motionSafeFx \? '' : 'guitar-solo-motion'/);
  assert.match(publicTvSource, /const grooveScore = clampLobby\(Number\(d\.grooveScore \?\? 70\)/);
  assert.doesNotMatch(
    publicTvSource,
    /d\.type === 'strum'[\s\S]{0,900}getBeatOffsetMs\(eventTimestamp/,
    'Public TV must not grade a phone strum using delayed Firestore arrival time'
  );
  assert.match(publicTvSource, /CROWD GUITAR SOLO[\s\S]{0,500}every hit powers the stage/i);
});

test('TV mode finalizers recompute winners and apply one-time server awards', () => {
  assert.match(functionsSource, /exports\.finalizePopTriviaQuestion = onCall/);
  assert.match(functionsSource, /findPerformingPopTriviaQuestion/);
  assert.match(functionsSource, /source: "pop_trivia"/);
  assert.match(functionsSource, /exports\.finalizeGuitarSyncRound = onCall/);
  assert.match(functionsSource, /source: "guitar_mode"/);
  assert.match(functionsSource, /exports\.finalizeStrobeModeRound = onCall/);
  assert.match(functionsSource, /source: "strobe_mode"/);
});


test('Pop Trivia recaps use server award summaries on PublicTV and functions', () => {
  assert.match(functionsSource, /winnerSummaries = correctVotes[\s\S]*winners: creditedWinners\.slice\(0, 24\)/);
  assert.match(functionsSource, /correctOption[\s\S]*winnerNames: creditedWinners\.slice\(0, 6\)/);
  assert.match(publicTvSource, /const popTriviaAwardSummary = popTriviaRevealQuestion\?\.id[\s\S]*room\?\.popTriviaAwards\?\.\[popTriviaRevealQuestion\.id\]/);
  assert.match(publicTvSource, /data-feature-id="tv-pop-trivia-active-beacon"/);
  assert.match(publicTvSource, /data-feature-id="tv-pop-trivia-winner-burst"/);
  assert.match(publicTvSource, /data-feature-id="tv-pop-trivia-winner-card"/);
  assert.match(publicTvSource, /popTriviaDisplayCorrectResponders/);
});
