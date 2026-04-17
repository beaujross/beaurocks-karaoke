import assert from "node:assert/strict";
import { test } from "vitest";
import {
  EVENT_CREDITS_PRESETS,
  applyEventCreditsPreset,
  buildProvisionEventCreditsPayload,
  buildProvisionDiscoveryPayload,
  createEventCreditsDraft,
  createQuickLaunchDiscoveryDraft,
} from "../../src/apps/Host/hostLaunchHelpers.js";

test("hostLaunchHelpers preserves venue linkage for selected venues", () => {
  const payload = buildProvisionDiscoveryPayload(
    createQuickLaunchDiscoveryDraft({
      publicRoom: true,
      venueName: "The Mint",
      venueId: "venue_mint",
      city: "Los Angeles",
      state: "CA",
      lat: "34.0901",
      lng: "-118.3852",
    }),
    { roomName: "Friday Showcase" },
  );

  assert.equal(payload.publicRoom, true);
  assert.equal(payload.title, "The Mint");
  assert.equal(payload.venueId, "venue_mint");
  assert.equal(payload.venueSource, "selected");
  assert.deepEqual(payload.location, { lat: 34.0901, lng: -118.3852 });
});

test("hostLaunchHelpers falls back to room name and marks freeform venues", () => {
  const payload = buildProvisionDiscoveryPayload(
    createQuickLaunchDiscoveryDraft({
      publicRoom: true,
      venueName: "Jordan's Pop-Up Room",
      city: "Portland",
      state: "OR",
    }),
    { roomName: "Friday Pop-Up" },
  );

  assert.equal(payload.title, "Jordan's Pop-Up Room");
  assert.equal(payload.venueId, "");
  assert.equal(payload.venueSource, "freeform");
  assert.equal(payload.city, "Portland");
  assert.equal(payload.state, "OR");
});

test("hostLaunchHelpers can use room name as the discovery title fallback", () => {
  const payload = buildProvisionDiscoveryPayload(
    createQuickLaunchDiscoveryDraft(),
    { roomName: "Private Test Room" },
  );

  assert.equal(payload.publicRoom, false);
  assert.equal(payload.title, "Private Test Room");
  assert.equal(payload.venueId, "");
  assert.equal(payload.venueSource, "");
});

test("hostLaunchHelpers normalizes event credits and claim codes", () => {
  const payload = buildProvisionEventCreditsPayload(
    createEventCreditsDraft({
      enabled: true,
      eventId: "AAHF Kickoff 2026",
      eventLabel: "AAHF Karaoke Kick-Off",
      generalAdmissionPoints: "200.9",
      vipBonusPoints: "400",
      skipLineBonusPoints: "600",
      websiteCheckInPoints: "150",
      socialPromoPoints: "250",
      claimCodes: {
        vip: "VIP 2026!",
        skipLine: "SKIP-2026",
        websiteCheckIn: "CHECK IN",
        socialPromo: "POST+LOUD",
      },
    }),
  );

  assert.equal(payload.enabled, true);
  assert.equal(payload.eventId, "aahfkickoff2026");
  assert.equal(payload.generalAdmissionPoints, 200);
  assert.equal(payload.vipBonusPoints, 400);
  assert.equal(payload.claimCodes.vip, "VIP2026");
  assert.equal(payload.claimCodes.skipLine, "SKIP-2026");
  assert.equal(payload.claimCodes.websiteCheckIn, "CHECKIN");
  assert.equal(payload.claimCodes.socialPromo, "POSTLOUD");
});

test("hostLaunchHelpers normalizes donation-backed support offers", () => {
  const payload = buildProvisionEventCreditsPayload(
    createEventCreditsDraft({
      enabled: true,
      supportProvider: "givebutter",
      supportOffers: [
        { id: "Solo Boost!", label: "Solo Boost", amount: "5.9", points: "1200", rewardScope: "buyer" },
      ],
    }),
  );

  assert.equal(payload.supportOffers.length, 1);
  assert.deepEqual(payload.supportOffers[0], {
    id: "soloboost",
    label: "Solo Boost",
    amount: 5,
    points: 1200,
    rewardScope: "buyer",
    awardBadge: false,
    supportUrl: "",
    supportEmbedUrl: "",
    supportCampaignCode: "",
    supportFundCode: "",
  });
});

test("hostLaunchHelpers applies AAHF preset defaults for simple Givebutter matching", () => {
  const draft = applyEventCreditsPreset("aahf_kickoff", createEventCreditsDraft());
  assert.equal(draft.enabled, true);
  assert.equal(draft.eventId, EVENT_CREDITS_PRESETS.aahf_kickoff.values.eventId);
  assert.equal(draft.sourceProvider, "givebutter");
  assert.equal(draft.generalAdmissionPoints, 200);
  assert.ok(Array.isArray(draft.promoCampaigns));
  assert.equal(draft.promoCampaigns.length, 0);
  assert.equal(draft.supportOffers.length, 3);
  assert.equal(draft.vipBonusPoints, 0);
  assert.equal(draft.skipLineBonusPoints, 0);

  const payload = buildProvisionEventCreditsPayload(draft);
  assert.equal(payload.presetId, "aahf_kickoff");
  assert.equal(payload.sourceProvider, "givebutter");
  assert.equal(payload.promoCampaigns.length, draft.promoCampaigns.length);
  assert.equal(payload.supportOffers.length, draft.supportOffers.length);
  assert.equal(payload.vipBonusPoints, 0);
  assert.equal(payload.skipLineBonusPoints, 0);
});
