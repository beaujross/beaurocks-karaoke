import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import {
  buildMarketingPath,
  MARKETING_ROUTE_PAGES,
  parseMarketingRouteFromHref,
} from "../../src/apps/Marketing/routing.js";

const functionsSource = readFileSync(new URL("../../functions/index.js", import.meta.url), "utf8");
const chartsSource = readFileSync(new URL("../../src/apps/Marketing/pages/ChartsPage.jsx", import.meta.url), "utf8");
const chartModelSource = readFileSync(new URL("../../src/apps/Marketing/pages/publicChartModel.js", import.meta.url), "utf8");
const discoverSource = readFileSync(new URL("../../src/apps/Marketing/pages/DiscoverPage.jsx", import.meta.url), "utf8");

test("public charts have a canonical indexable route", () => {
  assert.equal(buildMarketingPath({ page: MARKETING_ROUTE_PAGES.charts }), "/charts");
  assert.equal(parseMarketingRouteFromHref("/charts").page, MARKETING_ROUTE_PAGES.charts);
});

test("server projections separate member, canonical song, and approved public night rankings", () => {
  assert.match(functionsSource, /PUBLIC_CHART_MEMBERS_COLLECTION/);
  assert.match(functionsSource, /PUBLIC_CHART_SONGS_COLLECTION/);
  assert.match(functionsSource, /PUBLIC_CHART_NIGHTS_COLLECTION/);
  assert.match(functionsSource, /canonicalSongId: songId/);
  assert.match(functionsSource, /roomSessionData\.status === "approved"/);
  assert.match(functionsSource, /roomSessionData\.visibility === "public"/);
  assert.match(functionsSource, /BeauRocks Singer/);
});

test("charts stay low-friction and reportable", () => {
  assert.match(chartsSource, /No account, enjoy the room|Guests still appear in their live room/);
  assert.match(chartsSource, /mailto:hello@beaurocks\.app/);
  assert.match(chartsSource, /One song, one leaderboard/);
  assert.match(chartsSource, /Take the crown/);
  assert.doesNotMatch(chartsSource, /canonical song/i);
  assert.match(discoverSource, /PublicChartsTeaser/);
  assert.doesNotMatch(chartsSource, /Claim this score/);
});

test("song charts launch with transparent low opening scores from the browse catalog", () => {
  assert.match(chartModelSource, /BROWSE_CATEGORIES/);
  assert.match(chartModelSource, /popular_now/);
  assert.match(chartModelSource, /isOpeningScore: true/);
  assert.match(chartsSource, /not singer performances/);
  assert.match(chartsSource, /first qualified score on a song replaces its opening score/);
});
