import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const launchPadBrowserPath = 'src/apps/Host/components/HostRoomLaunchPadBrowser.jsx';
const joinPosterModalPath = 'src/apps/Host/components/RoomJoinPosterModal.jsx';
const launchPadPath = 'src/apps/Host/components/HostRoomLaunchPad.jsx';
const roomManagerPath = 'src/apps/Host/hooks/useHostRoomManager.js';

test('AAHF launch flow defaults the requested room code and exposes join poster actions', () => {
  const source = readFileSync(launchPadBrowserPath, 'utf8');

  assert.match(
    source,
    /if \(resolvedLaunchPresetId !== 'aahf'\) return;\s*setLaunchRequestedRoomCode\(\(current\) => String\(current \|\| ''\)\.trim\(\) \? current : 'AAHF'\);/s,
    'AAHF preset should prefill the stable AAHF room code when the field is empty',
  );
  assert.match(
    source,
    /\}, \[resolvedLaunchPresetId, setLaunchRequestedRoomCode\]\);/,
    'Clearing the AAHF room code should not immediately retrigger the preset default',
  );
  const workspaceStateSource = readFileSync('src/apps/Host/hooks/useHostWorkspaceState.js', 'utf8');
  assert.match(
    workspaceStateSource,
    /const \[rawLaunchRoomName, setLaunchRoomName\] = useState\(\(\) => \{[\s\S]*if \(rawLaunchRoomName !== null\) return rawLaunchRoomName;/,
    'Room name drafts should distinguish untouched defaults from an intentionally empty input',
  );
  assert.match(
    source,
    /placeholder=\{resolvedLaunchPresetId === 'aahf' \? 'AAHF' : 'Optional'\}/,
    'Requested room code input should hint AAHF when the festival preset is selected',
  );
  assert.match(
    source,
    /AAHF rooms default to room code AAHF so posters and QR signage stay stable\./,
    'Launch flow should explain why the AAHF room code is prefilled',
  );
  assert.match(
    source,
    />\s*Join Poster\s*</,
    'Room manager should expose a direct join poster action for the selected room',
  );
  assert.match(
    source,
    /<RoomJoinPosterModal[\s\S]*audienceUrl=\{activeJoinPosterRoom\.audienceUrl\}/,
    'Room manager should render the branded join poster modal with the resolved audience URL',
  );
});

