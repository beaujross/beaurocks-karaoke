import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const singerSource = readFileSync("src/apps/Mobile/SingerApp.jsx", "utf8");
const functionsSource = readFileSync("functions/index.js", "utf8");

test("Audience merchandises one self-attested Facebook and Instagram Community Boost", () => {
  assert.match(singerSource, /data-feature-id="audience-community-boost"/);
  assert.match(singerSource, /Honor system, once per verified account/);
  assert.match(singerSource, /I followed BeauRocks · Claim 250 PTS/);
  assert.match(singerSource, /claimAudienceCommunityBoost/);
  assert.match(singerSource, /COMMUNITY_BOOST_SOCIAL_LINKS/);
});

test("YouTube remains visible but outside the rewarded action", () => {
  assert.match(singerSource, /Subscribe on YouTube/);
  assert.match(singerSource, /no Points reward/);
  assert.doesNotMatch(functionsSource, /AUDIENCE_COMMUNITY_BOOST_NETWORKS[\s\S]{0,120}youtube/);
});

test("Community Boost authority is account-global and idempotent", () => {
  assert.match(functionsSource, /AUDIENCE_GROWTH_ACTION_CLAIMS_COLLECTION/);
  assert.match(functionsSource, /buildAudienceCommunityBoostClaimId\(uid\)/);
  assert.match(functionsSource, /if \(claimSnap\.exists\)/);
  assert.match(functionsSource, /A verified BeauRocks account is required/);
  assert.match(functionsSource, /selfAttested: true/);
});
