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
    /simplifyFestivalSupportAccess \? \(/,
    'Points modal should have a dedicated simplified branch for festival support rooms',
  );
  assert.match(
    source,
    /Support is optional\. When the room flashes a support moment on the main screen, you can donate there without interrupting your karaoke flow\./,
    'Points modal should steer guests toward occasional room-level support moments instead of a stacked monetization shop',
  );
  assert.match(
    source,
    /Get More Points/,
    'Simplified festival points modal should preserve the existing points-shop path instead of removing it outright',
  );
});
