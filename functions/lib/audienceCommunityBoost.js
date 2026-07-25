"use strict";

const AUDIENCE_COMMUNITY_BOOST_ACTION_ID = "community_social_boost_v1";
const AUDIENCE_COMMUNITY_BOOST_POINTS = 250;
const AUDIENCE_COMMUNITY_BOOST_NETWORKS = Object.freeze(["facebook", "instagram"]);

const normalizeCommunityBoostUid = (value = "") =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 128);

const buildAudienceCommunityBoostClaimId = (uid = "") => {
  const safeUid = normalizeCommunityBoostUid(uid);
  return safeUid ? `${AUDIENCE_COMMUNITY_BOOST_ACTION_ID}_${safeUid}` : "";
};

module.exports = {
  AUDIENCE_COMMUNITY_BOOST_ACTION_ID,
  AUDIENCE_COMMUNITY_BOOST_NETWORKS,
  AUDIENCE_COMMUNITY_BOOST_POINTS,
  buildAudienceCommunityBoostClaimId,
};
