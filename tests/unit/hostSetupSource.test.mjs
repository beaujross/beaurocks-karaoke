import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const primaryPicksPath = 'src/apps/Host/components/setup/MissionSetupPrimaryPicks.jsx';
const autopilotPreviewPath = 'src/apps/Host/components/setup/MissionSetupAutopilotPreview.jsx';
const footerPath = 'src/apps/Host/components/setup/MissionSetupFooter.jsx';
const missionSetupShellPath = 'src/apps/Host/components/setup/MissionSetupShell.jsx';
const selfServeLauncherPath = 'src/apps/Host/components/SelfServeModeLauncher.jsx';
const topChromePath = 'src/apps/Host/components/HostTopChrome.jsx';
const launchPadBrowserPath = 'src/apps/Host/components/HostRoomLaunchPadBrowser.jsx';
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
    /Start Room/,
    'Setup footer should use a single plain-language launch action',
  );
  assert.match(
    footerSource,
    /Open TV \+ Copy Link/,
    'Setup footer should keep launch links as a secondary action',
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
    /Room defaults/,
    'Room creation should frame preset-backed setup as room defaults.',
  );
  assert.match(
    launchPadBrowserSource,
    /<select[\s\S]*value=\{resolvedLaunchPresetId\}/,
    'Room creation should use a compact defaults selector instead of a wall of preset cards.',
  );
  assert.match(
    launchPadBrowserSource,
    /Defaults configure queue, requests, search, TV\/crowd layers, automation, and audience access\./,
    'Room defaults should explain the product areas affected by the selected preset.',
  );
  assert.match(
    launchPadBrowserSource,
    /selectedPresetImpactRows\.map\(\(row\) =>/,
    'Room creation should show a concise impact preview for the selected defaults.',
  );
  assert.match(
    launchPadBrowserSource,
    /Start time optional/,
    'Room start time should be framed as optional instead of a required primary field.',
  );
  assert.match(
    launchPadBrowserSource,
    /Planning ahead\?/,
    'Secondary show-plan creation should be tucked behind a planning disclosure.',
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
    /Custom emoji and featured voting reactions can require a BeauRocks account\./,
    'Audience access copy should describe both profile emojis and voting reactions',
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
