import assert from "node:assert/strict";
import {
  MARKETING_ROUTE_PAGES,
  isMarketingPath,
  parseMarketingRouteFromLocation,
} from "../../src/apps/Marketing/routing.js";

const run = () => {
  const fromLegacyQuery = parseMarketingRouteFromLocation({
    pathname: "/",
    search: "?mode=marketing&page=for_hosts&utm_source=test_suite",
  });
  assert.equal(fromLegacyQuery.page, MARKETING_ROUTE_PAGES.forHosts);
  assert.equal(fromLegacyQuery.params.utm_source, "test_suite");

  const fromLegacyPath = parseMarketingRouteFromLocation({
    pathname: "/marketing/for-venues",
    search: "",
  });
  assert.equal(fromLegacyPath.page, MARKETING_ROUTE_PAGES.forVenues);

  const fromChangelogPath = parseMarketingRouteFromLocation({
    pathname: "/changelog",
    search: "",
  });
  assert.equal(fromChangelogPath.page, MARKETING_ROUTE_PAGES.changelog);

  const fromLegacyJoin = parseMarketingRouteFromLocation({
    pathname: "/",
    search: "?mode=marketing&page=join&room=vip123",
  });
  assert.equal(fromLegacyJoin.page, MARKETING_ROUTE_PAGES.join);
  assert.equal(fromLegacyJoin.params.roomCode, "VIP123");

  const fromLegacyGeo = parseMarketingRouteFromLocation({
    pathname: "/",
    search: "?mode=marketing&page=geo_city&id=wa:seattle",
  });
  assert.equal(fromLegacyGeo.page, MARKETING_ROUTE_PAGES.geoCity);
  assert.equal(fromLegacyGeo.params.state, "wa");
  assert.equal(fromLegacyGeo.params.city, "seattle");

  assert.equal(isMarketingPath("/for-fans"), true);
  assert.equal(isMarketingPath("/marketing"), true);
  assert.equal(isMarketingPath("/random-unrelated-path"), false);
  assert.equal(isMarketingPath("/karaoke/terms"), false);

  const fromRootFallback = parseMarketingRouteFromLocation({
    pathname: "/",
    search: "",
  });
  assert.equal(fromRootFallback.page, MARKETING_ROUTE_PAGES.forFans);

  console.log("PASS marketingRoutingLegacy");
};

run();
