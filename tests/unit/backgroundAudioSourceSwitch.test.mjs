import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const hostSource = readFileSync(new URL('../../src/apps/Host/HostApp.jsx', import.meta.url), 'utf8');

test('switching to a local background source clears the Apple auto-play preference atomically', () => {
  expect(hostSource).toMatch(/setAppleMusicAutoPlaylistId\(''\);[\s\S]*roomRef\.current = \{[\s\S]*appleMusicAutoPlaylistId: '',[\s\S]*appleMusicPlayback: null/);
  expect(hostSource).toMatch(/appleMusicAutoPlaylistId: '',[\s\S]*appleMusicAutoPlaylistTitle: '',[\s\S]*bgMusicPlaying: result\.ok/);
});

test('switching to Apple invalidates local starts and clears local playback evidence', () => {
  expect(hostSource).toMatch(/playingBgRef\.current = false;[\s\S]*bgPlaybackOperationRef\.current \+= 1;[\s\S]*clearMediaElementSource\(bgAudio\.current\)/);
  expect(hostSource).toMatch(/appleMusicPlayback: null,[\s\S]*backgroundAudioPlayback: null/);
});
