import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const primaryPicksPath = 'src/apps/Host/components/setup/MissionSetupPrimaryPicks.jsx';
const autopilotPreviewPath = 'src/apps/Host/components/setup/MissionSetupAutopilotPreview.jsx';
const footerPath = 'src/apps/Host/components/setup/MissionSetupFooter.jsx';
const missionSetupShellPath = 'src/apps/Host/components/setup/MissionSetupShell.jsx';
const missionSetupHeaderPath = 'src/apps/Host/components/setup/MissionSetupHeader.jsx';
const selfServeLauncherPath = 'src/apps/Host/components/SelfServeModeLauncher.jsx';
const topChromePath = 'src/apps/Host/components/HostTopChrome.jsx';
const launchPadBrowserPath = 'src/apps/Host/components/HostRoomLaunchPadBrowser.jsx';
const hostNightPresetsPath = 'src/apps/Host/hostNightPresets.js';
const nightSetupFlowPath = 'src/apps/Host/hooks/useHostNightSetupFlow.js';
const hostAppPath = 'src/apps/Host/HostApp.jsx';
const functionsPath = 'functions/index.js';
const hostAppSource = readFileSync(hostAppPath, 'utf8');
const getAdminSection = (startKey, nextKey) => {
  const startMarker = `{settingsTab === '${startKey}' && (`;
  const endMarker = `{settingsTab === '${nextKey}' && (`;
  const startIndex = hostAppSource.indexOf(startMarker);
  const endIndex = hostAppSource.indexOf(endMarker, startIndex + startMarker.length);
  assert.notEqual(startIndex, -1, `Expected to find admin section ${startKey}`);
  assert.notEqual(endIndex, -1, `Expected to find following admin section ${nextKey}`);
  return hostAppSource.slice(startIndex, endIndex);
};

