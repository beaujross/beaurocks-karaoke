import { describe, expect, test } from 'vitest';
import {
    buildSelfServeDecisionPresentation,
    buildSelfServeModePresentation,
    buildSelfServeTransitionMoment,
    SELF_SERVE_FORMATS,
    SELF_SERVE_PRIMARY_FORMAT_ORDER,
    SELF_SERVE_V1_FORMAT_ORDER,
    buildSelfServeModeState,
    buildSelfServeQueueFaceOffWindow,
    buildSelfServeRulesCard,
    buildSelfServeTvPreviewOverlay,
    consumeSelfServeAuctionSlot,
    endSelfServeAuctionWindow,
    getSelfServeFormatDefinition,
    getSelfServeAuctionWindow,
    getSelfServeLaunchOptions,
    isSelfServeAuctionWindowLive,
    normalizeSelfServeFormat,
} from '../../src/lib/selfServeKaraoke.js';

describe('selfServeKaraoke', () => {
    test('normalizes unknown format values back to open stage', () => {
        expect(normalizeSelfServeFormat('')).toBe(SELF_SERVE_FORMATS.openStage);
        expect(normalizeSelfServeFormat('not-real')).toBe(SELF_SERVE_FORMATS.openStage);
    });

    test('normalizes legacy spotlight auction labels and new support surge aliases', () => {
        expect(normalizeSelfServeFormat('spotlight-auction')).toBe(SELF_SERVE_FORMATS.spotlightAuction);
        expect(normalizeSelfServeFormat('spotlight auction')).toBe(SELF_SERVE_FORMATS.spotlightAuction);
        expect(normalizeSelfServeFormat('support surge')).toBe(SELF_SERVE_FORMATS.spotlightAuction);
    });

    test('returns launch options in the expected host-facing order', () => {
        expect(getSelfServeLaunchOptions().map((entry) => entry.id)).toEqual(SELF_SERVE_V1_FORMAT_ORDER);
        expect(getSelfServeLaunchOptions().map((entry) => entry.launchLabel)).toEqual([
            'BeauRocks Open Stage',
            'BeauRocks Support Surge',
        ]);
        expect(getSelfServeLaunchOptions({ includeAdvanced: true }).map((entry) => entry.id)).toEqual(SELF_SERVE_PRIMARY_FORMAT_ORDER);
    });

    test('builds the open stage rules card with safe recovery actions', () => {
        expect(buildSelfServeRulesCard(SELF_SERVE_FORMATS.openStage)).toEqual({
            id: SELF_SERVE_FORMATS.openStage,
            launchLabel: 'BeauRocks Open Stage',
            shortLabel: 'Open Stage',
            tagline: 'Fair self-serve karaoke with crowd-picked song moments.',
            rulesSummary: [
                'Singers rotate fairly.',
                "The crowd can pick from a singer's ready songs.",
                'Money does not change who wins the night.',
            ],
            recoveryActions: [
                'Preview Before Go Live',
                'Pause New Entries',
                'Return To Normal Karaoke',
            ],
            fallbackSummary: 'If nobody votes, the room auto-resolves safely. If only one singer is ready, they auto-lock.',
            supportsPaidPriority: false,
            supportsAuction: false,
        });
    });

    test('support surge exposes paid-priority and dispute-relevant controls', () => {
        const definition = getSelfServeFormatDefinition(SELF_SERVE_FORMATS.spotlightAuction);
        const card = buildSelfServeRulesCard(SELF_SERVE_FORMATS.spotlightAuction);

        expect(definition.internalPreset).toBe('fundraiser_auction');
        expect(card.supportsPaidPriority).toBe(true);
        expect(card.supportsAuction).toBe(true);
        expect(card.recoveryActions).toContain('Disable Paid Priority');
        expect(card.recoveryActions).toContain('End Sponsored Block');
        expect(card.rulesSummary[0]).toBe('Top verified donors claim the opening showcase slots.');
    });

    test('builds a stable room state payload for live self-serve mode', () => {
        expect(buildSelfServeModeState(SELF_SERVE_FORMATS.spotlightAuction, {
            startedAtMs: 123,
            pauseNewEntries: true,
        })).toEqual({
            enabled: true,
            format: SELF_SERVE_FORMATS.spotlightAuction,
            internalPreset: 'fundraiser_auction',
            launchLabel: 'BeauRocks Support Surge',
            shortLabel: 'Support Surge',
            phase: 'live',
            preview: false,
            canReturnToNormal: true,
            pauseNewEntries: true,
            paidPriorityEnabled: true,
            startedAtMs: 123,
            auctionWindow: {
                scopeType: 'opening_slots',
                slotCount: 10,
                remainingSlots: 10,
                priorityAssignments: 0,
                closed: false,
                closedAtMs: 0,
                closeReason: '',
                lastAssignedSongId: '',
                lastAssignedAtMs: 0,
            },
        });
    });

    test('builds concise room-state presentation copy for open stage and support surge', () => {
        expect(buildSelfServeModePresentation(buildSelfServeModeState(SELF_SERVE_FORMATS.openStage))).toMatchObject({
            stateKey: 'stage_open',
            badgeLabel: 'Stage Open',
            heroLabel: 'Scan In. Step Up. Sing.',
            roomFlowLabel: 'Fair self-serve queue',
        });

        expect(buildSelfServeModePresentation(buildSelfServeModeState(SELF_SERVE_FORMATS.spotlightAuction, {
            auctionWindow: {
                slotCount: 10,
                remainingSlots: 4,
            },
        }))).toMatchObject({
            stateKey: 'auction_live',
            badgeLabel: 'Surge Live',
            heroLabel: 'Bid, Join, Sing.',
            helper: '4 of 10 priority slots still available.',
            supportCtaLabel: 'Bid For The Next Showcase Slot',
        });
    });

    test('consumes spotlight auction slots and falls back to fair queue when exhausted', () => {
        const liveMode = buildSelfServeModeState(SELF_SERVE_FORMATS.spotlightAuction, {
            auctionWindow: {
                slotCount: 2,
                remainingSlots: 2,
            },
        });

        const afterFirstLock = consumeSelfServeAuctionSlot(liveMode, {
            songId: 'song_a',
            nowMs: 1000,
        });
        expect(isSelfServeAuctionWindowLive(afterFirstLock)).toBe(true);
        expect(getSelfServeAuctionWindow(afterFirstLock)).toMatchObject({
            slotCount: 2,
            remainingSlots: 1,
            priorityAssignments: 1,
            lastAssignedSongId: 'song_a',
            lastAssignedAtMs: 1000,
            closed: false,
        });

        const afterSecondLock = consumeSelfServeAuctionSlot(afterFirstLock, {
            songId: 'song_b',
            nowMs: 2000,
        });
        expect(isSelfServeAuctionWindowLive(afterSecondLock)).toBe(false);
        expect(afterSecondLock.paidPriorityEnabled).toBe(false);
        expect(afterSecondLock.phase).toBe('fair_queue');
        expect(getSelfServeAuctionWindow(afterSecondLock)).toMatchObject({
            remainingSlots: 0,
            priorityAssignments: 2,
            closed: true,
            closedAtMs: 2000,
            closeReason: 'window_exhausted',
            lastAssignedSongId: 'song_b',
        });
        expect(buildSelfServeModePresentation(afterSecondLock)).toMatchObject({
            stateKey: 'auction_complete',
            badgeLabel: 'Fair Queue Live',
            roomFlowLabel: 'Fair self-serve queue',
        });
        expect(buildSelfServeTransitionMoment(afterSecondLock, {
            songs: [{ id: 'song_b', songTitle: 'Since U Been Gone' }],
            nowMs: 3000,
        })).toMatchObject({
            badgeLabel: 'Fair Queue Live',
            title: 'Opening block complete',
        });
    });

    test('builds short-lived transition moments for winner-locked states', () => {
        const openStageMoment = buildSelfServeTransitionMoment({
            ...buildSelfServeModeState(SELF_SERVE_FORMATS.openStage),
            phase: 'winner_locked',
            lastCrowdWinnerSongId: 'song_a',
            lastCrowdVoteResolvedAtMs: 1000,
        }, {
            songs: [{ id: 'song_a', songTitle: 'Mr. Brightside' }],
            nowMs: 2000,
        });

        expect(openStageMoment).toMatchObject({
            badgeLabel: 'Crowd Pick Locked',
            title: 'Next spotlight locked',
            detail: 'Mr. Brightside is on deck now.',
            songTitle: 'Mr. Brightside',
        });

        const auctionMoment = buildSelfServeTransitionMoment({
            ...buildSelfServeModeState(SELF_SERVE_FORMATS.spotlightAuction),
            phase: 'auction_locked',
            lastCrowdWinnerSongId: 'song_b',
            lastCrowdVoteResolvedAtMs: 1000,
            auctionWindow: {
                slotCount: 10,
                remainingSlots: 9,
            },
        }, {
            songs: [{ id: 'song_b', songTitle: 'Toxic' }],
            nowMs: 2000,
        });

        expect(auctionMoment).toMatchObject({
            badgeLabel: 'Showcase Locked',
            title: 'Next showcase locked',
            detail: 'Toxic just won the next showcase slot.',
            songTitle: 'Toxic',
        });
    });

    test('builds concise self-serve vote presentation copy', () => {
        expect(buildSelfServeDecisionPresentation({
            origin: 'self_serve_open_stage_auto',
        }, {
            timeLeftSec: 12,
            totalVotes: 9,
        })).toMatchObject({
            eyebrow: 'BeauRocks Open Stage Crowd Pick',
            badgeLabel: 'Spotlight Vote',
            decisionLabel: 'Pick the next spotlight',
        });

        expect(buildSelfServeDecisionPresentation({
            origin: 'self_serve_spotlight_auction_auto',
        }, {
            timeLeftSec: 8,
            totalVotes: 4,
        })).toMatchObject({
            eyebrow: 'BeauRocks Support Surge',
            badgeLabel: 'Showcase Vote',
            decisionLabel: 'Pick the next showcase',
        });
    });

    test('can end the sponsored block manually without mutating unrelated self-serve state', () => {
        const liveMode = buildSelfServeModeState(SELF_SERVE_FORMATS.spotlightAuction, {
            pauseNewEntries: true,
            auctionWindow: {
                slotCount: 5,
                remainingSlots: 3,
            },
        });

        expect(endSelfServeAuctionWindow(liveMode, {
            nowMs: 5000,
            closeReason: 'manual_end',
        })).toMatchObject({
            pauseNewEntries: true,
            paidPriorityEnabled: false,
            phase: 'fair_queue',
            auctionWindow: {
                slotCount: 5,
                remainingSlots: 0,
                closed: true,
                closedAtMs: 5000,
                closeReason: 'manual_end',
            },
        });
    });

    test('builds a TV preview overlay from format definitions', () => {
        expect(buildSelfServeTvPreviewOverlay(SELF_SERVE_FORMATS.openStage, {
            durationSec: 12,
            startedAtMs: 456,
        })).toMatchObject({
            active: true,
            type: 'announcement',
            takeoverScene: 'announcement',
            accentTheme: 'cyan',
            headline: 'BeauRocks Open Stage',
            modeKey: 'self_serve_open_stage',
            durationSec: 12,
            startedAtMs: 456,
        });
    });

    test('builds a branded self-serve queue face-off window payload', () => {
        expect(buildSelfServeQueueFaceOffWindow({
            firstSong: { id: 'song_a', songTitle: 'Mr. Brightside', artist: 'The Killers', singerName: 'Jamie', albumArtUrl: 'https://example.test/a.jpg', duration: 222 },
            secondSong: { id: 'song_b', songTitle: 'Since U Been Gone', artist: 'Kelly Clarkson', singerName: 'Alex', albumArtUrl: 'https://example.test/b.jpg', duration: 188 },
            openedAtMs: 999,
            durationSec: 18,
        })).toMatchObject({
            active: true,
            subjectType: 'queue_faceoff',
            governanceMode: 'crowd_vote',
            releasePolicy: 'auto_flight_winner',
            origin: 'self_serve_open_stage_auto',
            selfServeFormat: SELF_SERVE_FORMATS.openStage,
            prompt: 'Crowd pick the next spotlight.',
            openedAtMs: 999,
            closesAtMs: 18999,
            choiceLabels: {
                slot_scene: 'Mr. Brightside',
                keep_queue_moving: 'Since U Been Gone',
            },
            choiceDetails: {
                slot_scene: 'Jamie',
                keep_queue_moving: 'Alex',
            },
            choiceSublines: {
                slot_scene: 'The Killers - 3:42',
                keep_queue_moving: 'Kelly Clarkson - 3:08',
            },
            choiceArtworkUrls: {
                slot_scene: 'https://example.test/a.jpg',
                keep_queue_moving: 'https://example.test/b.jpg',
            },
            choiceMetadata: {
                slot_scene: { durationLabel: '3:42', artist: 'The Killers', singerName: 'Jamie' },
                keep_queue_moving: { durationLabel: '3:08', artist: 'Kelly Clarkson', singerName: 'Alex' },
            },
        });
    });
});
