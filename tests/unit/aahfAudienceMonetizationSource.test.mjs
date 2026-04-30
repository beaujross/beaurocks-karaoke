import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');

test('AAHF-style rooms simplify audience access and keep support out of the primary join path', () => {
  assert.match(
    source,
    /const festivalGuestJoinNoEmail = isCustomAudienceBrand/,
    'Singer app should explicitly detect festival rooms that should not ask for BeauRocks email on join',
  );
  assert.match(
    source,
    /audienceFeatureAccess\?\.features\?\.customEmoji === AUDIENCE_FEATURE_ACCESS_LEVELS\.open[\s\S]*audienceFeatureAccess\?\.features\?\.premiumReactions === AUDIENCE_FEATURE_ACCESS_LEVELS\.open/,
    'Festival join behavior should key off open audience perks instead of inventing a separate access system',
  );
  assert.match(
    source,
    /No BeauRocks email is required for AAHF tonight\./,
    'Festival join helper copy should say that BeauRocks email is not required',
  );
  assert.match(
    source,
    /Any festival updates should come from AAHF, not from BeauRocks\./,
    'Festival join helper copy should make it clear that follow-up communication belongs to the festival',
  );
  assert.match(
    source,
    /isAnon && !festivalGuestJoinNoEmail \?/,
    'Festival no-email rooms should suppress the join-time BeauRocks email CTA for anonymous guests',
  );
});

test('AAHF-style rooms keep support optional inside access and points flows', () => {
  assert.match(
    source,
    /allowsDonationAccess && roomSupportOffer && !simplifyFestivalSupportAccess/,
    'The old donation-first access card should be suppressed for simplified festival rooms',
  );
  assert.match(
    source,
    /allowsDonationAccess && roomSupportOffer && simplifyFestivalSupportAccess/,
    'Simplified festival rooms should still expose optional support using the existing support checkout path',
  );
  assert.match(
    source,
    /Support AAHF separately without slowing down your karaoke join\./,
    'Access modal should keep fundraiser support available but clearly secondary to joining',
  );
  assert.match(
    source,
    /Festival Join Ready/,
    'Festival no-email rooms should show a ready state instead of a BeauRocks email CTA on the join screen',
  );
  assert.match(
    source,
    /festivalNightGuideUrl/,
    'Festival join should derive a direct audience night-guide URL from the current origin and base path',
  );
  assert.match(
    source,
    /data-singer-night-guide-button/,
    'Festival join should expose a dedicated CTA that opens the audience night guide before join',
  );
  assert.match(
    source,
    /See tonight&apos;s format, points, and prizes/,
    'Festival join should explain the purpose of the audience night-guide CTA in plain language',
  );
  assert.match(
    source,
    /print\/aahf-audience-guide\.html/,
    'Festival join should point guests at the AAHF audience guide print route rather than a generic landing page',
  );
  assert.match(
    source,
    /allowsDonationAccess && roomSupportOffer && simplifyFestivalSupportAccess/,
    'Points modal should keep a dedicated simplified festival support branch instead of falling back to the old stacked access flow',
  );
  assert.match(
    source,
    /Optional support/,
    'Simplified festival support should stay visibly secondary inside the points flow',
  );
  assert.match(
    source,
    /Support AAHF separately without slowing down your karaoke join\./,
    'Points modal should keep fundraiser support clearly separate from joining and first-request momentum',
  );
  assert.match(
    source,
    /Get More Points/,
    'Simplified festival points modal should preserve the existing points-shop path instead of removing it outright',
  );
});
