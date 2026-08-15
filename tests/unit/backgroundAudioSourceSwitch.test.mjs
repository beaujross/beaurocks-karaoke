import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const hostSource = readFileSync(new URL('../../src/apps/Host/HostApp.jsx', import.meta.url), 'utf8');
const functionsSource = readFileSync(new URL('../../functions/index.js', import.meta.url), 'utf8');

test('switching to BeauRocks stops Apple playback without forgetting the saved Apple soundtrack', () => {
  expect(hostSource).toMatch(/backgroundAudioSource: BACKGROUND_AUDIO_SOURCES\.beaurocks,[\s\S]*appleMusicPlayback: null/);
  expect(hostSource).toMatch(/const switchBackgroundAudioSource = useCallback[\s\S]*Your Apple Music soundtrack is remembered/);
  expect(hostSource).not.toMatch(/const startLocalBackgroundTrack = useCallback[\s\S]{0,1800}appleMusicAutoPlaylistId: ''/);
});

test('switching to Apple invalidates local starts and clears local playback evidence', () => {
  expect(hostSource).toMatch(/backgroundAudioSource: BACKGROUND_AUDIO_SOURCES\.appleMusic,[\s\S]*bgMusicPlaying: false,[\s\S]*backgroundAudioPlayback: null/);
  expect(hostSource).toMatch(/bgPlaybackOperationRef\.current \+= 1;[\s\S]*clearMediaElementSource\(bgAudio\.current\)/);
});

test('source switching defers safely while a performance is active', () => {
  expect(hostSource).toMatch(/const performanceActive =[\s\S]*status === 'performing'/);
  expect(hostSource).toMatch(/performanceActive \|\| !shouldPlay[\s\S]*will start after the current performance/);
});

test('the host room callable accepts only the canonical background source values', () => {
  expect(functionsSource).toMatch(/BACKGROUND_AUDIO_SOURCE_VALUES = new Set\(\[[\s\S]*"beaurocks_loop",[\s\S]*"apple_music",[\s\S]*\]\)/);
  expect(functionsSource).toMatch(/key === "backgroundAudioSource"[\s\S]*!BACKGROUND_AUDIO_SOURCE_VALUES\.has\(value\)/);
});

test('Apple Music token requests bind the validated browser origin into the developer token', () => {
  expect(hostSource).toMatch(/callFunction\('createAppleMusicToken',[\s\S]*window\.location\.origin/);
  expect(functionsSource).toMatch(/resolveOrigin\(request\.rawRequest, request\.data\?\.origin\)/);
  expect(functionsSource).toMatch(/origin: \[requestOrigin\]/);
});
