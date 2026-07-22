import commercialContract from "../../functions/lib/hostCommercialContract.json";

const toSafeCents = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.floor(amount));
};

export const formatUsdFromCents = (value) => {
  const cents = toSafeCents(value);
  const dollars = cents / 100;
  const digits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  }).format(dollars);
};

export const formatHostUsageCount = (value) =>
  new Intl.NumberFormat("en-US").format(Math.max(0, Math.floor(Number(value) || 0)));

const buildPlan = ({ id, label, interval, amountCents, note }) => {
  const suffix = interval === "month" ? "/mo" : interval === "year" ? "/yr" : "";
  const priceLabel = amountCents > 0 ? `${formatUsdFromCents(amountCents)}${suffix}` : "$0";
  return Object.freeze({
    id,
    label,
    interval,
    amountCents: toSafeCents(amountCents),
    priceLabel,
    note,
  });
};

const buildPlanFromContract = (planId) => {
  const plan = commercialContract.plans?.[planId] || {};
  return buildPlan({
    id: plan.id || planId,
    label: plan.publicLabel || plan.name || planId,
    interval: plan.interval || null,
    amountCents: plan.amountCents || 0,
    note: plan.note || "",
  });
};

export const HOST_SUBSCRIPTION_PLAN_CATALOG = Object.freeze({
  free: buildPlanFromContract("free"),
  host_monthly: buildPlanFromContract("host_monthly"),
  host_annual: buildPlanFromContract("host_annual"),
});

export const HOST_SUBSCRIPTION_PLANS = Object.freeze([
  HOST_SUBSCRIPTION_PLAN_CATALOG.free,
  HOST_SUBSCRIPTION_PLAN_CATALOG.host_monthly,
  HOST_SUBSCRIPTION_PLAN_CATALOG.host_annual,
]);

export const HOST_USAGE_METER_OVERVIEW = Object.freeze(
  Object.values(commercialContract.usageMeters || {}).map((meter) => Object.freeze({
    id: meter.id,
    label: meter.publicLabel,
    monthlyIncluded: meter.includedByPlan?.host_monthly || 0,
    annualIncluded: meter.includedByPlan?.host_annual || 0,
    monthlyOverageCents: meter.currentOverageRateCentsByPlan?.host_monthly || 0,
    annualOverageCents: meter.currentOverageRateCentsByPlan?.host_annual || 0,
  })),
);

export const getHostSubscriptionPlan = (planId = "") =>
  HOST_SUBSCRIPTION_PLAN_CATALOG[String(planId || "").trim()] || null;

export const getSubscriptionPlanLabel = (planId = "") => {
  const normalized = String(planId || "").trim();
  if (normalized === "vip_monthly") {
    return commercialContract.plans?.vip_monthly?.publicLabel || "VIP Monthly";
  }
  return getHostSubscriptionPlan(normalized)?.label || (normalized || "Free");
};
