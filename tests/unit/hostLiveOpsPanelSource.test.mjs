import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostAppPath = path.resolve(__dirname, '../../src/apps/Host/HostApp.jsx');
const hostQueueTabPath = path.resolve(__dirname, '../../src/apps/Host/components/HostQueueTab.jsx');
const stagePanelPath = path.resolve(__dirname, '../../src/apps/Host/components/StageNowPlayingPanel.jsx');
const liveOpsPanelPath = path.resolve(__dirname, '../../src/apps/Host/components/HostLiveOpsPanel.jsx');

test('host stage runtime renders a consolidated live lane panel above the stage card', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');
  const hostQueueTabSource = readFileSync(hostQueueTabPath, 'utf8');

  assert.match(hostAppSource, /<HostQueueTab[\s\S]*runtimeVisible=\{tab === 'stage'\}/);
  assert.match(hostAppSource, /const recentCoHostSignals = useMemo/);
  assert.match(hostAppSource, /isCoHostSignalActivity\(entry\)/);
  assert.match(hostAppSource, /coHostSignals: recentCoHostSignals/);
  assert.match(hostAppSource, /const coHostSignalToastStateRef = useRef/);
  assert.match(hostAppSource, /contextTitle/);
  assert.match(hostAppSource, /contextMeta/);
  assert.match(hostAppSource, /performanceSongTitle/);
  assert.match(hostAppSource, /performanceArtistName/);
  assert.match(hostAppSource, /performanceAlbumArtUrl/);
  assert.match(hostAppSource, /performanceElapsedSec/);
  assert.match(hostAppSource, /toast\(`Co-host: \$\{freshSignal\.hostLabel\}/);
  assert.match(hostQueueTabSource, /import HostLiveOpsPanel from '\.\/HostLiveOpsPanel';/);
  assert.match(hostQueueTabSource, /<HostLiveOpsPanel[\s\S]*current=\{current\}/);
  assert.match(hostQueueTabSource, /runOfShowFlightedItem=\{runOfShowStagedItem\}/);
  assert.match(hostQueueTabSource, /runOfShowOnDeckItem=\{runOfShowNextItem\}/);
  assert.match(hostQueueTabSource, /crowdPulse=\{crowdPulse\}/);
  assert.match(hostQueueTabSource, /coHostSignals=\{coHostSignals\}/);
  assert.match(hostQueueTabSource, /showStageSummaryHeader=\{false\}/);
  assert.match(hostQueueTabSource, /h-full min-h-0 flex flex-col overflow-hidden/);
  assert.match(hostQueueTabSource, /flex-1 min-h-0 overflow-y-auto custom-scrollbar/);
});

test('live lane panel collapses host runtime into now next and conveyor cards', () => {
  const source = readFileSync(liveOpsPanelPath, 'utf8');

  assert.match(source, /data-feature-id="host-live-ops-panel"/);
  assert.match(source, /const getSongArtworkUrl = \(entry = \{\}\) => String\(/);
  assert.match(source, /const getScenePlaceholderMeta = \(item = \{\}\) => \{/);
  assert.match(source, /artworkUrl \? \(/);
  assert.match(source, /placeholderIcon = 'fa-microphone-lines'/);
  assert.match(source, /placeholderLabel = 'Live'/);
  assert.match(source, /bg-gradient-to-br/);
  assert.match(source, /flex flex-col gap-1\.5 sm:flex-row sm:items-start sm:justify-between/);
  assert.match(source, /line-clamp-2 text-\[12px\] font-semibold leading-tight text-white sm:text-\[13px\]/);
  assert.match(source, /line-clamp-2 text-\[10px\] leading-snug text-zinc-400 sm:text-\[11px\]/);
  assert.match(source, /mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3/);
  assert.match(source, /Live Lane/);
  assert.match(source, /Now/);
  assert.match(source, /Next Singer/);
  assert.match(source, /Conveyor/);
  assert.match(source, /fa-bullhorn/);
  assert.match(source, /fa-gamepad/);
  assert.match(source, /fa-user-music/);
  assert.match(source, /Tell Host/);
  assert.match(source, /Trusted co-host notes tied to the live performance/);
  assert.match(source, /coHostSignals\.slice\(0, 3\)/);
  assert.match(source, /No recent co-host audio notes\./);
  assert.match(source, /Start Next Singer/);
  assert.match(source, /Open Conveyor/);
  assert.match(source, /End Current/);
  assert.match(source, /Re-Queue Current/);
});

test('stage now playing panel can suppress its old summary header when the live lane is present', () => {
  const source = readFileSync(stagePanelPath, 'utf8');

  assert.match(source, /showStageSummaryHeader = true/);
  assert.match(source, /\{showStageSummaryHeader \? \(/);
  assert.match(source, /Live Stage/);
});
