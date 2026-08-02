import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const hostQueueTabSource = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');

test('host app lazy-loads heavy host surfaces behind React.lazy boundaries', () => {
  assert.match(hostAppSource, /const lazyHostSurface = \(loader,[\s\S]*=> React\.lazy/);
  for (const component of ['HostQueueTab', 'HostRoomLaunchPad', 'RunOfShowDirectorPanel', 'EventCreditsConfigPanel', 'ChatSettingsPanel', 'HostQaDebugPanel', 'HostChatPanel', 'SelfServeModeLauncher']) assert.match(hostAppSource, new RegExp(`const ${component} = lazyHostSurface\\(\\(\\) => import\\('\\.\\/components\\/${component}'\\)`));
  assert.match(hostAppSource, /const UnifiedGameLauncher = lazyHostSurface\(\(\) => import\('\.\.\/\.\.\/components\/UnifiedGameLauncher'\)/);
  assert.match(hostAppSource, /const DeferredHostSurfaceFallback = \(\{ label = 'Loading host tools\.\.\.' \}\) => \(/);
  assert.doesNotMatch(hostAppSource, /const ModerationInboxDrawer = React\.lazy\(\(\) => import\('\.\/components\/ModerationInboxDrawer'\)\);/);
  assert.doesNotMatch(hostAppSource, /const QueueTab = \(/);
});

test('host app wraps deferred host surfaces in suspense fallbacks', () => {
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label=\{\`Loading \$\{HOST_LIVE_OPS_LANGUAGE\.lineup\}\.\.\.\`\} \/>\}>[\s\S]*<HostQueueTab/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading room manager\.\.\." \/>\}>[\s\S]*<HostRoomLaunchPad/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label=\{\`Loading \$\{HOST_LIVE_OPS_LANGUAGE\.showPlan\}\.\.\.\`\} \/>\}>[\s\S]*<RunOfShowDirectorPanel/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading branding tools\.\.\." \/>\}>[\s\S]*<HostLogoManager[\s\S]*<HostOrbSkinManager/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading audience store settings\.\.\." \/>\}>[\s\S]*<EventCreditsConfigPanel/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading chat settings\.\.\." \/>\}>[\s\S]*<ChatSettingsPanel/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading QA tools\.\.\." \/>\}>[\s\S]*<HostQaDebugPanel/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading host chat\.\.\." \/>\}>[\s\S]*<HostChatPanel/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading room format tools\.\.\." \/>\}>[\s\S]*<SelfServeModeLauncher/);
  assert.match(hostAppSource, /<React\.Suspense fallback=\{<DeferredHostSurfaceFallback label="Loading game launcher\.\.\." \/>\}>[\s\S]*<UnifiedGameLauncher/);
  assert.doesNotMatch(hostAppSource, /showModerationInbox \? \(\s*<React\.Suspense fallback=\{null\}>[\s\S]*<ModerationInboxDrawer/);
  assert.match(hostQueueTabSource, /const QueueYouTubeSearchModal = React\.lazy\(\(\) => import\('\.\/QueueYouTubeSearchModal'\)\);/);
  assert.match(hostQueueTabSource, /const QueueEditSongModal = React\.lazy\(\(\) => import\('\.\/QueueEditSongModal'\)\);/);
  assert.match(hostQueueTabSource, /ytSearchOpen \? \(\s*<React\.Suspense fallback=\{null\}>[\s\S]*<QueueYouTubeSearchModal/);
  assert.match(hostQueueTabSource, /editingSongId \? \(\s*<React\.Suspense fallback=\{null\}>[\s\S]*<QueueEditSongModal/);
});
