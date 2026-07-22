import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildLedgerEntryId,
  buildLedgerAccountId,
  buildAuthoritativeLedgerEntry,
  buildShadowLedgerEntry,
  resolveLedgerCurrency,
  setShadowLedgerEntry,
} = require('../../functions/lib/beauBucksLedger.js');

test('server ledger uses deterministic hashed document identities', () => {
  assert.equal(buildLedgerEntryId('join:PARTY:user_1'), buildLedgerEntryId('join:PARTY:user_1'));
  assert.notEqual(buildLedgerEntryId('join:PARTY:user_1'), buildLedgerEntryId('join:PARTY:user_2'));
});

test('authoritative entries use the same deterministic account identity without shadow authority', () => {
  assert.equal(buildLedgerAccountId({ roomCode: 'ROOM1', uid: 'user_1', currency: 'beaubucks' }), 'room1__user_1__beaubucks');
  const entry = buildAuthoritativeLedgerEntry({
    idempotencyKey: 'purchase:cs_1', roomCode: 'ROOM1', uid: 'user_1',
    eventCredits: { enabled: true, presetId: 'beaubucks' }, type: 'purchase_grant', amount: 1200,
  });
  assert.equal(entry.shadow, false);
  assert.equal(entry.authoritative, true);
  assert.equal(entry.accountId, 'room1__user_1__beaubucks');
});

test('server ledger preserves Points and BeauBucks currency boundaries', () => {
  assert.equal(resolveLedgerCurrency({ enabled: false }), 'points');
  assert.equal(resolveLedgerCurrency({ enabled: true, presetId: 'beaubucks' }), 'beaubucks');
  assert.equal(resolveLedgerCurrency({ enabled: true, supportProvider: 'givebutter' }), 'beaubucks');
});

test('shadow entries are explicitly non-authoritative', () => {
  const entry = buildShadowLedgerEntry({
    idempotencyKey: 'grant:PARTY:user_1', roomCode: 'PARTY', uid: 'user_1',
    eventCredits: { enabled: true, presetId: 'beaubucks' }, type: 'join_grant', amount: 100,
    source: { provider: 'beaurocks', sourceId: 'grant_1' }, serverTimestamp: 'SERVER_TIME',
  });
  assert.equal(entry.shadow, true);
  assert.equal(entry.authoritative, false);
  assert.equal(entry.currency, 'beaubucks');
  assert.equal(entry.createdAt, 'SERVER_TIME');
});

test('writer targets one deterministic ledger document with merge safety', () => {
  const calls = [];
  const writer = { set: (...args) => calls.push(args) };
  const db = { collection: (name) => ({ doc: (id) => ({ name, id }) }) };
  const result = setShadowLedgerEntry({
    writer, db, idempotencyKey: 'timed:PARTY:user_1:25', roomCode: 'PARTY', uid: 'user_1',
    eventCredits: { enabled: true }, type: 'timed_refill', amount: 25,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].name, 'beaurocks_ledger_entries');
  assert.equal(calls[0][0].id, result.entry.ledgerEntryId);
  assert.deepEqual(calls[0][2], { merge: true });
});
