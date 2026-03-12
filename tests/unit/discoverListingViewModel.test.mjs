import assert from "node:assert/strict";
import { test } from "vitest";
import { buildDiscoverListing } from "../../src/apps/Marketing/pages/discoverListingViewModel.js";

test("discoverListingViewModel.test builds room-session listing presentation", () => {
  const listing = buildDiscoverListing({
    id: "session-1",
    title: "Friday Room",
    listingType: "room_session",
    hostUid: "Host-1",
    hostName: "DJ Beau",
    venueName: "Neon Lounge",
    roomCode: " br123 ",
    sessionMode: "virtual",
    isOfficialBeauRocksRoom: true,
    officialBeauRocksStatus: "featured",
    officialBeauRocksStatusLabel: "Featured",
    officialBadgeImageUrl: "http://cdn.example.com/badge.png",
    externalSources: {
      google: {
        photoRefs: ["photo-a", "photo-b"],
      },
    },
    hostLeaderboardRank: "4",
  }, "room_session", {
    mapsApiKey: "maps-key",
    allowGoogleImageApis: true,
    allowGoogleStaticFallback: true,
    resolvedLocation: { lat: 47.61, lng: -122.33 },
    resolvedLocationFields: {
      city: "Seattle",
      state: "WA",
      address1: "1 Main St",
    },
    locationSource: "venue_id",
  });

  assert.equal(listing.key, "room_session:session-1");
  assert.equal(listing.routePage, "session");
  assert.equal(listing.markerColor, "#ff4fae");
  assert.equal(listing.subtitle, "Virtual session");
  assert.equal(listing.detailLine, "Virtual | Neon Lounge | BR123");
  assert.equal(listing.roomCode, "BR123");
  assert.equal(listing.virtualOnly, true);
  assert.equal(listing.isOfficialBeauRocksListing, true);
  assert.equal(listing.isOfficialBeauRocksRoom, true);
  assert.equal(listing.isBeauRocksElevated, true);
  assert.equal(listing.officialBadgeImageUrl, "https://cdn.example.com/badge.png");
  assert.equal(listing.hostToken, "uid:host-1");
  assert.equal(listing.locationSource, "venue_id");
  assert.ok(listing.googleImageCandidates.some((url) => url.includes("photo_reference=photo-a")));
  assert.ok(listing.googleImageCandidates.some((url) => url.includes("streetview")));
  assert.ok(listing.googleImageCandidates.some((url) => url.includes("staticmap")));
  assert.ok(listing.experience && typeof listing.experience === "object");
});

test("discoverListingViewModel.test builds venue listing fallback presentation", () => {
  const longDescription = "A".repeat(140);
  const listing = buildDiscoverListing({
    id: "venue-1",
    title: "Harbor Karaoke",
    description: longDescription,
    karaokeNightsLabel: "Friday and Saturday",
    hostName: "Harbor Host",
    venueAverageRating: "4.8",
    venueReviewCount: "27",
  }, "venue", {
    allowGoogleImageApis: false,
    resolvedLocation: null,
    resolvedLocationFields: {
      city: "Tacoma",
      state: "WA",
    },
  });

  assert.equal(listing.routePage, "venue");
  assert.equal(listing.typeLabel, "venue");
  assert.equal(listing.imageUrl, "/images/marketing/venue-location-fallback.svg");
  assert.equal(listing.imageFallbackUrl, "/images/marketing/venue-location-fallback.svg");
  assert.deepEqual(listing.googleImageCandidates, []);
  assert.equal(listing.officialBadgeImageUrl, "/images/marketing/venue-location-fallback.svg");
  assert.equal(listing.subtitle, "Tacoma, WA");
  assert.equal(listing.timeLabel, "Friday and Saturday");
  assert.deepEqual(listing.cadenceBadges, ["Fri", "Sat"]);
  assert.equal(listing.detailLine.length, 120);
  assert.equal(listing.hostToken, "name:harbor host");
  assert.equal(listing.locationSource, "missing");
  assert.equal(listing.venueAverageRating, 4.8);
  assert.equal(listing.venueReviewCount, 27);
});
