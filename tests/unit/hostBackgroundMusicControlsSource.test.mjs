import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const readSource = (relativePath) => readFileSync(resolve(relativePath), 'utf8');

const hostAppSource = readSource('src/apps/Host/HostApp.jsx');
const appleMusicPlaylistPlaybackSource = readSource('src/lib/appleMusicPlaylistPlayback.js');
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
    assert.match(hostAppSource, /v1\/me\/library\/playlists\?limit=100/);
    assert.doesNotMatch(hostAppSource, /v1\/me\/library\/recently-added\?types=library-playlists&limit=50/);
    assert.match(hostAppSource, /v1\/me\/recommendations\?limit=10/);
    assert.match(hostAppSource, /relationships\?\.contents\?\.data/);
    assert.match(hostAppSource, /if \(Array\.isArray\(payload\)\) \{/);
    assert.match(hostAppSource, /return nested\.length \? \[\.\.\.payload, \.\.\.nested\] : payload;/);
    assert.doesNotMatch(hostAppSource, /v1\/me\/history\/heavy-rotation/);
    assert.match(hostAppSource, /types=playlists&limit=20/);
    assert.match(hostAppSource, /Apple Music background/);
    assert.match(hostAppSource, /Use & Start BG/);
    assert.match(hostAppSource, /const \[appleMusicBgPendingId, setAppleMusicBgPendingId\] = useState\(''\);/);
    assert.match(hostAppSource, /if \(appleMusicBgPendingId\) return;/);
    assert.match(hostAppSource, /setAppleMusicBgPendingId\(playlistId\);/);
    assert.match(hostAppSource, /finally \{\s*setAppleMusicBgPendingId\(''\);\s*\}/);
    assert.match(hostAppSource, /choiceIsPending \? 'Starting\.\.\.' : \(choiceIsActive \? 'Active' : 'Use & Start BG'\)/);
    assert.match(hostTopChromeSource, /choiceIsPending \? 'Starting\.\.\.' : \(choiceIsActive \? 'Active' : 'Start BG'\)/);
    assert.match(hostTopChromeSource, /Start BG/);
    assert.match(hostAppSource, /autoBgMusic: true,[\s\S]*bgMusicPlaying: false,[\s\S]*bgMusicUrl: ''/);
    assert.match(hostAppSource, /const playbackMeta = \{[\s\S]*alternatePlaylistIds: choice\.alternatePlaylistIds \|\| \[\][\s\S]*\}/);
    assert.match(hostAppSource, /await playAppleMusicPlaylist\(playlistId, playbackMeta\);/);
    assert.match(hostAppSource, /const applyAppleMusicOutputVolume = \(instance = null, value = 0\.3\) => \{/);
    assert.match(hostAppSource, /const musicKitVolume = Number\.isFinite\(currentVolume\) && currentVolume > 1 \? Math\.round\(volume \* 100\) : volume;/);
    assert.match(hostAppSource, /const hasLoadedItem = !!\(instance\?\.nowPlayingItem \|\| instance\?\.queue\?\.currentItem \|\| snapshot\?\.trackId \|\| snapshot\?\.durationSec > 0\);/);
    assert.match(hostAppSource, /const playAppleMusicPlaylistQueueWithFallback = async/);
    assert.match(hostAppSource, /for \(const descriptor of attempts\) \{[\s\S]*const queue = await instance\.setQueue\(descriptor\);[\s\S]*await startAppleMusicQueuePlayback\(instance, queue\);[\s\S]*await waitForAppleMusicPlaybackStart\(instance\);[\s\S]*await stopAppleMusicForQueueRetry\(instance\);/);
    assert.match(hostAppSource, /const appleMusicPlaylistStartRef = useRef\(\{ key: '', promise: null, failedAtMs: 0 \}\);/);
    assert.match(hostAppSource, /currentStart\.promise && currentStart\.key === startKey/);
    assert.match(hostAppSource, /isAppleMusicAutomaticRetryCoolingDown\(currentStart, startKey\)/);
    assert.match(hostAppSource, /setBgMusicState\(true, \{ automatic: true \}\)/);
    assert.match(hostAppSource, /setAutoBgMusic\(false\);[\s\S]*autoBgMusic: false/);
    assert.match(hostAppSource, /applyAppleMusicOutputVolume\(instance, appleMusicVolumeRef\.current\);[\s\S]*await playAppleMusicPlaylistQueueWithFallback\(instance, playlistId, meta\);/);
    assert.match(hostAppSource, /const waitForAppleMusicPlaybackStart = async/);
    assert.match(hostAppSource, /appleMusicVolumeRef\.current = nextAppleVolume;[\s\S]*applyAppleMusicOutputVolume\(appleMusicRef\.current, nextAppleVolume\);/);
    assert.match(hostAppSource, /shouldRestoreBgVolume \? \{ bgMusicVolume: 0\.3 \} : \{\}/);
    assert.match(hostAppSource, /BG will start after the current performance/);
    assert.match(hostAppSource, /const clearMediaElementSource = \(audio = null\) => \{/);
    assert.match(hostAppSource, /!currentSrc\.startsWith\('blob:'\)\) audio\.load\?\.\(\);/);
    assert.match(hostAppSource, /Paste playlist URL or ID/);
    assert.match(hostAppSource, /min-h-\[42px\][\s\S]*Connect/);
    assert.match(hostAppSource, /text-base font-semibold text-white truncate/);
    assert.match(hostAppSource, /canSkipBg=\{!appleMusicBackgroundActive\}/);
    assert.match(hostTopChromeSource, /disabled=\{!canSkipBg\}/);
    assert.match(hostAppSource, /const authorizeAppleMusicInstance = async[\s\S]*await instance\.authorize\(\)/);
    assert.match(hostAppSource, /__beauRocksMusicUserToken/);
    assert.match(hostAppSource, /headers\['Music-User-Token'\] = userToken/);
    assert.match(hostAppSource, /buildAppleMusicPlaylistQueueAttempts/);
    assert.match(hostAppSource, /Apple Music pause failed/);
    assert.doesNotMatch(appleMusicPlaylistPlaybackSource, /libraryPlaylist/);
    assert.match(appleMusicPlaylistPlaybackSource, /return \{ playlist: id \};/);
    assert.match(appleMusicPlaylistPlaybackSource, /meta\.alternatePlaylistIds/);
    assert.match(hostAppSource, /if \(!roomCode \|\| !autoBgMusic\) return;[\s\S]*setBgMusicState\(true\)/);
    assert.doesNotMatch(hostAppSource, /Auto-DJ playlist fallback/);
    assert.doesNotMatch(hostAppSource, /The BG button remains the single start\/stop control once a playlist is active\./);
    assert.doesNotMatch(hostAppSource, /Apple Music background[\s\S]{0,3000}Pause/);
});

test('background audio checks stale Apple playback only while a playlist claims to be playing', () => {
    const queueSource = readSource('src/apps/Host/components/HostQueueTab.jsx');
    assert.match(queueSource, /if \(!applePlaylistPlaying\) return undefined;[\s\S]*setInterval\(\(\) => setBackgroundAudioObservedAtMs\(Date\.now\(\)\), 15000\)/);
});
