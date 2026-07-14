import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const source = readFileSync('functions/index.js', 'utf8');

test('server-authoritative grants emit deterministic non-authoritative shadow entries', () => {
  assert.match(source, /setShadowLedgerEntry.*require\("\.\/lib\/beauBucksLedger"\)/s);
  assert.match(source, /room_event_credit_grant:\$\{grantDocId\}[\s\S]*type: 'join_grant'/);
  assert.match(source, /room_event_credit_grant:\$\{entitlementGrantRef\.id\}[\s\S]*type: 'ticket_value'/);
  assert.match(source, /timed_lobby:\$\{roomCode\}:\$\{callerUid\}:\$\{earnedTotal \+ pointsGranted\}[\s\S]*type: 'timed_refill'/);
  assert.match(source, /promo:\$\{roomCode\}:\$\{callerUid\}:\$\{activeCampaign\.id\}:\$\{nextRedeemCount\}[\s\S]*type: 'promo_grant'/);
});