test('mission setup keeps preset selection compact and applies full preset package', () => {
  const primaryPicksSource = readFileSync(primaryPicksPath, 'utf8');
  const nightSetupFlowSource = readFileSync(nightSetupFlowPath, 'utf8');

  assert.match(
    primaryPicksSource,
    /Selected room package/,
    'Night setup should show one selected room package instead of a full wall of presets',
  );
  assert.match(
    primaryPicksSource,
    /Change room package/,
    'Night setup should tuck alternate room packages behind a disclosure',
  );
  assert.match(
    nightSetupFlowSource,
    /hostNightPresetConfig: selectedPresetConfig/,
    'Night setup should persist the full preset config so Room Settings can reflect the selected package',
  );
  assert.match(
    nightSetupFlowSource,
    /audienceShellVariant: String\(basePayload\.audienceShellVariant \|\| selectedPresetSettings\.audienceShellVariant/,
    'Night setup should persist the preset audience shell variant',
  );
  assert.match(
    nightSetupFlowSource,
    /deadAirFiller/,
    'Night setup should persist the generated dead-air filler plan with mission control',
  );
});

test('mission setup exposes an autopilot plan instead of a third stacked assist step', () => {
  const primaryPicksSource = readFileSync(primaryPicksPath, 'utf8');
  const autopilotPreviewSource = readFileSync(autopilotPreviewPath, 'utf8');
  const footerSource = readFileSync(footerPath, 'utf8');
  const headerSource = readFileSync(missionSetupHeaderPath, 'utf8');

  assert.match(headerSource, /Room Readiness/);
  assert.match(headerSource, /Then Launch Room\./);

  assert.match(
    autopilotPreviewSource,
    /Tonight&apos;s Autopilot/,
    'Guided setup should lead with the generated autopilot plan',
  );
  assert.match(
    autopilotPreviewSource,
    /Dead-Air Picks/,
    'Guided setup should preview known-good dead-air filler songs',
  );
  assert.match(
    autopilotPreviewSource,
    /Autopilot First/,
    'Guided setup should expose the autopilot automation level',
  );
  assert.doesNotMatch(
    primaryPicksSource,
    /Pick how hands-on you want to be/,
    'The old assist step should not remain as another stacked setup card',
  );
  assert.match(
    footerSource,
    /Launch Room/,
    'Setup footer should use one plain-language launch action',
  );
  assert.doesNotMatch(
    footerSource,
    /Start Room|Open TV \+ Copy Link/,
    'Setup footer should not split setup and surface handoff into competing launch actions',
  );
  assert.match(
    footerSource,
    /Close/,
    'Mission setup footer should offer an explicit close action',
  );
  assert.doesNotMatch(
    footerSource,
    /More Settings/,
    'Mission setup footer should stop routing hosts into deeper settings for live tweaks',
  );
});

test('night setup wizard can close without forcing hosts through every step', () => {
  assert.match(
    hostAppSource,
    /event\.key !== 'Escape' \|\| nightSetupApplying/,
    'Night setup should close from Escape when the wizard is idle',
  );
  assert.match(
    hostAppSource,
    /window\.addEventListener\('keydown', handleKeyDown\)/,
    'Night setup should register an Escape key listener while open',
  );
  assert.match(
    hostAppSource,
    /if \(event\.target !== event\.currentTarget \|\| nightSetupApplying\) return;/,
    'Night setup should support clicking the backdrop to close',
  );
  assert.match(
    hostAppSource,
    /data-host-setup-skip-intro[\s\S]*>\s*Close\s*</,
    'Classic night setup should expose a clear close button in the header',
  );
  assert.match(
    hostAppSource,
    /onClose=\{closeNightSetupWizard\}/,
    'Mission setup footer should receive the shared close handler',
  );
});

test('host panel presents readiness and one launch action before deeper setup', () => {
  const topChromeSource = readFileSync(topChromePath, 'utf8');

  assert.doesNotMatch(
    hostAppSource,
    /<HostRoomReadinessPanel/,
    'Host app should stop rendering the old standalone room readiness strip above the queue',
  );
  assert.doesNotMatch(
    topChromeSource,
    /label=\{roomReadinessStatusLabel\}/,
    'Host top chrome should not render a second readiness-status chip once setup moved out of the live surface',
  );
  assert.doesNotMatch(
    topChromeSource,
    /Queue Controls/,
    'Host top chrome should not duplicate the old queue controls surface label',
  );
  assert.match(
    topChromeSource,
    /Launch TV/,
    'Top chrome should keep launch targets inside the quick-launch menu',
  );
  assert.match(
    topChromeSource,
    /Launch Mobile/,
    'Top chrome should keep the audience launch target inside the quick-launch menu',
  );
  assert.doesNotMatch(
    topChromeSource,
    /roomReadinessLaunchBusy \? 'Launching\.\.\.' : 'Launch'/,
    'Top chrome should not duplicate the quick-launch menu with a second standalone launch button',
  );
  assert.match(
    hostAppSource,
    /const roomReadinessState = useMemo\(\(\) => \{/,
    'Host app should still derive room readiness state for setup and admin handoff',
  );
  assert.match(
    hostAppSource,
    /const focusQueueLiveControls = useCallback\(\(\) => \{/,
    'Host app should provide a live queue-controls handoff from readiness',
  );
  assert.match(
    hostAppSource,
    /querySelector\('\[data-feature-id="deck-queue-menu-toggle"\]'\)/,
    'Readiness should target the top queue quick menu instead of reopening setup',
  );
  assert.match(
    hostAppSource,
    /roomReadinessSummary=\{roomReadinessState\.summary\}/,
    'Host app should pass the derived readiness summary into top chrome',
  );
  assert.match(
    hostAppSource,
    /await launchNightSetupPackage\(\)/,
    'Readiness launch should reuse the atomic TV, setup, and join-link flow',
  );
  assert.match(
    hostAppSource,
    /openNightSetupWizard\(room\?\.hostNightPreset \|\| hostNightPreset \|\| 'casual'\)/,
    'Night Setup entry should open the simplified setup modal instead of routing hosts into admin settings',
  );
  assert.match(
    hostAppSource,
    /openAdminWorkspace\('ops\.room_setup'\)/,
    'Night setup should route full-admin handoff through the workspace navigation helper',
  );
});

test('room formats are optional while room creation centers on defaults', () => {
  const selfServeLauncherSource = readFileSync(selfServeLauncherPath, 'utf8');
  const launchPadBrowserSource = readFileSync(launchPadBrowserPath, 'utf8');
  const hostNightPresetsSource = readFileSync(hostNightPresetsPath, 'utf8');
  const provisionFunctionsSource = readFileSync(functionsPath, 'utf8');

  assert.match(
    hostAppSource,
    /const roomFormatLauncher = roomCode \? \(/,
    'Night setup should build a reusable room-format launcher surface',
  );
  assert.match(
    hostAppSource,
    /<SelfServeModeLauncher[\s\S]*context="setup"/,
    'Night setup should mount the room-format launcher in setup context',
  );
  assert.doesNotMatch(
    hostAppSource,
    /{tab === 'games' && \([\s\S]*<SelfServeModeLauncher/s,
    'Games tab should stop rendering the room-format launcher',
  );
  assert.match(
    hostAppSource,
    /Optional room formats/,
    'Classic night setup should tuck self-serve formats behind an optional drawer instead of a required activity step',
  );
  assert.match(
    launchPadBrowserSource,
    /Starting point/,
    'Room creation should frame preset-backed setup as a starting point rather than an internal preset editor.',
  );
  assert.match(
    launchPadBrowserSource,
    /data-launch-preset-card=\{preset\.id\}/,
    'Room creation should present starting packages as selectable product cards instead of a dropdown.',
  );
  assert.doesNotMatch(
    launchPadBrowserSource,
    /<select[\s\S]*value=\{resolvedLaunchPresetId\}/,
    'Preset selection should no longer be hidden in a native dropdown.',
  );
  assert.match(
    launchPadBrowserSource,
    /LAUNCH_OPERATING_MODEL_OPTIONS[\s\S]*Host-Led[\s\S]*Assisted Host[\s\S]*Crowd-Driven[\s\S]*data-launch-room-control/,
    'Room creation should make the operating model a launch-time decision.',
  );
  assert.match(
    launchPadBrowserSource,
    /buildLaunchOperatingModelSettings[\s\S]*oneMinuteMicEnabled[\s\S]*performanceProgressionMode: oneMinuteMicEnabled \? 'one_minute_mic' : 'full_song'/,
    'Audience-led launch should persist the one-minute mic mode through preset config.',
  );
  assert.match(
    hostNightPresetsSource,
    /oneMinuteMicEnabled: value\?\.oneMinuteMicEnabled !== undefined[\s\S]*oneMinuteMicVoteWindowSec/,
    'Host preset normalization should preserve launch operating model one-minute settings.',
  );
  assert.match(
    provisionFunctionsSource,
    /oneMinuteMicEnabled: settings\.oneMinuteMicEnabled === true[\s\S]*performanceProgressionMode: String\(settings\.performanceProgressionMode/,
    'Provisioning should carry one-minute settings from the selected launch preset onto the room.',
  );
  assert.match(
    launchPadBrowserSource,
    /Choose the starting behavior for queue, requests, search, TV\/crowd layers, automation, and guest access\./,
    'The starting point should explain the product areas affected by the selected setup.',
  );
  assert.match(
    launchPadBrowserSource,
    /selectedPresetImpactRows\.map\(\(row\) =>/,
    'Room creation should show a concise impact preview for the selected starting point.',
  );
  assert.match(
    launchPadBrowserSource,
    /Start now/,
    'Room start time should remain optional and default to starting now.',
  );
  assert.match(
    launchPadBrowserSource,
    /How should points work\?/,
    'Room creation should make the launch points and rewards model a first-class decision.',
  );
  assert.match(
    launchPadBrowserSource,
    /Just for Fun[\s\S]*BeauBucks[\s\S]*Ticket Value[\s\S]*Fundraiser[\s\S]*Custom Rules/,
    'Room creation should expose plain-language participation, premium, ticket, fundraiser, and advanced economy choices.',
  );
  assert.match(
    launchPadBrowserSource,
    /if \(mode === 'beaubucks'\)[\s\S]*presetId: 'beaubucks',[\s\S]*eventId: 'beaubucks',[\s\S]*eventLabel: 'BeauBucks',[\s\S]*generalAdmissionPoints: 100/,
    'The BeauBucks outcome should compile to a stable premium-currency launch payload.',
  );
  assert.match(
    launchPadBrowserSource,
    /LAUNCH_ECONOMY_OPTIONS\.filter\(\(option\) => showAdvancedSetup \|\| option\.id !== 'custom'\)/,
    'Custom economy rules should stay behind Advanced Setup.',
  );
  assert.match(
    launchPadBrowserSource,
    /eventCreditsEventId === 'beaubucks'[\s\S]*\? 'beaubucks'/,
    'Saved BeauBucks configuration should resolve back to the BeauBucks choice.',
  );
  assert.match(
    launchPadBrowserSource,
    /Planning ahead\?/,
    'Secondary show-plan creation should be tucked behind a planning disclosure.',
  );
  assert.doesNotMatch(
    launchPadBrowserSource,
    /Credits and promos|EventCreditsConfigPanel|Manage saved defaults/,
    'Room creation should not embed full credits or preset-management editors.',
  );
  assert.doesNotMatch(
    launchPadBrowserSource,
    /Create \+ Open Room Settings/,
    'Room creation should not offer a duplicate create-and-open-settings CTA.',
  );
  assert.doesNotMatch(
    launchPadBrowserSource,
    /Night preset/,
    'Room creation should not lead with night preset language.',
  );
  assert.match(
    selfServeLauncherSource,
    /Room Formats/,
    'The launcher should frame these as room formats when opened from setup',
  );
});

test('host setup keeps room uploads available while routing live media actions back to runtime workspaces', () => {
  const mediaSection = getAdminSection('media', 'marquee');

  assert.match(
    mediaSection,
    /Room Uploads/,
    'Host app should keep the room upload library visible for local media checks',
  );
  assert.match(
    mediaSection,
    /accept="video\/\*,audio\/\*,image\/\*"/,
    'Room uploads should accept local audio, video, and image files',
  );
  assert.match(
    mediaSection,
    /Open Queue Workspace/,
    'Admin media should hand queue actions back to the live queue workspace',
  );
  assert.match(
    mediaSection,
    /Open Media Library/,
    'Admin media should hand scene and TV media actions back to the media library workspace',
  );
  assert.match(
    mediaSection,
    /Open Run Of Show/,
    'Admin media should hand run-of-show placement back to the run-of-show workspace',
  );
  assert.match(
    mediaSection,
    /Upload Only/,
    'Room uploads should still allow a plain library upload without live routing',
  );
  assert.match(
    mediaSection,
    /Save Offline Backup/,
    'Hosts should still be able to save an offline local backup on the host device',
  );
  assert.match(
    mediaSection,
    /TV Library/,
    'Admin media should still let hosts push eligible uploaded items into the TV library after upload',
  );
  assert.match(
    mediaSection,
    /Use In Run Of Show/,
    'Admin media should still let hosts turn eligible uploaded items into a run-of-show asset after upload',
  );
  assert.doesNotMatch(
    mediaSection,
    /Upload \+ Queue|Save To TV Library/,
    'Admin media should stop using the older direct-upload runtime action labels inside the library manager',
  );
});

test('host app declares Apple playback refs before assigning the sync callback', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');
  const refDeclarationIndex = hostAppSource.indexOf("const syncApplePlaybackStateRef = useRef(async () => {});");
  const callbackAssignmentIndex = hostAppSource.indexOf('syncApplePlaybackStateRef.current = syncApplePlaybackState;');

  assert.notEqual(refDeclarationIndex, -1, 'Host app should keep a ref for the Apple playback sync callback');
  assert.notEqual(callbackAssignmentIndex, -1, 'Host app should assign the Apple playback sync callback into the ref');
  assert.equal(
    refDeclarationIndex < callbackAssignmentIndex,
    true,
    'Apple playback sync refs must be declared before the callback assignment to avoid first-render TDZ crashes',
  );
});

test('host Apple playback sync uses the host update path without recursive diagnostics', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');
  const syncStart = hostAppSource.indexOf('const syncApplePlaybackState = useCallback(async ({ force = false } = {}) => {');
  const syncEnd = hostAppSource.indexOf('syncApplePlaybackStateRef.current = syncApplePlaybackState;', syncStart);
  const syncBlock = hostAppSource.slice(syncStart, syncEnd);

  assert.notEqual(syncStart, -1, 'Host app should keep Apple playback sync callback');
  assert.match(syncBlock, /await updateRoom\(patch\);/, 'Apple playback sync should use the host callable update path so production rules do not reject direct room writes');
  assert.doesNotMatch(syncBlock, /updateDoc\(doc\(db, 'artifacts'/, 'Apple playback sync should not direct-write the room document from the browser');
  assert.doesNotMatch(syncBlock, /reportAppleMusicDiagnostic\('playback_sync'/, 'Apple playback sync failures should not recursively write diagnostics through updateRoomAsHost');
  assert.match(syncBlock, /\}, \[roomCode, updateRoom\]\);/, 'Apple playback sync should depend on the audited room update helper');
});
test('host app declares room state before Apple playback effects depend on it', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');
  const roomStateIndex = hostAppSource.indexOf('const [room, setRoom] = useState(null);');
  const appleSyncResetEffectIndex = hostAppSource.indexOf("applePlaybackSyncKeyRef.current = '';");

  assert.notEqual(roomStateIndex, -1, 'Host app should declare room state in the main host component');
  assert.notEqual(appleSyncResetEffectIndex, -1, 'Host app should keep the Apple playback sync reset effect');
  assert.equal(
    roomStateIndex < appleSyncResetEffectIndex,
    true,
    'Room state must be declared before Apple playback effects reference it in dependency arrays',
  );
});

test('stage-start flow updates room state before marking the queue entry performing', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');
  const helperSource = readFileSync('src/apps/Host/startQueueSongOnStage.js', 'utf8');

  const hostStageFlowSource = hostAppSource.slice(
    hostAppSource.indexOf('const startQueueSongOnStage = async ({'),
    hostAppSource.indexOf('// Background tracks and sounds imported from gameDataConstants.js'),
  );
  const helperStageFlowSource = helperSource;

  const hostRoomUpdateIndex = hostStageFlowSource.indexOf('await updateRoom({');
  const hostQueueUpdateIndex = hostStageFlowSource.indexOf("await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', safeSongId), {");
  const helperRoomUpdateIndex = helperStageFlowSource.indexOf('await updateRoom({');
  const helperQueueUpdateIndex = helperStageFlowSource.indexOf("await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', safeSongId), {");

  assert.notEqual(hostRoomUpdateIndex, -1, 'Host app should update room state in the stage-start flow');
  assert.notEqual(hostQueueUpdateIndex, -1, 'Host app should still mark the queue entry performing after a stage start');
  assert.equal(
    hostRoomUpdateIndex < hostQueueUpdateIndex,
    true,
    'Host app should update Public TV room state before it marks the queue entry performing',
  );

  assert.notEqual(helperRoomUpdateIndex, -1, 'Shared stage-start helper should update room state');
  assert.notEqual(helperQueueUpdateIndex, -1, 'Shared stage-start helper should still mark the queue entry performing');
  assert.equal(
    helperRoomUpdateIndex < helperQueueUpdateIndex,
    true,
    'Shared stage-start helper should update room state before it marks the queue entry performing',
  );
});

test('room settings avoids duplicate-looking event and base preset choices', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');

  assert.match(
    hostAppSource,
    /activeRoomEventProfile\?\.basePresetId/,
    'Room settings should know when an event package owns a base room preset',
  );
  assert.match(
    hostAppSource,
    /roomSettingsHostPresetList\.map/,
    'Room settings should render the filtered host preset list',
  );
  assert.match(
    hostAppSource,
    /Base room: \{profile\.basePresetLabel\}/,
    'Event cards should explain which base room preset they apply',
  );
});

test('room settings persists Search Sources toggles and preset defaults to the room', () => {
  assert.match(
    hostAppSource,
    /const DEFAULT_SEARCH_SOURCES = Object\.freeze\(\{ local: true, youtube: true, itunes: true \}\);/,
    'Host room settings should share a single default for local, YouTube, and Apple search sources.',
  );
  assert.match(
    hostAppSource,
    /room\?\.searchSources && typeof room\.searchSources === 'object'[\s\S]*?normalizeHostSearchSources\(room\.searchSources, presetSearchSources\)/,
    'Host state sync should prefer the saved room Search Sources over preset defaults.',
  );
  assert.match(
    hostAppSource,
    /await updateRoom\(\{ searchSources: nextSources \}\);/,
    'Search Sources buttons should persist changes to the room document.',
  );
  assert.match(
    hostAppSource,
    /setSearchSources\(previousSources\);[\s\S]*?toast\('Could not update search sources\.'\);/,
    'Failed Search Sources saves should roll the UI back and warn the host.',
  );
  assert.match(
    hostAppSource,
    /searchSources: normalizeHostSearchSources\(preset\.searchSources \|\| \{\}, DEFAULT_SEARCH_SOURCES\),/,
    'Applying a room preset should persist that preset Search Sources package into the room.',
  );
  assert.match(
    hostAppSource,
    /setSearchSources\(normalizeHostSearchSources\(payload\.searchSources \|\| \{\}, DEFAULT_SEARCH_SOURCES\)\);/,
    'Preset application should update local Search Sources from the room payload it saved.',
  );
});

test('room setup shells stay top-aligned and scrollable on short viewports', () => {
  const missionSetupShellSource = readFileSync(missionSetupShellPath, 'utf8');

  assert.match(
    hostAppSource,
    /min-h-\[100dvh\] overflow-x-hidden overflow-y-auto overscroll-y-contain/,
    'Standalone room setup should use dynamic viewport height and vertical scrolling so the top cannot render above the visible screen.',
  );
  assert.doesNotMatch(
    hostAppSource,
    /md:justify-center/,
    'Standalone room setup should not vertically center tall content on desktop because that can clip the top edge.',
  );
  assert.match(
    hostAppSource,
    /fixed inset-0 z-\[92\] overflow-y-auto overscroll-y-contain[\s\S]*?pt-\[calc\(env\(safe-area-inset-top\)\+0\.75rem\)\]/,
    'Classic setup modal should reserve safe-area top padding and remain scrollable.',
  );
  assert.match(
    hostAppSource,
    /mx-auto flex min-h-full w-full max-w-6xl items-start/,
    'Classic setup modal should top-align its panel instead of centering tall content.',
  );
  assert.match(
    missionSetupShellSource,
    /fixed inset-0 z-\[92\] overflow-y-auto overscroll-y-contain[\s\S]*?pt-\[calc\(env\(safe-area-inset-top\)\+0\.75rem\)\]/,
    'Guided setup shell should reserve safe-area top padding and remain scrollable.',
  );
  assert.match(
    missionSetupShellSource,
    /mx-auto flex min-h-full w-full max-w-6xl items-start/,
    'Guided setup shell should top-align its panel on short screens.',
  );
});

test('new room setup keeps marquee off unless the host explicitly enables it', () => {
  const nightSetupFlowSource = readFileSync(nightSetupFlowPath, 'utf8');
  const functionsSource = readFileSync(functionsPath, 'utf8');

  assert.match(
    hostAppSource,
    /const \[nightSetupMarqueeEnabled, setNightSetupMarqueeEnabled\] = useState\(false\);/,
    'Classic room setup should not seed the marquee toggle on.',
  );
  assert.match(
    hostAppSource,
    /const \[marqueeShowMode, setMarqueeShowMode\] = useState\('idle'\);/,
    'Room settings should default marquee rotation to idle instead of always-on.',
  );
  assert.match(
    hostAppSource,
    /const \[hypeMeterDisplayMode, setHypeMeterDisplayMode\] = useState\(HYPE_METER_DISPLAY_MODES\.scoreIntegrated\);/,
    'Room settings should default the hype meter into the score display instead of duplicating the top bar.',
  );
  assert.match(
    hostAppSource,
    /<option value=\{HYPE_METER_DISPLAY_MODES\.scoreIntegrated\}>Inside score display<\/option>/,
    'Hosts should be able to choose the integrated score display mode from room settings.',
  );
  assert.match(
    nightSetupFlowSource,
    /nightSetupMarqueeEnabled = false,/,
    'Shared night setup flow should default marquee off.',
  );
  assert.match(
    nightSetupFlowSource,
    /marqueeShowMode: legacyPresetSettings\.marqueeShowMode \|\| 'idle'/,
    'Setup payload fallback should not force always-on marquee mode.',
  );
  assert.match(
    functionsSource,
    /casual: Object\.freeze\(\{[\s\S]*?marqueeEnabled: false,[\s\S]*?marqueeShowMode: "idle"/,
    'Server-side casual provisioning should keep marquee off for newly created rooms.',
  );
  assert.match(
    functionsSource,
    /bingo: Object\.freeze\(\{[\s\S]*?marqueeEnabled: false,[\s\S]*?marqueeShowMode: "idle"/,
    'Server-side bingo provisioning should keep marquee off and avoid always-on marquee mode.',
  );
  assert.match(
    functionsSource,
    /hypeMeterDisplayMode: "score_integrated"/,
    'Server-side provisioning should default new rooms to the non-duplicated integrated score HUD mode.',
  );
  assert.match(
    functionsSource,
    /hideNonEmbeddableYouTube: true/,
    'Server-side provisioning should default new rooms to embeddable-only YouTube search.',
  );
});

test('host audience access toggle gates custom emojis and featured reactions together', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');

  assert.match(
    hostAppSource,
    /Account-gated reactions[\s\S]*Song requests stay open\./,
    'Audience access should state the gated behavior without obscuring open song requests',
  );
  assert.match(
    hostAppSource,
    /premiumReactions: customEmojiAccountRequired \? 'open' : 'account_required'/,
    'Audience access toggle should write the featured reaction access policy with custom emoji access',
  );
  assert.match(
    hostAppSource,
    /Audience Emoji Access/,
    'Audience access control should be labeled as a broader emoji access policy',
  );
});

test('round winners editor can auto-fill from leaderboard stats and prize details', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');

  assert.match(
    hostAppSource,
    /ROUND_WINNER_LEADERBOARD_MODES/,
    'Host should expose leaderboard stat choices for round winner rewards',
  );
  assert.match(
    hostAppSource,
    /buildRoundWinnersDraftFromCandidates\(roundWinnerCandidates, nextMetricKey\)/,
    'Changing the winner stat should auto-fill the podium from the leaderboard',
  );
  assert.match(
    hostAppSource,
    /uploadRoundWinnersPrizeImage/,
    'Host should support uploading a prize image for the podium reveal',
  );
  assert.match(
    hostAppSource,
    /leaderboardMetricKey: leaderboardMode\.key/,
    'Public TV payload should include the rewarded leaderboard stat',
  );
  assert.match(
    hostAppSource,
    /prize: \{\s*title: prizeTitle,\s*imageUrl: prizeImageUrl,\s*imagePath: prizeImagePath,\s*\}/,
    'Public TV payload should include prize title and image metadata',
  );
});

test('host account org fallback builds a literal org id for setup reads', () => {
  assert.match(
    hostAppSource,
    /const buildHostAccountOrgId = \(uid = ''\) => \{[\s\S]*return `org_\$\{token\}`;[\s\S]*\};/,
    'The account-scoped YouTube index fallback should build a real organization id string.',
  );
  assert.doesNotMatch(
    hostAppSource,
    /return org_;/,
    'Room setup must not reference a bare org_ identifier, which crashes production renders.',
  );
});
test('tight 15 catalog sanitation tolerates null entries', () => {
  assert.match(
    hostAppSource,
    /const normalizeTight15Entry = \(entry = \{\}\) => \{\s*const safeEntry = entry && typeof entry === 'object' \? entry : \{\};[\s\S]*String\(safeEntry\.songTitle \|\| safeEntry\.song \|\| ''\)/,
    'Tight 15 normalization should guard null catalog entries before reading songTitle.',
  );
  assert.doesNotMatch(
    hostAppSource,
    /const normalizeTight15Entry = \(entry = \{\}\) => \{\s*const songTitle = String\(entry\.songTitle/,
    'Tight 15 normalization must not read entry.songTitle directly because null entries crash the Games tab.',
  );
});
test('host game control pad submissions remain scrollable above the launchpad', () => {
  assert.match(
    hostAppSource,
    /\(tab === 'run_of_show' \|\| tab === 'games'\) \? 'md:overflow-y-auto' : 'md:overflow-hidden'/,
    'The Games tab main column should scroll because the live game control pad renders above the launchpad.',
  );
  assert.match(
    hostAppSource,
    /data-host-game-submission-scroll="doodle"[^>]*max-h-\[min\(58dvh,34rem\)\][^>]*overflow-y-auto[\s\S]*\{doodleSubmissions\.map\(\(submission\) => \{/,
    'Doodle submissions should render in their own scrollable review grid without truncating to the first eight.',
  );
  assert.match(
    hostAppSource,
    /data-host-game-submission-scroll="selfie"[^>]*max-h-\[min\(58dvh,34rem\)\][^>]*overflow-y-auto[\s\S]*\{selfieSubmissions\.length > 0 \? selfieSubmissions\.map\(\(submission\) => \{/,
    'Selfie submissions should render in their own scrollable review grid without truncating to the first eight.',
  );
  assert.doesNotMatch(
    hostAppSource,
    /(?:doodleSubmissions|selfieSubmissions)\.slice\(0, 8\)\.map/,
    'Host review surfaces should not hide submitted game media behind an arbitrary eight-item cap.',
  );
});

test('doodle-oke host reveal awards the winner from the host surface', () => {
  assert.match(
    hostAppSource,
    /const revealDoodleWinner = async \(\) => \{[\s\S]*await awardWinnerPoints\(winnerUid, rewardPoints, nextWinner\.name, \{[\s\S]*awardKey: `doodle_\$\{roomCode\}_\$\{promptId \|\| 'round'\}`,[\s\S]*source: 'doodle_oke'[\s\S]*winnerAwardedAt: nowMs\(\)/,
    'Doodle-oke reveal should award the selected winner through the host-authorized points callable.',
  );
  assert.doesNotMatch(
    hostAppSource,
    /Winner reveal sent to TV\. The top doodle gets the round reward\./,
    'Doodle-oke host copy should not imply that TV is responsible for the winner award.',
  );
});

test('host top chrome exposes quick rewards in the deck dropdown style', () => {
  const topChromeSource = readFileSync(topChromePath, 'utf8');

  assert.match(
    topChromeSource,
    /data-feature-id="deck-rewards-menu-toggle"/,
    'The live deck should expose a dedicated quick rewards dropdown.',
  );
  assert.match(
    topChromeSource,
    /const fireRoomReward = React\.useCallback[\s\S]*onDropBonus\(amount\)/,
    'Room rewards should use the existing room bonus drop path.',
  );
  assert.match(
    topChromeSource,
    /const fireUserReward = React\.useCallback[\s\S]*onGiftPointsToUser\(targetUid, amount\)/,
    'Individual rewards should use the existing host gift path.',
  );
  assert.match(
    topChromeSource,
    /quickMenuPanelClass[\s\S]*Quick Rewards/,
    'Rewards should render inside the same top chrome dropdown styling primitives as the other host menus.',
  );
  assert.match(
    topChromeSource,
    /QUICK_REWARD_REFILL_PRESETS[\s\S]*friendly[\s\S]*timedLobbyPoints: 25/,
    'Rewards should expose concrete auto-refill presets instead of burying credit pacing in full settings.',
  );
  assert.match(
    topChromeSource,
    /const updateQuickTimedRefill = React\.useCallback[\s\S]*eventCredits: buildProvisionEventCreditsPayload\(nextCredits\)/,
    'Timed refill quick controls should persist through the normalized event credits payload.',
  );
  assert.match(
    topChromeSource,
    /Auto refill[\s\S]*openOpsSection\('audience\.monetization'\)[\s\S]*Full Credits Settings/,
    'Rewards should show only quick credit pacing and link to the full credits editor for deeper settings.',
  );
});

test('room setup exposes host-led assisted-host and crowd-driven launch decisions', () => {
  assert.match(hostAppSource, /ROOM_CONTROL_MODEL_OPTIONS = Object\.freeze\(\[[\s\S]*Host-Led[\s\S]*Assisted Host[\s\S]*Crowd-Driven/);
  assert.match(hostAppSource, /data-room-setup-control-model/);
  assert.match(hostAppSource, /Decide who drives the room before launch/);
  assert.match(hostAppSource, /Host-Led protects full songs[\s\S]*Crowd-Driven enables One-Minute Mic and Auto-DJ/);
  assert.match(hostAppSource, /currentRoomControlModelId = room\?\.oneMinuteMicEnabled === true[\s\S]*'crowd_driven'[\s\S]*autoDj[\s\S]*'assisted_host'[\s\S]*'host_led'/);
  assert.match(hostAppSource, /onClick=\{\(\) => \{ void applyRoomControlModelQuick\(option\.id\); \}\}/);
  assert.match(hostAppSource, /safeModel === 'crowd_driven'[\s\S]*nextAutoDj = safeModel !== 'host_led'/);
  assert.match(hostAppSource, /Host-led full songs restored/);
});

test('host monetization settings explain the capped audience storefront purchase ladder', () => {
  const source = readFileSync(hostAppPath, 'utf8');
  assert.match(
    source,
    /data-feature-id="host-audience-storefront-rules"[\s\S]*2 room-wide boosts and 3 personal packs/,
    'Host monetization settings should tell hosts how many offers the audience storefront merchandises',
  );
  assert.match(
    source,
    /Rewards everyone = party boost with a TV burst\. Rewards buyer only = personal buyer boost/,
    'Host boost offer copy should explain how reward scope maps to audience purchase UX',
  );
});
