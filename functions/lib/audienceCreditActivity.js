const crypto = require('node:crypto');
const {
  buildLegacyRoomLedgerAccountId,
  buildLedgerAccountId,
} = require('./beauBucksLedger');

const ACTIVITY_KIND = Object.freeze({
  payment: 'payment',
  credit: 'credit',
  debit: 'debit',
});

const LEDGER_LABELS = Object.freeze({
  vip_account_upgrade: 'VIP account reward',
  community_social_boost_v1: 'Community Boost',
  join_grant: 'Room welcome reward',
  ticket_value: 'Event access reward',
  timed_refill: 'Lobby reward',
  promo_grant: 'Promo reward',
  purchase_grant: 'BeauBucks purchase',
  refund_reversal: 'Refund adjustment',
  chargeback_reversal: 'Payment reversal',
  reaction_spend: 'Reaction',
  profile_change_spend: 'Profile update',
  avatar_unlock_spend: 'Avatar unlock',
  reaction_slot_unlock_spend: 'Reaction slot 5',
});

const token = (value = '') => String(value || '').trim();
const normalizedToken = (value = '') => token(value)
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '_')
  .replace(/_+/g, '_')
  .slice(0, 160);
const wholeAmount = (value = 0) => Math.max(0, Math.floor(Number(value) || 0));
const toMillis = (value) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const buildAudienceLedgerAccountIds = ({ roomCode = '', uid = '' } = {}) => {
  const room = normalizedToken(token(roomCode).toUpperCase());
  const user = token(uid);
  if (!room || !user) return [];
  return [
    buildLedgerAccountId({ roomCode, uid: user, currency: 'points' }),
    buildLedgerAccountId({ uid: user, currency: 'beaubucks' }),
    buildLegacyRoomLedgerAccountId({ roomCode, uid: user, currency: 'beaubucks' }),
  ];
};

const buildConfirmationCode = (sourceId = '') => {
  const safeSourceId = token(sourceId);
  if (!safeSourceId) return '';
  return `BR-${crypto.createHash('sha256').update(safeSourceId).digest('hex').slice(0, 10).toUpperCase()}`;
};

const sanitizeLedgerActivity = (entry = {}) => {
  if (normalizedToken(entry.status) !== 'posted') return null;
  const amount = wholeAmount(entry.amount);
  if (!amount) return null;
  const direction = normalizedToken(entry.direction) === 'debit' ? 'debit' : 'credit';
  const type = normalizedToken(entry.type);
  const occurredAtMs = toMillis(entry.createdAt || entry.updatedAt);
  const isAuthoritativePurchase = type === 'purchase_grant'
    && entry.authoritative === true
    && normalizedToken(entry.currency) === 'beaubucks';
  const financialAmountCents = wholeAmount(entry.financial?.amountCents);
  const financialSourceId = token(entry.financial?.externalTransactionId || entry.source?.sourceId);
  return {
    activityId: buildConfirmationCode(`activity:${entry.ledgerEntryId || entry.idempotencyKey || `${type}:${occurredAtMs}:${amount}`}`),
    kind: isAuthoritativePurchase ? ACTIVITY_KIND.payment : direction === 'debit' ? ACTIVITY_KIND.debit : ACTIVITY_KIND.credit,
    title: LEDGER_LABELS[type] || (direction === 'debit' ? 'Room credit used' : 'Room credit reward'),
    amount,
    direction,
    currency: normalizedToken(entry.currency) === 'beaubucks' ? 'beaubucks' : 'points',
    occurredAtMs,
    payment: isAuthoritativePurchase ? {
      amountCents: financialAmountCents,
      currency: normalizedToken(entry.financial?.currency || 'usd') || 'usd',
      status: 'paid',
      confirmationCode: buildConfirmationCode(financialSourceId || entry.ledgerEntryId),
    } : null,
  };
};

const sanitizePaidCheckoutActivity = (checkout = {}) => {
  const paymentStatus = normalizedToken(checkout.paymentStatus);
  const checkoutStatus = normalizedToken(checkout.checkoutStatus);
  if (paymentStatus !== 'paid' || checkoutStatus !== 'completed') return null;
  const checkoutType = normalizedToken(checkout.checkoutType);
  if (!['points_pack', 'tip_crate'].includes(checkoutType)) return null;
  const points = wholeAmount(checkout.points);
  const amountCents = wholeAmount(checkout.amountCents ?? Number(checkout.amount || 0) * 100);
  const roomWide = normalizedToken(checkout.rewardScope) === 'room';
  const safeLabel = token(checkout.label).slice(0, 80)
    || (checkoutType === 'tip_crate' ? 'Room Boost' : 'Credit pack');
  const sourceId = token(checkout.sessionId || checkout.documentId);
  return {
    activityId: buildConfirmationCode(`payment:${sourceId || `${safeLabel}:${amountCents}`}`),
    kind: ACTIVITY_KIND.payment,
    title: checkoutType === 'tip_crate' ? safeLabel : `${safeLabel} purchase`,
    amount: points,
    direction: roomWide ? 'room_credit' : 'credit',
    currency: 'points',
    occurredAtMs: toMillis(checkout.fulfilledAt || checkout.updatedAt || checkout.createdAt),
    payment: {
      amountCents,
      currency: normalizedToken(checkout.currency || 'usd') || 'usd',
      status: 'paid',
      confirmationCode: buildConfirmationCode(sourceId || checkout.documentId),
    },
  };
};

const buildAudienceCreditActivity = ({ ledgerEntries = [], paidCheckouts = [], limit = 10 } = {}) => {
  const safeLimit = Math.max(1, Math.min(20, Math.floor(Number(limit) || 10)));
  const activities = [
    ...ledgerEntries.map(sanitizeLedgerActivity),
    ...paidCheckouts.map(sanitizePaidCheckoutActivity),
  ]
    .filter(Boolean)
    .sort((left, right) => Number(right.occurredAtMs || 0) - Number(left.occurredAtMs || 0));
  return {
    activities: activities.slice(0, safeLimit),
    hasMore: activities.length > safeLimit,
    paymentRecordCount: activities.filter((entry) => entry.kind === ACTIVITY_KIND.payment).length,
  };
};

module.exports = {
  ACTIVITY_KIND,
  buildAudienceCreditActivity,
  buildAudienceLedgerAccountIds,
  buildConfirmationCode,
  sanitizeLedgerActivity,
  sanitizePaidCheckoutActivity,
};
