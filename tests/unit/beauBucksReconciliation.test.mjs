import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  RECONCILIATION_CLASSIFICATIONS,
  buildShadowLedgerReconciliation,
} = require('../../functions/lib/beauBucksReconciliation.js');
const { buildLedgerEntryId } = require('../../functions/lib/beauBucksLedger.js');

const ledger = (overrides = {}) => {
  const idempotencyKey = overrides.idempotencyKey || 'grant:ROOM1:user_1';
  const ledgerEntryId = overrides.ledgerEntryId || buildLedgerEntryId(idempotencyKey);
  return {
    documentId: overrides.documentId || ledgerEntryId,
    ledgerEntryId,
    idempotencyKey,
    accountId: 'room1__user_1__beaubucks',
    roomCode: 'ROOM1',
    uid: 'user_1',
    currency: 'beaubucks',
    direction: 'credit',
    type: 'join_grant',
    amount: 100,
    status: 'posted',
    shadow: true,
    authoritative: false,
    source: { provider: 'beaurocks', sourceCollection: 'room_event_credit_grants', sourceId: 'grant_1' },
    attribution: {},
    ...overrides,
  };
};

const report = (overrides = {}) => buildShadowLedgerReconciliation({
  roomCode: 'ROOM1',
  expectedCurrency: 'beaubucks',
  legacyAccounts: [{ uid: 'user_1', roomPoints: 100, globalPointsBalance: null }],
  ledgerEntries: [ledger()],
  evidenceEvents: [],
  ...overrides,
});

test('reconciles exact posted shadow totals without changing legacy authority', () => {
  const result = report();
  assert.equal(result.readOnly, true);
  assert.equal(result.authoritative, false);
  assert.equal(result.balanceAuthority, 'legacy');
  assert.equal(result.accounts[0].reconciled, true);
  assert.equal(result.accounts[0].primaryClassification, RECONCILIATION_CLASSIFICATIONS.exact);
});

test('classifies opening balances and known missing shadow events separately', () => {
  const result = report({
    legacyAccounts: [{ uid: 'user_1', roomPoints: 350 }],
    evidenceEvents: [{
      evidenceId: 'vip_1',
      idempotencyKey: 'room_event_credit_grant:vip_1',
      roomCode: 'ROOM1',
      uid: 'user_1',
      currency: 'beaubucks',
      type: 'vip',
      amount: 200,
      sourceCollection: 'room_event_credit_grants',
      sourceId: 'vip_1',
    }],
  });
  assert.deepEqual(result.accounts[0].classifications, [
    RECONCILIATION_CLASSIFICATIONS.missingShadowEvent,
    RECONCILIATION_CLASSIFICATIONS.openingBalanceGap,
  ]);
  assert.equal(result.accounts[0].evidence.missingShadowEventCount, 1);
});

test('classifies legacy spend when shadow credits exceed the live room balance', () => {
  const result = report({ legacyAccounts: [{ uid: 'user_1', roomPoints: 65 }] });
  assert.equal(result.accounts[0].delta, -35);
  assert.deepEqual(result.accounts[0].classifications, [RECONCILIATION_CLASSIFICATIONS.unsupportedLegacySpend]);
});

test('detects duplicate idempotency and deterministic document identity conflicts', () => {
  const result = report({
    legacyAccounts: [{ uid: 'user_1', roomPoints: 200 }],
    ledgerEntries: [ledger(), ledger({ documentId: 'wrong-document-id' })],
  });
  assert.equal(result.accounts[0].classifications.includes(RECONCILIATION_CLASSIFICATIONS.duplicateIdempotencyConflict), true);
  assert.deepEqual(result.accounts[0].evidence.duplicateIdempotencyKeys, ['grant:ROOM1:user_1']);
  assert.deepEqual(result.accounts[0].evidence.identityConflicts, ['wrong-document-id']);
});

test('keeps currency and canonical/backing attribution boundaries explicit', () => {
  const result = report({
    ledgerEntries: [ledger({
      attribution: {
        canonicalSongId: 'song_hello',
        performanceId: 'performance_1',
        backingTrackId: 'youtube_backing_9',
        performerUid: 'singer_1',
      },
    }), ledger({
      idempotencyKey: 'grant:ROOM1:user_1:points',
      currency: 'points',
      amount: 25,
    })],
  });
  const beaubucks = result.accounts.find((account) => account.currency === 'beaubucks');
  assert.equal(beaubucks.classifications.includes(RECONCILIATION_CLASSIFICATIONS.currencyMismatch), true);
  assert.deepEqual(beaubucks.canonicalAttribution.canonicalSongIds, ['song_hello']);
  assert.deepEqual(beaubucks.backingAttribution.backingTrackIds, ['youtube_backing_9']);
});

test('marks partial reports without overstating reconciliation confidence', () => {
  const result = report({ truncated: true });
  assert.equal(result.truncated, true);
});
