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
    /if \(resolvedLaunchPresetId !== 'aahf'\) return;\s*if \(String\(launchRequestedRoomCode \|\| ''\)\.trim\(\)\) return;\s*setLaunchRequestedRoomCode\('AAHF'\);/s,
    'AAHF preset should prefill the stable AAHF room code when the field is empty',
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
  assert.match(browserSource, /Pin Room/);
  assert.match(launchPadSource, /ROOM_BROWSER_PIN_STORAGE_KEY/);
  assert.match(launchPadSource, /pinnedRoomCodeSet\.has/);
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
  assert.match(browserSource, /Pick a task/);
  assert.match(browserSource, /onClick=\{\(\) => setRoomSetupMode\('create'\)\}/);
  assert.match(browserSource, /ROOM_SETUP_TABS = Object\.freeze\(\[/);
  assert.match(browserSource, /id: 'manage'/);
  assert.match(browserSource, /How should points work\?/);
  assert.doesNotMatch(browserSource, /Credits and promos/);
  assert.doesNotMatch(browserSource, /EventCreditsConfigPanel/);
});
