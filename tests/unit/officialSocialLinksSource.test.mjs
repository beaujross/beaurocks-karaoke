import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

import { OFFICIAL_BEAUROCKS_SOCIAL_LINKS } from "../../src/lib/officialSocialLinks.js";

const marketingSource = readFileSync("src/apps/Marketing/MarketingSite.jsx", "utf8");

test("official BeauRocks social destinations are canonical and public", () => {
  assert.deepEqual(
    OFFICIAL_BEAUROCKS_SOCIAL_LINKS.map(({ id, url }) => ({ id, url })),
    [
      { id: "facebook", url: "https://www.facebook.com/BeauRocksKaraoke" },
      { id: "instagram", url: "https://www.instagram.com/beaurockskaraoke/" },
      { id: "youtube", url: "https://www.youtube.com/channel/UCkWxI2CivAk52-l9zXofrKA" },
    ]
  );
});

test("the public footer exposes and attributes official social destinations", () => {
  assert.match(marketingSource, /OFFICIAL_BEAUROCKS_SOCIAL_LINKS\.map/);
  assert.match(marketingSource, /mk_social_outbound_click/);
  assert.match(marketingSource, /rel="me noreferrer"/);
});
