import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vitest";

const audienceGuideSource = readFileSync("public/print/aahf-audience-guide.html", "utf8");
const cohostGuideSource = readFileSync("public/print/cohost-guide.html", "utf8");
const hostWalkthroughSource = readFileSync("public/print/aahf-host-walkthrough.html", "utf8");

test("AAHF audience poster explains the live room format and night flow", () => {
  assert.match(audienceGuideSource, /Scan To Join Karaoke/);
  assert.match(audienceGuideSource, /Open karaoke\. Crowd points\. Big festival energy\./);
  assert.match(audienceGuideSource, /Scan drops you straight into emoji pick\./);
  assert.match(audienceGuideSource, /No BeauRocks email is required tonight\./);
  assert.match(audienceGuideSource, /vote for performers with points/);
  assert.match(audienceGuideSource, /reacting, playing along, and supporting the fundraiser whenever you want\./);
  assert.match(audienceGuideSource, /Point Your Camera Here/);
  assert.match(audienceGuideSource, /aahf-kickoff-join-qr\.svg/);
  assert.match(audienceGuideSource, /width: 8\.5in;/);
  assert.match(audienceGuideSource, /height: 11in;/);
  assert.match(audienceGuideSource, /width: 3\.52in;/);
  assert.match(audienceGuideSource, /No code typing tonight\./);
  assert.match(audienceGuideSource, /request songs, vote with points, and keep your phone handy for crowd moments all night\./);
  assert.match(audienceGuideSource, /<h2 class="card-title">Scan<\/h2>/);
  assert.match(audienceGuideSource, /<h2 class="card-title">Pick Emoji<\/h2>/);
  assert.match(audienceGuideSource, /<h2 class="card-title">Play The Room<\/h2>/);
  assert.match(audienceGuideSource, /Cheer Loud\. Earn Points\. Spend Them On The Fun\./);
  assert.match(audienceGuideSource, /The more you interact, the more playful the room gets\./);
  assert.match(audienceGuideSource, /Support is optional, but the energy absolutely counts\./);
});

test("AAHF co-host poster explains role boundaries and the run of night", () => {
  assert.match(cohostGuideSource, /Keep the line moving\. Protect the guest experience\./);
  assert.match(cohostGuideSource, /What you own tonight/);
  assert.match(cohostGuideSource, /Escalate and vote clean/);
  assert.match(cohostGuideSource, /How your night unfolds/);
  assert.match(cohostGuideSource, /Tell Host once/);
  assert.match(cohostGuideSource, /their phone becomes their queue status screen for the night\./);
  assert.match(cohostGuideSource, /The host opens the face-off/);
  assert.match(cohostGuideSource, /You vote from the live room/);
  assert.match(cohostGuideSource, /The host sees your choice in the live tally\./);
  assert.match(cohostGuideSource, /Host confirms the winner/);
});

test("AAHF host walkthrough includes a room-settings verification block", () => {
  assert.match(hostWalkthroughSource, /AAHF settings to verify before doors/);
  assert.match(hostWalkthroughSource, /Audience shell should stay <strong>streamlined<\/strong>\./);
  assert.match(hostWalkthroughSource, /Join credits: <strong>200<\/strong>\./);
  assert.match(hostWalkthroughSource, /Active-room refill: <strong>\+25 every 10 min<\/strong>\./);
  assert.match(hostWalkthroughSource, /Support CTA should stay <strong>Support AAHF Festival<\/strong>\./);
  assert.match(hostWalkthroughSource, /Official AAHF website links can auto-award <strong>\+150<\/strong>\./);
  assert.match(hostWalkthroughSource, /Official AAHF social links can auto-award <strong>\+250<\/strong>\./);
  assert.match(hostWalkthroughSource, /No guest claim step or host proof check should be required\./);
  assert.match(hostWalkthroughSource, /There is no all-night crowd vote running by default\./);
  assert.match(hostWalkthroughSource, /Top-of-hour celebration timing can float to the next clean break after a performance\./);
  assert.match(hostWalkthroughSource, /How the host runs the night without over-explaining it/);
  assert.match(hostWalkthroughSource, /Phase 3: Live room loop/);
});
