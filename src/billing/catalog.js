import commercialContract from "../../functions/lib/hostCommercialContract.json";

export const POINTS_PACKS = [
  {
    id: "points_1200",
    label: "Solo Boost",
    amount: 5,
    points: 1200,
  },
  {
    id: "points_3000",
    label: "Stage Starter",
    amount: 10,
    points: 3000,
  },
  {
    id: "points_7500",
    label: "Headliner",
    amount: 20,
    points: 7500,
  },
];

const buildSubscriptionCatalog = (planIds = []) => planIds.map((planId) => {
  const plan = commercialContract.plans?.[planId] || {};
  return {
    id: plan.id || planId,
    label: plan.publicLabel || plan.name || planId,
    interval: plan.interval || null,
  };
});

export const SUBSCRIPTIONS = buildSubscriptionCatalog(
  commercialContract.publicOfferPlanIds,
);

export const LEGACY_SUBSCRIPTIONS = buildSubscriptionCatalog(
  commercialContract.legacyCompatibilityPlanIds,
);
