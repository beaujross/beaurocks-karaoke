import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  buildIndexedYouTubeAutocompleteEntries,
  buildLocalLibraryAutocompleteEntries,
  matchesAutocompleteQuery,
} from '../../src/apps/Host/queueAutocomplete.js';

test('matchesAutocompleteQuery handles multi-token queries against sparse parts', () => {
  assert.equal(matchesAutocompleteQuery(['Dreams', null, 'Fleetwood Mac'], 'dreams fleetwood'), true);
  assert.equal(matchesAutocompleteQuery(['Dreams', null, 'Fleetwood Mac'], 'dreams valerie'), false);
});

test('buildLocalLibraryAutocompleteEntries tolerates sparse library records', () => {
  const matches = buildLocalLibraryAutocompleteEntries([
    {
      id: 'local_1',
      title: 'Dreams',
      artist: 'Fleetwood Mac',
      url: 'https://media.example.com/dreams.mp3',
    },
    {
      id: 'local_2',
      fileName: 'valerie-alt-cut.mp3',
      url: 'https://media.example.com/valerie.mp3',
    },
    {
      id: 'local_3',
      url: 'https://media.example.com/untitled.mp3',
    },
  ], 'valerie alt');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'local_2');
  assert.equal(matches[0].trackName, 'valerie-alt-cut.mp3');
  assert.equal(matches[0].artistName, '');
});

test('buildIndexedYouTubeAutocompleteEntries tolerates partial index rows', () => {
  const matches = buildIndexedYouTubeAutocompleteEntries([
    {
      videoId: 'yt_1',
      trackName: 'Dreams Karaoke Version',
      artistName: 'Venue Backing Library',
      url: 'https://www.youtube.com/watch?v=yt_1',
    },
    {
      videoId: 'yt_2',
      title: 'Valerie Karaoke',
      channelTitle: 'Open Mic Tracks',
      url: 'https://www.youtube.com/watch?v=yt_2',
    },
    {
      videoId: 'yt_3',
      url: 'https://www.youtube.com/watch?v=yt_3',
    },
  ], 'valerie open mic');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].videoId, 'yt_2');
  assert.equal(matches[0].trackName, 'Valerie Karaoke');
  assert.equal(matches[0].artistName, 'Open Mic Tracks');
});
