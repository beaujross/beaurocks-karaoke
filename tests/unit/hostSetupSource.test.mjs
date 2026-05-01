import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const primaryPicksPath = 'src/apps/Host/components/setup/MissionSetupPrimaryPicks.jsx';
const autopilotPreviewPath = 'src/apps/Host/components/setup/MissionSetupAutopilotPreview.jsx';
const footerPath = 'src/apps/Host/components/setup/MissionSetupFooter.jsx';
const topChromePath = 'src/apps/Host/components/HostTopChrome.jsx';
const nightSetupFlowPath = 'src/apps/Host/hooks/useHostNightSetupFlow.js';
const hostAppPath = 'src/apps/Host/HostApp.jsx';

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
  const hostAppSource = readFileSync(hostAppPath, 'utf8');

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
  const hostAppSource = readFileSync(hostAppPath, 'utf8');
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
    'Host top chrome should not duplicate queue live controls as a top-level launch surface',
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
    /querySelector\('\[data-feature-id="queue-live-controls"\]'\)/,
    'Readiness should target the queue live-controls anchor instead of reopening setup',
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

test('host setup keeps room uploads available for local playback checks', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');

  assert.match(
    hostAppSource,
    /Room Uploads/,
    'Host app should keep the room upload library visible for local media checks',
  );
  assert.match(
    hostAppSource,
    /accept="video\/\*,audio\/\*,image\/\*"/,
    'Room uploads should accept local audio, video, and image files',
  );
  assert.match(
    hostAppSource,
    /Upload \+ Queue/,
    'Hosts should still be able to upload a local file straight into the queue',
  );
  assert.match(
    hostAppSource,
    /Save To TV Library/,
    'Room uploads should let hosts save uploaded image or video assets into the TV library',
  );
  assert.match(
    hostAppSource,
    /Use In Run Of Show/,
    'Room uploads should let hosts send uploaded image or video assets into the run of show from the shared upload surface',
  );
  assert.match(
    hostAppSource,
    /Save Offline Backup/,
    'Hosts should still be able to save an offline local backup on the host device',
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
