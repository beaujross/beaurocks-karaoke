import assert from "node:assert/strict";
import { test } from "vitest";
import { createDiscoverViewState, reduceDiscoverViewState } from "../../src/apps/Marketing/pages/discoverViewState.js";

test("discoverViewState.test", () => {
  const mobileInitial = createDiscoverViewState({ isMobile: true });
  assert.equal(mobileInitial.mobileSurface, "list");
  assert.equal(mobileInitial.mobileFiltersExpanded, false);

  const desktopInitial = createDiscoverViewState({ isMobile: false });
  assert.equal(desktopInitial.mobileFiltersExpanded, true);

  const mapState = reduceDiscoverViewState(mobileInitial, { type: "show_map" });
  assert.equal(mapState.mobileSurface, "map");
  assert.equal(mapState.mobileFiltersExpanded, false);

  const listState = reduceDiscoverViewState(mapState, { type: "show_list" });
  assert.equal(listState.mobileSurface, "list");

  const toggled = reduceDiscoverViewState(listState, { type: "toggle_filters" });
  assert.equal(toggled.mobileFiltersExpanded, true);

  const tilesState = reduceDiscoverViewState(toggled, { type: "set_results_view", value: "tiles" });
  assert.equal(tilesState.resultsView, "tiles");

  const viewportDesktop = reduceDiscoverViewState(tilesState, { type: "viewport_changed", isMobile: false });
  assert.equal(viewportDesktop.mobileSurface, "list");
  assert.equal(viewportDesktop.mobileFiltersExpanded, true);
});
