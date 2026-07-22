const HOST_COMMERCIAL_CONTRACT = require("./hostCommercialContract.json");

const BASE_CAPABILITIES = Object.freeze({
  ...(HOST_COMMERCIAL_CONTRACT.baseCapabilities || {}),
});

const PLAN_DEFINITIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(HOST_COMMERCIAL_CONTRACT.plans || {}).map(([planId, plan]) => [
      planId,
      Object.freeze({
        id: plan.id || planId,
        name: plan.name || plan.publicLabel || planId,
        tier: plan.tier || "free",
        interval: plan.interval || null,
        amountCents: Number(plan.amountCents || 0),
        capabilities: Object.freeze({ ...(plan.capabilities || {}) }),
      }),
    ]),
  ),
);

const ENTITLED_STATUSES = new Set(HOST_COMMERCIAL_CONTRACT.entitledStatuses || []);
const PUBLIC_HOST_PLAN_IDS = new Set(HOST_COMMERCIAL_CONTRACT.publicOfferPlanIds || []);
const ROOM_CREATE_CAPABILITY = "rooms.create";
const USAGE_CONTROL_POLICY = Object.freeze({
  ...(HOST_COMMERCIAL_CONTRACT.usageControlPolicy || {}),
  lifecycleStates: Object.freeze([...(HOST_COMMERCIAL_CONTRACT.usageControlPolicy?.lifecycleStates || [])]),
  warningThresholdBps: Object.freeze([...(HOST_COMMERCIAL_CONTRACT.usageControlPolicy?.warningThresholdBps || [])]),
  protectedLiveRoomCapabilities: Object.freeze([...(HOST_COMMERCIAL_CONTRACT.usageControlPolicy?.protectedLiveRoomCapabilities || [])]),
});
const ADDITIONAL_USAGE_POLICY = Object.freeze({
  ...(HOST_COMMERCIAL_CONTRACT.additionalUsagePolicy || {}),
  packs: Object.freeze({ ...(HOST_COMMERCIAL_CONTRACT.additionalUsagePolicy?.packs || {}) }),
});

