import { describe, expect, test } from 'vitest';
import {
    AUDIENCE_ACCESS_MODES,
    CO_HOST_CREDIT_POLICIES,
    CREDIT_EARNING_MODES,
    DEFAULT_REACTION_TAP_COOLDOWN_MS,
    MONEYBAGS_BADGE_LABEL,
    SUPPORT_CELEBRATION_STYLES,
    buildAudienceSupportOffer,
    buildPurchaseCelebrationReplay,
    buildGivebutterSupportLaunchUrl,
    normalizeAudienceExperience,
    normalizeReactionTapCooldownMs,
    normalizePurchaseCelebration,
} from '../../src/lib/roomMonetization.js';

describe('roomMonetization', () => {
    test('normalizes audience experience defaults safely', () => {
        expect(normalizeAudienceExperience({})).toEqual({
            audienceAccessMode: AUDIENCE_ACCESS_MODES.account,
            creditEarningMode: CREDIT_EARNING_MODES.standard,
            coHostCreditPolicy: CO_HOST_CREDIT_POLICIES.standard,
            reactionTapCooldownMs: DEFAULT_REACTION_TAP_COOLDOWN_MS,
            timedLobbyEnabled: false,
            timedLobbyPoints: 0,
            timedLobbyIntervalMin: 1,
            timedLobbyMaxPerGuest: 0,
            supportCelebrationStyle: SUPPORT_CELEBRATION_STYLES.standard,
        });
    });

    test('keeps supported audience experience values', () => {
        expect(normalizeAudienceExperience({
            audienceAccessMode: AUDIENCE_ACCESS_MODES.emailOrDonation,
            creditEarningMode: CREDIT_EARNING_MODES.friendly,
            coHostCreditPolicy: CO_HOST_CREDIT_POLICIES.freeReactions,
            reactionTapCooldownMs: 1600,
            timedLobbyEnabled: true,
            timedLobbyPoints: 25,
            timedLobbyIntervalMin: 10,
            timedLobbyMaxPerGuest: 150,
            supportCelebrationStyle: SUPPORT_CELEBRATION_STYLES.moneybagsBurst,
        })).toEqual({
            audienceAccessMode: AUDIENCE_ACCESS_MODES.emailOrDonation,
            creditEarningMode: CREDIT_EARNING_MODES.friendly,
            coHostCreditPolicy: CO_HOST_CREDIT_POLICIES.freeReactions,
            reactionTapCooldownMs: 1600,
            timedLobbyEnabled: true,
            timedLobbyPoints: 25,
            timedLobbyIntervalMin: 10,
            timedLobbyMaxPerGuest: 150,
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

    test('clamps reaction cooldown to a room-safe range', () => {
        expect(normalizeReactionTapCooldownMs('not-a-number')).toBe(DEFAULT_REACTION_TAP_COOLDOWN_MS);
        expect(normalizeReactionTapCooldownMs(120)).toBe(250);
        expect(normalizeReactionTapCooldownMs(9900)).toBe(5000);
    });

    test('builds replayable purchase celebrations with a fresh id and timestamp', () => {
        expect(buildPurchaseCelebrationReplay({
            id: 'gb_123',
            buyerName: 'Taylor',
            amountCents: 4200,
        }, 1234567890)).toEqual({
            id: 'replay_1234567890_gb_123',
            buyerName: 'Taylor',
            buyerAvatar: '',
            title: '',
            label: '',
            subtitle: '',
            points: 0,
            badgeAwarded: false,
            badgeLabel: MONEYBAGS_BADGE_LABEL,
            sourceProvider: '',
            rewardScope: '',
            amountCents: 4200,
            celebrationStyle: SUPPORT_CELEBRATION_STYLES.standard,
            createdAtMs: 1234567890,
        });
    });

    test('builds donation-backed audience offers from event credits', () => {
        const offer = buildAudienceSupportOffer({
            supportProvider: 'givebutter',
            supportUrl: 'https://givebutter.com/festival-kick-off-karaoke-party-y1ogra',
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

    test('builds a generalized donation CTA even when no reward offers are configured', () => {
        const offer = buildAudienceSupportOffer({
            supportProvider: 'givebutter',
            supportLabel: 'Support AAHF Festival',
            supportUrl: 'https://givebutter.com/festival-kick-off-karaoke-party-y1ogra',
            supportOffers: [],
            supportBadge: false,
        });

        expect(offer).toMatchObject({
            label: 'Support AAHF Festival',
            launchUrl: 'https://givebutter.com/festival-kick-off-karaoke-party-y1ogra',
            supportBadge: false,
        });
        expect(offer?.supportOffers).toEqual([]);
    });

    test('extracts Givebutter widget ids from embed snippets without losing the support link', () => {
        const offer = buildAudienceSupportOffer({
            supportProvider: 'givebutter',
            supportLabel: 'Support AAHF Festival',
            supportUrl: 'https://givebutter.com/festival-kick-off-karaoke-party-y1ogra',
            supportEmbedUrl: '<givebutter-widget id="LZoPWY"></givebutter-widget>',
            supportCampaignCode: 'festival-kick-off-karaoke-party-y1ogra',
        });

        expect(offer).toMatchObject({
            supportUrl: 'https://givebutter.com/festival-kick-off-karaoke-party-y1ogra',
            supportWidgetId: 'LZoPWY',
            hasEmbed: true,
        });
    });

    test('builds Givebutter launch URLs with donate path and amount', () => {
        expect(buildGivebutterSupportLaunchUrl('https://givebutter.com/festival-kick-off-karaoke-party-y1ogra', {
            amount: 10,
            fundCode: '12345',
        })).toBe('https://givebutter.com/festival-kick-off-karaoke-party-y1ogra/donate?amount=10&fund=12345');
    });
});
