const SPEND_READINESS_SCHEMA_VERSION = 1;
const DEFAULT_SPEND_READINESS_THRESHOLDS = Object.freeze({
  minimumAcceptedOperations: 12,
  minimumDistinctAccounts: 3,
  minimumDuplicateReplays: 1,
  requiredKinds: Object.freeze(['reaction', 'profile_change', 'avatar_unlock']),
});

const token = (value = '') => String(value || '').trim();
const normalizedToken = (value = '') => token(value).toLowerCase();
const positiveInteger = (value = 0) => Math.max(0, Math.floor(Number(value) || 0));

const normalizeOperation = (operation = {}) => ({
  operationDocumentId: token(operation.operationDocumentId || operation.documentId || operation.id),
  roomCode: token(operation.roomCode).toUpperCase(),
  uid: token(operation.uid),
  kind: normalizedToken(operation.kind),
  outcome: normalizedToken(operation.outcome),
  chargedAmount: positiveInteger(operation.chargedAmount),
  balanceBefore: positiveInteger(operation.balanceBefore),
  balanceAfter: positiveInteger(operation.balanceAfter),
  replayCount: positiveInteger(operation.replayCount),
});

const normalizeLedgerEntry = (entry = {}) => ({
  documentId: token(entry.documentId || entry.ledgerEntryId || entry.id),
  idempotencyKey: token(entry.idempotencyKey),
  roomCode: token(entry.roomCode).toUpperCase(),
  uid: token(entry.uid),
  currency: normalizedToken(entry.currency),
  direction: normalizedToken(entry.direction),
  type: normalizedToken(entry.type),
  amount: positiveInteger(entry.amount),
  status: normalizedToken(entry.status),
});

const expectedLedgerTypeForKind = (kind = '') => ({
  reaction: 'reaction_spend',
  profile_change: 'profile_change_spend',
  avatar_unlock: 'avatar_unlock_spend',
}[normalizedToken(kind)] || '');

