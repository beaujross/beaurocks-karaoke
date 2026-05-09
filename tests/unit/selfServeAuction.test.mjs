import { describe, expect, test } from 'vitest';
import { getSelfServeAuctionLead, getSelfServeAuctionState } from '../../src/lib/selfServeAuction.js';

describe('selfServeAuction', () => {
    test('normalizes the server-auth Spotlight Auction projection', () => {
        const auctionState = getSelfServeAuctionState({
            auctionState: {
                active: true,
                syncedAtMs: 1700000010000,
                totalQualifiedSupporters: 2,
                summary: 'Bailey leads with $25.00',
                leaderboard: [
                    {
                        uid: 'buyer-b',
                        singerName: 'Bailey',
                        songId: 'song_b',
                        songTitle: 'Since U Been Gone',
                        amountCents: 2500,
                        eventCount: 2,
                        qualifiedAtMs: 1700000008000,
                        lastPurchaseAtMs: 1700000009000,
                        queueIndex: 1,
                        sourceProvider: 'stripe',
                    },
                    {
                        uid: 'buyer-a',
                        singerName: 'Alex',
                        songId: 'song_a',
                        songTitle: 'Mr. Brightside',
                        amountCents: 1200,
                        eventCount: 1,
                        qualifiedAtMs: 1700000005000,
                        lastPurchaseAtMs: 1700000005000,
                        queueIndex: 0,
                        sourceProvider: 'givebutter',
                    },
                ],
            },
        });

        expect(auctionState.summary).toBe('Bailey leads with $25.00');
        expect(auctionState.leaderboard.map((entry) => entry.songId)).toEqual(['song_b', 'song_a']);
        expect(getSelfServeAuctionLead({ auctionState })?.amountCents).toBe(2500);
    });

    test('drops malformed leaderboard entries and provides a null lead when none qualify', () => {
        const auctionState = getSelfServeAuctionState({
            auctionState: {
                active: true,
                leaderboard: [
                    { uid: 'buyer-a', songTitle: 'Missing song id', amountCents: 1000 },
                    { songId: 'song_b', singerName: 'Missing uid', amountCents: 1000 },
                ],
            },
        });

        expect(auctionState.leaderboard).toEqual([]);
        expect(getSelfServeAuctionLead({ auctionState })).toBe(null);
    });
});
