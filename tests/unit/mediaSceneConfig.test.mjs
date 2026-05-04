import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  buildMediaSceneSoundtrackPayload,
  getMediaSceneAllowedReactionTypes,
  normalizeMediaSceneAudienceReactionMode,
  normalizeMediaSceneSoundtrackConfig,
} from '../../src/lib/mediaSceneConfig.js';
import { BG_TRACK_OPTIONS } from '../../src/lib/bgTrackOptions.js';

test('media scene reaction modes normalize to the narrow clap-vote lane', () => {
  assert.equal(normalizeMediaSceneAudienceReactionMode(''), 'off');
  assert.equal(normalizeMediaSceneAudienceReactionMode('free_standard'), 'free_clap');
  assert.equal(normalizeMediaSceneAudienceReactionMode('blossom_only'), 'free_clap');
  assert.deepEqual(getMediaSceneAllowedReactionTypes('off'), []);
  assert.deepEqual(getMediaSceneAllowedReactionTypes('free_all'), ['clap']);
});

test('media scene soundtrack config normalizes youtube, apple music, and bg track inputs', () => {
  const youtube = normalizeMediaSceneSoundtrackConfig({
    soundtrackSourceType: 'youtube',
    soundtrackInputValue: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    soundtrackLabel: 'Clip bed',
  });
  assert.equal(youtube.soundtrackYoutubeId, 'dQw4w9WgXcQ');
  assert.equal(youtube.soundtrackMediaUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  const apple = normalizeMediaSceneSoundtrackConfig({
    soundtrackSourceType: 'apple_music',
    soundtrackInputValue: 'https://music.apple.com/us/song/example/1712345678',
  });
  assert.equal(apple.soundtrackAppleMusicId, '1712345678');

  const firstBgTrack = BG_TRACK_OPTIONS[0];
  assert.ok(firstBgTrack);
  const bgTrack = normalizeMediaSceneSoundtrackConfig({
    soundtrackSourceType: 'bg_track',
    soundtrackInputValue: firstBgTrack.id,
  });
  assert.equal(bgTrack.soundtrackSourceType, 'bg_track');
  assert.equal(bgTrack.soundtrackBgTrackId, firstBgTrack.id);
  assert.equal(bgTrack.soundtrackMediaUrl, firstBgTrack.url);
});

test('media scene soundtrack payload only builds when a valid source is configured', () => {
  assert.equal(buildMediaSceneSoundtrackPayload({ soundtrackSourceType: '' }, 1000, 'Scene', 20), null);

  const payload = buildMediaSceneSoundtrackPayload({
    soundtrackSourceType: 'manual_external',
    soundtrackInputValue: 'https://cdn.example.com/scene-bed.mp3',
    soundtrackLabel: 'Sponsor Bed',
  }, 2500, 'Scene', 45);

  assert.equal(payload.sourceType, 'manual_external');
  assert.equal(payload.label, 'Sponsor Bed');
  assert.equal(payload.mediaUrl, 'https://cdn.example.com/scene-bed.mp3');
  assert.equal(payload.startedAtMs, 2500);
  assert.equal(payload.durationSec, 45);
});
