"use strict";

const GROWTH_ACTION_POLICIES = Object.freeze({
  email_verified: Object.freeze({
    verification: "firebase_auth",
    rewardEligible: true,
    rewardCurrency: "points",
    rewardAmount: 5000,
    status: "live",
  }),
  room_invite_shared: Object.freeze({
    verification: "client_reported",
    rewardEligible: false,
    rewardCurrency: "",
    rewardAmount: 0,
    status: "tracked_only",
  }),
  recap_shared: Object.freeze({
    verification: "client_reported",
    rewardEligible: false,
    rewardCurrency: "",
    rewardAmount: 0,
    status: "tracked_only",
  }),
  facebook_follow: Object.freeze({
    verification: "unsupported_provider_event",
    rewardEligible: false,
    rewardCurrency: "",
    rewardAmount: 0,
    status: "unavailable",
  }),
  facebook_like: Object.freeze({
    verification: "unsupported_provider_event",
    rewardEligible: false,
    rewardCurrency: "",
    rewardAmount: 0,
    status: "unavailable",
  }),
  instagram_follow: Object.freeze({
    verification: "unsupported_provider_event",
    rewardEligible: false,
    rewardCurrency: "",
    rewardAmount: 0,
    status: "unavailable",
  }),
  instagram_like: Object.freeze({
    verification: "unsupported_provider_event",
    rewardEligible: false,
    rewardCurrency: "",
    rewardAmount: 0,
    status: "unavailable",
  }),
  youtube_subscribe: Object.freeze({
    verification: "platform_policy_prohibits_reward",
    rewardEligible: false,
    rewardCurrency: "",
    rewardAmount: 0,
    status: "prohibited",
  }),
  youtube_like: Object.freeze({
    verification: "platform_policy_prohibits_reward",
    rewardEligible: false,
    rewardCurrency: "",
    rewardAmount: 0,
    status: "prohibited",
  }),
});

const safeToken = (value = "", maxLength = 180) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_.:@/-]/g, "_")
    .slice(0, maxLength);

const getAudienceGrowthActionPolicy = (action = "") => {
  const key = String(action || "").trim().toLowerCase();
  return GROWTH_ACTION_POLICIES[key] || Object.freeze({
    verification: "unknown",
    rewardEligible: false,
    rewardCurrency: "",
    rewardAmount: 0,
    status: "unavailable",
  });
};

const normalizeMetaGrowthWebhookEvents = (payload = {}) => {
  const objectType = safeToken(payload?.object || "unknown", 60).toLowerCase();
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  const normalized = [];

  entries.slice(0, 100).forEach((entry = {}) => {
    const entryId = safeToken(entry?.id || "", 180);
    const occurredAtMs = Math.max(0, Number(entry?.time || 0) * 1000);
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    changes.slice(0, 100).forEach((change = {}) => {
      const value = change?.value && typeof change.value === "object" ? change.value : {};
      normalized.push({
        provider: "meta",
        objectType,
        entryId,
        eventType: safeToken(change?.field || "change", 80).toLowerCase(),
        action: safeToken(value?.verb || value?.action || value?.item || "", 80).toLowerCase(),
        targetId: safeToken(
          value?.post_id
          || value?.media_id
          || value?.comment_id
          || value?.item_id
          || value?.id
          || "",
          220
        ),
        actorId: safeToken(
          value?.from?.id
          || value?.sender_id
          || value?.user_id
          || "",
          180
        ),
        occurredAtMs,
      });
    });

    const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
    messaging.slice(0, 100).forEach((event = {}) => {
      normalized.push({
        provider: "meta",
        objectType,
        entryId,
        eventType: event?.message ? "message" : event?.postback ? "postback" : "messaging",
        action: event?.postback ? "postback" : "",
        targetId: safeToken(event?.message?.mid || event?.postback?.mid || "", 220),
        actorId: safeToken(event?.sender?.id || "", 180),
        occurredAtMs: Math.max(0, Number(event?.timestamp || occurredAtMs || 0)),
      });
    });
  });

  return normalized.filter((event) => event.entryId || event.targetId || event.actorId);
};

module.exports = {
  GROWTH_ACTION_POLICIES,
  getAudienceGrowthActionPolicy,
  normalizeMetaGrowthWebhookEvents,
};
