const assert = require('node:assert/strict');
const {
  buildEntitlementDocumentId,
  buildEntitlementOperationId,
  getPremiumProduct,
  getReactionSlotCount,
  listPublicPremiumProducts,
} = require('../../functions/lib/beauBucksEntitlements');

test('premium catalog exposes durable BeauBucks cosmetics and one sixth-slot unlock', () => {
  const products = listPublicPremiumProducts();
  assert.equal(products.filter((product) => product.kind === 'profile_emoji').length, 6);
  assert.equal(getPremiumProduct('reaction_slot_6').slotCount, 6);
  assert.equal(getPremiumProduct('reaction_slot_6').grantedReactionType, 'crown');
  assert.ok(products.every((product) => product.cost > 0));
});

test('reaction capacity progresses from guest four to account five to paid six', () => {
  assert.equal(getReactionSlotCount({ accountEligible: false }), 4);
  assert.equal(getReactionSlotCount({ accountEligible: true }), 5);
  assert.equal(getReactionSlotCount({ accountEligible: true, entitlementIds: ['reaction_slot_6'] }), 6);
});

test('entitlement and operation IDs are stable and account-specific', () => {
  assert.equal(
    buildEntitlementDocumentId({ uid: 'User-1', productId: 'profile_comet' }),
    buildEntitlementDocumentId({ uid: 'User-1', productId: 'profile_comet' }),
  );
  assert.notEqual(
    buildEntitlementDocumentId({ uid: 'User-1', productId: 'profile_comet' }),
    buildEntitlementDocumentId({ uid: 'User-2', productId: 'profile_comet' }),
  );
  assert.ok(buildEntitlementOperationId({ uid: 'User-1', clientOperationId: 'unlock:profile_comet:1' }));
});
