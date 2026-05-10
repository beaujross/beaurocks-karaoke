import { describe, expect, test } from 'vitest';
import { SELF_SERVE_FORMATS } from '../../src/lib/selfServeKaraoke.js';
import { buildSelfServeQueueExplanation } from '../../src/lib/selfServeQueueExplanation.js';

describe('selfServeQueueExplanation', () => {
    test('calls out first-time boost in open stage rotation', () => {
        const explanation = buildSelfServeQueueExplanation({
            room: {
                queueSettings: {
                    rotation: 'round_robin',
                    firstTimeBoost: true,
                },
                selfServeMode: {
                    enabled: true,
                    format: SELF_SERVE_FORMATS.openStage,
                },
            },
            songs: [
                { singerUid: 'repeat', status: 'performed' },
                { singerUid: 'newcomer', status: 'requested' },
                { singerUid: 'repeat', status: 'requested' },
            ],
            queue: [
                { singerUid: 'newcomer', singerName: 'Taylor', status: 'requested' },
                { singerUid: 'repeat', singerName: 'Jordan', status: 'requested' },
            ],
            nextQueueSong: { singerUid: 'newcomer', singerName: 'Taylor', status: 'requested' },
        });

        expect(explanation.shortLabel).toBe('First-time boost');
        expect(explanation.detail).toContain('has not performed yet tonight');
    });

    test('explains the live Support Surge opening block before a verified leader is locked', () => {
        const explanation = buildSelfServeQueueExplanation({
            room: {
                queueSettings: {
                    rotation: 'round_robin',
                    firstTimeBoost: true,
                },
                selfServeMode: {
                    enabled: true,
                    format: SELF_SERVE_FORMATS.spotlightAuction,
                    paidPriorityEnabled: true,
                    auctionWindow: {
                        slotCount: 10,
                        remainingSlots: 8,
                    },
                },
            },
            songs: [],
            queue: [
                { singerUid: 'a', singerName: 'A', status: 'requested' },
                { singerUid: 'b', singerName: 'B', status: 'requested' },
            ],
            nextQueueSong: { singerUid: 'a', singerName: 'A', status: 'requested' },
        });

        expect(explanation).toEqual({
            shortLabel: 'Auction live',
            detail: 'Support Surge is running for the opening 10 slots, and any unmatched moments fall back to fair rotation.',
        });
    });

    test('explains when the Support Surge opening block is complete', () => {
        const explanation = buildSelfServeQueueExplanation({
            room: {
                selfServeMode: {
                    enabled: true,
                    format: SELF_SERVE_FORMATS.spotlightAuction,
                    paidPriorityEnabled: false,
                    auctionWindow: {
                        slotCount: 10,
                        remainingSlots: 0,
                        closed: true,
                    },
                },
            },
            songs: [],
            queue: [
                { singerUid: 'a', singerName: 'A', status: 'requested' },
                { singerUid: 'b', singerName: 'B', status: 'requested' },
            ],
            nextQueueSong: { singerUid: 'a', singerName: 'A', status: 'requested' },
        });

        expect(explanation).toEqual({
            shortLabel: 'Auction complete',
            detail: 'The Support Surge opening block is finished, so the room has returned to fair rotation.',
        });
    });

    test('detects auto-lock when only one singer is ready', () => {
        const explanation = buildSelfServeQueueExplanation({
            room: {
                selfServeMode: {
                    enabled: true,
                    format: SELF_SERVE_FORMATS.openStage,
                },
            },
            songs: [],
            queue: [{ singerUid: 'solo', singerName: 'Solo', status: 'requested' }],
            nextQueueSong: { singerUid: 'solo', singerName: 'Solo', status: 'requested' },
        });

        expect(explanation.shortLabel).toBe('Auto-locked');
    });
});
