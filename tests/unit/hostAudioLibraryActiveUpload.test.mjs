import { describe, expect, it } from 'vitest';

import {
  buildCustomBgTrackOption,
  buildHostAudioUploadTrackId,
  isHostAudioUploadActive,
} from '../../src/lib/hostAudioLibrary.js';

const upload = {
  id: 'media_qa_event',
  title: 'QA Event Bed',
  url: 'https://storage.example/qa-event.wav',
  mediaType: 'audio',
  audioLibraryCategory: 'bg',
};

describe('active background upload identity', () => {
  it('matches the selected custom track by source upload id', () => {
    const track = buildCustomBgTrackOption(upload);
    expect(isHostAudioUploadActive({ item: upload, track })).toBe(true);
  });

  it('matches persisted local playback by normalized track id or URL', () => {
    expect(isHostAudioUploadActive({
      item: upload,
      playback: { type: 'local_upload', id: buildHostAudioUploadTrackId(upload) },
    })).toBe(true);
    expect(isHostAudioUploadActive({
      item: upload,
      playback: { type: 'local_upload', url: upload.url },
    })).toBe(true);
  });

  it('does not treat Apple playback or a different upload as the selected source', () => {
    expect(isHostAudioUploadActive({
      item: upload,
      playback: { type: 'playlist', id: buildHostAudioUploadTrackId(upload), url: upload.url },
    })).toBe(false);
    expect(isHostAudioUploadActive({
      item: upload,
      track: { id: 'upload_other', sourceUploadId: 'other' },
      playback: { type: 'local_upload', id: 'upload_other', url: 'https://storage.example/other.wav' },
    })).toBe(false);
  });
});
