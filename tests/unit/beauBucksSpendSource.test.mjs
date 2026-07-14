import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'vitest';

const functionsSource = fs.readFileSync(new URL('../../functions/index.js', import.meta.url), 'utf8');
const callableStart = functionsSource.indexOf('exports.spendAudienceRoomCredits = onCall');
const callableEnd = functionsSource.indexOf('exports.uploadAudienceRoomPhoto = onCall', callableStart);
const callableSource = functionsSource.slice(callableStart, callableEnd);
const singerSource = fs.readFileSync(new URL('../../src/apps/Mobile/SingerApp.jsx', import.meta.url), 'utf8');

test('server spend callable owns price, balance mutation, operation evidence, and shadow debit', () => {
  assert.ok(callableStart >= 0 && callableEnd > callableStart, 'spend callable source must exist');
  assert.match(callableSource, /resolveReactionSpendCost\(\{ reactionType: payload\.reactionType, reactionCosts: REACTION_POINT_COSTS \}\)/);
  assert.match(callableSource, /resolveProfileChangeSpendCost\(userData\.nameEmojiChangeCount \|\| 0\)/);
  assert.match(callableSource, /resolveAvatarUnlockSpend\(\{ avatarId: payload\.avatarId, avatarCatalog: AUDIENCE_AVATAR_CATALOG \}\)/);
  assert.match(callableSource, /buildSpendOperationDocumentId/);
  assert.match(callableSource, /tx\.create\(operationRef, operationRecord\)/);
  assert.match(callableSource, /points: balanceAfter/);
  assert.match(callableSource, /direction: "debit"/);
  assert.match(callableSource, /outcome: "legacy_fallback"/);
});

test('audience only uses legacy writes after explicit server fallback', () => {
  assert.match(singerSource, /spendResult\?\.outcome === 'legacy_fallback'/);
  assert.match(singerSource, /spendResult\?\.outcome === 'insufficient_balance'/);
  assert.match(singerSource, /Could not confirm the charge\. Try that reaction again\./);
  assert.match(singerSource, /kind: 'profile_change'/);
  assert.match(singerSource, /kind: 'avatar_unlock'/);
  assert.match(singerSource, /createAudienceSpendOperationId/);
});

test('join response controls the client canary while the server remains the final gate', () => {
  assert.match(functionsSource, /spendAuthority: isBeauBucksSpendCanaryRoom\(\{ roomCode, roomData \}\) \? "server_canary" : "legacy"/);
  assert.match(singerSource, /const nextSpendAuthority = joinResult\?\.spendAuthority === 'server_canary'/);
  assert.match(singerSource, /pendingSpendOperationIdsRef\.current\.get\(safeRetryKey\)/);
  assert.match(singerSource, /writeAudienceSpendAuthority\(roomCode, 'legacy'\)/);
  assert.match(callableSource, /isBeauBucksSpendCanaryRoom\(\{ roomCode, roomData: initialRoomData \}\)/);
});
