import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vitest";

const audienceGuideSource = readFileSync("public/print/aahf-audience-guide.html", "utf8");
const hostWalkthroughSource = readFileSync("public/print/aahf-host-walkthrough.html", "utf8");

test("AAHF audience poster explains the live room format and points economy", () => {
  assert.match(audienceGuideSource, /Open karaoke queue\. Bonus points all night\./);
  assert.match(audienceGuideSource, /200 to start/);
  assert.match(audienceGuideSource, /\+25<\/strong> every <strong>10 min<\/strong>, capped at <strong>\+150<\/strong>/);
  assert.match(audienceGuideSource, /There is no all-night crowd vote running by default\./);
  assert.match(audienceGuideSource, /No BeauRocks email is required tonight\./);
  assert.match(audienceGuideSource, /Support is optional and stays separate from karaoke join\./);
});

test("AAHF host walkthrough includes a room-settings verification block", () => {
  assert.match(hostWalkthroughSource, /AAHF settings to verify before doors/);
  assert.match(hostWalkthroughSource, /Audience shell should stay <strong>streamlined<\/strong>\./);
  assert.match(hostWalkthroughSource, /Join credits: <strong>200<\/strong>\./);
  assert.match(hostWalkthroughSource, /Active-room refill: <strong>\+25 every 10 min<\/strong>\./);
  assert.match(hostWalkthroughSource, /Support CTA should stay <strong>Support AAHF Festival<\/strong>\./);
  assert.match(hostWalkthroughSource, /Run of show template is loaded, but <strong>not live<\/strong>\./);
});
