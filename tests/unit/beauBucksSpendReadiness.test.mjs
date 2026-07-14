import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const { buildSpendOperationReadiness } = require('../../functions/lib/beauBucksSpendReadiness.js');

const operation = ({ id, uid, kind, amount, outcome = 'accepted', replayCount = 0 } = {}) => ({
  operationDocumentId: id,
  roomCode: 'ROOM1',
  uid,
  kind,
  outcome,
  chargedAmount: outcome === 'accepted' ? amount : 0,
  balanceBefore: 1000,
  balanceAfter: outcome === 'accepted' ? 1000 - amount : 1000,
  replayCount,
});

const ledger = ({ id, uid, kind, amount } = {}) => ({
  documentId: `ledger-${id}`,
  idempotencyKey: `audience_spend:${id}`,
  roomCode: 'ROOM1',
  uid,
  currency: 'beaubucks',
  direction: 'debit',
  type: `${kind}_spend`,
  amount,
  status: 'posted',
});

const readiness = (overrides = {}) => buildSpendOperationReadiness({
  roomCode: 'ROOM1',
  expectedCurrency: 'beaubucks',
  spendOperations: [
    operation({ id: 'reaction-1', uid: 'user-1', kind: 'reaction', amount: 5, replayCount: 1 }),
    operation({ id: 'profile-1', uid: 'user-2', kind: 'profile_change', amount: 500 }),
    operation({ id: 'avatar-1', uid: 'user-3', kind: 'avatar_unlock', amount: 60 }),
  ],
  ledgerEntries: [
    ledger({ id: 'reaction-1', uid: 'user-1', kind: 'reaction', amount: 5 }),
    ledger({ id: 'profile-1', uid: 'user-2', kind: 'profile_change', amount: 500 }),
    ledger({ id: 'avatar-1', uid: 'user-3', kind: 'avatar_unlock', amount: 60 }),
  ],
  thresholds: {
    minimumAcceptedOperations: 3,
    minimumDistinctAccounts: 3,
    minimumDuplicateReplays: 1,
    requiredKinds: ['reaction', 'profile_change', 'avatar_unlock'],
  },
  ...overrides,
});

test('marks a complete multi-kind sample ready without changing balance authority', () => {
  const result = readiness();
  assert.equal(result.boundaryReady, true);
  assert.equal(result.balanceAuthority, 'legacy');
  assert.equal(result.authoritative, false);
  assert.equal(result.summary.acceptedOperationCount, 3);
  assert.equal(result.summary.duplicateReplayCount, 1);
  assert.deepEqual(result.blockers, []);
});

test('separates insufficient outcomes from economic mutations', () => {
  const insufficient = operation({ id: 'insufficient-1', uid: 'user-4', kind: 'reaction', amount: 5, outcome: 'insufficient_balance' });
  const result = readiness({
    spendOperations: [
      operation({ id: 'reaction-1', uid: 'user-1', kind: 'reaction', amount: 5, replayCount: 1 }),
      operation({ id: 'profile-1', uid: 'user-2', kind: 'profile_change', amount: 500 }),
      operation({ id: 'avatar-1', uid: 'user-3', kind: 'avatar_unlock', amount: 60 }),
      insufficient,
    ],
  });
  assert.equal(result.summary.insufficientOperationCount, 1);
  assert.equal(result.coverage.unexpectedLedgerOperationIds.length, 0);
  assert.equal(result.boundaryReady, true);
});

test('blocks readiness when accepted operations lack or disagree with their ledger debit', () => {
  const missing = readiness({ ledgerEntries: [] });
  assert.equal(missing.boundaryReady, false);
  assert.equal(missing.blockers.includes('accepted_operation_missing_ledger'), true);
  assert.deepEqual(missing.coverage.missingLedgerOperationIds, ['avatar-1', 'profile-1', 'reaction-1']);

  const invalid = readiness({
    ledgerEntries: [
      ledger({ id: 'reaction-1', uid: 'user-1', kind: 'reaction', amount: 6 }),
      ledger({ id: 'profile-1', uid: 'user-2', kind: 'profile_change', amount: 500 }),
      ledger({ id: 'avatar-1', uid: 'user-3', kind: 'avatar_unlock', amount: 60 }),
    ],
  });
  assert.equal(invalid.blockers.includes('accepted_operation_invalid_ledger'), true);
  assert.deepEqual(invalid.coverage.invalidLedgerOperationIds, ['reaction-1']);
});

test('reports practical sample blockers independently from ledger correctness', () => {
  const result = readiness({
    spendOperations: [operation({ id: 'reaction-1', uid: 'user-1', kind: 'reaction', amount: 5 })],
    ledgerEntries: [ledger({ id: 'reaction-1', uid: 'user-1', kind: 'reaction', amount: 5 })],
  });
  assert.equal(result.coverage.missingLedgerOperationIds.length, 0);
  assert.equal(result.blockers.includes('accepted_sample_below_threshold'), true);
  assert.equal(result.blockers.includes('account_sample_below_threshold'), true);
  assert.equal(result.blockers.includes('duplicate_replay_evidence_missing'), true);
  assert.equal(result.blockers.includes('required_spend_kind_missing'), true);
});

test('blocks truncated and invalid balance-transition evidence', () => {
  const result = readiness({
    truncated: true,
    spendOperations: [
      { ...operation({ id: 'reaction-1', uid: 'user-1', kind: 'reaction', amount: 5, replayCount: 1 }), balanceAfter: 999 },
      operation({ id: 'profile-1', uid: 'user-2', kind: 'profile_change', amount: 500 }),
      operation({ id: 'avatar-1', uid: 'user-3', kind: 'avatar_unlock', amount: 60 }),
    ],
  });
  assert.equal(result.blockers.includes('report_truncated'), true);
  assert.equal(result.blockers.includes('invalid_balance_transition'), true);
  assert.deepEqual(result.coverage.balanceTransitionOperationIds, ['reaction-1']);
});