test('join poster modal stays brand-forward and print-ready', () => {
  const source = readFileSync(joinPosterModalPath, 'utf8');

  assert.match(source, /QRCode\.toDataURL/);
  assert.match(source, /window\.open\('', '_blank'/);
  assert.match(source, /window\.print\(\)/);
  assert.match(source, /Check in at the front door\./);
  assert.match(source, /Scan the QR code with your phone\./);
  assert.match(source, /Pick your emoji and join the room\./);
  assert.match(source, /Request songs and watch the queue live\./);
  assert.match(source, /Copy URL/);
  assert.match(source, /Print Poster/);
});

test('room browser keeps results adjacent to folders, supports pinning, and does not cap host rooms to a tiny recent subset', () => {
  const browserSource = readFileSync(launchPadBrowserPath, 'utf8');
  const launchPadSource = readFileSync(launchPadPath, 'utf8');
  const roomManagerSource = readFileSync(roomManagerPath, 'utf8');

  assert.match(browserSource, /data-room-browser-bucket=\{bucket\.id\}/);
  assert.match(browserSource, /ref=\{roomBrowserResultsRef\}/);
  assert.match(browserSource, /handleRoomBrowserBucketClick/);
  assert.ok(browserSource.includes("roomBrowserResultsRef.current?.scrollIntoView"));
  assert.match(browserSource, /xl:col-start-2 xl:row-start-1/);
  assert.match(browserSource, /xl:col-start-3 xl:row-start-1/);
  assert.ok(browserSource.includes("openExistingRoomWorkspace(roomItem.code, 'ops.room_setup')"));
  assert.match(browserSource, /\{roomPinned \? 'Pinned' : 'Pin'\}/);
  assert.match(browserSource, /roomItem\.hasRecap && audienceBase[\s\S]*runFeaturedAction\('recap', roomItem\)[\s\S]*Recap/);
  assert.match(browserSource, /selectedRoom\.hasRecap && audienceBase[\s\S]*View Recap/);
  assert.match(browserSource, /Pin Room/);
  assert.match(launchPadSource, /ROOM_BROWSER_PIN_STORAGE_KEY/);
  assert.match(launchPadSource, /pinnedRoomCodeSet\.has/);
  assert.match(launchPadSource, /const \[roomBrowserSort, setRoomBrowserSort\] = useState\('newest'\);/);
  assert.match(browserSource, /Newest Rooms First/);
  assert.match(browserSource, /Recently Active/);
  assert.match(browserSource, /Upcoming First/);
  assert.match(browserSource, /Room Name/);
  assert.match(browserSource, /line-clamp-2/);
  assert.match(browserSource, /title=\{roomItem\.roomName \|\| roomItem\.code\}/);
  assert.match(launchPadSource, /const \[browserNowMs, setBrowserNowMs\] = useState\(\(\) => Date\.now\(\)\);/);
  assert.match(launchPadSource, /window\.setInterval\(\(\) => \{\s*setBrowserNowMs\(Date\.now\(\)\);\s*\}, 60000\);/);
  assert.doesNotMatch(roomManagerSource, /limit\(20\)/);
  assert.doesNotMatch(roomManagerSource, /\.slice\(0, 8\)/);
});

test('AAHF rooms still drive the default launchpad focus without a dedicated browser spotlight card', () => {
  const browserSource = readFileSync(launchPadBrowserPath, 'utf8');
  const launchPadSource = readFileSync(launchPadPath, 'utf8');

  assert.match(launchPadSource, /const eventFocusRoom = \[\.\.\.tonightRooms, \.\.\.upcomingRooms, \.\.\.cleanupRooms, \.\.\.archivedRooms\]\.find\(isAahfRoom\) \|\| null;/);
  assert.match(launchPadSource, /const featuredRoom = eventFocusRoom\s*\|\|\s*\[\.\.\.recentHostRooms\]\.find\(\(roomItem\) => pinnedRoomCodeSet\.has/);
  assert.match(launchPadSource, /const defaultRoomBrowserFilter = findBucketForRoomCode\(featuredRoom\?\.code, roomBrowserBuckets\) \|\| 'ready';/);
  assert.match(launchPadSource, /const \[selectedRoomCode, setSelectedRoomCode\] = useState\(\(\) => String\(featuredRoom\?\.code \|\| ''\)\.trim\(\)\.toUpperCase\(\)\);/);
  assert.match(launchPadSource, /setRoomBrowserFilter\(targetBucketId\);/);
  assert.doesNotMatch(browserSource, /Event Focus/);
  assert.match(browserSource, /Room controls/);
  assert.match(browserSource, />\s*Room Settings\s*</);
  assert.match(browserSource, />\s*Reset Room\s*</);
});

test('room setup rail keeps one workspace open at a time so the browser stays primary', () => {
  const browserSource = readFileSync(launchPadBrowserPath, 'utf8');

  assert.match(browserSource, /const \[roomSetupMode, setRoomSetupMode\] = useState\('manage'\);/);
  assert.match(browserSource, /Existing Rooms/);
  assert.match(browserSource, /Create Room/);
  assert.match(browserSource, /createModeActive = roomSetupMode === 'create'/);
  assert.match(browserSource, /manageModeActive = roomSetupMode === 'manage'/);
  assert.match(browserSource, /existingRoomCount = roomBrowserBuckets\.find\(\(bucket\) => bucket\.id === 'all'\)\?\.rooms\.length \|\| 0/);
  assert.match(browserSource, /\{manageModeActive \? \(/);
  assert.match(browserSource, /\{createModeActive \? \(/);
  assert.match(browserSource, /xl:grid-cols-\[220px_minmax\(0,1fr\)_380px\]/);
  assert.match(browserSource, /xl:sticky xl:top-4/);
  assert.ok(browserSource.includes("openExistingRoomWorkspace(roomItem.code, 'ops.room_setup')"));
  assert.match(browserSource, /More room actions/);
  assert.match(browserSource, /activeRoomSetupTab\.helper/);
  assert.doesNotMatch(browserSource, /Pick a task/);
  assert.match(browserSource, /onClick=\{\(\) => setRoomSetupMode\(tab\.id\)\}/);

  assert.match(browserSource, /ROOM_SETUP_TABS = Object\.freeze\(\[/);
  assert.match(browserSource, /id: 'manage'/);
  assert.match(browserSource, /Choose tonight&apos;s rewards/);
  assert.doesNotMatch(browserSource, /Credits and promos/);
  assert.doesNotMatch(browserSource, /EventCreditsConfigPanel/);
  assert.match(browserSource, /Eligible Rooms get one separate/);
  assert.match(browserSource, /It never changes Points or performance scoring/);
});

test('quick setup compiles night outcomes and hides overlapping primitives by default', () => {
  const source = readFileSync(launchPadBrowserPath, 'utf8');

  assert.match(source, /data-launch-core-setup="true"/);
  assert.match(source, /data-room-create-premium="true"/);
  assert.match(source, /Name it, choose a recipe, and decide who can join\./);
  assert.match(source, /data-launch-room-control="true"/);
  assert.match(source, /data-launch-guest-access="true"/);
  assert.match(source, /data-launch-room-privacy="true"/);
  assert.match(source, /data-launch-media-readiness="true"/);
  assert.match(source, /Host-Led[\s\S]*Assisted Host[\s\S]*Crowd-Driven/);
  assert.match(source, /openNightSetup: true/);
  assert.match(source, /Continue to Room Readiness/);
  assert.match(source, /Launch Room to open Public TV and copy the Audience App link/);
  assert.match(source, /Custom room code/);
  assert.match(source, /data-launch-configuration-contract="true"/);
  assert.match(source, /LAUNCH_NIGHT_TYPE_OPTIONS = Object\.freeze\(\[[\s\S]*Party Karaoke[\s\S]*Crowd Sing-Along[\s\S]*Score Challenge[\s\S]*Karaoke \+ Trivia/);
  assert.match(source, /data-launch-room-recipe=\{option\.id\}/);
  assert.match(
    source,
    /const applyLaunchNightType =[\s\S]*setLaunchOperatingModel\(option\.operatingModel\);[\s\S]*applyLaunchEconomy\(option\.economyMode\);[\s\S]*setHostNightPreset\(option\.presetId\)/,
    'Night type should compile host style, economy, and preset together',
  );
  assert.match(source, /One choice sets the recommended queue, host style, automation, and economy defaults\./);
  assert.match(source, /const \[showAdvancedSetup, setShowAdvancedSetup\] = useState\(false\);/);
  assert.match(source, /aria-expanded=\{showAdvancedSetup\}/);
  assert.match(
    source,
    /\$\{showAdvancedSetup \? '' : 'hidden'\}[\s\S]*data-launch-operating-model/,
    'Detailed host-style controls should stay behind Advanced Setup',
  );
  assert.match(
    source,
    /\$\{showAdvancedSetup \? '' : 'hidden'\}[\s\S]*data-launch-template-options/,
    'Detailed template controls should stay behind Advanced Setup',
  );
  assert.match(source, /Step 1 - Room identity/);
  assert.match(source, /Step 2 - Guest entry/);
  assert.match(source, /Step 3 - Points & rewards/);
  assert.match(source, /resolveRoomSetupEffectiveBehavior/);
  assert.match(source, /data-launch-effective-behavior="true"/);
  assert.match(source, /data-launch-effective-domain=\{domain\.key\}/);
  assert.match(source, /nightPresetPayload: launchPresetPayloadPreview/);
  assert.doesNotMatch(source, /nightPresetPayload: buildLaunchPresetPayload\(\)/);
  assert.match(source, /Draft restored from this browser\. Guest and promo codes are never saved\./);
  assert.match(source, /HOST_LAUNCH_EXPERIENCE_DRAFT_KEY/);
  assert.match(source, /buildHostLaunchDraftKey/);
  assert.match(
    source,
    /persistHostLaunchDraftPart\(launchExperienceDraftKey, \{\s*joinAccessMode: launchJoinAccessMode,\s*operatingModel: launchOperatingModel,\s*nightType: launchNightType,\s*mediaSources: launchMediaSources,\s*\}\);/,
    'Recovered experience drafts should store only non-secret setup choices',
  );
});
