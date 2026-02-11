const BASE_CAPABILITIES = Object.freeze({
  "ai.generate_content": false,
  "api.youtube_data": false,
  "api.apple_music": false,
  "billing.invoice_drafts": false,
  "workspace.onboarding": true,
});

const PLAN_DEFINITIONS = Object.freeze({
  free: {
    id: "free",
    name: "Free",
    tier: "free",
    interval: null,
    amountCents: 0,
    capabilities: {},
  },
  vip_monthly: {
    id: "vip_monthly",
    name: "VIP Monthly",
    tier: "vip",
    interval: "month",
    amountCents: 999,
    capabilities: {},
  },
  host_monthly: {
    id: "host_monthly",
    name: "Host Monthly",
    tier: "host",
    interval: "month",
    amountCents: 1500,
    capabilities: {
      "ai.generate_content": true,
      "api.youtube_data": true,
      "api.apple_music": true,
      "billing.invoice_drafts": true,
      "workspace.onboarding": true,
    },
  },
  host_annual: {
    id: "host_annual",
    name: "Host Annual",
    tier: "host",
    interval: "year",
    amountCents: 15000,
    capabilities: {
      "ai.generate_content": true,
      "api.youtube_data": true,
      "api.apple_music": true,
      "billing.invoice_drafts": true,
      "workspace.onboarding": true,
    },
  },
});

const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

const USAGE_METER_DEFINITIONS = Object.freeze({
  ai_generate_content: {
    id: "ai_generate_content",
    label: "AI generations",
    unit: "request",
    includedByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 750,
      host_annual: 1200,
    }),
    hardLimitByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 2500,
      host_annual: 4000,
    }),
    overageRateCentsByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 3,
      host_annual: 2,
    }),
    passThroughUnitCostCentsByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 2,
      host_annual: 1,
    }),
    markupMultiplierByPlan: Object.freeze({
      free: 1,
      vip_monthly: 1,
      host_monthly: 1.5,
      host_annual: 2,
    }),
  },
  youtube_data_request: {
    id: "youtube_data_request",
    label: "YouTube Data API requests",
    unit: "request",
    includedByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 6000,
      host_annual: 9000,
    }),
    hardLimitByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 25000,
      host_annual: 35000,
    }),
    overageRateCentsByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 1,
      host_annual: 1,
    }),
    passThroughUnitCostCentsByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 1,
      host_annual: 1,
    }),
    markupMultiplierByPlan: Object.freeze({
      free: 1,
      vip_monthly: 1,
      host_monthly: 1,
      host_annual: 1,
    }),
  },
  apple_music_request: {
    id: "apple_music_request",
    label: "Apple Music API requests",
    unit: "request",
    includedByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 2000,
      host_annual: 3000,
    }),
    hardLimitByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 10000,
      host_annual: 15000,
    }),
    overageRateCentsByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 2,
      host_annual: 2,
    }),
    passThroughUnitCostCentsByPlan: Object.freeze({
      free: 0,
      vip_monthly: 0,
      host_monthly: 1,
      host_annual: 1,
    }),
    markupMultiplierByPlan: Object.freeze({
      free: 1,
      vip_monthly: 1,
      host_monthly: 2,
      host_annual: 2,
    }),
  },
});

const toWholeNumber = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

const getPlanDefinition = (planId = "") => PLAN_DEFINITIONS[String(planId || "").trim()] || null;

const isEntitledStatus = (status = "") => ENTITLED_STATUSES.has(String(status || "").toLowerCase());

const buildCapabilitiesForPlan = (planId = "free", status = "inactive") => {
  const caps = { ...BASE_CAPABILITIES };
  if (!isEntitledStatus(status)) {
    return caps;
  }
  const plan = getPlanDefinition(planId) || PLAN_DEFINITIONS.free;
  Object.entries(plan.capabilities || {}).forEach(([key, enabled]) => {
    caps[key] = !!enabled;
  });
  return caps;
};

