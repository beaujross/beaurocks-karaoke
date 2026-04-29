import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const hostQueueTabSource = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');

test('host app lazy-loads heavy host surfaces behind React.lazy boundaries', () => {
  assert.match(hostAppSource, /const HostQueueTab = React\.lazy\(\(\) => import\('\.\/components\/HostQueueTab'\)\);/);
  assert.match(hostAppSource, /const HostRoomLaunchPad = React\.lazy\(\(\) => import\('\.\/components\/HostRoomLaunchPad'\)\);/);
  assert.match(hostAppSource, /const RunOfShowDirectorPanel = React\.lazy\(\(\) => import\('\.\/components\/RunOfShowDirectorPanel'\)\);/);
  assert.match(hostAppSource, /const EventCreditsConfigPanel = React\.lazy\(\(\) => import\('\.\/components\/EventCreditsConfigPanel'\)\);/);
  assert.match(hostAppSource, /const ChatSettingsPanel = React\.lazy\(\(\) => import\('\.\/components\/ChatSettingsPanel'\)\);/);
  assert.match(hostAppSource, /const HostQaDebugPanel = React\.lazy\(\(\) => import\('\.\/components\/HostQaDebugPanel'\)\);/);
  assert.match(hostAppSource, /const DeferredHostSurfaceFallback = \(\{ label = 'Loading host tools\.\.\.' \}\) => \(/);
  assert.doesNotMatch(hostAppSource, /const ModerationInboxDrawer = React\.lazy\(\(\) => import\('\.\/components\/ModerationInboxDrawer'\)\);/);
  assert.doesNotMatch(hostAppSource, /const QueueTab = \(/);
});

test('host app wraps deferred host surfaces in suspense fallbacks', () => {
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading live queue\.\.\." \/>\}>[\s\S]*<HostQueueTab/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading room manager\.\.\." \/>\}>[\s\S]*<HostRoomLaunchPad/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading show conveyor\.\.\." \/>\}>[\s\S]*<RunOfShowDirectorPanel/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading branding tools\.\.\." \/>\}>[\s\S]*<HostLogoManager[\s\S]*<HostOrbSkinManager/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading audience store settings\.\.\." \/>\}>[\s\S]*<EventCreditsConfigPanel/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading chat settings\.\.\." \/>\}>[\s\S]*<ChatSettingsPanel/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading QA tools\.\.\." \/>\}>[\s\S]*<HostQaDebugPanel/);
  assert.doesNotMatch(hostAppSource, /showModerationInbox \? \(\s*<React\.Suspense fallback=\{null\}>[\s\S]*<ModerationInboxDrawer/);
  assert.match(hostQueueTabSource, /const QueueYouTubeSearchModal = React\.lazy\(\(\) => import\('\.\/QueueYouTubeSearchModal'\)\);/);
  assert.match(hostQueueTabSource, /const QueueEditSongModal = React\.lazy\(\(\) => import\('\.\/QueueEditSongModal'\)\);/);
  assert.match(hostQueueTabSource, /ytSearchOpen \? \(\s*<React\.Suspense fallback=\{null\}>[\s\S]*<QueueYouTubeSearchModal/);
  assert.match(hostQueueTabSource, /editingSongId \? \(\s*<React\.Suspense fallback=\{null\}>[\s\S]*<QueueEditSongModal/);
});
