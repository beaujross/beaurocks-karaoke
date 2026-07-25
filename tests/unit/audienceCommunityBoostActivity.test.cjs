const assert = require("node:assert/strict");
const { sanitizeLedgerActivity } = require("../../functions/lib/audienceCreditActivity");

test("Community Boost has a clear audience credit-history label", () => {
  const activity = sanitizeLedgerActivity({
    status: "posted",
    direction: "credit",
    currency: "points",
    type: "community_social_boost_v1",
    amount: 250,
    createdAt: { seconds: 10 },
    ledgerEntryId: "community-boost-ledger",
  });
  assert.equal(activity.title, "Community Boost");
  assert.equal(activity.amount, 250);
  assert.equal(activity.currency, "points");
});
