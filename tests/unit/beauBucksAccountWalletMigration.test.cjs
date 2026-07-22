const assert = require('node:assert/strict');
const { buildBeauBucksAccountWalletMigrationReport } = require('../../functions/lib/beauBucksAccountWalletMigration');

test('empty inventory is ready and read-only', () => {
  const report = buildBeauBucksAccountWalletMigrationReport();
  assert.equal(report.readOnly, true);
  assert.equal(report.readyForAccountWalletCutover, true);
  assert.equal(report.summary.accountCount, 0);
});

test('positive legacy Room wallets block account cutover and aggregate by exact uid', () => {
  const report = buildBeauBucksAccountWalletMigrationReport({ accounts: [
    { documentId: 'room1__User-1__beaubucks', uid: 'User-1', currency: 'beaubucks', scope: 'room', balance: 400 },
    { documentId: 'room2__User-1__beaubucks', uid: 'User-1', currency: 'beaubucks', scope: 'room', balance: 600 },
    { documentId: 'account__User-1__beaubucks', uid: 'User-1', currency: 'beaubucks', scope: 'account', balance: 50 },
  ] });
  assert.equal(report.readyForAccountWalletCutover, false);
  assert.equal(report.summary.positiveLegacyAccountCount, 2);
  assert.equal(report.summary.legacyBalanceTotal, 1000);
  assert.equal(report.users[0].expectedAccountId, 'account__User-1__beaubucks');
});

test('zeroed legacy evidence and one canonical persistent projection are safe', () => {
  const report = buildBeauBucksAccountWalletMigrationReport({ accounts: [
    { documentId: 'room1__user-1__beaubucks', uid: 'user-1', currency: 'beaubucks', scope: 'room', balance: 0 },
    { documentId: 'account__user-1__beaubucks', uid: 'user-1', currency: 'beaubucks', scope: 'account', balance: 75 },
  ] });
  assert.equal(report.readyForAccountWalletCutover, true);
  assert.equal(report.blockers.length, 0);
});

test('truncation and malformed persistent identities fail closed', () => {
  const report = buildBeauBucksAccountWalletMigrationReport({
    truncated: true,
    accounts: [{ documentId: 'wrong', uid: 'User', currency: 'beaubucks', scope: 'account', balance: 0 }],
  });
  assert.equal(report.readyForAccountWalletCutover, false);
  assert.ok(report.blockers.some((blocker) => blocker.includes('truncated')));
  assert.ok(report.blockers.some((blocker) => blocker.includes('document ID')));
});
