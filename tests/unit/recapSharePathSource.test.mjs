import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const recapSource = readFileSync(new URL("../../src/apps/Recap/RecapView.jsx", import.meta.url), "utf8");
const singerSource = readFileSync(new URL("../../src/apps/Mobile/SingerApp.jsx", import.meta.url), "utf8");

test("published room recaps can be shared and lead into hosting", () => {
  assert.match(recapSource, /data-feature-id="recap-share-actions"/);
  assert.match(recapSource, /navigator\.share/);
  assert.match(recapSource, /recap_share_completed/);
  assert.match(recapSource, /Start your own room/);
  assert.match(recapSource, /host-access/);
});

test("the audience can return to and share a completed room recap", () => {
  assert.match(singerSource, /data-feature-id="audience-room-recap-actions"/);
  assert.match(singerSource, /room\?\.latestRecapUrl/);
  assert.match(singerSource, /buildRoomRecapUrl/);
  assert.match(singerSource, /audience_recap_share_completed/);
  assert.match(singerSource, /View recap/);
});
