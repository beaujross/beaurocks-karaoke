const crypto = require('node:crypto');
const commercialContract = require('./hostCommercialContract.json');
const { buildLedgerAccountId } = require('./beauBucksLedger');

const BEAUBUCKS_ACCOUNT_COLLECTION = 'beaurocks_ledger_accounts';
const BEAUBUCKS_PAYMENT_REF_COLLECTION = 'beaurocks_payment_refs';
const BEAUBUCKS_ADJUSTMENT_COLLECTION = 'beaurocks_payment_adjustments';
const BEAUBUCKS_PENDING_ADJUSTMENT_COLLECTION = 'beaurocks_pending_payment_adjustments';
const BEAUBUCKS_PENDING_ADJUSTMENT_EVENT_COLLECTION = 'beaurocks_pending_payment_adjustment_events';
const BEAUBUCKS_PURCHASE_LIMIT_COLLECTION = 'beaurocks_beaubucks_purchase_limits';
const BEAUBUCKS_AUTHORITY_SCHEMA_VERSION = 1;

const token = (value = '') => String(value || '').trim();
const normalizedToken = (value = '') => token(value).toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 160);
const whole = (value = 0) => Math.max(0, Math.floor(Number(value) || 0));

const getBeauBucksPolicy = (contract = commercialContract) => contract?.beauBucksPolicy || {};
const getBeauBucksPack = (packId = '', contract = commercialContract) => {
  const safePackId = normalizedToken(packId);
  const pack = getBeauBucksPolicy(contract)?.packs?.[safePackId] || null;
  if (!pack || pack.id !== safePackId) return null;
  const amountCents = whole(pack.amountCents);
  const beauBucks = whole(pack.beauBucks);
  if (!amountCents || !beauBucks || normalizedToken(pack.scope) !== 'room') return null;
  return {
    id: safePackId,
    publicLabel: token(pack.publicLabel).slice(0, 80) || 'BeauBucks pack',
    amountCents,
    currency: normalizedToken(pack.currency || 'usd') || 'usd',
    beauBucks,
    scope: 'room',
    publicOffer: pack.publicOffer === true,
  };
};

const isBeauBucksCheckoutEnabled = (contract = commercialContract) => {
  const policy = getBeauBucksPolicy(contract);
  return policy.checkoutEnabled === true && token(policy.status) === 'active';
};

const getBeauBucksPurchaseLimit = (contract = commercialContract) => {
  const source = getBeauBucksPolicy(contract)?.purchaseLimit || {};
  const maxCompletedPurchasesPerBuyerPerRoom = whole(source.maxCompletedPurchasesPerBuyerPerRoom);
  const reservationMinutes = whole(source.reservationMinutes);
  if (!maxCompletedPurchasesPerBuyerPerRoom || reservationMinutes < 30 || reservationMinutes > 1440) return null;
  return { maxCompletedPurchasesPerBuyerPerRoom, reservationMinutes };
};

const evaluateBeauBucksPurchaseReservation = ({
  account = {},
  limitState = {},
  pack = {},
  reservationId = '',
  nowMs = Date.now(),
  contract = commercialContract,
} = {}) => {
  const purchaseLimit = getBeauBucksPurchaseLimit(contract);
  if (!purchaseLimit) return { allowed: false, reasonCode: 'beaubucks_purchase_limit_invalid' };
  const packValue = whole(pack.beauBucks);
  if (!packValue) return { allowed: false, reasonCode: 'beaubucks_pack_invalid' };
  const completedFromProjection = Math.floor(whole(account.lifetimePurchased) / packValue);
  const completedPurchases = Math.max(whole(limitState.completedPurchases), completedFromProjection);
  if (completedPurchases >= purchaseLimit.maxCompletedPurchasesPerBuyerPerRoom) {
    return { allowed: false, reasonCode: 'beaubucks_purchase_limit_reached', completedPurchases, purchaseLimit };
  }
  const activeReservationId = token(limitState.reservationId);
  const reservationExpiresAtMs = whole(limitState.reservationExpiresAtMs);
  if (activeReservationId && activeReservationId !== token(reservationId) && reservationExpiresAtMs > whole(nowMs)) {
    return { allowed: false, reasonCode: 'beaubucks_purchase_in_progress', completedPurchases, purchaseLimit };
  }
  return {
    allowed: true,
    reasonCode: '',
    completedPurchases,
    purchaseLimit,
    reservationExpiresAtMs: whole(nowMs) + (purchaseLimit.reservationMinutes * 60 * 1000),
  };
};

const buildBeauBucksAccountId = ({ roomCode = '', uid = '' } = {}) =>
  buildLedgerAccountId({ roomCode, uid, currency: 'beaubucks' });

const hashId = (namespace = '', value = '') => {
  const safeValue = token(value);
  if (!safeValue) return '';
  return crypto.createHash('sha256').update(`${namespace}:${safeValue}`).digest('hex');
};
const buildBeauBucksPaymentRefId = (paymentIntentId = '') => hashId('beaubucks_payment', paymentIntentId);
const buildBeauBucksAdjustmentId = (eventId = '') => hashId('beaubucks_adjustment', eventId);

