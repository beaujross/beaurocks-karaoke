import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vitest";

const audienceGuideSource = readFileSync("public/print/aahf-audience-guide.html", "utf8");
const cohostGuideSource = readFileSync("public/print/cohost-guide.html", "utf8");
const hostWalkthroughSource = readFileSync("public/print/aahf-host-walkthrough.html", "utf8");

test("AAHF audience poster explains the live room format and night flow", () => {
  assert.match(audienceGuideSource, /Join fast\. Request your song\. Stay ready\./);
  assert.match(audienceGuideSource, /How tonight unfolds/);
  assert.match(audienceGuideSource, /Request a song/);
  assert.match(audienceGuideSource, /No BeauRocks email is required tonight\./);
  assert.match(audienceGuideSource, /Support and donations are optional and never block karaoke join\./);
  assert.match(audienceGuideSource, /There is no always-on crowd vote\./);
  assert.match(audienceGuideSource, /Votes \+ winners appear live/);
  assert.match(audienceGuideSource, /Scan the QR, join AAHF, tap Songs, then watch your queue\./);
});

test("AAHF co-host poster explains role boundaries and the run of night", () => {
  assert.match(cohostGuideSource, /Keep the line moving\. Protect the guest experience\./);
  assert.match(cohostGuideSource, /What you own tonight/);
  assert.match(cohostGuideSource, /Escalate instead of improvising/);
  assert.match(cohostGuideSource, /How your night unfolds/);
  assert.match(cohostGuideSource, /Tell Host once/);
  assert.match(cohostGuideSource, /their phone becomes their queue status screen for the night\./);
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
