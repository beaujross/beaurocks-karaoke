import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const readSource = (relativePath) => readFileSync(resolve(relativePath), 'utf8');

const hostAppSource = readSource('src/apps/Host/HostApp.jsx');
const automationControlsSource = readSource('src/apps/Host/components/AutomationControls.jsx');
const hostTopChromeSource = readSource('src/apps/Host/components/HostTopChrome.jsx');

test('Apple playlist background playback is routed through shared BG controls', () => {
    assert.match(hostAppSource, /const appleMusicBackgroundActive = useMemo\(\(\) => \{[\s\S]*type \|\| ''\)[\s\S]*playlist[\s\S]*\['playing', 'paused'\]\.includes\(status\);/);
    assert.match(hostAppSource, /const backgroundMusicActive = !!playingBg \|\| appleMusicBackgroundActive;/);
    assert.match(hostAppSource, /playingBg=\{backgroundMusicActive\}/);
    assert.match(hostAppSource, /if \(!next && applePlaylistIsActive\) \{\s*await stopAppleMusic\?\.\(\);\s*await updateRoom\(\{ appleMusicPlayback: null \}\);/);
    assert.doesNotMatch(hostAppSource, /appleMusicPlaying \? 'Pause' : 'Resume'/);
});

test('Auto BG controls stop the active background source when toggled off', () => {
    assert.match(automationControlsSource, /if \(!next && playingBg\) await setBgMusicState\(false\);/);
    assert.match(hostTopChromeSource, /if \(!next && playingBg\) await setBgMusicState\(false\);/);
    assert.match(hostAppSource, /const toggleAutoBgMusicQuick = async \(\) => \{[\s\S]*else if \(!next && backgroundMusicActive\) \{[\s\S]*await setBgMusicState\(false\);/);
});

test('Host setup Auto BG buttons delegate to the shared quick toggle', () => {
    const delegatedToggleCount = (hostAppSource.match(/await toggleAutoBgMusicQuick\(\);/g) || []).length;
    assert.ok(delegatedToggleCount >= 2);
});
test('Apple Music setup exposes a picker without adding separate runtime playback controls', () => {
    assert.match(hostAppSource, /const APPLE_MUSIC_PICKER_MODES = Object\.freeze\(\[/);
    assert.match(hostAppSource, /id: 'library', label: 'My Playlists'/);
    assert.match(hostAppSource, /id: 'forYou', label: 'For You'/);
    assert.match(hostAppSource, /id: 'search', label: 'Search'/);
    assert.match(hostAppSource, /v1\/me\/library\/playlists\?limit=25/);
    assert.match(hostAppSource, /v1\/me\/recommendations\?limit=10/);
    assert.match(hostAppSource, /relationships\?\.contents\?\.data/);
    assert.doesNotMatch(hostAppSource, /v1\/me\/history\/heavy-rotation/);
    assert.match(hostAppSource, /types=playlists&limit=20/);
    assert.match(hostAppSource, /Apple Music background/);
    assert.match(hostAppSource, /Use & Start BG/);
    assert.match(hostTopChromeSource, /Use BG/);
    assert.match(hostAppSource, /autoBgMusic: true,[\s\S]*bgMusicPlaying: false,[\s\S]*bgMusicUrl: ''/);
    assert.match(hostAppSource, /await playAppleMusicPlaylist\(playlistId, \{ title, sourceType: choice\.sourceType \|\| '' \}\);/);
    assert.match(hostAppSource, /audio\.removeAttribute\('src'\);[\s\S]*audio\.load\(\);/);
    assert.match(hostAppSource, /Paste playlist URL or ID/);
    assert.match(hostAppSource, /min-h-\[42px\][\s\S]*Connect/);
    assert.match(hostAppSource, /text-base font-semibold text-white truncate/);
    assert.match(hostAppSource, /canSkipBg=\{!appleMusicBackgroundActive\}/);
    assert.match(hostTopChromeSource, /disabled=\{!canSkipBg\}/);
    assert.match(hostAppSource, /const authorizeAppleMusicInstance = async[\s\S]*await instance\.authorize\(\)/);
    assert.match(hostAppSource, /__beauRocksMusicUserToken/);
    assert.match(hostAppSource, /headers\['Music-User-Token'\] = userToken/);
    assert.match(hostAppSource, /\{ libraryPlaylist: id \}/);
    assert.match(hostAppSource, /if \(!roomCode \|\| !autoBgMusic\) return;[\s\S]*setBgMusicState\(true\)/);
    assert.doesNotMatch(hostAppSource, /Auto-DJ playlist fallback/);
    assert.doesNotMatch(hostAppSource, /The BG button remains the single start\/stop control once a playlist is active\./);
    assert.doesNotMatch(hostAppSource, /Apple Music background[\s\S]{0,3000}Pause/);
});