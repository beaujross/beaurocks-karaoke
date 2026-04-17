import { describe, expect, test } from 'vitest';
import {
    AUDIENCE_ACCESS_MODES,
    MONEYBAGS_BADGE_LABEL,
    SUPPORT_CELEBRATION_STYLES,
    buildAudienceSupportOffer,
    buildGivebutterSupportLaunchUrl,
    normalizeAudienceExperience,
    normalizePurchaseCelebration,
} from '../../src/lib/roomMonetization.js';

describe('roomMonetization', () => {
    test('normalizes audience experience defaults safely', () => {
        expect(normalizeAudienceExperience({})).toEqual({
            audienceAccessMode: AUDIENCE_ACCESS_MODES.account,
            supportCelebrationStyle: SUPPORT_CELEBRATION_STYLES.standard,
        });
    });

    test('keeps supported audience experience values', () => {
        expect(normalizeAudienceExperience({
            audienceAccessMode: AUDIENCE_ACCESS_MODES.emailOrDonation,
            supportCelebrationStyle: SUPPORT_CELEBRATION_STYLES.moneybagsBurst,
        })).toEqual({
            audienceAccessMode: AUDIENCE_ACCESS_MODES.emailOrDonation,
            supportCelebrationStyle: SUPPORT_CELEBRATION_STYLES.moneybagsBurst,
        });
    });

    test('normalizes purchase celebration extended fields', () => {
        expect(normalizePurchaseCelebration({
            buyerName: 'Taylor',
            buyerAvatar: '🤑',
            amountCents: 4200,
            celebrationStyle: SUPPORT_CELEBRATION_STYLES.moneybagsBurst,
        })).toMatchObject({
            buyerName: 'Taylor',
            buyerAvatar: '🤑',
            amountCents: 4200,
            celebrationStyle: SUPPORT_CELEBRATION_STYLES.moneybagsBurst,
            badgeLabel: MONEYBAGS_BADGE_LABEL,
        });
    });

    test('builds donation-backed audience offers from event credits', () => {
        const offer = buildAudienceSupportOffer({
            supportProvider: 'givebutter',
            supportUrl: 'https://givebutter.com/aahf-kickoff',
            supportOffers: [
                { id: 'solo_boost', label: 'Solo Boost', amount: 5, points: 1200, rewardScope: 'buyer' },
            ],
        });

        expect(offer?.supportOffers).toHaveLength(1);
        expect(offer?.supportOffers?.[0]).toMatchObject({
            id: 'solo_boost',
            amount: 5,
            points: 1200,
            rewardScope: 'buyer',
        });
    });

    test('builds Givebutter launch URLs with donate path and amount', () => {
        expect(buildGivebutterSupportLaunchUrl('https://givebutter.com/aahf-kickoff', {
            amount: 10,
            fundCode: '12345',
        })).toBe('https://givebutter.com/aahf-kickoff/donate?amount=10&fund=12345');
    });
});
