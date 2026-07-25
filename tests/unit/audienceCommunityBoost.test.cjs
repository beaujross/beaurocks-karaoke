const assert = require("node:assert/strict");
const {
  AUDIENCE_COMMUNITY_BOOST_ACTION_ID,
  AUDIENCE_COMMUNITY_BOOST_NETWORKS,
  AUDIENCE_COMMUNITY_BOOST_POINTS,
  buildAudienceCommunityBoostClaimId,
} = require("../../functions/lib/audienceCommunityBoost");

test("Community Boost is one combined low-stakes social action", () => {
  assert.equal(AUDIENCE_COMMUNITY_BOOST_ACTION_ID, "community_social_boost_v1");
  assert.equal(AUDIENCE_COMMUNITY_BOOST_POINTS, 250);
  assert.deepEqual(AUDIENCE_COMMUNITY_BOOST_NETWORKS, ["facebook", "instagram"]);
  assert.equal(
    buildAudienceCommunityBoostClaimId("user-123"),
    "community_social_boost_v1_user-123"
  );
  assert.equal(buildAudienceCommunityBoostClaimId(""), "");
});
