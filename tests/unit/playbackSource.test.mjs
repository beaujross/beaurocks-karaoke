import assert from 'node:assert/strict';
import {
    normalizeBackingChoice,
    resolveStageMediaUrl,
    resolveQueuePlayback,
    isBackingPlaying,
    getBackingSourceLabel
} from '../../src/lib/playbackSource.js';

const run = () => {
    const explicitMedia = normalizeBackingChoice({
        mediaUrl: ' https://www.youtube.com/watch?v=abc12345 ',
        appleMusicId: '12345'
    });
    assert.equal(explicitMedia.mediaUrl, 'https://www.youtube.com/watch?v=abc12345');
    assert.equal(explicitMedia.appleMusicId, '');
    assert.equal(explicitMedia.usesAppleBacking, false);
    assert.equal(explicitMedia.youtubeId, 'abc12345');
    assert.equal(explicitMedia.isYouTube, true);

    const appleOnly = normalizeBackingChoice({
        mediaUrl: '',
        appleMusicId: '12345'
    });
    assert.equal(appleOnly.mediaUrl, '');
    assert.equal(appleOnly.appleMusicId, '12345');
    assert.equal(appleOnly.usesAppleBacking, true);
    assert.equal(appleOnly.isYouTube, false);

    assert.equal(
        resolveStageMediaUrl({ mediaUrl: '  https://example.com/a.mp4  ' }, { mediaUrl: 'https://fallback.example.com/b.mp4' }),
        'https://example.com/a.mp4'
    );
    assert.equal(
        resolveStageMediaUrl(null, { mediaUrl: '  https://fallback.example.com/b.mp4  ' }),
        'https://fallback.example.com/b.mp4'
    );

    const queueApple = resolveQueuePlayback({ mediaUrl: '', appleMusicId: '777' }, true);
    assert.equal(queueApple.usesAppleBacking, true);
    assert.equal(queueApple.autoStartMedia, true);

    const queueMediaNoAuto = resolveQueuePlayback({ mediaUrl: 'https://example.com/a.mp4', appleMusicId: '' }, false);
    assert.equal(queueMediaNoAuto.hasMedia, true);
    assert.equal(queueMediaNoAuto.autoStartMedia, false);

    const queueYoutubeWins = resolveQueuePlayback({
        mediaUrl: 'https://youtu.be/abc12345',
        appleMusicId: 'should_be_ignored'
    }, true);
    assert.equal(queueYoutubeWins.usesAppleBacking, false);
    assert.equal(queueYoutubeWins.appleMusicId, '');
    assert.equal(queueYoutubeWins.isYouTube, true);
    assert.equal(queueYoutubeWins.hasMedia, true);
    assert.equal(queueYoutubeWins.autoStartMedia, true);

    assert.equal(
        isBackingPlaying({
            usesAppleBacking: true,
            room: { appleMusicPlayback: { status: 'playing' } },
            appleMusicPlaying: false
        }),
        true
    );
    assert.equal(
        isBackingPlaying({
            usesAppleBacking: false,
            room: { videoPlaying: true }
        }),
        true
    );
    assert.equal(
        isBackingPlaying({
            usesAppleBacking: false,
            room: {
                videoPlaying: false,
                appleMusicPlayback: { status: 'playing' }
            },
            appleMusicPlaying: true
        }),
        false
    );
    assert.equal(
        isBackingPlaying({
            usesAppleBacking: true,
            room: {
                videoPlaying: true,
                appleMusicPlayback: { status: 'paused' }
            },
            appleMusicPlaying: false
        }),
        false
    );

    assert.equal(getBackingSourceLabel({ usesAppleBacking: true, mediaUrl: '' }), 'Apple Music');
    assert.equal(getBackingSourceLabel({ usesAppleBacking: false, mediaUrl: 'https://youtu.be/abc12345' }), 'YouTube');
    assert.equal(getBackingSourceLabel({ usesAppleBacking: false, mediaUrl: 'https://example.com/a.mp4' }), 'Local');
    assert.equal(getBackingSourceLabel({ usesAppleBacking: false, mediaUrl: '' }), 'No backing');

    console.log('playbackSource tests passed');
};

run();
