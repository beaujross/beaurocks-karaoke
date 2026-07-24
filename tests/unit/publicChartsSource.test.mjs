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
  assert.match(functionsSource, /mergePublicSongLeaders/);
  assert.match(functionsSource, /schemaVersion: 2/);
});

test("charts stay low-friction and reportable", () => {
  assert.match(chartsSource, /Sign in before you sing to appear on public charts/);
  assert.match(chartsSource, /mailto:hello@beaurocks\.app/);
  assert.match(chartsSource, /One song, one leaderboard/);
  assert.match(chartsSource, /take the crown/i);
  assert.match(chartsSource, /Song Crowns/);
  assert.match(chartsSource, /Singer Momentum/);
  assert.match(chartsSource, /Active Nights/);
  assert.match(chartsSource, /Host your own night/);
  assert.match(chartsSource, /Ready to sing\?/);
  assert.match(chartsSource, /Run a karaoke night\?/);
  assert.match(chartsSource, /Top performances for/);
  assert.doesNotMatch(chartsSource, /canonical song/i);
  assert.match(discoverSource, /PublicChartsTeaser/);
  assert.doesNotMatch(chartsSource, /Claim this score/);
});

test("song charts launch with transparent low opening scores from the browse catalog", () => {
  assert.match(chartModelSource, /BROWSE_CATEGORIES/);
  assert.match(chartModelSource, /popular_now/);
  assert.match(chartModelSource, /isOpeningScore: true/);
  assert.match(chartModelSource, /ItemList/);
  assert.match(chartsSource, /application\/ld\+json/);
  assert.match(chartsSource, /Opening scores are placeholders/);
  assert.match(chartsSource, /first eligible singer score replaces them/);
});
