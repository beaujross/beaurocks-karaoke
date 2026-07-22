const { buildLegacyRoomLedgerAccountId, buildLedgerAccountId, buildLedgerEntryId } = require('./beauBucksLedger');

const RECONCILIATION_SCHEMA_VERSION = 1;
const RECONCILIATION_CLASSIFICATIONS = Object.freeze({
  exact: 'exact',
  openingBalanceGap: 'opening_balance_gap',
  missingShadowEvent: 'missing_shadow_event',
  duplicateIdempotencyConflict: 'duplicate_idempotency_conflict',
  currencyMismatch: 'currency_mismatch',
  unsupportedLegacySpend: 'unsupported_legacy_spend',
});

const token = (value = '') => String(value || '').trim();
const currencyToken = (value = '') => token(value).toLowerCase();
const positiveInteger = (value = 0) => Math.max(0, Math.floor(Number(value) || 0));
const signedInteger = (value = 0) => Math.trunc(Number(value) || 0);
const unique = (values = []) => [...new Set(values.map(token).filter(Boolean))].sort();

const normalizeLegacyAccount = (account = {}) => ({
  uid: token(account.uid),
  roomPoints: positiveInteger(account.roomPoints),
  timedLobbyEarnedPoints: positiveInteger(account.timedLobbyEarnedPoints),
  globalPointsBalance: account.globalPointsBalance == null
    ? null
    : positiveInteger(account.globalPointsBalance),
});

const normalizeLedgerEntry = (entry = {}) => ({
  documentId: token(entry.documentId || entry.id),
  ledgerEntryId: token(entry.ledgerEntryId),
  idempotencyKey: token(entry.idempotencyKey),
  accountId: token(entry.accountId),
  roomCode: token(entry.roomCode).toUpperCase(),
  uid: token(entry.uid),
  currency: currencyToken(entry.currency),
  direction: currencyToken(entry.direction),
  type: currencyToken(entry.type),
  amount: positiveInteger(entry.amount),
  status: currencyToken(entry.status),
  shadow: entry.shadow === true,
  authoritative: entry.authoritative === true,
  source: {
    provider: currencyToken(entry.source?.provider),
    sourceId: token(entry.source?.sourceId),
    sourceCollection: token(entry.source?.sourceCollection),
  },
  attribution: {
    canonicalSongId: token(entry.attribution?.canonicalSongId),
    performanceId: token(entry.attribution?.performanceId),
    backingTrackId: token(entry.attribution?.backingTrackId),
    performerUid: token(entry.attribution?.performerUid),
    fundCode: token(entry.attribution?.fundCode),
  },
});

const normalizeEvidenceEvent = (event = {}) => ({
  evidenceId: token(event.evidenceId || event.id),
  idempotencyKey: token(event.idempotencyKey),
  roomCode: token(event.roomCode).toUpperCase(),
  uid: token(event.uid),
  currency: currencyToken(event.currency),
  type: currencyToken(event.type),
  amount: event.amount == null ? null : positiveInteger(event.amount),
  sourceCollection: token(event.sourceCollection),
  sourceId: token(event.sourceId),
});

const ledgerAmount = (entry = {}) => {
  if (entry.status !== 'posted' || !entry.amount) return 0;
  return entry.direction === 'debit' ? -entry.amount : entry.direction === 'credit' ? entry.amount : 0;
};

const evidenceMatchesEntry = (evidence, entry) => {
  if (evidence.idempotencyKey && evidence.idempotencyKey === entry.idempotencyKey) return true;
  return Boolean(
    evidence.sourceCollection
    && evidence.sourceId
    && evidence.sourceCollection === entry.source.sourceCollection
    && evidence.sourceId === entry.source.sourceId
  );
};

const buildAccountKey = (uid = '', currency = '') => `${token(uid)}::${currencyToken(currency)}`;

