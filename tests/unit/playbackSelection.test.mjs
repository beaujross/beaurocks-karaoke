import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLAYBACK_SELECTION_MODES,
  SONG_IDENTITY_STATUSES,
  getContentSourceCapabilities,
  getContentSourceMeta,
  getQueuePlaybackSelection,
  normalizeContentSource,
  normalizePlaybackSelectionMode,
} from '../../src/lib/playbackSelection.js';

test('normalizes provider aliases into one presentation vocabulary', () => {
  assert.equal(normalizeContentSource('itunes'), 'apple_music');
  assert.equal(normalizeContentSource('browse_catalog'), 'youtube');
  assert.equal(normalizeContentSource('custom'), 'local');
  assert.equal(getContentSourceMeta('youtube').label, 'YouTube');
  assert.match(getContentSourceMeta('youtube').className, /red/);
});

test('keeps provider availability separate from future partner capabilities', () => {
  assert.equal(getContentSourceCapabilities('youtube').integrationStatus, 'available');
  assert.equal(getContentSourceCapabilities('youtube').karaokeBacking, true);
  assert.equal(getContentSourceCapabilities('apple').lyricsAccess, 'metadata_only');
  assert.equal(getContentSourceCapabilities('karafun').integrationStatus, 'planned_partner');
  assert.equal(getContentSourceCapabilities('karafun').timedLyrics, true);
});

test('keeps a routine resolved song request visually source-neutral', () => {
  const selection = getQueuePlaybackSelection({
    songId: 'song_1',
    trackSource: 'youtube',
    mediaUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    mediaResolutionStatus: 'catalog_ready',
    resolutionLayer: 'global_catalog',
  });

  assert.equal(selection.mode, PLAYBACK_SELECTION_MODES.songOnly);
  assert.equal(selection.showSource, false);
  assert.equal(selection.label, 'Song request');
});

test('calls out a specific audience-selected backing and its provider', () => {
  const selection = getQueuePlaybackSelection({
    songId: 'song_1',
    trackSource: 'youtube',
    mediaUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    mediaResolutionStatus: 'audience_selected',
    resolutionLayer: 'audience_youtube_search',
  });

  assert.equal(selection.mode, PLAYBACK_SELECTION_MODES.specificVersion);
  assert.equal(selection.showSource, true);
  assert.equal(selection.source, 'youtube');
  assert.equal(selection.label, 'YouTube pick');
});

test('treats an Apple catalog identity without chosen playback as song-only', () => {
  const selection = getQueuePlaybackSelection({
    songId: 'song_1',
    appleMusicId: '12345',
    trackSource: 'apple_music',
    mediaResolutionStatus: 'pending_youtube_match',
    resolutionLayer: 'manual_review',
  });

  assert.equal(selection.mode, PLAYBACK_SELECTION_MODES.songOnly);
  assert.equal(selection.showSource, false);
});

test('keeps unmatched room uploads playable without forcing a song identity', () => {
  const selection = getQueuePlaybackSelection({
    songId: null,
    songIdentityStatus: SONG_IDENTITY_STATUSES.unmatched,
    trackSource: 'custom',
    mediaUrl: 'https://storage.example.test/party-intro.mp3',
    submittedVia: 'local_library',
  });

  assert.equal(
    normalizePlaybackSelectionMode('', {
      songIdentityStatus: SONG_IDENTITY_STATUSES.unmatched,
      trackSource: 'custom',
    }),
    PLAYBACK_SELECTION_MODES.customMedia
  );
  assert.equal(selection.mode, PLAYBACK_SELECTION_MODES.customMedia);
  assert.equal(selection.showSource, true);
  assert.equal(selection.sourceMeta.label, 'Room Upload');
});
