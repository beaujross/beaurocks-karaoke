import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { getHostRoomLaunchProgress } from '../../src/apps/Host/hostRoomQuickStartModel.js';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const guideSource = readFileSync('src/apps/Host/components/HostRoomQuickStart.jsx', 'utf8');

test('Room launch completion includes the room plan and two guest-facing essentials', () => {
  assert.deepEqual(
    getHostRoomLaunchProgress({ tvOpened: false, joinLinkCopied: false, roomSetupReviewed: false }),
    { completedCount: 0, totalCount: 3, complete: false, percent: 0 },
  );
  assert.deepEqual(
    getHostRoomLaunchProgress({ tvOpened: true, joinLinkCopied: true, roomSetupReviewed: true }),
    { completedCount: 3, totalCount: 3, complete: true, percent: 100 },
  );
});

test('live-room guidance makes Room Setup part of readiness and keeps soundtrack optional', () => {
  assert.match(guideSource, /data-host-room-launch-guide="true"/);
  assert.match(guideSource, /data-room-readiness-actions="true"/);
  assert.match(guideSource, /Set the Night/);
  assert.match(guideSource, /Open Public TV/);
  assert.match(guideSource, /Copy Join Link/);
  assert.doesNotMatch(guideSource, /Optional setup/);
  assert.match(guideSource, /Optional · Soundtrack/);
  assert.match(guideSource, /Connect Apple Music/);
  assert.match(guideSource, /Complete these three readiness steps/);
});

test('HostApp renders the guide in the live Room and removes the disconnected chrome contract', () => {
  assert.match(hostAppSource, /<HostRoomQuickStart[\s\S]*tvOpened=\{!!activeQuickStartProgress\.tvOpened\}[\s\S]*joinLinkCopied=\{!!activeQuickStartProgress\.joinLinkCopied\}/);
  assert.doesNotMatch(hostAppSource, /stageQuickStartItems=\{stageQuickStartItems\}/);
  assert.doesNotMatch(hostAppSource, /roomReadinessSummary=\{roomReadinessState\.summary\}/);
  assert.match(hostAppSource, /host_room_launch_guide_action/);
  assert.match(hostAppSource, /host_room_launch_guide_dismissed/);
});
