import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import {
  HOST_COMMERCIAL_CONTRACT,
  HOST_COMMERCIAL_CONTRACT_ID,
  HOST_COMMERCIAL_CONTRACT_VERSION,
  HOST_MONEY_RAIL_CONTRACTS,
  HOST_PUBLIC_VOCABULARY,
  HOST_SUBSCRIPTION_STATE_CONTRACTS,
  HOST_USAGE_METER_CONTRACTS,
  LEGACY_HOST_PLAN_IDS,
  PUBLIC_HOST_PLAN_IDS,
  getHostCommercialPlan,
  getHostMoneyRailContract,
  getHostUsageMeterContract,
  isLegacyHostPlan,
  isPublicHostPlan,
} from "../../src/billing/hostCommercialContract.js";
import {
  HOST_SUBSCRIPTION_PLAN_CATALOG,
  HOST_USAGE_METER_OVERVIEW,
} from "../../src/billing/hostPlans.js";
import {
  LEGACY_SUBSCRIPTIONS,
  SUBSCRIPTIONS,
} from "../../src/billing/catalog.js";

const require = createRequire(import.meta.url);
const {
  PLAN_DEFINITIONS,
  USAGE_METER_DEFINITIONS,
  isEntitledStatus,
} = require("../../functions/lib/entitlementsUsage.js");

