import { describe, expect, test } from 'vitest';
import {
    AUDIENCE_ACCESS_MODES,
    MONEYBAGS_BADGE_LABEL,
    SUPPORT_CELEBRATION_STYLES,
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
});
