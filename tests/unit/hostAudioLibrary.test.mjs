import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  buildCustomBgTrackOption,
  buildHostAudioUploadTrackId,
  buildRoomBgTrackOptions,
  getHostAudioLibraryItemLabel,
  normalizeHostAudioLibraryCategory,
  normalizeHostAudioLibraryItemMetadata,
  normalizeHostAudioMomentCueId,
} from '../../src/lib/hostAudioLibrary.js';
import { BG_TRACK_OPTIONS } from '../../src/lib/bgTrackOptions.js';

test('host audio library metadata normalizes lane-specific fields', () => {
  assert.equal(normalizeHostAudioLibraryCategory('SFX'), 'sfx');
  assert.equal(normalizeHostAudioLibraryCategory('bg'), 'bg');
  assert.equal(normalizeHostAudioLibraryCategory('weird'), '');
  assert.equal(normalizeHostAudioMomentCueId('Celebrate'), 'celebrate');
  assert.equal(normalizeHostAudioMomentCueId('not_real'), '');

  assert.deepEqual(
    normalizeHostAudioLibraryItemMetadata({
      audioLibraryCategory: 'sfx',
      soundboardLabel: ' Airhorn 2 ',
      hostMomentCueId: 'Hype',
      includeOnSoundboard: true,
      bgAutoEligible: false,
    }),
    {
      audioLibraryCategory: 'sfx',
      soundboardLabel: 'Airhorn 2',
      hostMomentCueId: 'hype',
      includeOnSoundboard: true,
      bgAutoEligible: false,
    }
  );

  assert.deepEqual(
    normalizeHostAudioLibraryItemMetadata({
      audioLibraryCategory: 'bg',
      soundboardLabel: ' Lobby ',
      hostMomentCueId: 'celebrate',
      includeOnSoundboard: true,
      bgAutoEligible: false,
    }),
    {
      audioLibraryCategory: 'bg',
      soundboardLabel: 'Lobby',
      hostMomentCueId: '',
      includeOnSoundboard: false,
      bgAutoEligible: false,
    }
  );
});

test('custom background tracks are appended after built-ins with stable metadata', () => {
  const upload = {
    id: 'room_upload_123',
    title: 'Cash Cannon Loop',
    url: 'https://example.com/cash-cannon.mp3',
    audioLibraryCategory: 'bg',
    bgAutoEligible: false,
  };
  const customTrack = buildCustomBgTrackOption(upload, 0);

  assert.equal(buildHostAudioUploadTrackId(upload), 'upload_room_upload_123');
  assert.equal(getHostAudioLibraryItemLabel(upload), 'Cash Cannon Loop');
  assert.equal(customTrack?.id, 'upload_room_upload_123');
  assert.equal(customTrack?.name, 'Cash Cannon Loop');
  assert.equal(customTrack?.sourceType, 'upload');
  assert.equal(customTrack?.sourceUploadId, 'room_upload_123');
  assert.equal(customTrack?.autoEligible, false);

  const roomTracks = buildRoomBgTrackOptions([upload]);
  assert.equal(roomTracks.length, BG_TRACK_OPTIONS.length + 1);
  assert.equal(roomTracks.at(-1)?.id, 'upload_room_upload_123');
  assert.equal(roomTracks.at(-1)?.url, 'https://example.com/cash-cannon.mp3');
});
