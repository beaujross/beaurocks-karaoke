import contract from "../../functions/lib/hostCommercialContract.json";

const freezeRecord = (value) => Object.freeze({ ...(value || {}) });

export const HOST_COMMERCIAL_CONTRACT = Object.freeze(contract);
export const HOST_COMMERCIAL_CONTRACT_VERSION = Number(contract.schemaVersion || 0);
export const HOST_COMMERCIAL_CONTRACT_ID = String(contract.contractId || "");

export const PUBLIC_HOST_PLAN_IDS = Object.freeze([...(contract.publicOfferPlanIds || [])]);
export const LEGACY_HOST_PLAN_IDS = Object.freeze([...(contract.legacyCompatibilityPlanIds || [])]);

export const HOST_COMMERCIAL_PLANS = freezeRecord(contract.plans);
export const HOST_USAGE_METER_CONTRACTS = freezeRecord(contract.usageMeters);
export const HOST_MONEY_RAIL_CONTRACTS = freezeRecord(contract.moneyRails);
export const HOST_PUBLIC_VOCABULARY = freezeRecord(contract.vocabulary);
export const HOST_SUBSCRIPTION_STATE_CONTRACTS = freezeRecord(contract.subscriptionStates);

export const getHostCommercialPlan = (planId = "") =>
  HOST_COMMERCIAL_PLANS[String(planId || "").trim()] || null;

export const getHostUsageMeterContract = (meterId = "") =>
  HOST_USAGE_METER_CONTRACTS[String(meterId || "").trim()] || null;

export const getHostMoneyRailContract = (railId = "") =>
  HOST_MONEY_RAIL_CONTRACTS[String(railId || "").trim()] || null;

export const isPublicHostPlan = (planId = "") =>
  PUBLIC_HOST_PLAN_IDS.includes(String(planId || "").trim());

export const isLegacyHostPlan = (planId = "") =>
  LEGACY_HOST_PLAN_IDS.includes(String(planId || "").trim());
