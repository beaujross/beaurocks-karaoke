import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const personaSource = fs.readFileSync(path.join(root, 'scripts/qa/persona-golden-paths-playwright.mjs'), 'utf8');
const hostSource = fs.readFileSync(path.join(root, 'src/apps/Host/HostApp.jsx'), 'utf8');
const hostQueueSource = fs.readFileSync(path.join(root, 'src/apps/Host/components/HostQueueTab.jsx'), 'utf8');
const hostChromeSource = fs.readFileSync(path.join(root, 'src/apps/Host/components/HostTopChrome.jsx'), 'utf8');

describe('background audio event-readiness QA contract', () => {
  it('keeps the destructive production drill explicitly opt-in', () => {
    expect(personaSource).toMatch(/QA_BACKGROUND_AUDIO_DRILL/);
    expect(personaSource).toMatch(/if \(backgroundAudioDrill\)/);
  });

  it('covers upload playback, Host and TV observation, recovery, Apple capability, and cleanup', () => {
    expect(personaSource).toMatch(/Upload to Background/);
    expect(personaSource).toMatch(/host-upload-playing\.png/);
    expect(personaSource).toMatch(/tv-upload-playing\.png/);
    expect(personaSource).toMatch(/Start Upload/);
    expect(personaSource).toMatch(/host-apple-capability\.png/);
    expect(personaSource).toMatch(/Uploaded, played, paused, recovered, and deleted/);
  });

  it('clears the room playback observation before deleting an active upload', () => {
    const start = hostSource.indexOf('const deleteCloudUpload = async');
    const end = hostSource.indexOf('const startBgLibraryTrack = useCallback', start);
    const deletionSource = hostSource.slice(start, end);
    expect(deletionSource).toMatch(/isHostAudioUploadActive/);
    expect(deletionSource).toMatch(/backgroundAudioPlayback: null/);
    expect(deletionSource.indexOf('backgroundAudioPlayback: null')).toBeLessThan(deletionSource.indexOf('deleteObject'));
  });

  it('disables Auto BG before the library truth card pauses playback', () => {
    expect(hostQueueSource).toMatch(/await updateRoom\?\.\(\{ autoBgMusic: false \}\)/);
    expect(hostQueueSource).toMatch(/await setBgMusicState\?\.\(false\)/);
  });

  it('keeps the full-screen media library above Host chrome interactions', () => {
    expect(hostSource).toMatch(/modalOverlayActive=\{sceneLibraryModalOpen\}/);
    expect(hostChromeSource).toMatch(/modalOverlayActive \? 'pointer-events-none invisible'/);
  });
});
