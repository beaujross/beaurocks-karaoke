import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  SPEND_KINDS,
  buildSpendOperationDocumentId,
  normalizeClientOperationId,
  normalizeSpendKind,
  resolveAvatarUnlockSpend,
  resolveProfileChangeSpendCost,
  resolveReactionSpendCost,
} = require('../../functions/lib/beauBucksSpend.js');

test('spend operation IDs are strict and deterministic per room, user, and client operation', () => {
  assert.equal(normalizeClientOperationId('reaction:abc_123-Z'), 'reaction:abc_123-Z');
  assert.equal(normalizeClientOperationId('contains spaces'), '');
  assert.equal(normalizeClientOperationId('x'.repeat(121)), '');
  const first = buildSpendOperationDocumentId({ roomCode: 'a6m6', uid: 'user-1', clientOperationId: 'reaction:123' });
  const duplicate = buildSpendOperationDocumentId({ roomCode: 'A6M6', uid: 'user-1', clientOperationId: 'reaction:123' });
  const distinct = buildSpendOperationDocumentId({ roomCode: 'A6M6', uid: 'user-1', clientOperationId: 'reaction:124' });
  assert.equal(first, duplicate);
  assert.notEqual(first, distinct);
  assert.equal(first.length, 64);
});

test('spend kinds reject unknown client input', () => {
  assert.equal(normalizeSpendKind('REACTION'), SPEND_KINDS.reaction);
  assert.equal(normalizeSpendKind('profile_change'), SPEND_KINDS.profileChange);
  assert.equal(normalizeSpendKind('refund'), '');
});

test('reaction costs come from the server table', () => {
  assert.deepEqual(resolveReactionSpendCost({ reactionType: 'FIRE', reactionCosts: { fire: 5 } }), {
    ok: true,
    reactionType: 'fire',
    cost: 5,
  });
  assert.equal(resolveReactionSpendCost({ reactionType: 'unknown', reactionCosts: { fire: 5 } }).ok, false);
  assert.equal(resolveReactionSpendCost({ reactionType: 'clap', reactionCosts: { clap: 0 } }).ok, false);
});

test('profile change pricing preserves the first-free progression', () => {
  assert.equal(resolveProfileChangeSpendCost(0), 0);
  assert.equal(resolveProfileChangeSpendCost(1), 500);
  assert.equal(resolveProfileChangeSpendCost(2), 1000);
});

test('avatar unlocks require a server-catalog paid item', () => {
  const catalog = [
    { id: 'fox', emoji: '🦊', unlock: { type: 'points', cost: 60 } },
    { id: 'cool', emoji: '😎', unlock: { type: 'free' } },
  ];
  const fox = resolveAvatarUnlockSpend({ avatarId: 'FOX', avatarCatalog: catalog });
  assert.equal(fox.ok, true);
  assert.equal(fox.cost, 60);
  assert.equal(fox.record.emoji, '🦊');
  assert.equal(resolveAvatarUnlockSpend({ avatarId: 'cool', avatarCatalog: catalog }).ok, false);
  assert.equal(resolveAvatarUnlockSpend({ avatarId: 'missing', avatarCatalog: catalog }).ok, false);
});
