const assert = require("node:assert/strict");
const {
  ADDITIONAL_USAGE_REASON_CODES,
  buildAdditionalUsageSummary,
  buildVerifiedAdditionalUsageGrant,
  resolveAdditionalCapacityUnits,
  resolveMaximumUsageHardLimit,
} = require("../../functions/lib/additionalUsageCapacity");

const TEST_POLICY = {
  checkoutEnabled: true,
  autoRefillEnabled: false,
  autoRefillMonthlyCeilingRequired: true,
  packs: {
    extra_night_test: {
      enabled: true,
      publicLabel: "Extra private karaoke night",
      amountCents: 1200,
      currency: "usd",
      capacityByMeter: {
        youtube_data_request: 500,
        ai_generate_content: 25,
        ignored_meter: 999,
      },
    },
  },
};

test("verified fulfillment requires an enabled catalog and exact paid checkout", () => {
  const disabled = buildVerifiedAdditionalUsageGrant({
    policy: { ...TEST_POLICY, checkoutEnabled: false },
    checkout: {},
  });
  assert.equal(disabled.reasonCode, ADDITIONAL_USAGE_REASON_CODES.checkoutDisabled);

  const unpaid = buildVerifiedAdditionalUsageGrant({
    policy: TEST_POLICY,
    checkout: { checkoutType: "additional_usage", paymentStatus: "unpaid" },
  });
  assert.equal(unpaid.reasonCode, ADDITIONAL_USAGE_REASON_CODES.paymentNotVerified);

  const mismatch = buildVerifiedAdditionalUsageGrant({
    policy: TEST_POLICY,
    allowedMeterIds: ["youtube_data_request", "ai_generate_content"],
    checkout: {
      checkoutType: "additional_usage",
      paymentStatus: "paid",
      orgId: "org_1",
      periodKey: "202607",
      packId: "extra_night_test",
      amountCents: 1199,
      currency: "usd",
    },
  });
  assert.equal(mismatch.reasonCode, ADDITIONAL_USAGE_REASON_CODES.amountMismatch);

  const verified = buildVerifiedAdditionalUsageGrant({
    policy: TEST_POLICY,
    allowedMeterIds: ["youtube_data_request", "ai_generate_content"],
    checkout: {
      checkoutType: "additional_usage",
      paymentStatus: "paid",
      orgId: "org_1",
      periodKey: "202607",
      packId: "extra_night_test",
      amountCents: 1200,
      currency: "USD",
    },
  });
  assert.equal(verified.ok, true);
  assert.deepEqual(verified.grant.capacityByMeter, {
    youtube_data_request: 500,
    ai_generate_content: 25,
  });
});

test("revocations reduce current capacity without rewriting historical grants", () => {
  const capacityDocument = {
    meters: {
      youtube_data_request: { granted: 900, revoked: 200 },
    },
  };
  assert.equal(resolveAdditionalCapacityUnits({ capacityDocument, meterId: "youtube_data_request" }), 700);
  assert.equal(resolveMaximumUsageHardLimit({ planHardLimit: 25000, additionalUnits: 700 }), 25700);
});

test("Host summary is bounded to known meters and advertises disabled rails honestly", () => {
  const summary = buildAdditionalUsageSummary({
    policy: {
      status: "owner_review_required_checkout_disabled",
      checkoutEnabled: false,
      autoRefillEnabled: false,
      packs: {},
    },
    periodKey: "202607",
    meterDefinitions: {
      youtube_data_request: { label: "Workspace YouTube request allowance" },
    },
    capacityDocument: {
      meters: { youtube_data_request: { granted: 100, revoked: 25 } },
    },
  });
  assert.equal(summary.publicLabel, "Additional usage");
  assert.equal(summary.checkoutEnabled, false);
  assert.equal(summary.autoRefillEnabled, false);
  assert.equal(summary.packsAvailable, 0);
  assert.equal(summary.meters.youtube_data_request.active, 75);
});
