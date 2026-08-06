import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { getHostRoomLaunchProgress } from '../../src/apps/Host/hostRoomQuickStartModel.js';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const guideSource = readFileSync('src/apps/Host/components/HostRoomQuickStart.jsx', 'utf8');

test('Room launch completion includes only the two guest-facing essentials', () => {
  assert.deepEqual(
    getHostRoomLaunchProgress({ tvOpened: false, joinLinkCopied: false }),
    { completedCount: 0, totalCount: 2, complete: false, percent: 0 },
  );
  assert.deepEqual(
    getHostRoomLaunchProgress({ tvOpened: true, joinLinkCopied: true }),
    { completedCount: 2, totalCount: 2, complete: true, percent: 100 },
  );
});

test('live-room guidance separates essential launch actions from optional setup', () => {
  assert.match(guideSource, /data-host-room-launch-guide="true"/);
  assert.match(guideSource, /Open Public TV/);
  assert.match(guideSource, /Copy Join Link/);
  assert.match(guideSource, /Optional setup/);
  assert.match(guideSource, /Adjust Room Setup/);
  assert.match(guideSource, /Connect Apple Music/);
  assert.match(guideSource, /Everything else can wait\./);
});

test('HostApp renders the guide in the live Room and removes the disconnected chrome contract', () => {
  assert.match(hostAppSource, /<HostRoomQuickStart[\s\S]*tvOpened=\{!!activeQuickStartProgress\.tvOpened\}[\s\S]*joinLinkCopied=\{!!activeQuickStartProgress\.joinLinkCopied\}/);
  assert.doesNotMatch(hostAppSource, /stageQuickStartItems=\{stageQuickStartItems\}/);
  assert.doesNotMatch(hostAppSource, /roomReadinessSummary=\{roomReadinessState\.summary\}/);
  assert.match(hostAppSource, /host_room_launch_guide_action/);
  assert.match(hostAppSource, /host_room_launch_guide_dismissed/);
});
