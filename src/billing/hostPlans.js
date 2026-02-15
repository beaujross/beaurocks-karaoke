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

export const HOST_SUBSCRIPTION_PLAN_CATALOG = Object.freeze({
  free: buildPlan({
    id: "free",
    label: "Free",
    interval: null,
    amountCents: 0,
    note: "Test the workspace before upgrading.",
  }),
  host_monthly: buildPlan({
    id: "host_monthly",
    label: "Host Monthly",
    interval: "month",
    amountCents: 1500,
    note: "Recurring monthly host subscription.",
  }),
  host_annual: buildPlan({
    id: "host_annual",
    label: "Host Annual",
    interval: "year",
    amountCents: 15000,
    note: "Lower yearly effective rate for active hosts.",
  }),
});

export const HOST_SUBSCRIPTION_PLANS = Object.freeze([
  HOST_SUBSCRIPTION_PLAN_CATALOG.free,
  HOST_SUBSCRIPTION_PLAN_CATALOG.host_monthly,
  HOST_SUBSCRIPTION_PLAN_CATALOG.host_annual,
]);

export const HOST_USAGE_METER_OVERVIEW = Object.freeze([
  {
    id: "ai_generate_content",
    label: "AI generations",
    monthlyIncluded: 750,
    annualIncluded: 1200,
    monthlyOverageCents: 3,
    annualOverageCents: 2,
  },
  {
    id: "youtube_data_request",
    label: "YouTube Data API requests",
    monthlyIncluded: 6000,
    annualIncluded: 9000,
    monthlyOverageCents: 1,
    annualOverageCents: 1,
  },
  {
    id: "apple_music_request",
    label: "Apple Music API requests",
    monthlyIncluded: 2000,
    annualIncluded: 3000,
    monthlyOverageCents: 2,
    annualOverageCents: 2,
  },
]);

export const getHostSubscriptionPlan = (planId = "") =>
  HOST_SUBSCRIPTION_PLAN_CATALOG[String(planId || "").trim()] || null;

export const getSubscriptionPlanLabel = (planId = "") => {
  const normalized = String(planId || "").trim();
  if (normalized === "vip_monthly") return "VIP Monthly";
  return getHostSubscriptionPlan(normalized)?.label || (normalized || "Free");
};
