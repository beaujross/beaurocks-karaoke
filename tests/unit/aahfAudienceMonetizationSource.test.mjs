import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');

test('AAHF-style rooms simplify audience access and keep support out of the primary join path', () => {
  assert.match(
    source,
    /const simplifyFestivalSupportAccess = allowsDonationAccess/,
    'Singer app should explicitly detect festival rooms that already open the core audience perks',
  );
  assert.match(
    source,
    /audienceFeatureAccess\?\.features\?\.customEmoji === AUDIENCE_FEATURE_ACCESS_LEVELS\.open[\s\S]*audienceFeatureAccess\?\.features\?\.premiumReactions === AUDIENCE_FEATURE_ACCESS_LEVELS\.open/,
    'Festival simplification should key off open audience perks instead of inventing a separate access system',
  );
  assert.match(
    source,
    /const accessActionLabel = simplifyFestivalSupportAccess\s*\n\s*\? 'Continue with Email'/,
    'Simplified festival access should default the primary CTA back to email instead of support-first language',
  );
  assert.match(
    source,
    /AAHF support moments can stay separate from your karaoke join flow\./,
    'Audience access copy should explicitly separate fundraising from the core karaoke join experience',
  );
  assert.match(
    source,
    /const wantsEmail = preferredPath === 'email' \|\| \(preferredPath === 'auto' && simplifyFestivalSupportAccess\);/,
    'Auto-upgrade routing should prefer the existing email flow for simplified festival rooms',
  );
  assert.match(
    source,
    /Support moments for AAHF can stay on the main screen instead of blocking join\./,
    'Join helper copy should reinforce that support appears on the main screen instead of interrupting entry',
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
