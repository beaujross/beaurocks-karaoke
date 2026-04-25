import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "vitest";

import { normalizeComparableMarketingUrl } from "../../src/apps/Marketing/marketingCanonicalization.js";

test("marketingSiteCanonicalization normalizes trailing slash equivalents", () => {
  assert.equal(
    normalizeComparableMarketingUrl("/discover/"),
    normalizeComparableMarketingUrl("/discover")
  );
  assert.equal(
    normalizeComparableMarketingUrl("/for-hosts/?utm_source=test"),
    normalizeComparableMarketingUrl("/for-hosts?utm_source=test")
  );
  assert.equal(
    normalizeComparableMarketingUrl("/"),
    "/"
  );
});

test("marketingSiteCanonicalization avoids full-page replace for same-origin canonicalization", () => {
  const source = fs.readFileSync(
    "src/apps/Marketing/MarketingSite.jsx",
    "utf8"
  );

  assert.match(source, /window\.history\.replaceState\(\{\}, "", canonicalUrl\)/);
  assert.doesNotMatch(source, /window\.location\.replace\(canonicalUrl\)/);
});
