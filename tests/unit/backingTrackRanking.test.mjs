import { describe, expect, test } from 'vitest';
import {
    buildBackingTrackCandidateId,
    normalizeBackingCandidateTelemetry,
    normalizeCanonicalSongIdentity,
    rankBackingTrackCandidates,
    scoreBackingTrackCandidate
} from '../../src/lib/backingTrackRanking.js';

describe('backingTrackRanking', () => {
    test('ties YouTube backing candidates to a canonical Apple Music song identity', () => {
        const song = normalizeCanonicalSongIdentity({
            appleMusicId: '1440857781',
            title: 'September',
            artist: 'Earth, Wind & Fire'
        });
        const candidateId = buildBackingTrackCandidateId({
            canonicalSongId: song.canonicalSongId,
            provider: 'youtube',
            videoId: 'abc123'
        });

        expect(song).toMatchObject({
            canonicalSongId: 'apple:1440857781',
            appleMusicId: '1440857781'
        });
        expect(candidateId).toBe('apple-1440857781__youtube__abc123');
    });

    test('weights host and co-host feedback above raw YouTube view counts', () => {
        const ranked = rankBackingTrackCandidates([
            {
                canonicalSongId: 'apple:1',
                videoId: 'huge-views',
                embeddable: true,
                viewCount: 80_000_000,
                telemetry: { audienceUpvotes: 5 }
            },
            {
                canonicalSongId: 'apple:1',
                videoId: 'host-liked',
                embeddable: true,
                viewCount: 8_000,
                titleIntentMatch: 0.9,
                telemetry: { hostUpvotes: 1, coHostUpvotes: 1, completionCount: 2, usageCount: 2 }
            }
        ], { canonicalSongId: 'apple:1' });

        expect(ranked.map((candidate) => candidate.providerTrackId)).toEqual(['host-liked', 'huge-views']);
        expect(ranked[0].rankingScore).toBeGreaterThan(ranked[1].rankingScore);
    });

    test('penalizes non-embeddable tracks even when other signals look good', () => {
        const embeddableScore = scoreBackingTrackCandidate({
            embeddable: true,
            titleIntentMatch: 0.7,
            telemetry: { hostUpvotes: 1 }
        });
        const blockedScore = scoreBackingTrackCandidate({
            embeddable: false,
            titleIntentMatch: 1,
            viewCount: 200_000_000,
            telemetry: { hostUpvotes: 2, completionCount: 4, usageCount: 4 }
        });

        expect(embeddableScore).toBeGreaterThan(blockedScore);
    });

    test('normalizes telemetry aliases from stored aggregate fields', () => {
        expect(normalizeBackingCandidateTelemetry({
            hostVotes: { up: 2, down: 1 },
            coHostVotes: { up: 1 },
            audienceVotes: { up: 12, down: 3 },
            plays: 4,
            completedCount: 3,
            skips: 1
        })).toEqual({
            hostUpvotes: 2,
            hostDownvotes: 1,
            coHostUpvotes: 1,
            coHostDownvotes: 0,
            audienceUpvotes: 12,
            audienceDownvotes: 3,
            usageCount: 4,
            completionCount: 3,
            skipCount: 1
        });
    });
});
