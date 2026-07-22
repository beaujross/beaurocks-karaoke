const crypto = require("node:crypto");

const CHECKOUT_RETRY_WINDOW_MS = 10 * 60 * 1000;

const normalizeCheckoutToken = (value = "", maxLength = 120) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, maxLength);

const buildSubscriptionCheckoutIdempotencyKey = ({
  uid = "",
  orgId = "",
  planId = "",
  requestId = "",
  nowMs = Date.now(),
} = {}) => {
  const safeUid = normalizeCheckoutToken(uid, 80) || "user";
  const safeOrgId = normalizeCheckoutToken(orgId, 80) || "workspace";
  const safePlanId = normalizeCheckoutToken(planId, 60) || "plan";
  const safeRequestId = normalizeCheckoutToken(requestId, 120);
  const fallbackWindow = Math.floor(
    Math.max(0, Number(nowMs) || 0) / CHECKOUT_RETRY_WINDOW_MS,
  );
  const retryToken = safeRequestId || `window_${fallbackWindow}`;
  const digest = crypto
    .createHash("sha256")
    .update(`${safeUid}|${safeOrgId}|${safePlanId}|${retryToken}`)
    .digest("hex")
    .slice(0, 40);
  return `host_subscription_checkout_${digest}`;
};

module.exports = {
  CHECKOUT_RETRY_WINDOW_MS,
  normalizeCheckoutToken,
  buildSubscriptionCheckoutIdempotencyKey,
};
