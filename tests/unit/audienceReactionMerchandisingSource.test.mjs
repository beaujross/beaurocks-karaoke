import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vitest";

const source = readFileSync("src/apps/Mobile/SingerApp.jsx", "utf8");

test("locked reaction slots keep the live reaction-card footprint and show bright prices", () => {
  assert.match(source, /data-feature-id="audience-reaction-slot-grid"/);
  assert.match(
    source,
    /data-feature-id="locked-reaction-slot-5"[\s\S]*min-h-\[148px\][\s\S]*CurrencyAmount currency="points" amount=\{fifthReactionSlotPointsCost\}/,
  );
  assert.match(
    source,
    /data-feature-id="locked-reaction-slot-6"[\s\S]*min-h-\[148px\][\s\S]*CurrencyAmount currency="beaubucks" amount=\{sixthReactionSlotProduct\.cost\}/,
  );
  assert.match(source, /border-zinc-500\/65[\s\S]*grayscale/);
});

test("locked slots route insufficient balances into currency-specific conversion funnels", () => {
  assert.match(source, /openAudienceCurrencyFunnel\('points'\)/);
  assert.match(source, /openAudienceCurrencyFunnel\('beaubucks'\)/);
  assert.match(source, /data-feature-id="audience-points-conversion-funnel"/);
  assert.match(
    source,
    /data-feature-id="audience-beaubucks-conversion-funnel"/,
  );
  assert.match(
    source,
    /data-feature-id="audience-account-5000-points-offer"[\s\S]*\+5,000 PTS/,
  );
  assert.match(
    source,
    /BeauBucks buy cosmetics only\. Points and Fame come from play\./,
  );
});

test("live reactions expose an obvious path to browse and buy from the library", () => {
  assert.match(source, /data-feature-id="browse-reaction-emoji-library"/);
  assert.match(source, /Reaction Emoji Library/);
  assert.match(source, /Browse, compare, unlock, and equip reactions/);
  assert.match(
    source,
    /const openReactionLibrary = \(\) => openAudienceCurrencyFunnel\('reactions'\)/,
  );
  assert.match(source, /data-feature-id="reaction-emoji-library-toggle"/);
});