const buildPendingBeauBucksAdjustmentState = ({
  existing = {},
  eventIdHash = '',
  adjustmentType = 'refund',
  cumulativeRefundedAmountCents = 0,
  chargebackAmountCents = 0,
  maxEventIds = 20,
} = {}) => {
  const previousEventIds = Array.isArray(existing.eventIdHashes)
    ? existing.eventIdHashes.map(token).filter(Boolean)
    : [];
  const nextEventIds = [...previousEventIds.filter((value) => value !== token(eventIdHash)), token(eventIdHash)]
    .filter(Boolean)
    .slice(-Math.max(1, whole(maxEventIds)));
  return {
    cumulativeRefundedAmountCents: Math.max(
      whole(existing.cumulativeRefundedAmountCents),
      whole(cumulativeRefundedAmountCents),
    ),
    chargebackObserved: existing.chargebackObserved === true || adjustmentType === 'chargeback',
    chargebackAmountCents: Math.max(
      whole(existing.chargebackAmountCents),
      adjustmentType === 'chargeback' ? whole(chargebackAmountCents) : 0,
    ),
    eventIdHashes: nextEventIds,
    eventCount: whole(existing.eventCount) + 1,
  };
};

const validateBeauBucksCheckoutFulfillment = ({ checkout = {}, session = {}, contract = commercialContract } = {}) => {
  const metadata = session?.metadata || {};
  const pack = getBeauBucksPack(metadata.packId || checkout.packId, contract);
  if (!pack) return { ok: false, reasonCode: 'beaubucks_pack_invalid' };
  if (normalizedToken(checkout.checkoutType) !== 'beaubucks_purchase') return { ok: false, reasonCode: 'beaubucks_checkout_not_registered' };
  if (normalizedToken(metadata.checkoutType) !== 'beaubucks_purchase') return { ok: false, reasonCode: 'beaubucks_checkout_type_mismatch' };
  if (normalizedToken(session.payment_status) !== 'paid') return { ok: false, reasonCode: 'beaubucks_payment_not_paid' };
  const roomCode = token(metadata.roomCode || checkout.roomCode).toUpperCase();
  const buyerUid = token(metadata.buyerUid || checkout.buyerUid);
  if (!roomCode || !buyerUid) return { ok: false, reasonCode: 'beaubucks_account_missing' };
  if (token(checkout.roomCode).toUpperCase() !== roomCode || token(checkout.buyerUid) !== buyerUid) {
    return { ok: false, reasonCode: 'beaubucks_checkout_account_mismatch' };
  }
  if (
    token(checkout.packId) !== pack.id
    || whole(checkout.amountCents) !== pack.amountCents
    || whole(checkout.beauBucks) !== pack.beauBucks
    || whole(metadata.beauBucks) !== pack.beauBucks
    || whole(session.amount_total) !== pack.amountCents
  ) {
    return { ok: false, reasonCode: 'beaubucks_checkout_amount_mismatch' };
  }
  const currency = normalizedToken(session.currency || '');
  if (currency !== pack.currency || normalizedToken(checkout.currency || '') !== pack.currency) {
    return { ok: false, reasonCode: 'beaubucks_checkout_currency_mismatch' };
  }
  return { ok: true, pack, roomCode, buyerUid };
};

const buildBeauBucksAdjustmentPlan = ({
  purchaseBeauBucks = 0,
  purchaseAmountCents = 0,
  priorAdjustedAmountCents = 0,
  requestedAdjustedAmountCents = 0,
  availableBalance = 0,
  adjustmentType = 'refund',
} = {}) => {
  const paidCents = whole(purchaseAmountCents);
  const purchaseValue = whole(purchaseBeauBucks);
  const priorCents = Math.min(paidCents, whole(priorAdjustedAmountCents));
  const targetCents = adjustmentType === 'chargeback'
    ? paidCents
    : Math.min(paidCents, Math.max(priorCents, whole(requestedAdjustedAmountCents)));
  const priorTargetValue = paidCents ? Math.floor((purchaseValue * priorCents) / paidCents) : 0;
  const targetValue = paidCents ? Math.floor((purchaseValue * targetCents) / paidCents) : 0;
  const requestedRevocation = Math.max(0, targetValue - priorTargetValue);
  const appliedRevocation = Math.min(requestedRevocation, whole(availableBalance));
  return {
    targetAdjustedAmountCents: targetCents,
    requestedRevocation,
    appliedRevocation,
    unrecoveredAmount: Math.max(0, requestedRevocation - appliedRevocation),
    balanceAfter: Math.max(0, whole(availableBalance) - appliedRevocation),
    restrictAccount: adjustmentType === 'chargeback',
  };
};

module.exports = {
  BEAUBUCKS_ACCOUNT_COLLECTION,
  BEAUBUCKS_ADJUSTMENT_COLLECTION,
  BEAUBUCKS_AUTHORITY_SCHEMA_VERSION,
  BEAUBUCKS_PENDING_ADJUSTMENT_COLLECTION,
  BEAUBUCKS_PENDING_ADJUSTMENT_EVENT_COLLECTION,
  BEAUBUCKS_PURCHASE_LIMIT_COLLECTION,
  BEAUBUCKS_PAYMENT_REF_COLLECTION,
  buildBeauBucksAccountId,
  buildBeauBucksAdjustmentId,
  buildBeauBucksAdjustmentPlan,
  buildBeauBucksPaymentRefId,
  buildPendingBeauBucksAdjustmentState,
  evaluateBeauBucksPurchaseReservation,
  getBeauBucksPack,
  getBeauBucksPolicy,
  getBeauBucksPurchaseLimit,
  isBeauBucksCheckoutEnabled,
  validateBeauBucksCheckoutFulfillment,
};
