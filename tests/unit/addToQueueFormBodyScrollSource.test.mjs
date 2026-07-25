import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const addToQueueFormBodyPath = path.resolve(__dirname, '../../src/apps/Host/components/AddToQueueFormBody.jsx');
const hostQueueTabPath = path.resolve(__dirname, '../../src/apps/Host/components/HostQueueTab.jsx');
const hostStageConsolePath = path.resolve(__dirname, '../../src/apps/Host/components/HostStageConsoleExperimental.jsx');

test('AddToQueueFormBody keeps YouTube/autocomplete results inside a dedicated scroll lane', () => {
  const source = readFileSync(addToQueueFormBodyPath, 'utf8');

  assert.match(
    source,
    /host-autocomplete-results-list min-h-0 flex-1 overflow-y-auto overscroll-contain touch-scroll-y custom-scrollbar px-2 py-2 \$\{compactRows \? 'grid content-start gap-1 xl:grid-cols-2' : ''\}/,
    'Autocomplete results should be their own compact touch-friendly scroll surface',
  );
  assert.match(
    source,
    /host-autocomplete-shell relative z-30 w-full min-w-0 \$\{dockResults \? 'flex min-h-0 shrink-0 flex-col' : ''\}/,
    'Autocomplete controls should keep their natural height instead of splitting the workspace with the results',
  );
  assert.match(
    source,
    /mt-2 pr-1 \$\{dockResults \? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden' : ''\}/,
    'Docked add workspace should clip the shell and hand scrolling to the active content lane',
  );
  assert.match(
    source,
    /host-autocomplete-results absolute left-1\/2 top-full mt-2 z-50 flex w-\[min\(42rem,calc\(100vw-2rem\)\)\] -translate-x-1\/2 max-h-\[clamp\(18rem,calc\(100dvh-8rem\),82dvh\)\] flex-col overflow-hidden/,
    'Floating autocomplete results should use viewport-aware width and height while still clipping into an internal scroller',
  );
  assert.match(
    source,
    /mt-2 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden/,
    'Docked add-tab results should fill the available add workspace and keep an internal scroll lane',
  );
  assert.match(
    source,
    /mt-3 grid min-h-0 flex-1 basis-0 overflow-y-auto overscroll-contain touch-scroll-y custom-scrollbar pr-1/,
    'Docked moment cards should scroll independently so game and announcement controls stay reachable',
  );
  assert.match(
    source,
    /sm:grid-cols-\[auto_minmax\(0,1fr\)_auto\]/,
    'Backing source, YouTube filter, and expanded search should use an explicit responsive hierarchy',
  );
  assert.match(source, /data-feature-id="host-performance-search-expand"/);
  assert.match(source, /Expand Search/);
  assert.doesNotMatch(source, /aria-label="Open YouTube search"|More YouTube/);
  assert.match(source, /const appleProviderAvailable = appleProviderConfigured && appleMusicAuthorized;/);
  assert.match(source, /\{appleProviderAvailable \? \([\s\S]*setAutocompleteProvider\('apple'\)/);
  assert.match(source, /apple-search-unavailable/);
  assert.match(source, /YouTube filter/);
});

test('AddToQueueFormBody autocomplete rows stay dense and metadata-forward', () => {
  const source = readFileSync(addToQueueFormBodyPath, 'utf8');

  assert.match(source, /const getResultDurationSec = \(result = \{\}\) => \{/);
  assert.match(source, /const durationLabel = formatResultDuration\(getResultDurationSec\(r\)\);/);
  assert.match(source, /grid-cols-\[48px_minmax\(0,1fr\)\]/);
  assert.match(source, /compactRows \? 'rounded-lg px-2 py-1\.5'/);
  assert.match(source, /compactRows \? 'h-12'/);
  assert.match(source, /compactRows \? 'grid content-start gap-1 xl:grid-cols-2'/);
  assert.match(source, /max-h-\[18px\] flex-nowrap gap-1 overflow-hidden/);
  assert.match(source, /line-clamp-1 font-black/);
  assert.match(source, /durationLabel \? \([\s\S]*\{durationLabel\}/);
  assert.match(source, /const resultMetaChipBaseClass = /);
  assert.match(source, /className=\{getResultMetaChipClass\(getSourceChipTone\(r\.source\)\)\}/);
  assert.match(source, /playbackState\?\.youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES\.notEmbeddable/);
  assert.doesNotMatch(source, /\? 'External' : 'TV'/);
  assert.doesNotMatch(source, /r\.sourceDetail/);
});

test('docked add mode keeps advanced controls available without consuming result height', () => {
  const source = readFileSync(addToQueueFormBodyPath, 'utf8');

  assert.match(source, /data-feature-id="host-performance-search-tools"/);
  assert.match(source, /data-feature-id="host-add-other-moment"/);
  assert.match(
    source,
    /dockResults && performanceMode && !momentTypeMenuOpen \? 'hidden'/,
  );
  assert.match(
    source,
    /dockResults \? \(searchOptionsOpen \? 'md:col-span-3' : 'hidden'\)/,
  );
  assert.match(source, /role="button"/);
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
});

test('host add workspace owns the available panel height beneath the persistent horizon', () => {
  const hostQueueSource = readFileSync(hostQueueTabPath, 'utf8');
  const stageSource = readFileSync(hostStageConsolePath, 'utf8');

  assert.match(hostQueueSource, /dockResults=\{addToQueueWorkspaceActive\}/);
  assert.match(
    hostQueueSource,
    /addToQueueWorkspaceActive \? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3'/,
  );
  assert.match(
    hostQueueSource,
    /queueSurface\.activeCompactTab === 'add' \? \([\s\S]*min-h-0 flex-1 overflow-hidden bg-fuchsia-500/,
  );
  assert.doesNotMatch(
    hostQueueSource,
    /dockResults=\{addToQueueWorkspaceActive && !queueSurface\.isCompactQueueSurface\}/,
  );

  assert.match(
    stageSource,
    /const workspaceFocusActive = supportView === 'workspace' && !!workspacePanel/,
  );
  assert.match(stageSource, /data-host-workspace-focus="true"/);
  assert.match(stageSource, /workspaceFocusActive \? 'hidden'/);
  assert.match(
    stageSource,
    /onOpenAdd\?\.\(\);[\s\S]*setSupportView\('workspace'\)/,
  );
  assert.match(stageSource, /onClick=\{openAddWorkspace\}/);
  assert.match(stageSource, /onClick=\{openInboxWorkspace\}/);
  assert.doesNotMatch(stageSource, /max-h-\[46vh\]/);
});
