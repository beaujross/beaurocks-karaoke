import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const readSource = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('background audio runtime source integration', () => {
  test('Host confirms local playback before persisting playing state', () => {
    const source = readSource('src/apps/Host/HostApp.jsx');
    expect(source).toMatch(/const result = await startBackgroundAudioElement\(audio, \{ url \}\);/);
    expect(source).toMatch(/playingBgRef\.current = result\.ok;[\s\S]*bgMusicPlaying: result\.ok,[\s\S]*backgroundAudioPlayback: observation/);
    expect(source).toMatch(/bgPlaybackOperationRef\.current !== operationId/);
    expect(source).not.toMatch(/bgAudio\.current\.play\(\)\.catch\(\(\) => \{\}\)/);
  });

  test('Host uses the confirmed path for selection, skipping, and automatic advance', () => {
    const source = readSource('src/apps/Host/HostApp.jsx');
    expect(source).toMatch(/const selectBgTrack = useCallback[\s\S]*await startLocalBackgroundTrack\(nextTrack\);/);
    expect(source).toMatch(/const advanceBgTrack = useCallback\(async[\s\S]*await startLocalBackgroundTrack\(nextTrack\);/);
    expect(source).toMatch(/void advanceBgTrack\(\{ shouldPlay: true, syncRoom: true \}\);/);
  });

  test('Host and TV expose the same safe production QA state', () => {
    const hostQueueSource = readSource('src/apps/Host/components/HostQueueTab.jsx');
    const tvSource = readSource('src/apps/TV/PublicTV.jsx');
    expect(hostQueueSource).toMatch(/window\.__qaBackgroundAudioState = snapshot/);
    expect(tvSource).toMatch(/window\.__qaBackgroundAudioState = \{ \.\.\.snapshot, surface: 'tv_observer' \}/);
    expect(tvSource).toMatch(/document\.documentElement\.dataset\.backgroundAudioState = snapshot\.key/);
  });
});