const buildShadowLedgerReconciliation = ({
  roomCode = '',
  expectedCurrency = 'points',
  legacyAccounts = [],
  ledgerEntries = [],
  evidenceEvents = [],
  truncated = false,
} = {}) => {
  const safeRoomCode = token(roomCode).toUpperCase();
  const safeExpectedCurrency = currencyToken(expectedCurrency) || 'points';
  const normalizedLegacy = legacyAccounts.map(normalizeLegacyAccount).filter((account) => account.uid);
  const normalizedEntries = ledgerEntries.map(normalizeLedgerEntry).filter((entry) => entry.uid);
  const normalizedEvidence = evidenceEvents.map(normalizeEvidenceEvent).filter((event) => event.uid);
  const accountKeys = new Set([
    ...normalizedLegacy.map((account) => buildAccountKey(account.uid, safeExpectedCurrency)),
    ...normalizedEntries.map((entry) => buildAccountKey(entry.uid, entry.currency || safeExpectedCurrency)),
    ...normalizedEvidence.map((event) => buildAccountKey(event.uid, event.currency || safeExpectedCurrency)),
  ]);
  const legacyByUid = new Map(normalizedLegacy.map((account) => [account.uid, account]));

  const accounts = [...accountKeys].sort().map((accountKey) => {
    const [uid, keyCurrency] = accountKey.split('::');
    const accountCurrency = keyCurrency || safeExpectedCurrency;
    const legacy = legacyByUid.get(uid) || normalizeLegacyAccount({ uid });
    const accountEntries = normalizedEntries.filter((entry) => entry.uid === uid && (entry.currency || safeExpectedCurrency) === accountCurrency);
    const allUidEntries = normalizedEntries.filter((entry) => entry.uid === uid);
    const accountEvidence = normalizedEvidence.filter((event) => event.uid === uid && (event.currency || safeExpectedCurrency) === accountCurrency);
    const idempotencyCounts = new Map();
    accountEntries.forEach((entry) => {
      if (!entry.idempotencyKey) return;
      idempotencyCounts.set(entry.idempotencyKey, (idempotencyCounts.get(entry.idempotencyKey) || 0) + 1);
    });
    const duplicateKeys = [...idempotencyCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key)
      .sort();
    const identityConflicts = accountEntries
      .filter((entry) => entry.idempotencyKey)
      .filter((entry) => {
        const expectedId = buildLedgerEntryId(entry.idempotencyKey);
        return (entry.documentId && entry.documentId !== expectedId)
          || (entry.ledgerEntryId && entry.ledgerEntryId !== expectedId);
      })
      .map((entry) => entry.documentId || entry.ledgerEntryId || entry.idempotencyKey);
    const currencyConflicts = allUidEntries
      .filter((entry) => entry.roomCode === safeRoomCode)
      .filter((entry) => entry.currency && entry.currency !== safeExpectedCurrency)
      .map((entry) => entry.documentId || entry.ledgerEntryId || entry.idempotencyKey);
    const missingEvidence = accountEvidence.filter((evidence) => !accountEntries.some((entry) => evidenceMatchesEntry(evidence, entry)));
    const ledgerBalance = accountEntries.reduce((sum, entry) => sum + ledgerAmount(entry), 0);
    const legacyRoomBalance = accountCurrency === safeExpectedCurrency ? legacy.roomPoints : 0;
    const delta = signedInteger(legacyRoomBalance - ledgerBalance);
    const classifications = [];
    if (duplicateKeys.length || identityConflicts.length) {
      classifications.push(RECONCILIATION_CLASSIFICATIONS.duplicateIdempotencyConflict);
    }
    if (currencyConflicts.length || accountCurrency !== safeExpectedCurrency) {
      classifications.push(RECONCILIATION_CLASSIFICATIONS.currencyMismatch);
    }
    if (missingEvidence.length) {
      classifications.push(RECONCILIATION_CLASSIFICATIONS.missingShadowEvent);
    }
    const knownMissingAmount = missingEvidence.reduce((sum, event) => sum + (event.amount == null ? 0 : event.amount), 0);
    if (delta > knownMissingAmount) {
      classifications.push(RECONCILIATION_CLASSIFICATIONS.openingBalanceGap);
    }
    if (delta < 0) {
      classifications.push(RECONCILIATION_CLASSIFICATIONS.unsupportedLegacySpend);
    }
    if (!classifications.length && delta === 0) {
      classifications.push(RECONCILIATION_CLASSIFICATIONS.exact);
    }
    if (!classifications.length) {
      classifications.push(RECONCILIATION_CLASSIFICATIONS.openingBalanceGap);
    }

    return {
      accountId: accountCurrency === 'beaubucks'
        ? buildLegacyRoomLedgerAccountId({ roomCode: safeRoomCode, uid, currency: accountCurrency })
        : buildLedgerAccountId({ roomCode: safeRoomCode, uid, currency: accountCurrency }),
      roomCode: safeRoomCode,
      uid,
      currency: accountCurrency,
      legacy: {
        roomPoints: legacyRoomBalance,
        globalPointsBalance: legacy.globalPointsBalance,
        authority: 'legacy',
      },
      shadowLedger: {
        postedBalance: ledgerBalance,
        postedEntryCount: accountEntries.filter((entry) => entry.status === 'posted').length,
        creditTotal: accountEntries.filter((entry) => entry.status === 'posted' && entry.direction === 'credit').reduce((sum, entry) => sum + entry.amount, 0),
        debitTotal: accountEntries.filter((entry) => entry.status === 'posted' && entry.direction === 'debit').reduce((sum, entry) => sum + entry.amount, 0),
        authoritative: false,
      },
      delta,
      reconciled: delta === 0 && classifications.length === 1 && classifications[0] === RECONCILIATION_CLASSIFICATIONS.exact,
      primaryClassification: classifications[0],
      classifications,
      evidence: {
        missingShadowEventCount: missingEvidence.length,
        missingShadowEvents: missingEvidence.map((event) => ({
          evidenceId: event.evidenceId,
          idempotencyKey: event.idempotencyKey,
          type: event.type,
          amount: event.amount,
          sourceCollection: event.sourceCollection,
          sourceId: event.sourceId,
        })),
        duplicateIdempotencyKeys: duplicateKeys,
        identityConflicts: unique(identityConflicts),
        currencyConflicts: unique(currencyConflicts),
      },
      canonicalAttribution: {
        canonicalSongIds: unique(accountEntries.map((entry) => entry.attribution.canonicalSongId)),
        performanceIds: unique(accountEntries.map((entry) => entry.attribution.performanceId)),
        performerUids: unique(accountEntries.map((entry) => entry.attribution.performerUid)),
      },
      backingAttribution: {
        backingTrackIds: unique(accountEntries.map((entry) => entry.attribution.backingTrackId)),
      },
    };
  });

  const classificationCounts = Object.values(RECONCILIATION_CLASSIFICATIONS).reduce((result, classification) => {
    result[classification] = accounts.filter((account) => account.classifications.includes(classification)).length;
    return result;
  }, {});

  return {
    schemaVersion: RECONCILIATION_SCHEMA_VERSION,
    readOnly: true,
    authoritative: false,
    balanceAuthority: 'legacy',
    roomCode: safeRoomCode,
    expectedCurrency: safeExpectedCurrency,
    truncated: truncated === true,
    summary: {
      accountCount: accounts.length,
      reconciledAccountCount: accounts.filter((account) => account.reconciled).length,
      mismatchAccountCount: accounts.filter((account) => !account.reconciled).length,
      classificationCounts,
    },
    accounts,
  };
};

module.exports = {
  RECONCILIATION_CLASSIFICATIONS,
  RECONCILIATION_SCHEMA_VERSION,
  buildShadowLedgerReconciliation,
};
