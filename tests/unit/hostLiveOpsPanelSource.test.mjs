import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostAppPath = path.resolve(__dirname, '../../src/apps/Host/HostApp.jsx');
const hostQueueTabPath = path.resolve(__dirname, '../../src/apps/Host/components/HostQueueTab.jsx');
const hostInboxPanelPath = path.resolve(__dirname, '../../src/apps/Host/components/HostInboxPanel.jsx');
const stagePanelPath = path.resolve(__dirname, '../../src/apps/Host/components/StageNowPlayingPanel.jsx');
const liveOpsPanelPath = path.resolve(__dirname, '../../src/apps/Host/components/HostLiveOpsPanel.jsx');

test('host stage runtime keeps the stage primary and leaves the snapshot strip below it', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');
  const hostQueueTabSource = readFileSync(hostQueueTabPath, 'utf8');

  assert.match(hostAppSource, /<HostQueueTab[\s\S]*runtimeVisible=\{tab === 'stage'\}/);
  assert.match(hostAppSource, /const recentCoHostSignals = useMemo/);
  assert.match(hostAppSource, /isCoHostSignalActivity\(entry\)/);
  assert.match(hostAppSource, /coHostSignals: recentCoHostSignals/);
  assert.match(hostAppSource, /const coHostSignalToastStateRef = useRef/);
  assert.match(hostAppSource, /const \[sceneLibraryModalOpen, setSceneLibraryModalOpen\] = useState\(false\)/);
  assert.match(hostAppSource, /const stagePreviewAutoCollapseRef = useRef\(false\)/);
  assert.match(hostAppSource, /if \(tab !== 'stage'\) \{\s*stagePreviewAutoCollapseRef\.current = false;\s*return;\s*\}/);
  assert.match(hostAppSource, /setAudiencePreviewCollapsed\(true\)/);
  assert.match(hostAppSource, /setPublicTvPreviewCollapsed\(true\)/);
  assert.match(hostAppSource, /onSceneLibraryModalChange: setSceneLibraryModalOpen/);
  assert.match(hostAppSource, /audiencePreviewVisible && tab !== 'run_of_show' && !sceneLibraryModalOpen/);
  assert.match(hostAppSource, /publicTvPreviewVisible && !sceneLibraryModalOpen/);
  assert.match(hostAppSource, /contextTitle/);
  assert.match(hostAppSource, /contextMeta/);
  assert.match(hostAppSource, /performanceSongTitle/);
  assert.match(hostAppSource, /performanceArtistName/);
  assert.match(hostAppSource, /performanceAlbumArtUrl/);
  assert.match(hostAppSource, /performanceElapsedSec/);
  assert.match(hostAppSource, /toast\(`Co-host: \$\{freshSignal\.hostLabel\}/);
  assert.match(hostAppSource, /window\.dispatchEvent\(new CustomEvent\('beaurocks:focus-queue-live-controls'\)\)/);
  assert.match(hostAppSource, /window\.dispatchEvent\(new CustomEvent\('beaurocks:focus-host-inbox'\)\)/);
  assert.match(hostQueueTabSource, /import HostLiveOpsPanel from '\.\/HostLiveOpsPanel';/);
  assert.match(hostQueueTabSource, /import HostInboxPanel from '\.\/HostInboxPanel';/);
  assert.match(hostQueueTabSource, /<HostLiveOpsPanel[\s\S]*current=\{current\}/);
  assert.match(hostQueueTabSource, /runOfShowFlightedItem=\{runOfShowStagedItem\}/);
  assert.match(hostQueueTabSource, /runOfShowOnDeckItem=\{runOfShowNextItem\}/);
  assert.match(hostQueueTabSource, /showStageSummaryHeader=\{false\}/);
  assert.match(hostQueueTabSource, /h-full min-h-0 flex flex-col overflow-hidden/);
  assert.match(hostQueueTabSource, /flex-1 min-h-0 overflow-y-auto custom-scrollbar/);
  assert.match(hostQueueTabSource, /queueWorkspaceTabListClass/);
  assert.match(hostQueueTabSource, /renderQueueWorkspaceTabButton/);
  assert.match(hostQueueTabSource, /featureId: 'queue-surface-tab-inbox-desktop'/);
  assert.match(hostQueueTabSource, /data-feature-id="panel-inbox"/);
  assert.match(hostQueueTabSource, /window\.addEventListener\('beaurocks:focus-queue-live-controls', focusQueueControls\)/);
  assert.match(hostQueueTabSource, /window\.addEventListener\('beaurocks:focus-host-inbox', focusInbox\)/);
  assert.match(hostQueueTabSource, /<HostInboxPanel[\s\S]*moderationQueueItems=\{moderationQueueItems\}/);
  assert.match(hostQueueTabSource, /data-feature-id="open-tv-library"/);
  assert.match(hostQueueTabSource, /data-feature-id="tv-moments-library-modal"/);
  assert.match(hostQueueTabSource, /onSceneLibraryModalChange\?\.\(sceneLibraryOpen\)/);
  assert.match(hostQueueTabSource, /multiple/);
  assert.match(hostQueueTabSource, /Upload Scenes/);
  assert.ok(
    hostQueueTabSource.indexOf('label="Stage"') < hostQueueTabSource.indexOf('<HostLiveOpsPanel'),
    'Stage should render before the room snapshot strip so transport stays higher in the left rail',
  );
});

test('room snapshot panel keeps host runtime compact and hopper-aware', () => {
  const source = readFileSync(liveOpsPanelPath, 'utf8');

  assert.match(source, /data-feature-id="host-live-ops-panel"/);
  assert.match(source, /const SnapshotCard = \(\{/);
  assert.match(source, /Live Snapshot/);
  assert.match(source, /On Stage/);
  assert.match(source, /Next Singer/);
  assert.match(source, /Planned/);
  assert.match(source, /meta=\{queuedMoment \? \(runOfShowFlightedItem\?\.id \? 'Armed' : 'On Deck'\) : \(runOfShowEnabled \? 'Plan' : 'Planner Off'\)\}/);
  assert.match(source, /\? 'Open slot'/);
  assert.match(source, />\s*Planner\s*</);
  assert.doesNotMatch(source, /Tell Host/);
  assert.doesNotMatch(source, /End Current/);
  assert.doesNotMatch(source, /Re-Queue Current/);
});

test('host inbox panel aggregates moderation, co-host notes, and chat into two buckets', () => {
  const source = readFileSync(hostInboxPanelPath, 'utf8');

  assert.match(source, /data-feature-id="host-inbox-panel"/);
  assert.match(source, /Host Inbox/);
  assert.match(source, /Needs Host/);
  assert.match(source, /Everything Else/);
  assert.match(source, /Co-host notes, moderation, direct messages, and lounge chatter in one live view\./);
  assert.match(source, /groupChatMessages/);
  assert.match(source, /source: 'Moderation'/);
  assert.match(source, /source: 'Co-Host'/);
  assert.match(source, /source: 'DM'/);
  assert.match(source, /source: 'Audience'/);
  assert.match(source, /Open Action Tools/);
  assert.match(source, /Pop Out Chat/);
  assert.match(source, /Chat Settings/);
});

test('stage now playing panel can suppress its old summary header when the live lane is present', () => {
  const source = readFileSync(stagePanelPath, 'utf8');

  assert.match(source, /showStageSummaryHeader = true/);
  assert.match(source, /\{showStageSummaryHeader \? \(/);
  assert.match(source, /Live Stage/);
});
