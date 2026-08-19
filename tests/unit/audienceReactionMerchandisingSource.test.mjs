import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vitest";

const source = [
  readFileSync("src/apps/Mobile/SingerApp.jsx", "utf8"),
  readFileSync("src/apps/Mobile/components/AudienceReactionSlotGrid.jsx", "utf8"),
  readFileSync("src/apps/Mobile/components/AudienceReactionCollection.jsx", "utf8"),
  readFileSync("src/apps/Mobile/components/AudienceReactionDeck.jsx", "utf8"),
  readFileSync("src/apps/Mobile/lib/audienceReactionUnlockFlow.js", "utf8"),
].join("\n");

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

test("premium library items remain actionable so account and balance funnels can resolve the tap", () => {
  assert.match(source, /onPurchasePremium\(premiumProduct\.id\)/);
  assert.doesNotMatch(source, /\|\| !walletReady/);
  assert.match(source, /result\?\.outcome === 'insufficient_balance'[\s\S]*setCurrencyFunnelTarget\('beaubucks'\)/);
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

test("reaction library distinguishes avatars and supports explicit slot replacement", () => {
  assert.match(source, /Voting Reaction Library/);
  assert.match(source, /not your profile avatar/);
  assert.match(source, /data-feature-id="reaction-loadout-slot-picker"/);
  assert.match(source, /Choose the voting slot to change/);
  assert.match(source, /Replace slot \$\{targetSlotNumber\}/);
  assert.match(source, /reaction-library-preview-/);
  assert.match(source, /data-feature-id="reaction-library-wallet-context"/);
  assert.match(source, /data-reaction-product-price=/);
  assert.match(source, /Permanent cosmetic/);
});

test("streamlined audience keeps a persistent reaction loadout with an edit path", () => {
  assert.match(source, /data-feature-id="persistent-audience-reaction-deck"/);
  assert.match(source, /data-reactions-active=/);
  assert.match(source, /data-feature-id="edit-voting-emojis"/);
  assert.match(source, /Ready for the next performance/);
});

test("audience header exposes both spendable balances", () => {
  assert.match(source, /data-feature-id="audience-wallet-balances"/);
  assert.match(source, /currency="points"/);
  assert.match(source, /currency="beaubucks"/);
});

test("shared avatar picker provides direct access to paid collections and visible prices", () => {
  assert.match(source, /data-feature-id="avatar-storefront-jump-nav"/);
  assert.match(source, /data-avatar-jump=\{group\.id\}/);
  assert.match(source, /data-avatar-offer-currency="points"/);
  assert.match(source, /data-avatar-offer-currency="beaubucks"/);
  assert.match(source, /Profile Studio[\s\S]*<AvatarCoverflow/);
});

test("fifth reaction slot clearly follows Host enablement and room-only ownership", () => {
  assert.match(source, /fifthReactionSlotPurchasesEnabled/);
  assert.match(source, /Host has not enabled/);
  assert.match(source, /This room only/);
});

test("the noncritical reaction collection loads behind a visible lazy boundary", () => {
  assert.match(source, /const AudienceReactionCollection = React\.lazy\(\(\) => import\('\.\/components\/AudienceReactionCollection'\)\);/);
  assert.match(source, /data-feature-id="audience-reaction-collection-loading"/);
  assert.match(source, /<React\.Suspense fallback=\{<section[\s\S]*<AudienceReactionCollection/);
});
