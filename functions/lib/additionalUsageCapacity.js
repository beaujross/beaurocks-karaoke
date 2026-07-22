const MAX_SAFE_USAGE_UNITS = Number.MAX_SAFE_INTEGER;

const ADDITIONAL_USAGE_REASON_CODES = Object.freeze({
  checkoutDisabled: "additional_usage_checkout_disabled",
  invalidCheckoutType: "additional_usage_invalid_checkout_type",
  paymentNotVerified: "additional_usage_payment_not_verified",
  unknownPack: "additional_usage_unknown_pack",
  packDisabled: "additional_usage_pack_disabled",
  amountMismatch: "additional_usage_amount_mismatch",
  currencyMismatch: "additional_usage_currency_mismatch",
  invalidPeriod: "additional_usage_invalid_period",
  invalidOrganization: "additional_usage_invalid_organization",
  invalidCapacity: "additional_usage_invalid_capacity",
  invalidAdjustmentType: "additional_usage_invalid_adjustment_type",
  invalidPaymentReference: "additional_usage_invalid_payment_reference",
  paymentReferenceConflict: "additional_usage_payment_reference_conflict",
  grantStateMissing: "additional_usage_grant_state_missing",
  alreadyFullyRevoked: "additional_usage_already_fully_revoked",
});

const ADDITIONAL_USAGE_ADJUSTMENT_TYPES = Object.freeze({
  refund: "refund",
  chargeback: "chargeback",
});

const toWholeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(MAX_SAFE_USAGE_UNITS, Math.floor(parsed)));
};

const isUsagePeriodKey = (value = "") => {
  const safe = String(value || "").trim();
  if (!/^\d{6}$/.test(safe)) return false;
  const month = Number(safe.slice(4, 6));
  return month >= 1 && month <= 12;
};

const normalizeCapacityByMeter = (value = {}, allowedMeterIds = []) => {
  const allowed = new Set((allowedMeterIds || []).map((meterId) => String(meterId || "").trim()).filter(Boolean));
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([meterId]) => allowed.has(String(meterId || "").trim()))
      .map(([meterId, units]) => [meterId, toWholeNumber(units, 0)])
      .filter(([, units]) => units > 0),
  );
};

const resolveAdditionalCapacityUnits = ({ capacityDocument = {}, meterId = "" } = {}) => {
  const meter = capacityDocument?.meters?.[meterId] || {};
  const granted = toWholeNumber(meter.granted, 0);
  const revoked = toWholeNumber(meter.revoked, 0);
  return Math.max(0, granted - revoked);
};

const resolveMaximumUsageHardLimit = ({ planHardLimit = 0, additionalUnits = 0 } = {}) => {
  const plan = toWholeNumber(planHardLimit, 0);
  const additional = toWholeNumber(additionalUnits, 0);
  return Math.min(MAX_SAFE_USAGE_UNITS, plan + additional);
};

const buildAdditionalUsageSummary = ({
  policy = {},
  capacityDocument = {},
  meterDefinitions = {},
  periodKey = "",
} = {}) => {
  const meters = {};
  Object.keys(meterDefinitions || {}).forEach((meterId) => {
    const meter = capacityDocument?.meters?.[meterId] || {};
    const granted = toWholeNumber(meter.granted, 0);
    const revoked = toWholeNumber(meter.revoked, 0);
    meters[meterId] = {
      meterId,
      label: meterDefinitions?.[meterId]?.label || meterId,
      granted,
      revoked,
      active: Math.max(0, granted - revoked),
    };
  });
  return {
    publicLabel: "Additional usage",
    status: String(policy?.status || "owner_review_required_checkout_disabled"),
    period: String(periodKey || ""),
    checkoutEnabled: policy?.checkoutEnabled === true,
    autoRefillEnabled: policy?.autoRefillEnabled === true,
    autoRefillMonthlyCeilingRequired: policy?.autoRefillMonthlyCeilingRequired !== false,
    grantTrigger: String(policy?.grantTrigger || "verified_stripe_webhook_only"),
    packsAvailable: Object.values(policy?.packs || {}).filter((pack) => pack?.enabled === true).length,
    meters,
  };
};

const rejectGrant = (reasonCode) => ({ ok: false, reasonCode });