const buildSpendOperationReadiness = ({
  roomCode = '',
  expectedCurrency = 'points',
  spendOperations = [],
  ledgerEntries = [],
  truncated = false,
  thresholds = DEFAULT_SPEND_READINESS_THRESHOLDS,
} = {}) => {
  const safeRoomCode = token(roomCode).toUpperCase();
  const safeCurrency = normalizedToken(expectedCurrency) || 'points';
  const safeThresholds = {
    minimumAcceptedOperations: positiveInteger(thresholds?.minimumAcceptedOperations),
    minimumDistinctAccounts: positiveInteger(thresholds?.minimumDistinctAccounts),
    minimumDuplicateReplays: positiveInteger(thresholds?.minimumDuplicateReplays),
    requiredKinds: Array.isArray(thresholds?.requiredKinds)
      ? [...new Set(thresholds.requiredKinds.map(normalizedToken).filter(Boolean))]
      : [...DEFAULT_SPEND_READINESS_THRESHOLDS.requiredKinds],
  };
  const operations = spendOperations.map(normalizeOperation)
    .filter((operation) => operation.operationDocumentId && operation.roomCode === safeRoomCode);
  const spendLedgers = ledgerEntries.map(normalizeLedgerEntry)
    .filter((entry) => entry.roomCode === safeRoomCode)
    .filter((entry) => entry.idempotencyKey.startsWith('audience_spend:'));
  const operationsById = new Map(operations.map((operation) => [operation.operationDocumentId, operation]));
  const ledgersByOperationId = new Map();
  spendLedgers.forEach((entry) => {
    const operationId = entry.idempotencyKey.slice('audience_spend:'.length);
    const list = ledgersByOperationId.get(operationId) || [];
    list.push(entry);
    ledgersByOperationId.set(operationId, list);
  });

  const accepted = operations.filter((operation) => operation.outcome === 'accepted');
  const acceptedPaid = accepted.filter((operation) => operation.chargedAmount > 0);
  const insufficient = operations.filter((operation) => operation.outcome === 'insufficient_balance');
  const unrecognized = operations.filter((operation) => !['accepted', 'insufficient_balance'].includes(operation.outcome));
  const missingLedgerOperationIds = [];
  const invalidLedgerOperationIds = [];
  const balanceTransitionOperationIds = [];
  const unexpectedLedgerOperationIds = [];

  operations.forEach((operation) => {
    const matchingLedgers = ledgersByOperationId.get(operation.operationDocumentId) || [];
    if (operation.outcome === 'accepted' && operation.chargedAmount > 0) {
      if (matchingLedgers.length === 0) {
        missingLedgerOperationIds.push(operation.operationDocumentId);
      } else if (
        matchingLedgers.length !== 1
        || matchingLedgers[0].uid !== operation.uid
        || matchingLedgers[0].currency !== safeCurrency
        || matchingLedgers[0].direction !== 'debit'
        || matchingLedgers[0].status !== 'posted'
        || matchingLedgers[0].amount !== operation.chargedAmount
        || matchingLedgers[0].type !== expectedLedgerTypeForKind(operation.kind)
      ) {
        invalidLedgerOperationIds.push(operation.operationDocumentId);
      }
      if (operation.balanceBefore - operation.chargedAmount !== operation.balanceAfter) {
        balanceTransitionOperationIds.push(operation.operationDocumentId);
      }
    } else if (operation.outcome === 'insufficient_balance') {
      if (matchingLedgers.length > 0) unexpectedLedgerOperationIds.push(operation.operationDocumentId);
      if (operation.chargedAmount !== 0 || operation.balanceBefore !== operation.balanceAfter) {
        balanceTransitionOperationIds.push(operation.operationDocumentId);
      }
    } else if (matchingLedgers.length > 0) {
      unexpectedLedgerOperationIds.push(operation.operationDocumentId);
    }
  });

  const orphanLedgerOperationIds = [...ledgersByOperationId.keys()]
    .filter((operationId) => !operationsById.has(operationId))
    .sort();
  const kindCounts = safeThresholds.requiredKinds.reduce((result, kind) => {
    const kindOperations = operations.filter((operation) => operation.kind === kind);
    result[kind] = {
      total: kindOperations.length,
      accepted: kindOperations.filter((operation) => operation.outcome === 'accepted').length,
      insufficient: kindOperations.filter((operation) => operation.outcome === 'insufficient_balance').length,
      chargedAmount: kindOperations.reduce((sum, operation) => sum + operation.chargedAmount, 0),
    };
    return result;
  }, {});
  const duplicateReplayCount = operations.reduce((sum, operation) => sum + operation.replayCount, 0);
  const distinctAcceptedAccounts = new Set(accepted.map((operation) => operation.uid).filter(Boolean)).size;
  const blockers = [];
  if (truncated === true) blockers.push('report_truncated');
  if (missingLedgerOperationIds.length) blockers.push('accepted_operation_missing_ledger');
  if (invalidLedgerOperationIds.length) blockers.push('accepted_operation_invalid_ledger');
  if (unexpectedLedgerOperationIds.length) blockers.push('nonaccepted_operation_has_ledger');
  if (orphanLedgerOperationIds.length) blockers.push('orphan_spend_ledger');
  if (balanceTransitionOperationIds.length) blockers.push('invalid_balance_transition');
  if (unrecognized.length) blockers.push('unrecognized_operation_outcome');
  if (accepted.length < safeThresholds.minimumAcceptedOperations) blockers.push('accepted_sample_below_threshold');
  if (distinctAcceptedAccounts < safeThresholds.minimumDistinctAccounts) blockers.push('account_sample_below_threshold');
  if (duplicateReplayCount < safeThresholds.minimumDuplicateReplays) blockers.push('duplicate_replay_evidence_missing');
  const missingKinds = safeThresholds.requiredKinds.filter((kind) => (kindCounts[kind]?.accepted || 0) < 1);
  if (missingKinds.length) blockers.push('required_spend_kind_missing');

  return {
    schemaVersion: SPEND_READINESS_SCHEMA_VERSION,
    roomCode: safeRoomCode,
    expectedCurrency: safeCurrency,
    authoritative: false,
    balanceAuthority: 'legacy',
    boundaryReady: blockers.length === 0,
    blockers,
    thresholds: safeThresholds,
    summary: {
      operationCount: operations.length,
      acceptedOperationCount: accepted.length,
      acceptedPaidOperationCount: acceptedPaid.length,
      insufficientOperationCount: insufficient.length,
      unrecognizedOperationCount: unrecognized.length,
      distinctAcceptedAccountCount: distinctAcceptedAccounts,
      duplicateReplayCount,
      acceptedChargedAmount: accepted.reduce((sum, operation) => sum + operation.chargedAmount, 0),
      kindCounts,
    },
    coverage: {
      missingLedgerOperationIds: missingLedgerOperationIds.sort(),
      invalidLedgerOperationIds: invalidLedgerOperationIds.sort(),
      unexpectedLedgerOperationIds: unexpectedLedgerOperationIds.sort(),
      orphanLedgerOperationIds,
      balanceTransitionOperationIds: [...new Set(balanceTransitionOperationIds)].sort(),
    },
  };
};

module.exports = {
  DEFAULT_SPEND_READINESS_THRESHOLDS,
  SPEND_READINESS_SCHEMA_VERSION,
  buildSpendOperationReadiness,
  expectedLedgerTypeForKind,
};
