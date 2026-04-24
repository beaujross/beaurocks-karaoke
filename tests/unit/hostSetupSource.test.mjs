import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const primaryPicksPath = 'src/apps/Host/components/setup/MissionSetupPrimaryPicks.jsx';
const autopilotPreviewPath = 'src/apps/Host/components/setup/MissionSetupAutopilotPreview.jsx';
const footerPath = 'src/apps/Host/components/setup/MissionSetupFooter.jsx';
const readinessPath = 'src/apps/Host/components/HostRoomReadinessPanel.jsx';
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
});

test('host panel presents readiness and one launch action before deeper setup', () => {
  const readinessSource = readFileSync(readinessPath, 'utf8');
  const hostAppSource = readFileSync(hostAppPath, 'utf8');

  assert.match(
    readinessSource,
    /Room Readiness/,
    'Host panel should expose room readiness as the main setup model',
  );
  assert.match(
    readinessSource,
    /Launch Room/,
    'Readiness surface should provide one launch action',
  );
  assert.match(
    hostAppSource,
    /<HostRoomReadinessPanel/,
    'Host app should render the readiness surface above the live queue',
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