const resolveUsageMeterQuota = ({ meterId = "", planId = "free", status = "inactive" }) => {
  const meter = USAGE_METER_DEFINITIONS[meterId];
  if (!meter) {
    return {
      meterId,
      included: 0,
      hardLimit: 0,
      overageRateCents: 0,
      passThroughUnitCostCents: 0,
      markupMultiplier: 1,
      billableUnitRateCents: 0,
    };
  }
  const normalizedPlan = getPlanDefinition(planId)?.id || "free";
  const entitled = isEntitledStatus(status);
  const included = entitled
    ? toWholeNumber(meter.includedByPlan?.[normalizedPlan], 0)
    : 0;
  const hardLimit = entitled
    ? toWholeNumber(meter.hardLimitByPlan?.[normalizedPlan], 0)
    : 0;
  const configuredOverageRateCents = entitled
    ? toWholeNumber(meter.overageRateCentsByPlan?.[normalizedPlan], 0)
    : 0;
  const passThroughUnitCostCents = entitled
    ? toWholeNumber(meter.passThroughUnitCostCentsByPlan?.[normalizedPlan], 0)
    : 0;
  const rawMarkup = entitled
    ? Number(meter.markupMultiplierByPlan?.[normalizedPlan] ?? 1)
    : 1;
  const markupMultiplier = Number.isFinite(rawMarkup) && rawMarkup > 0
    ? rawMarkup
    : 1;
  const derivedRateCents = passThroughUnitCostCents > 0
    ? Math.max(0, Math.round(passThroughUnitCostCents * markupMultiplier))
    : configuredOverageRateCents;
  const billableUnitRateCents = derivedRateCents || configuredOverageRateCents;

  return {
    meterId: meter.id,
    included,
    hardLimit,
    overageRateCents: billableUnitRateCents,
    passThroughUnitCostCents,
    markupMultiplier,
    billableUnitRateCents,
  };
};

const buildUsageMeterSummary = ({ meterId, used = 0, quota, periodKey = "" }) => {
  const meter = USAGE_METER_DEFINITIONS[meterId] || {
    id: meterId,
    label: meterId,
    unit: "unit",
  };
  const safeUsed = toWholeNumber(used, 0);
  const included = toWholeNumber(quota?.included, 0);
  const hardLimit = toWholeNumber(quota?.hardLimit, 0);
  const overageRateCents = toWholeNumber(quota?.overageRateCents, 0);
  const passThroughUnitCostCents = toWholeNumber(quota?.passThroughUnitCostCents, 0);
  const markupMultiplier = Number.isFinite(Number(quota?.markupMultiplier))
    ? Math.max(0, Number(quota?.markupMultiplier))
    : 1;
  const billableUnitRateCents = toWholeNumber(quota?.billableUnitRateCents, overageRateCents);
  const overageUnits = Math.max(0, safeUsed - included);
  const estimatedOverageCents = overageUnits * billableUnitRateCents;
  const remainingIncluded = Math.max(0, included - safeUsed);
  const remainingToHardLimit = hardLimit > 0 ? Math.max(0, hardLimit - safeUsed) : null;
  const hardLimitReached = hardLimit > 0 && safeUsed >= hardLimit;
  return {
    meterId: meter.id,
    label: meter.label,
    unit: meter.unit,
    period: periodKey,
    used: safeUsed,
    included,
    overageUnits,
    overageRateCents,
    passThroughUnitCostCents,
    markupMultiplier,
    billableUnitRateCents,
    estimatedOverageCents,
    hardLimit,
    hardLimitReached,
    remainingIncluded,
    remainingToHardLimit,
  };
};

module.exports = {
  BASE_CAPABILITIES,
  PLAN_DEFINITIONS,
  USAGE_METER_DEFINITIONS,
  getPlanDefinition,
  isEntitledStatus,
  buildCapabilitiesForPlan,
  resolveUsageMeterQuota,
  buildUsageMeterSummary,
};
