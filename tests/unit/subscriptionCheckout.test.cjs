const assert = require("node:assert/strict");
const {
  CHECKOUT_RETRY_WINDOW_MS,
  buildSubscriptionCheckoutIdempotencyKey,
} = require("../../functions/lib/subscriptionCheckout.js");

test("subscriptionCheckout.test", () => {
  const input = {
    uid: "host-123",
    orgId: "org_host-123",
    planId: "host_monthly",
    requestId: "checkout-attempt-1",
    nowMs: 1700000000000,
  };
  const first = buildSubscriptionCheckoutIdempotencyKey(input);
  const retry = buildSubscriptionCheckoutIdempotencyKey({
    ...input,
    nowMs: input.nowMs + CHECKOUT_RETRY_WINDOW_MS,
  });
  assert.equal(retry, first);
  assert.match(first, /^host_subscription_checkout_[a-f0-9]{40}$/);

  const deliberateNextAttempt = buildSubscriptionCheckoutIdempotencyKey({
    ...input,
    requestId: "checkout-attempt-2",
  });
  assert.notEqual(deliberateNextAttempt, first);

  const fallbackFirst = buildSubscriptionCheckoutIdempotencyKey({
    ...input,
    requestId: "",
    nowMs: 1700000000000,
  });
  const fallbackRetry = buildSubscriptionCheckoutIdempotencyKey({
    ...input,
    requestId: "",
    nowMs: 1700000000000 + 1000,
  });
  assert.equal(fallbackRetry, fallbackFirst);

  const anotherPlan = buildSubscriptionCheckoutIdempotencyKey({
    ...input,
    planId: "host_annual",
  });
  assert.notEqual(anotherPlan, first);
});
