import { describe, expect, test } from 'vitest';
import { isAahfRoom, resolveRecapBranding, toAbsoluteRecapUrl } from '../../src/lib/recapBranding.js';

describe('recapBranding', () => {
  test('treats AAHF rooms as partner-branded even without an explicit room logo', () => {
    const branding = resolveRecapBranding({
      roomCode: 'AAHF',
      roomName: 'Asian Arts & Heritage Festival',
      defaultLogoUrl: '/images/logo-library/beaurocks-logo-neon trasnparent.png',
    });

    expect(isAahfRoom('AAHF', 'Asian Arts & Heritage Festival')).toBeTruthy();
    expect(branding.hasPartnerLogo).toBe(true);
    expect(branding.partnerLogo).toMatch(/aahf-combined-badge-clean\.png$/);
    expect(branding.socialImageUrl).toMatch(/aahf-combined-badge-clean\.png$/);
  });

  test('does not duplicate BeauRocks as a fake partner logo', () => {
    const branding = resolveRecapBranding({
      roomCode: 'SING',
      roomName: 'BeauRocks Karaoke',
      logoUrl: 'https://app.beaurocks.app/images/logo-library/beaurocks-logo-neon%20trasnparent.png',
      defaultLogoUrl: '/images/logo-library/beaurocks-logo-neon trasnparent.png',
      leadImageUrl: '/images/social/discover.png',
      origin: 'https://app.beaurocks.app',
    });

    expect(branding.hasPartnerLogo).toBe(false);
    expect(branding.socialImageUrl).toBe('/images/social/discover.png');
  });

  test('absolutizes relative recap assets for meta tags', () => {
    expect(toAbsoluteRecapUrl('/images/social/discover.png', 'https://app.beaurocks.app'))
      .toBe('https://app.beaurocks.app/images/social/discover.png');
  });
});