describe("Host commercial contract", () => {
  it("is versioned and distinguishes public offers from legacy compatibility", () => {
    expect(HOST_COMMERCIAL_CONTRACT_VERSION).toBe(1);
    expect(HOST_COMMERCIAL_CONTRACT_ID).toBe("beaurocks-host-commercial-v1");
    expect(PUBLIC_HOST_PLAN_IDS).toEqual(["host_monthly", "host_annual"]);
    expect(LEGACY_HOST_PLAN_IDS).toEqual(["vip_monthly"]);

    for (const planId of PUBLIC_HOST_PLAN_IDS) {
      expect(isPublicHostPlan(planId)).toBe(true);
      expect(isLegacyHostPlan(planId)).toBe(false);
      expect(getHostCommercialPlan(planId)?.publicOffer).toBe(true);
    }

    expect(isPublicHostPlan("vip_monthly")).toBe(false);
    expect(isLegacyHostPlan("vip_monthly")).toBe(true);
    expect(getHostCommercialPlan("vip_monthly")?.legacyCompatibility).toBe(true);
    expect(SUBSCRIPTIONS.map((plan) => plan.id)).toEqual([
      "host_monthly",
      "host_annual",
    ]);
    expect(LEGACY_SUBSCRIPTIONS.map((plan) => plan.id)).toEqual(["vip_monthly"]);
  });

  it("matches current client and Functions plan identifiers, prices, and capabilities", () => {
    for (const [planId, contractPlan] of Object.entries(HOST_COMMERCIAL_CONTRACT.plans)) {
      const functionsPlan = PLAN_DEFINITIONS[planId];
      expect(functionsPlan, `${planId} must exist in Functions`).toBeTruthy();
      expect(functionsPlan.id).toBe(contractPlan.id);
      expect(functionsPlan.name).toBe(contractPlan.name);
      expect(functionsPlan.tier).toBe(contractPlan.tier);
      expect(functionsPlan.interval).toBe(contractPlan.interval);
      expect(functionsPlan.amountCents).toBe(contractPlan.amountCents);
      expect(functionsPlan.capabilities).toEqual(contractPlan.capabilities);

      if (HOST_SUBSCRIPTION_PLAN_CATALOG[planId]) {
        const clientPlan = HOST_SUBSCRIPTION_PLAN_CATALOG[planId];
        expect(clientPlan.id).toBe(contractPlan.id);
        expect(clientPlan.label).toBe(contractPlan.publicLabel);
        expect(clientPlan.interval).toBe(contractPlan.interval);
        expect(clientPlan.amountCents).toBe(contractPlan.amountCents);
      }
    }
  });

  it("matches current meter allowances and rates without declaring them publishable", () => {
    const clientMetersById = Object.fromEntries(
      HOST_USAGE_METER_OVERVIEW.map((meter) => [meter.id, meter]),
    );

    for (const [meterId, meterContract] of Object.entries(HOST_USAGE_METER_CONTRACTS)) {
      const functionsMeter = USAGE_METER_DEFINITIONS[meterId];
      expect(functionsMeter, `${meterId} must exist in Functions`).toBeTruthy();
      expect(functionsMeter.id).toBe(meterContract.id);
      expect(functionsMeter.unit).toBe(meterContract.unit);
      expect(functionsMeter.includedByPlan).toEqual(meterContract.includedByPlan);
      expect(functionsMeter.hardLimitByPlan).toEqual(meterContract.hardLimitByPlan);
      expect(functionsMeter.overageRateCentsByPlan).toEqual(
        meterContract.currentOverageRateCentsByPlan,
      );
      expect(meterContract.pricingStatus).toBe("existing_unvalidated_do_not_publish");

      const clientMeter = clientMetersById[meterId];
      expect(clientMeter, `${meterId} must exist in the Host client`).toBeTruthy();
      expect(clientMeter.label).toBe(meterContract.publicLabel);
      expect(clientMeter.monthlyIncluded).toBe(meterContract.includedByPlan.host_monthly);
      expect(clientMeter.annualIncluded).toBe(meterContract.includedByPlan.host_annual);
      expect(clientMeter.monthlyOverageCents).toBe(
        meterContract.currentOverageRateCentsByPlan.host_monthly,
      );
      expect(clientMeter.annualOverageCents).toBe(
        meterContract.currentOverageRateCentsByPlan.host_annual,
      );
      expect(getHostUsageMeterContract(meterId)).toBe(meterContract);
    }
  });

  it("records subscription behavior without silently settling owner decisions", () => {
    expect(HOST_SUBSCRIPTION_STATE_CONTRACTS.active.newRoomPolicy).toBe(
      "allowed_when_plan_capability_allows",
    );
    expect(HOST_SUBSCRIPTION_STATE_CONTRACTS.trialing.newRoomPolicy).toBe(
      "blocked",
    );
    expect(HOST_SUBSCRIPTION_STATE_CONTRACTS.past_due.newRoomPolicy).toBe(
      "blocked",
    );
    expect(HOST_SUBSCRIPTION_STATE_CONTRACTS.canceled.newRoomPolicy).toBe("blocked");

    for (const status of HOST_COMMERCIAL_CONTRACT.entitledStatuses) {
      expect(isEntitledStatus(status)).toBe(true);
    }
    expect(isEntitledStatus("canceled")).toBe(false);
    expect(isEntitledStatus("inactive")).toBe(false);
  });

  it("keeps all money rails distinct and fails financial actions closed offline", () => {
    expect(Object.keys(HOST_MONEY_RAIL_CONTRACTS)).toEqual([
      "host_plan",
      "usage",
      "host_tip",
      "beaubucks_purchase",
      "fundraiser_support",
    ]);

    expect(getHostMoneyRailContract("host_tip")?.recipient).toContain("Host");
    expect(getHostMoneyRailContract("host_tip")?.merchant).not.toBe("BeauRocks");
    expect(getHostMoneyRailContract("beaubucks_purchase")?.merchant).toBe("BeauRocks");
    expect(getHostMoneyRailContract("fundraiser_support")?.recipient).toContain("fundraiser");

    for (const rail of Object.values(HOST_MONEY_RAIL_CONTRACTS)) {
      expect(["not_allowed", "display_only_unverified"]).toContain(rail.offlineExecution);
    }
  });

  it("uses the approved repo and customer-facing vocabulary", () => {
    expect(HOST_PUBLIC_VOCABULARY.HostApp).toBe("Host Dashboard");
    expect(HOST_PUBLIC_VOCABULARY.SingerApp).toBe("Audience App");
    expect(HOST_PUBLIC_VOCABULARY.PublicTV).toBe("Public TV");
    expect(HOST_PUBLIC_VOCABULARY.RecapView).toBe("Room Recap");
    expect(HOST_PUBLIC_VOCABULARY.organization).toBe("Workspace");
    expect(HOST_PUBLIC_VOCABULARY.canonicalSongId).toBe("Song");
    expect(HOST_PUBLIC_VOCABULARY.earned_non_cash_value).toBe("Points");
    expect(HOST_PUBLIC_VOCABULARY.purchased_in_app_value).toBe("BeauBucks");
    expect(HOST_PUBLIC_VOCABULARY.host_directed_money).toBe("Host Tip");
    expect(HOST_PUBLIC_VOCABULARY.fundraiser_payment).toBe("Support");
  });
});
