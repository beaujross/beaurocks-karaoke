import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const tvSource = readFileSync(new URL("../../src/apps/TV/PublicTV.jsx", import.meta.url), "utf8");
const hostChromeSource = readFileSync(new URL("../../src/apps/Host/components/HostTopChrome.jsx", import.meta.url), "utf8");

test("Public TV keeps pop-up trivia legible and out of the sidebar header", () => {
  assert.match(tvSource, /hasActivePopTriviaPanel && isCinema/);
  assert.match(tvSource, /data-feature-id="tv-pop-trivia-active-beacon"/);
  assert.match(tvSource, /Vote on your phone/);
  assert.doesNotMatch(
    tvSource,
    /GameLifecycleStatusCard presentation=\{popTriviaLifecyclePresentation\} surface="tv"/
  );
});

test("Mic Checkpoint has a visible countdown and supports two-minute turns", () => {
  assert.match(tvSource, /data-feature-id="tv-mic-checkpoint-countdown"/);
  assert.match(tvSource, /micCheckpointOpeningWindowSec/);
  assert.match(tvSource, /micCheckpointCountdownLabel/);
  assert.match(tvSource, /micCheckpointProgressPct/);
  assert.match(hostChromeSource, /Object\.freeze\(\[45, 60, 90, 120\]\)/);
  assert.match(hostChromeSource, /Mic Checkpoint/);
});