const INTERNAL_USAGE_METER_PRICING = Object.freeze({
  ai_generate_content: {
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

const USAGE_METER_DEFINITIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(HOST_COMMERCIAL_CONTRACT.usageMeters || {}).map(([meterId, meter]) => {
      const internalPricing = INTERNAL_USAGE_METER_PRICING[meterId] || {};
      return [
        meterId,
        Object.freeze({
          id: meter.id || meterId,
          label: meter.publicLabel || internalPricing.label || meterId,
          unit: meter.unit || internalPricing.unit || "unit",
          includedByPlan: Object.freeze({ ...(meter.includedByPlan || {}) }),
          hardLimitByPlan: Object.freeze({ ...(meter.hardLimitByPlan || {}) }),
          overageRateCentsByPlan: Object.freeze({
            ...(meter.currentOverageRateCentsByPlan || {}),
          }),
          passThroughUnitCostCentsByPlan: Object.freeze({
            ...(internalPricing.passThroughUnitCostCentsByPlan || {}),
          }),
          markupMultiplierByPlan: Object.freeze({
            ...(internalPricing.markupMultiplierByPlan || {}),
          }),
        }),
      ];
    }),
  ),
);

const toWholeNumber = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

const toRollupEntries = (entries = {}, {
  keyField = "key",
  labelField = "label",
  fallbackLabel = "",
  limit = 5,
} = {}) => {
  if (!entries || typeof entries !== "object") return [];
  return Object.entries(entries)
    .map(([key, value]) => {
      const safeValue = value && typeof value === "object" ? value : {};
      const used = toWholeNumber(safeValue.used, 0);
      if (used <= 0) return null;
      const normalizedKey = String(safeValue[keyField] || key || "").trim() || String(key || "").trim();
      const label = String(safeValue[labelField] || normalizedKey || fallbackLabel || "").trim()
        || String(fallbackLabel || normalizedKey || key || "").trim();
      return {
        key: normalizedKey,
        label,
        used,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.used !== a.used) return b.used - a.used;
      return String(a.label || a.key).localeCompare(String(b.label || b.key));
    })
    .slice(0, Math.max(1, toWholeNumber(limit, 5)));
};

const getPlanDefinition = (planId = "") => PLAN_DEFINITIONS[String(planId || "").trim()] || null;

const isEntitledStatus = (status = "") => ENTITLED_STATUSES.has(String(status || "").toLowerCase());

const isPublicHostPlan = (planId = "") =>
  PUBLIC_HOST_PLAN_IDS.has(String(planId || "").trim());

const canUseAdditionalUsageCapacity = ({ planId = "free", status = "inactive" } = {}) => (
  getPlanDefinition(planId)?.tier === "host" && isEntitledStatus(status)
);

const resolveSubscriptionStateKey = ({
  status = "inactive",
  cancelAtPeriodEnd = false,
} = {}) => {
  const normalizedStatus = String(status || "inactive").trim().toLowerCase() || "inactive";
  if (cancelAtPeriodEnd && (normalizedStatus === "active" || normalizedStatus === "trialing")) {
    return "canceled_at_period_end";
  }
  return HOST_COMMERCIAL_CONTRACT.subscriptionStates?.[normalizedStatus]
    ? normalizedStatus
    : "inactive";
};

const canCreateRoomForSubscription = ({
  planId = "free",
  status = "inactive",
  cancelAtPeriodEnd = false,
} = {}) => {
  const plan = getPlanDefinition(planId);
  if (!plan || plan.tier !== "host") return false;
  const stateKey = resolveSubscriptionStateKey({ status, cancelAtPeriodEnd });
  const state = HOST_COMMERCIAL_CONTRACT.subscriptionStates?.[stateKey] || {};
  return state.grantsCapabilities === true && (
    state.newRoomPolicy === "allowed_when_plan_capability_allows"
    || state.newRoomPolicy === "allowed_until_period_end"
  );
};

const buildCapabilitiesForPlan = (
  planId = "free",
  status = "inactive",
  { cancelAtPeriodEnd = false } = {},
) => {
  const caps = { ...BASE_CAPABILITIES };
  if (!isEntitledStatus(status)) {
    return caps;
  }
  const plan = getPlanDefinition(planId) || PLAN_DEFINITIONS.free;
  Object.entries(plan.capabilities || {}).forEach(([key, enabled]) => {
    caps[key] = !!enabled;
  });
  caps[ROOM_CREATE_CAPABILITY] = !!(
    plan.capabilities?.[ROOM_CREATE_CAPABILITY]
    && canCreateRoomForSubscription({ planId, status, cancelAtPeriodEnd })
  );
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

const buildUsageMeterSummary = ({
  meterId,
  used = 0,
  reserved = 0,
  settled = null,
  released = 0,
  billable = 0,
  invoiced = 0,
  quota,
  periodKey = "",
  sources = {},
  actors = {},
  rooms = {},
  surfaces = {},
}) => {
  const meter = USAGE_METER_DEFINITIONS[meterId] || {
    id: meterId,
    label: meterId,
    unit: "unit",
  };
  const legacyUsed = toWholeNumber(used, 0);
  const safeSettled = settled === null || settled === undefined
    ? legacyUsed
    : toWholeNumber(settled, legacyUsed);
  const safeReserved = toWholeNumber(reserved, 0);
  const safeReleased = toWholeNumber(released, 0);
  const safeBillable = toWholeNumber(billable, 0);
  const safeInvoiced = toWholeNumber(invoiced, 0);
  const exposureUnits = safeSettled + safeReserved;
  const included = toWholeNumber(quota?.included, 0);
  const hardLimit = toWholeNumber(quota?.hardLimit, 0);
  const overageRateCents = toWholeNumber(quota?.overageRateCents, 0);
  const passThroughUnitCostCents = toWholeNumber(quota?.passThroughUnitCostCents, 0);
  const markupMultiplier = Number.isFinite(Number(quota?.markupMultiplier))
    ? Math.max(0, Number(quota?.markupMultiplier))
    : 1;
  const billableUnitRateCents = toWholeNumber(quota?.billableUnitRateCents, overageRateCents);
  const overageUnits = Math.max(0, safeSettled - included);
  const estimatedOverageCents = overageUnits * billableUnitRateCents;
  const remainingIncluded = Math.max(0, included - safeSettled);
  const remainingToHardLimit = hardLimit > 0 ? Math.max(0, hardLimit - exposureUnits) : null;
  const hardLimitReached = hardLimit > 0 && exposureUnits >= hardLimit;
  const hardLimitRatioBps = hardLimit > 0 ? Math.floor((exposureUnits / hardLimit) * 10000) : 0;
  const warningThresholdBps = [...(USAGE_CONTROL_POLICY.warningThresholdBps || [5000, 8000, 10000])]
    .map((value) => toWholeNumber(value, 0))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const warningLevelBps = warningThresholdBps.reduce(
    (level, threshold) => (hardLimitRatioBps >= threshold ? threshold : level),
    0,
  );
  const topSources = toRollupEntries(sources, {
    keyField: "source",
    labelField: "label",
    fallbackLabel: "Unknown Source",
  });
  const topActors = toRollupEntries(actors, {
    keyField: "uid",
    labelField: "label",
    fallbackLabel: "Operator",
  });
  const topRooms = toRollupEntries(rooms, {
    keyField: "roomCode",
    labelField: "label",
    fallbackLabel: "Room",
  });
  const topSurfaces = toRollupEntries(surfaces, {
    keyField: "surface",
    labelField: "label",
    fallbackLabel: "Surface",
  });
  return {
    meterId: meter.id,
    label: meter.label,
    unit: meter.unit,
    period: periodKey,
    used: safeSettled,
    exposureUnits,
    lifecycle: {
      reserved: safeReserved,
      settled: safeSettled,
      released: safeReleased,
      billable: safeBillable,
      invoiced: safeInvoiced,
    },
    included,
    overageUnits,
    overageRateCents,
    passThroughUnitCostCents,
    markupMultiplier,
    billableUnitRateCents,
    estimatedOverageCents,
    hardLimit,
    hardLimitReached,
    hardLimitRatioBps,
    warningLevelBps,
    remainingIncluded,
    remainingToHardLimit,
    breakdowns: {
      topSources,
      topActors,
      topRooms,
      topSurfaces,
    },
  };
};

module.exports = {
  BASE_CAPABILITIES,
  PLAN_DEFINITIONS,
  USAGE_METER_DEFINITIONS,
  ROOM_CREATE_CAPABILITY,
  USAGE_CONTROL_POLICY,
  ADDITIONAL_USAGE_POLICY,
  getPlanDefinition,
  isEntitledStatus,
  isPublicHostPlan,
  canUseAdditionalUsageCapacity,
  resolveSubscriptionStateKey,
  canCreateRoomForSubscription,
  buildCapabilitiesForPlan,
  resolveUsageMeterQuota,
  buildUsageMeterSummary,
};
