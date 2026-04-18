import { describe, expect, test } from 'vitest';
import {
    YOUTUBE_PLAYBACK_STATUSES,
    getYouTubeEmbedCacheStatus,
    isYouTubeEmbeddable,
    normalizeYouTubePlaybackState
} from '../../src/lib/youtubePlaybackStatus.js';

describe('youtubePlaybackStatus', () => {
    test('marks embeddable tracks as playable', () => {
        const result = normalizeYouTubePlaybackState({
            embeddable: true,
            uploadStatus: 'processed',
            privacyStatus: 'public'
        });

        expect(result.playable).toBe(true);
        expect(result.backingAudioOnly).toBe(false);
        expect(result.youtubePlaybackStatus).toBe(YOUTUBE_PLAYBACK_STATUSES.embeddable);
        expect(isYouTubeEmbeddable(result)).toBe(true);
        expect(getYouTubeEmbedCacheStatus(result)).toBe('ok');
    });

    test('marks non-embeddable tracks for external playback', () => {
        const result = normalizeYouTubePlaybackState({
            embeddable: false,
            uploadStatus: 'processed',
            privacyStatus: 'public'
        });

        expect(result.playable).toBe(false);
        expect(result.backingAudioOnly).toBe(true);
        expect(result.youtubePlaybackStatus).toBe(YOUTUBE_PLAYBACK_STATUSES.notEmbeddable);
        expect(isYouTubeEmbeddable(result)).toBe(false);
        expect(getYouTubeEmbedCacheStatus(result)).toBe('fail');
    });

    test('treats private or unprocessed tracks as not embeddable', () => {
        const privateResult = normalizeYouTubePlaybackState({
            embeddable: true,
            uploadStatus: 'processed',
            privacyStatus: 'private'
        });
        const processingResult = normalizeYouTubePlaybackState({
            embeddable: true,
            uploadStatus: 'processing',
            privacyStatus: 'public'
        });

        expect(privateResult.youtubePlaybackStatus).toBe(YOUTUBE_PLAYBACK_STATUSES.notEmbeddable);
        expect(processingResult.youtubePlaybackStatus).toBe(YOUTUBE_PLAYBACK_STATUSES.notEmbeddable);
    });
});
