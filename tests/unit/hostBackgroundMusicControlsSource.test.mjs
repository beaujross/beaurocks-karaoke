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
    assert.match(hostAppSource, /const appleMusicBackgroundSelected = useMemo\(\(\) => \{[\s\S]*isAppleBackgroundAudioSource\(backgroundAudioSource\)[\s\S]*\['playing', 'paused'\]\.includes\(status\)/);
    assert.match(hostAppSource, /const appleMusicBackgroundPlaying = useMemo\(\(\) => \{[\s\S]*status \|\| ''\)[\s\S]*playing/);
    assert.match(hostAppSource, /const backgroundMusicActive = isAppleBackgroundAudioSource\(backgroundAudioSource\)[\s\S]*appleMusicBackgroundPlaying && appleMusicPlaying[\s\S]*: !!playingBg;/);
    assert.match(hostAppSource, /playingBg=\{backgroundMusicActive\}/);
    assert.match(hostAppSource, /if \(!next && isAppleBackgroundAudioSource\(backgroundAudioSource\) && applePlaylistIsActive\) \{\s*await pauseAppleMusic\(\{[\s\S]*reason:[\s\S]*performanceSessionId:/);
    assert.match(hostAppSource, /configuredApplePlaylistIsActive && livePlaybackStatus === 'paused'[\s\S]*await resumeAppleMusic\(\);/);
    assert.doesNotMatch(hostAppSource, /if \(!next && isAppleBackgroundAudioSource\(backgroundAudioSource\) && applePlaylistIsActive\) \{[\s\S]{0,180}appleMusicPlayback: null/);
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
test('Apple Music setup exposes playlist and station choices without adding separate runtime playback controls', () => {
    assert.match(hostAppSource, /const APPLE_MUSIC_PICKER_MODES = Object\.freeze\(\[/);
    assert.match(hostAppSource, /id: 'library', label: 'My Playlists'/);
    assert.match(hostAppSource, /id: 'forYou', label: 'For You'/);
    assert.match(hostAppSource, /id: 'stations', label: 'Recent Stations'/);
    assert.match(hostAppSource, /id: 'search', label: 'Search'/);
    assert.match(hostAppSource, /v1\/me\/library\/playlists\?limit=100/);
    assert.doesNotMatch(hostAppSource, /v1\/me\/library\/recently-added\?types=library-playlists&limit=50/);
    assert.match(hostAppSource, /v1\/me\/recommendations\?limit=10/);
    assert.match(hostAppSource, /v1\/me\/recent\/radio-stations\?limit=25/);
    assert.match(hostAppSource, /relationships\?\.contents\?\.data/);
    assert.match(hostAppSource, /if \(Array\.isArray\(payload\)\) \{/);
    assert.match(hostAppSource, /return nested\.length \? \[\.\.\.payload, \.\.\.nested\] : payload;/);
    assert.doesNotMatch(hostAppSource, /v1\/me\/history\/heavy-rotation/);
    assert.match(hostAppSource, /types=playlists&limit=20/);
    assert.match(hostAppSource, /Apple Music room soundtrack/);
    assert.match(hostAppSource, /Use as Soundtrack/);
    assert.match(hostAppSource, /const \[appleMusicBgPendingId, setAppleMusicBgPendingId\] = useState\(''\);/);
    assert.match(hostAppSource, /if \(appleMusicBgPendingId\) return;/);
    assert.match(hostAppSource, /setAppleMusicBgPendingId\(playlistId\);/);
    assert.match(hostAppSource, /finally \{\s*setAppleMusicBgPendingId\(''\);\s*\}/);
    assert.match(hostAppSource, /choiceIsPending \? 'Starting\.\.\.' : \(choiceIsActive \? 'Active' : 'Use as Soundtrack'\)/);
    assert.match(hostTopChromeSource, /choiceIsPending \? 'Starting\.\.\.' : \(choiceIsActive \? 'Active' : 'Start BG'\)/);
    assert.match(hostTopChromeSource, /Start BG/);
    assert.match(hostAppSource, /autoBgMusic: true,[\s\S]*bgMusicPlaying: false,[\s\S]*bgMusicUrl: ''/);
    assert.match(hostAppSource, /const playbackMeta = \{[\s\S]*alternatePlaylistIds: choice\.alternatePlaylistIds \|\| \[\][\s\S]*\}/);
    assert.match(hostAppSource, /await playAppleMusicPlaylist\(playlistId, playbackMeta\);/);
    assert.match(hostAppSource, /const applyAppleMusicOutputVolume = \(instance = null, value = 0\.3\) => \{/);
    assert.match(hostAppSource, /const musicKitVolume = Number\.isFinite\(currentVolume\) && currentVolume > 1 \? Math\.round\(volume \* 100\) : volume;/);
    assert.match(hostAppSource, /const hasLoadedItem = !!\([\s\S]*instance\?\.player\?\.nowPlayingItem[\s\S]*instance\?\.player\?\.queue\?\.currentItem[\s\S]*snapshot\?\.trackId/);
    assert.match(hostAppSource, /const playAppleMusicPlaylistQueueWithFallback = async/);
    assert.match(hostAppSource, /for \(const descriptor of attempts\) \{[\s\S]*queue = await instance\.setQueue\(descriptor\);[\s\S]*await startAppleMusicQueuePlayback\(instance, queue\);[\s\S]*waitForAppleMusicPlaybackStart\(instance, \{ contentLabel: 'playlist or station' \}\)/);
    assert.doesNotMatch(hostAppSource, /stopAppleMusicForQueueRetry/);
    assert.match(hostAppSource, /const appleMusicPlaylistStartRef = useRef\(\{ key: '', promise: null, failedAtMs: 0 \}\);/);
    assert.match(hostAppSource, /currentStart\.promise && \(currentStart\.key === startKey \|\| meta\.automatic === true\)/);
    assert.match(hostAppSource, /isAppleMusicAutomaticRetryCoolingDown\(currentStart, startKey\)/);
    assert.match(hostAppSource, /setBgMusicState\(true, \{ automatic: true \}\)/);
    assert.match(hostAppSource, /setAutoBgMusic\(false\);[\s\S]*autoBgMusic: false/);
    assert.match(hostAppSource, /applyAppleMusicOutputVolume\(instance, appleMusicVolumeRef\.current\);[\s\S]*const queueResult = await playAppleMusicPlaylistQueueWithFallback\(instance, playlistId, meta\);/);
    assert.match(hostAppSource, /queueResult\?\.snapshot\?\.trackId[\s\S]*trackId: queueResult\.snapshot\.trackId/);
    assert.match(hostAppSource, /const appleMusicTransportRef = useRef\(\{ action: '', promise: null \}\);/);
    assert.match(hostAppSource, /currentTransport\.promise && currentTransport\.action === 'pause'/);
    assert.match(hostAppSource, /currentTransport\.promise && currentTransport\.action === 'resume'/);
    assert.match(hostAppSource, /setAppleMusicPlaying\(snapshot\?\.status === 'playing'\);/);
    assert.match(hostAppSource, /configuredApplePlaylistIsActive && livePlaybackStatus === 'playing' && appleMusicPlaying/);
    assert.match(hostAppSource, /configuredApplePlaylistIsActive && livePlaybackStatus === 'paused' && appleMusicRef\.current/);
    assert.match(hostAppSource, /const waitForAppleMusicPlaybackStart = async/);
    assert.match(hostAppSource, /appleMusicVolumeRef\.current = nextAppleVolume;[\s\S]*applyAppleMusicOutputVolume\(appleMusicRef\.current, nextAppleVolume\);/);
    assert.match(hostAppSource, /shouldRestoreBgVolume \? \{ bgMusicVolume: 0\.3 \} : \{\}/);
    assert.match(hostAppSource, /BG will start after the current performance/);
    assert.match(hostAppSource, /const clearMediaElementSource = \(audio = null\) => \{/);
    assert.match(hostAppSource, /if \(currentSrc\) audio\.load\?\.\(\);/);
    assert.match(hostAppSource, /await instance\.changeToMediaAtIndex\(firstPlayableIndex\);\s*\}\s*await instance\.play\(\);/);
    assert.match(hostAppSource, /applePlaylistActive \|\| configuredApplePlaylistId/);
    assert.match(hostAppSource, /Paste playlist URL or ID/);
    assert.match(hostAppSource, /min-h-\[42px\][\s\S]*Connect/);
    assert.match(hostAppSource, /text-base font-semibold text-white truncate/);
    assert.match(hostAppSource, /previousBg=\{previousBg\}/);
    assert.match(hostAppSource, /canToggleBg=\{!currentSong\}/);
    assert.match(hostAppSource, /canSkipBg=\{!currentSong\}/);
    assert.match(hostAppSource, /controlAppleBackgroundQueue[\s\S]*skipToPreviousItem[\s\S]*skipToNextItem/);
    assert.match(hostTopChromeSource, /disabled=\{!canSkipBg\}/);
    assert.match(hostTopChromeSource, /data-feature-id='deck-apple-background-transport'[\s\S]*disabled=\{!canToggleBg\}/);
    assert.match(hostTopChromeSource, /data-feature-id='deck-apple-background-transport'/);
    assert.match(hostTopChromeSource, /Apple Music is the selected background source/);
    assert.match(hostTopChromeSource, /Use BeauRocks Loop/);
    assert.match(hostAppSource, /VITE_MUSICKIT_WEB_VERSION \|\| 'v3'/);
    assert.match(hostAppSource, /'playbackStateDidChange', 'nowPlayingItemDidChange', 'queueItemsDidChange'/);
    assert.match(hostAppSource, /instance\?\.player\?\.nowPlayingItem/);
    assert.match(hostAppSource, /instance\?\.player\?\.queue\?\.currentItem/);
    assert.match(hostAppSource, /const nextBackgroundSession = buildAppleBackgroundSession\([\s\S]*backgroundAudioPlayback: nextBackgroundSession/);
    assert.match(hostAppSource, /const authorizeAppleMusicInstance = async[\s\S]*await instance\.authorize\(\)/);
    assert.match(hostAppSource, /__beauRocksMusicUserToken/);
    assert.match(hostAppSource, /headers\['Music-User-Token'\] = userToken/);
    assert.match(hostAppSource, /buildAppleMusicPlaylistQueueAttempts/);
    assert.match(hostAppSource, /Apple Music pause failed/);
    assert.match(hostAppSource, /if \(!shouldPauseApplePlaybackTransport\(instance\)\) \{[\s\S]*setAppleMusicPlaying\(false\);[\s\S]*return;/);
    assert.match(hostAppSource, /if \(shouldPauseApplePlaybackTransport\(instance\)\) \{\s*await instance\.pause\(\);/);
    assert.doesNotMatch(appleMusicPlaylistPlaybackSource, /libraryPlaylist/);
    assert.match(appleMusicPlaylistPlaybackSource, /return \{ playlist: id \};/);
    assert.match(appleMusicPlaylistPlaybackSource, /meta\.alternatePlaylistIds/);
    assert.match(hostAppSource, /if \(!autoBgMusic\) return;[\s\S]*if \(stageActivationPendingRef\.current\) return;[\s\S]*setBgMusicState\(true, \{ automatic: true \}\)/);
    assert.doesNotMatch(hostAppSource, /if \(!autoDjEnabled\) return;[\s\S]{0,900}playAppleMusicPlaylist/);
    assert.doesNotMatch(hostAppSource, /Auto-DJ playlist fallback/);
    assert.doesNotMatch(hostAppSource, /The BG button remains the single start\/stop control once a playlist is active\./);
    assert.doesNotMatch(hostAppSource, /Apple Music background[\s\S]{0,3000}Pause/);
});

test('background audio checks stale Apple playback only while a playlist claims to be playing', () => {
    const queueSource = readSource('src/apps/Host/components/HostQueueTab.jsx');
    assert.match(queueSource, /if \(!applePlaylistPlaying\) return undefined;[\s\S]*setInterval\(\(\) => setBackgroundAudioObservedAtMs\(Date\.now\(\)\), 15000\)/);
});

test('stage transitions preserve and resume an Apple background soundtrack checkpoint', () => {
    const queueSource = readSource('src/apps/Host/components/HostQueueTab.jsx');
    const stageHelperSource = readSource('src/apps/Host/startQueueSongOnStage.js');
    assert.match(stageHelperSource, /if \(pauseAppleMusic\) \{\s*await pauseAppleMusic\(\{ reason: 'performance', performanceSessionId \}\);/);
    assert.doesNotMatch(stageHelperSource, /currentPerformanceSession,[\s\S]{0,220}appleMusicPlayback: null/);
    assert.match(queueSource, /const appleBackgroundSourceActive = \['playlist', 'station'\]\.includes\(applePlaybackType\);[\s\S]*await pauseAppleMusic\?\.\(\{[\s\S]*reason: 'performance',[\s\S]*performanceSessionId:/);
    assert.match(queueSource, /const preservedAppleBackgroundPlayback = \['playlist', 'station'\]\.includes\(String\(activeApplePlayback\?\.type[\s\S]*status: 'paused'/);
    assert.match(queueSource, /appleMusicPlayback: preservedAppleBackgroundPlayback/);
    assert.match(queueSource, /performanceSessionId: room\?\.currentPerformanceSession\?\.sessionId/);
    assert.match(queueSource, /if \(shouldClearApplePerformancePlayback\) updates\.appleMusicPlayback = null;/);
    assert.doesNotMatch(queueSource, /const restartCurrentPlayback[\s\S]{0,900}await stopAppleMusic\?\.\(\);/);
});

test('Rewards menu exposes the existing auto-tip toggle and editable amount', () => {
    assert.match(hostTopChromeSource, /data-feature-id="deck-auto-tip-controls"/);
    assert.match(hostTopChromeSource, /data-feature-id="deck-auto-tip-toggle"/);
    assert.match(hostTopChromeSource, /quickAutomationControls\?\.onToggleAutoBonus\?\.\(\)/);
    assert.match(hostTopChromeSource, /quickAutomationControls\?\.onSetAutoBonusPoints\?\.\(amount\)/);
    assert.match(hostAppSource, /const setAutoBonusPointsQuick = async \(value\) => \{[\s\S]*await updateRoom\(\{ autoBonusPoints: next \}\)/);
    assert.match(hostAppSource, /autoBonusPoints,[\s\S]*onSetAutoBonusPoints: setAutoBonusPointsQuick/);
});
