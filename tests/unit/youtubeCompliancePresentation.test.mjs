import { describe, expect, test } from 'vitest';
import {
    getYouTubePlaybackPresentation,
    getYouTubeProvenancePresentation,
    getYouTubeVerificationFreshness,
    isYouTubeTvReady,
} from '../../src/apps/Host/youtubeCompliancePresentation.js';

describe('YouTube compliance presentation', () => {
    test('requires affirmative playable and embeddable evidence for Public TV', () => {
        expect(isYouTubeTvReady({
            playable: true,
            embeddable: true,
            youtubePlaybackStatus: 'embeddable',
        })).toBe(true);
        expect(isYouTubeTvReady({ playable: true })).toBe(false);
        expect(isYouTubeTvReady({
            playable: true,
            embeddable: false,
            youtubePlaybackStatus: 'not_embeddable',
        })).toBe(false);
    });

    test('preserves non-embeddable tracks as external or review actions', () => {
        const external = getYouTubePlaybackPresentation({
            embeddable: false,
            youtubePlaybackStatus: 'not_embeddable',
        });
        const unknown = getYouTubePlaybackPresentation({});

        expect(external.state).toBe('external');
        expect(external.label).toBe('External only');
        expect(external.actionLabel).toBe('Add for Review');
        expect(unknown.state).toBe('unknown');
        expect(unknown.label).toBe('Needs verification');
    });

    test('labels the observable search and reuse provenance', () => {
        expect(getYouTubeProvenancePresentation({ sourceDiscovery: 'live_youtube_search' }).label)
            .toBe('Live YouTube search');
        expect(getYouTubeProvenancePresentation({ sourceDiscovery: 'server_cache' }).label)
            .toBe('Cached YouTube search');
        expect(getYouTubeProvenancePresentation({ sourceDiscovery: 'playlist_index' }).label)
            .toBe('Playlist index');
        expect(getYouTubeProvenancePresentation({ sourceDiscovery: 'host_paste' }).label)
            .toBe('Host-provided URL');
    });

    test('shows verification freshness and expiry without overstating readiness', () => {
        const atMs = Date.UTC(2026, 7, 10, 12, 0, 0);
        const ready = {
            playable: true,
            embeddable: true,
            youtubePlaybackStatus: 'embeddable',
            lastValidatedAtMs: atMs - (2 * 24 * 60 * 60 * 1000),
            expiresAtMs: atMs + (2 * 24 * 60 * 60 * 1000),
        };

        expect(getYouTubeVerificationFreshness(ready, atMs)).toBe('Verified 2 days ago');
        expect(getYouTubeVerificationFreshness({ ...ready, expiresAtMs: atMs }, atMs)).toBe('Refresh due');
        expect(getYouTubeVerificationFreshness({ playable: true }, atMs)).toBe('Needs verification');
    });
});
