const assert = require('node:assert/strict');
const {
  buildBeauBucksCanaryBuyerPolicy,
  isBeauBucksCanaryBuyerAllowed,
} = require('../../functions/lib/beauBucksCanary');

test('the paid canary fails closed when no buyer roster is configured', () => {
  const policy = buildBeauBucksCanaryBuyerPolicy({});
  assert.equal(policy.configured, false);
  assert.equal(isBeauBucksCanaryBuyerAllowed({ uid: 'buyer-1', policy }), false);
});

test('the paid canary allows only explicitly rostered account UIDs', () => {
  const policy = buildBeauBucksCanaryBuyerPolicy({ BEAUBUCKS_CANARY_BUYER_UIDS: ' buyer-1,buyer-2,buyer-1 ' });
  assert.equal(policy.configured, true);
  assert.deepEqual(policy.buyerUids, ['buyer-1', 'buyer-2']);
  assert.equal(isBeauBucksCanaryBuyerAllowed({ uid: 'buyer-1', policy }), true);
  assert.equal(isBeauBucksCanaryBuyerAllowed({ uid: 'buyer-3', policy }), false);
});

test('an oversized roster fails closed instead of widening the canary', () => {
  const policy = buildBeauBucksCanaryBuyerPolicy({
    BEAUBUCKS_CANARY_BUYER_UIDS: Array.from({ length: 11 }, (_, index) => `buyer-${index}`).join(','),
  });
  assert.equal(policy.configured, false);
  assert.equal(isBeauBucksCanaryBuyerAllowed({ uid: 'buyer-1', policy }), false);
});
