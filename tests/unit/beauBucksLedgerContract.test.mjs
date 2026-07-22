import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  buildLedgerAccountId,
  buildLedgerIdempotencyKey,
  createLedgerEntry,
  LEDGER_CURRENCIES,
  LEDGER_DIRECTIONS,
  LEDGER_ENTRY_TYPES,
  reconcileLedgerBalance,
  validateLedgerEntry,
} from '../../src/lib/beauBucksLedgerContract.js';

const entry = (overrides = {}) => createLedgerEntry({
  ledgerEntryId: overrides.ledgerEntryId || 'entry_1',
  idempotencyKey: overrides.idempotencyKey || 'source_1',
  roomCode: 'PARTY',
  uid: 'user_1',
  currency: LEDGER_CURRENCIES.beaubucks,
  direction: LEDGER_DIRECTIONS.credit,
  type: LEDGER_ENTRY_TYPES.joinGrant,
  amount: 100,
  ...overrides,
});

test('builds stable account and provider idempotency identities', () => {
  assert.equal(buildLedgerAccountId({ roomCode: 'Party', uid: 'User-1', currency: 'beaubucks' }), 'account__User-1__beaubucks');
  assert.equal(buildLedgerAccountId({ roomCode: 'Another', uid: 'User-1', currency: 'beaubucks' }), 'account__User-1__beaubucks');
  assert.equal(buildLedgerIdempotencyKey({ provider: 'givebutter', type: 'donation_reward', roomCode: 'PARTY', uid: 'user_1', sourceId: 'txn-9' }), 'givebutter__donation_reward__party__user_1__txn-9');
});

test('requires positive, typed, idempotent entries', () => {
  assert.equal(validateLedgerEntry(entry()).valid, true);
  const invalid = validateLedgerEntry(entry({ amount: 0, idempotencyKey: '' }));
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.errors, ['idempotencyKey is required', 'amount must be greater than zero']);
});

test('keeps canonical song attribution independent from backing rendition', () => {
  const valid = validateLedgerEntry(entry({
    type: LEDGER_ENTRY_TYPES.performerAllocation,
    direction: LEDGER_DIRECTIONS.debit,
    attribution: { canonicalSongId: 'song_hello_adele', backingTrackId: 'youtube_abc', performanceId: 'perf_1', performerUid: 'singer_1' },
  }));
  assert.equal(valid.valid, true);
  assert.equal(valid.entry.attribution.canonicalSongId, 'song_hello_adele');
  assert.equal(valid.entry.attribution.backingTrackId, 'youtube_abc');
  assert.equal(validateLedgerEntry(entry({ attribution: { backingTrackId: 'youtube_abc' } })).valid, false);
});

test('financial metadata requires a provider transaction id', () => {
  assert.equal(validateLedgerEntry(entry({ financial: { amountCents: 2000, currency: 'usd' } })).valid, false);
  assert.equal(validateLedgerEntry(entry({ financial: { amountCents: 2000, currency: 'usd', externalTransactionId: 'gb_txn_1' } })).valid, true);
});

test('reconciles only valid posted credits and debits', () => {
  assert.equal(reconcileLedgerBalance([
    entry({ ledgerEntryId: 'grant', idempotencyKey: 'grant', amount: 100 }),
    entry({ ledgerEntryId: 'spend', idempotencyKey: 'spend', direction: LEDGER_DIRECTIONS.debit, type: LEDGER_ENTRY_TYPES.reactionSpend, amount: 25 }),
    entry({ ledgerEntryId: 'pending', idempotencyKey: 'pending', status: 'pending', amount: 500 }),
  ]), 75);
});
