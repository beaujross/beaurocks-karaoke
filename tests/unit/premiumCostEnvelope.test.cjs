const assert = require('node:assert/strict');
const { buildPremiumCostEnvelope } = require('../../functions/lib/premiumCostEnvelope');

test('the starter pack envelope reflects unique durable cosmetic entitlements', () => {
  assert.deepEqual(buildPremiumCostEnvelope({ packBalance: 1200 }), {
    minimumUnlockCost: 120,
    publicEntitlementCount: 13,
    maximumEntitlementPurchasesPerPack: 7,
    maximumAuthorityWritesPerPack: 34,
  });
});
