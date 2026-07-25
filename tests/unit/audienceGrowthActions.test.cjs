const assert = require("node:assert/strict");
const {
  getAudienceGrowthActionPolicy,
  normalizeMetaGrowthWebhookEvents,
} = require("../../functions/lib/audienceGrowthActions");

test("growth rewards only actions the server can safely verify", () => {
  assert.deepEqual(getAudienceGrowthActionPolicy("email_verified"), {
    verification: "firebase_auth",
    rewardEligible: true,
    rewardCurrency: "points",
    rewardAmount: 5000,
    status: "live",
  });
  assert.equal(getAudienceGrowthActionPolicy("instagram_follow").rewardEligible, false);
  assert.equal(getAudienceGrowthActionPolicy("facebook_like").status, "unavailable");
  assert.equal(getAudienceGrowthActionPolicy("youtube_subscribe").status, "prohibited");
  assert.equal(getAudienceGrowthActionPolicy("youtube_like").rewardEligible, false);
});

test("Meta webhooks normalize event metadata without storing message text", () => {
  const events = normalizeMetaGrowthWebhookEvents({
    object: "instagram",
    entry: [{
      id: "page-1",
      time: 1720000000,
      changes: [{
        field: "comments",
        value: {
          verb: "add",
          media_id: "media-7",
          from: { id: "person-9", username: "private-handle" },
          text: "This must not be persisted",
        },
      }],
    }],
  });

  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    provider: "meta",
    objectType: "instagram",
    entryId: "page-1",
    eventType: "comments",
    action: "add",
    targetId: "media-7",
    actorId: "person-9",
    occurredAtMs: 1720000000000,
  });
  assert.equal(JSON.stringify(events).includes("This must not be persisted"), false);
  assert.equal(JSON.stringify(events).includes("private-handle"), false);
});
