import assert from 'node:assert/strict';
import { test } from 'vitest';

import { AUDIENCE_ACCESS_MODES } from '../../src/lib/roomMonetization.js';
import {
  buildAudienceAccessPresentation,
  shouldSimplifyFestivalSupportAccess,
} from '../../src/apps/Mobile/lib/audienceAccessPresentation.js';

test('AAHF-style rooms simplify support gating into a karaoke-first email path', () => {
  const simplified = shouldSimplifyFestivalSupportAccess({
    audienceAccessMode: AUDIENCE_ACCESS_MODES.emailOrDonation,
    roomSupportOffer: { label: 'Support AAHF' },
    openCustomEmoji: true,
    openPremiumReactions: true,
    audienceBrandTitle: 'AAHF Festival',
  });

  assert.equal(simplified, true);

  const presentation = buildAudienceAccessPresentation({
    simplifyFestivalSupportAccess: simplified,
    allowsDonationAccess: true,
    isDonationFirstAccess: false,
    supportCtaLabel: 'Support AAHF',
    simpleEmailCaptureMode: false,
    isCustomAudienceBrand: true,
    audienceBrandTitle: 'AAHF Festival',
    supporterAccessLabel: 'Festival Supporter',
    premiumPerksLabel: 'premium perks',
  });

  assert.equal(presentation.accessActionLabel, 'Continue with Email');
  assert.equal(presentation.accessConnectedLabel, 'Email Access Ready');
  assert.equal(presentation.audienceAccessHeadline, 'Continue with Email');
  assert.match(presentation.audienceAccessBody, /AAHF support moments can stay separate from your karaoke join flow/i);
});

test('donation-first rooms still explain supporter unlocks when simplification is off', () => {
  const presentation = buildAudienceAccessPresentation({
    simplifyFestivalSupportAccess: false,
    allowsDonationAccess: true,
    isDonationFirstAccess: true,
    supportCtaLabel: 'Support the Room',
    simpleEmailCaptureMode: false,
    isCustomAudienceBrand: false,
    audienceBrandTitle: 'BeauRocks',
    supporterAccessLabel: 'VIP',
    premiumPerksLabel: 'premium perks',
  });

  assert.equal(presentation.accessActionLabel, 'Support the Room');
  assert.equal(presentation.audienceAccessHeadline, 'Support BeauRocks');
  assert.match(presentation.audienceAccessBody, /unlock vip perks/i);
});
