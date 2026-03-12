import assert from "node:assert/strict";
import { test } from "vitest";
import {
  buildListingActionHref,
  getListingActionMeta,
  normalizeListingType,
  normalizeSelectedListingTypes,
  setOnlySelectedListingType,
  toggleSelectedListingType,
} from "../../src/apps/Marketing/pages/discoverListingTypes.js";

const ALLOWED_TYPES = ["event", "venue", "room_session"];

test("discoverListingTypes.test normalizes listing types and selected sets", () => {
  assert.equal(normalizeListingType(" EVENT "), "event");
  assert.equal(normalizeListingType("room_session"), "room_session");
  assert.equal(normalizeListingType("anything-else"), "venue");

  assert.deepEqual(
    normalizeSelectedListingTypes(["room_session", "event", "event", "weird"], ALLOWED_TYPES),
    ["event", "venue", "room_session"]
  );
  assert.deepEqual(
    normalizeSelectedListingTypes("unknown", ALLOWED_TYPES),
    ["venue"]
  );
  assert.deepEqual(
    normalizeSelectedListingTypes([], ALLOWED_TYPES),
    ALLOWED_TYPES
  );
});

test("discoverListingTypes.test toggles and sets selected listing types", () => {
  assert.deepEqual(
    toggleSelectedListingType(["event", "venue"], "room_session", ALLOWED_TYPES),
    ALLOWED_TYPES
  );
  assert.deepEqual(
    toggleSelectedListingType(ALLOWED_TYPES, "venue", ALLOWED_TYPES),
    ["event", "room_session"]
  );
  assert.deepEqual(
    toggleSelectedListingType(["event"], "event", ALLOWED_TYPES),
    ["event"]
  );
  assert.deepEqual(
    setOnlySelectedListingType("room_session", ALLOWED_TYPES),
    ["room_session"]
  );
});

test("discoverListingTypes.test builds listing action hrefs", () => {
  assert.equal(
    buildListingActionHref({ listingType: "room_session", roomCode: " ab12 " }),
    "/join/AB12"
  );
  assert.equal(
    buildListingActionHref({ listingType: "event", routePage: "event", id: "evt-1" }),
    "/events/evt-1"
  );
  assert.equal(
    buildListingActionHref({ sourceType: "official_registry", routePage: "event", id: "evt-1" }),
    ""
  );
  assert.equal(buildListingActionHref({ routePage: "", id: "x" }), "");
  assert.equal(buildListingActionHref(null), "");
});

test("discoverListingTypes.test returns listing action meta", () => {
  assert.deepEqual(
    getListingActionMeta({ listingType: "room_session", roomCode: "joinme" }),
    { href: "/join/JOINME", label: "Open room" }
  );
  assert.deepEqual(
    getListingActionMeta({ listingType: "event", routePage: "event", id: "evt-2" }),
    { href: "/events/evt-2", label: "Open details" }
  );
});