const buildVerifiedAdditionalUsageGrant = ({
  policy = {},
  checkout = {},
  allowedMeterIds = [],
} = {}) => {
  if (policy?.checkoutEnabled !== true) return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.checkoutDisabled);
  if (String(checkout?.checkoutType || "") !== "additional_usage") {
    return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.invalidCheckoutType);
  }
  if (String(checkout?.paymentStatus || "").toLowerCase() !== "paid") {
    return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.paymentNotVerified);
  }
  const orgId = String(checkout?.orgId || "").trim();
  if (!orgId) return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.invalidOrganization);
  const periodKey = String(checkout?.periodKey || "").trim();
  if (!isUsagePeriodKey(periodKey)) return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.invalidPeriod);
  const packId = String(checkout?.packId || "").trim();
  const pack = policy?.packs?.[packId];
  if (!pack) return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.unknownPack);
  if (pack.enabled !== true) return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.packDisabled);
  const expectedAmountCents = toWholeNumber(pack.amountCents, -1);
  const paidAmountCents = toWholeNumber(checkout?.amountCents, -2);
  if (expectedAmountCents <= 0 || paidAmountCents !== expectedAmountCents) {
    return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.amountMismatch);
  }
  const expectedCurrency = String(pack.currency || "usd").trim().toLowerCase();
  const paidCurrency = String(checkout?.currency || "").trim().toLowerCase();
  if (!paidCurrency || paidCurrency !== expectedCurrency) {
    return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.currencyMismatch);
  }
  const capacityByMeter = normalizeCapacityByMeter(pack.capacityByMeter, allowedMeterIds);
  if (!Object.keys(capacityByMeter).length) {
    return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.invalidCapacity);
  }
  return {
    ok: true,
    reasonCode: "",
    grant: {
      schemaVersion: 1,
      orgId,
      period: periodKey,
      packId,
      label: String(pack.publicLabel || pack.label || packId),
      amountCents: expectedAmountCents,
      currency: expectedCurrency,
      capacityByMeter,
      paymentProvider: "stripe",
      paymentStatus: "paid",
    },
  };
};

const buildAdditionalUsageRevocation = ({
  grant = {},
  grantState = {},
  adjustmentType = "",
} = {}) => {
  const safeAdjustmentType = String(adjustmentType || "").trim().toLowerCase();
  if (!Object.values(ADDITIONAL_USAGE_ADJUSTMENT_TYPES).includes(safeAdjustmentType)) {
    return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.invalidAdjustmentType);
  }
  const grantedCapacity = normalizeCapacityByMeter(
    grant?.capacityByMeter,
    Object.keys(grant?.capacityByMeter || {}),
  );
  if (!Object.keys(grantedCapacity).length) {
    return rejectGrant(ADDITIONAL_USAGE_REASON_CODES.invalidCapacity);
  }
  const alreadyRevoked = normalizeCapacityByMeter(
    grantState?.revokedByMeter,
    Object.keys(grantedCapacity),
  );
  const capacityByMeter = {};
  Object.entries(grantedCapacity).forEach(([meterId, grantedUnits]) => {
    const remaining = Math.max(0, grantedUnits - toWholeNumber(alreadyRevoked[meterId], 0));
    if (remaining > 0) capacityByMeter[meterId] = remaining;
  });
  return {
    ok: true,
    reasonCode: "",
    adjustmentType: safeAdjustmentType,
    applied: Object.keys(capacityByMeter).length > 0,
    capacityByMeter,
    nextRevokedByMeter: Object.fromEntries(
      Object.entries(grantedCapacity).map(([meterId, grantedUnits]) => [
        meterId,
        Math.min(grantedUnits, toWholeNumber(alreadyRevoked[meterId], 0) + toWholeNumber(capacityByMeter[meterId], 0)),
      ]),
    ),
  };
};

module.exports = {
  ADDITIONAL_USAGE_ADJUSTMENT_TYPES,
  ADDITIONAL_USAGE_REASON_CODES,
  buildAdditionalUsageRevocation,
  buildAdditionalUsageSummary,
  buildVerifiedAdditionalUsageGrant,
  isUsagePeriodKey,
  normalizeCapacityByMeter,
  resolveAdditionalCapacityUnits,
  resolveMaximumUsageHardLimit,
};
