import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'vitest';

const source = fs.readFileSync(new URL('../../functions/index.js', import.meta.url), 'utf8');
const start = source.indexOf('exports.reconcileBeauBucksShadowLedger = onCall');
const end = source.indexOf('exports.mergeAnonymousAccountData = onCall', start);
const callableSource = source.slice(start, end);

test('reconciliation callable is canary-scoped and explicitly read-only', () => {
  assert.ok(start >= 0 && end > start, 'reconciliation callable source must exist');
  assert.match(callableSource, /BEAUBUCKS_RECONCILIATION_ROOM_CODES/);
  assert.match(callableSource, /BEAUBUCKS_RECONCILIATION_HOST_UIDS/);
  assert.match(callableSource, /ensureRoomHostAccess/);
  assert.match(callableSource, /buildShadowLedgerReconciliation/);
  assert.match(callableSource, /buildSpendOperationReadiness/);
  assert.match(callableSource, /SPEND_OPERATIONS_COLLECTION/);
  assert.match(callableSource, /balanceReadMigrationReady/);
  assert.match(callableSource, /explicit_compensating_opening_entry/);
  assert.doesNotMatch(callableSource, /\b(?:tx|batch|writer)\.(?:set|update|delete|create)\s*\(/);
  assert.doesNotMatch(callableSource, /docSnap\.ref\.(?:set|update|delete|create)\s*\(/);
});

test('global balances require an explicit super-admin request', () => {
  assert.match(callableSource, /includeGlobalBalances = superAdmin && request\.data\?\.includeGlobalBalances === true/);
  assert.match(callableSource, /globalBalancesIncluded: includeGlobalBalances/);
});

test('operator report keeps canonical and backing attribution in the pure contract', () => {
  const reconciliationSource = fs.readFileSync(new URL('../../functions/lib/beauBucksReconciliation.js', import.meta.url), 'utf8');
  assert.match(reconciliationSource, /canonicalAttribution:[\s\S]*canonicalSongIds:[\s\S]*performanceIds:/);
  assert.match(reconciliationSource, /backingAttribution:[\s\S]*backingTrackIds:/);
  assert.match(reconciliationSource, /authoritative: false/);
  assert.match(reconciliationSource, /balanceAuthority: 'legacy'/);
});
