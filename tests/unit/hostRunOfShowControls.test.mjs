import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostAppPath = path.resolve(__dirname, "../../src/apps/Host/HostApp.jsx");
const hostQueueTabPath = path.resolve(__dirname, "../../src/apps/Host/components/HostQueueTab.jsx");
const hostTopChromePath = path.resolve(__dirname, "../../src/apps/Host/components/HostTopChrome.jsx");
const runOfShowDirectorPanelPath = path.resolve(__dirname, "../../src/apps/Host/components/RunOfShowDirectorPanel.jsx");
const runOfShowQueueHudPath = path.resolve(__dirname, "../../src/apps/Host/components/RunOfShowQueueHud.jsx");

test("HostApp clears run of show state back to straight queue mode", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /const clearRunOfShowNow = useCallback\(async \(\) => \{/);
  assert.match(source, /runOfShowEnabled:\s*false,/);
  assert.match(source, /runOfShowDirector:\s*nextDirector,/);
  assert.match(source, /runOfShowPolicy:\s*nextPolicy,/);
  assert.match(source, /runOfShowRoles:\s*nextRoles,/);
  assert.match(source, /runOfShowTemplateMeta:\s*nextTemplateMeta,/);
  assert.match(source, /runOfShowItemId:\s*null,/);
});

test("HostApp reset and media deletes reconcile run-of-show TV state", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /const clearRoomDataForCode = async \(targetRoomCode = ''\) => \{/);
  assert.match(source, /const nextRunOfShowDirector = createDefaultRunOfShowDirector\(\);/);
  assert.match(source, /programMode:\s*RUN_OF_SHOW_PROGRAM_MODES\.standard,/);
  assert.match(source, /runOfShowEnabled:\s*false,/);
  assert.match(source, /runOfShowDirector:\s*nextRunOfShowDirector,/);
  assert.match(source, /announcement:\s*null,/);
  assert.match(source, /tvPreviewOverlay:\s*null,/);
  assert.match(source, /const reconcileDeletedMediaReferences = useCallback\(async \(asset = \{\}\) => \{/);
  assert.match(source, /reconcileRunOfShowDirectorMediaDeletion\(getCurrentRunOfShowDirector\(\), assetIdentity\)/);
  assert.match(source, /await reconcileDeletedMediaReferences\(mergeRoomMediaIdentities\(/);
  assert.match(source, /await reconcileDeletedMediaReferences\(preset\);/);
});

test("Run of show queue and board surfaces expose clear-show controls", () => {
  const queueHudSource = readFileSync(runOfShowQueueHudPath, "utf8");
  const directorPanelSource = readFileSync(runOfShowDirectorPanelPath, "utf8");

  assert.match(queueHudSource, /onClear,/);
  assert.match(queueHudSource, />\s*Clear\s*</);
  assert.match(directorPanelSource, /onClearRunOfShow,/);
  assert.match(directorPanelSource, />\s*Clear Show\s*</);
});

test("HostApp feeds run-of-show with crowd pulse guidance and conveyor copy", () => {
  const source = readFileSync(hostAppPath, "utf8");
  const directorPanelSource = readFileSync(runOfShowDirectorPanelPath, "utf8");

  assert.match(source, /getCrowdPulseSnapshot/);
  assert.match(source, /crowdPulse=\{crowdPulse\}/);
  assert.match(source, /Show Conveyor/);
  assert.match(directorPanelSource, /getRunOfShowConveyorSnapshot/);
  assert.match(directorPanelSource, /getRunOfShowConveyorPhase/);
  assert.match(directorPanelSource, /Crowd Pulse/);
  assert.match(directorPanelSource, /Conveyor status/);
  assert.match(directorPanelSource, /Show Conveyor/);
  assert.match(directorPanelSource, /On Deck/);
  assert.match(directorPanelSource, /Flighted/);
  assert.match(source, /const openRunOfShowReleaseWindow = useCallback\(async \(itemId, options = \{\}\) => \{/);
  assert.match(source, /const closeRunOfShowReleaseWindow = useCallback\(async \(options = \{\}\) => \{/);
  assert.match(source, /onOpenReleaseWindow=\{openRunOfShowReleaseWindow\}/);
  assert.match(source, /onCloseReleaseWindow=\{closeRunOfShowReleaseWindow\}/);
  assert.match(source, /const importRunOfShowCsv = useCallback\(async \(csvText = '', options = \{\}\) => \{/);
  assert.match(source, /buildRunOfShowItemsFromCsvImport\(csvText\)/);
  assert.match(source, /onImportCsv=\{importRunOfShowCsv\}/);
  assert.match(directorPanelSource, /Release Window/);
  assert.match(directorPanelSource, /Crowd Signal/);
  assert.match(directorPanelSource, /Co-Host Vote/);
});

test("HostApp restores queue tools after stop and previews the audience app", () => {
  const hostSource = readFileSync(hostAppPath, "utf8");
  const queueTabSource = readFileSync(hostQueueTabPath, "utf8");

  assert.match(queueTabSource, /const handleStopRunOfShowAndRestoreQueueTools = useCallback\(async \(\) => \{/);
  assert.match(queueTabSource, /const runOfShowNeedsAttentionCount = Math\.max\(/);
  assert.match(queueTabSource, /onFocusItem=\{onFocusRunOfShowItem\}/);
  assert.match(queueTabSource, /onPreviewItem=\{onPreviewRunOfShowItem\}/);
  assert.match(queueTabSource, /onMoveItem=\{onMoveRunOfShowItem\}/);
  assert.match(queueTabSource, /onSkipItem=\{onSkipRunOfShowItem\}/);
  assert.match(queueTabSource, /badge:\s*runOfShowNeedsAttentionCount,/);
  assert.match(queueTabSource, /setShowAddForm\(true\);/);
  assert.match(queueTabSource, /setShowQueueList\(true\);/);
  assert.match(hostSource, /onFocusRunOfShowItem=\{\(itemId\) => \{/);
  assert.match(hostSource, /onPreviewRunOfShowItem=\{previewRunOfShowItem\}/);
  assert.match(hostSource, /onMoveRunOfShowItem=\{moveRunOfShowItem\}/);
  assert.match(hostSource, /onSkipRunOfShowItem=\{skipRunOfShowItem\}/);
  assert.match(hostSource, /normalizeAudiencePreviewMode/);
  assert.match(hostSource, /audienceLaunchUrl=\{activeRoomLaunchUrls\.audienceUrl\}/);
  assert.match(hostSource, /title="Audience app live preview"/);
  assert.match(hostSource, /const shouldApplyRunOfShowRemoteSync = Date\.now\(\) - runOfShowLocalEditAtRef\.current > 1500;/);
});

test("Host chrome routes live automation access back into the queue tab", () => {
  const hostSource = readFileSync(hostAppPath, "utf8");
  const chromeSource = readFileSync(hostTopChromePath, "utf8");

  assert.match(chromeSource, /data-feature-id="deck-open-queue-controls"/);
  assert.match(chromeSource, /data-feature-id="deck-crowd-pulse"/);
  assert.match(chromeSource, /Crowd Pulse/);
  assert.match(chromeSource, /Queue Controls/);
  assert.match(chromeSource, /roomReadinessStatusLabel = 'Room'/);
  assert.match(chromeSource, /fa-solid fa-rocket/);
  assert.match(chromeSource, /Launch TV/);
  assert.match(chromeSource, /Launch Mobile/);
  assert.match(chromeSource, /Print Guides/);
  assert.match(chromeSource, /data-feature-id="launch-audience-poster"/);
  assert.match(chromeSource, /data-feature-id="launch-cohost-poster"/);
  assert.match(chromeSource, /data-feature-id="launch-host-walkthrough"/);
  assert.match(chromeSource, /Audience Poster/);
  assert.match(chromeSource, /Co-Host Poster/);
  assert.match(chromeSource, /Host Walkthrough/);
  assert.match(chromeSource, /\/print\/aahf-audience-guide\.html/);
  assert.match(chromeSource, /\/print\/cohost-guide\.html/);
  assert.match(chromeSource, /\/print\/aahf-host-walkthrough\.html/);
  assert.doesNotMatch(chromeSource, /roomReadinessLaunchBusy \? 'Launching\.\.\.' : 'Launch'/);
  assert.doesNotMatch(chromeSource, /data-feature-id="deck-automation-menu-toggle"/);
  assert.doesNotMatch(chromeSource, /Auto DJ Queue/);
  assert.match(hostSource, /onOpenQueueControls=\{focusQueueLiveControls\}/);
});

test("HostApp keeps the queue runtime mounted when the host leaves the queue view", () => {
  const hostSource = readFileSync(hostAppPath, "utf8");
  const queueTabSource = readFileSync(hostQueueTabPath, "utf8");

  assert.match(
    hostSource,
    /data-host-main-scroll="true"[\s\S]*className=\{`relative z-0 flex flex-1 min-h-0 flex-col/,
    "The host main shell must be a flex column so stage and show tabs can claim scrollable height",
  );
  assert.match(
    hostSource,
    /data-host-queue-runtime="mounted"[\s\S]*<HostQueueTab[\s\S]*runtimeVisible=\{tab === 'stage'\}/,
    "HostQueueTab owns host-side automation timers and should stay mounted while its UI is hidden",
  );
  assert.match(
    hostSource,
    /className=\{tab === 'stage' \? 'flex flex-1 min-h-0 flex-col' : 'hidden'\}/,
    "Queue UI should stay mounted inside a constrained flex column so its internal panels can scroll",
  );
  assert.match(
    hostSource,
    /\{tab === 'run_of_show' && \(\s*<div className="flex flex-1 min-h-0 flex-col gap-4">/,
    "Run of show should also claim constrained height so its board can scroll independently",
  );
  assert.match(
    queueTabSource,
    /if \(!runtimeVisible\) return \(\) => \{\};/,
    "Hidden queue runtime should not keep the command palette keyboard shortcut active",
  );
});

test("Audience tab can promote and remove co-hosts directly from lobby selection", () => {
  const hostSource = readFileSync(hostAppPath, "utf8");

  assert.match(hostSource, /const selectedLobbyUserIsCoHost = !!\(selectedLobbyUserUid && \(runOfShowRoles\?\.coHosts \|\| \[\]\)\.includes\(selectedLobbyUserUid\)\);/);
  assert.match(hostSource, /const toggleLobbyUserCoHost = useCallback\(async \(roomUser = \{\}\) => \{/);
  assert.match(hostSource, /await updateRunOfShowRolesState\(\{ coHosts: nextCoHosts \}\);/);
  assert.match(hostSource, /promoted to co-host/);
  assert.match(hostSource, /removed from co-hosts/);
  assert.match(hostSource, /Make Co-Host/);
  assert.match(hostSource, /Remove Co-Host/);
  assert.match(hostSource, /MAKE CO-HOST/);
  assert.match(hostSource, /REMOVE CO-HOST/);
  assert.match(hostSource, /CO-HOST/);
});

test("HostApp keeps Auto DJ queue advance independent from TV display mode changes", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(
    source,
    /getRoomFlowSnapshot\(\{/,
    "HostApp should derive room automation ownership from one explicit orchestrator helper",
  );
  assert.match(
    source,
    /activeMode: room\?\.activeMode,/,
    "Room-flow orchestration should consider the room mode before staging the next song",
  );
  assert.match(
    source,
    /runOfShowLiveItem,|runOfShowStagedItem,|runOfShowNextItem,/,
    "Room-flow orchestration should not race the run of show executor",
  );
  assert.match(
    source,
    /const intent = flow\.autoDjIntent;/,
    "Auto DJ should stage queue advances from the orchestrator intent instead of duplicating logic",
  );
  assert.match(
    source,
    /flow\.autoPartyIntent\.shouldStart\) \{\s*autoDjKickoffRef\.current = '';/,
    "Auto DJ should yield while the orchestrator arms a between-singer bridge",
  );
  assert.match(
    source,
    /isQueueEntryPlayable/,
    "Room-flow orchestration should still use backing-track readiness when choosing the next queue item",
  );
  assert.doesNotMatch(
    source,
    /runAutoDjWatchdog|autoDjWatchdogBusyRef|setInterval\(runAutoDjWatchdog/,
    "Auto DJ queue advance should not rely on a periodic watchdog",
  );
});

test("Run-of-show quick draft controls avoid clipped dropdown layers", () => {
  const source = readFileSync(runOfShowDirectorPanelPath, "utf8");

  assert.match(
    source,
    /focus-within:z-\[90\]/,
    "Run-of-show select controls should lift above neighboring quick draft content while focused",
  );
  assert.match(
    source,
    /fixed inset-0 z-\[260\][\s\S]*Quick Draft Builder/,
    "Quick Draft modal should sit above host panel chrome and dropdown layers",
  );
  assert.match(
    source,
    /overflow-visible rounded-\[28px\]/,
    "Quick Draft modal shell should not clip dropdown affordances",
  );
  assert.match(
    source,
    /grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-\[minmax\(0,1\.1fr\)_120px_120px_170px_minmax\(150px,auto\)\]/,
    "Quick Draft form grid should keep controls from crowding or wrapping over each other",
  );
});

test("Run-of-show performance launch resolves real media duration before seeding auto-end timing", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /const getAssociatedBackingDurationSec = \(song = \{\}\) => \{/);
  assert.match(source, /const associatedBackingDurationSec = getAssociatedBackingDurationSec\(queueSong\);/);
  assert.match(source, /await resolveHostDurationForUrl\(nextMediaUrl, isAudioUrl\(nextMediaUrl\)\)\.catch\(\(\) => null\)/);
  assert.match(source, /queueSong\.performanceStartedDurationSec = performanceDurationSec;/);
  assert.match(source, /currentPerformanceMeta:\s*\{[\s\S]*durationSec:\s*performanceDurationSec,/);
});

test("Run-of-show game cards launch through the shared live game mapper", () => {
  const hostSource = readFileSync(hostAppPath, "utf8");
  const directorPanelSource = readFileSync(runOfShowDirectorPanelPath, "utf8");
  const queueHudSource = readFileSync(runOfShowQueueHudPath, "utf8");
  const chromeSource = readFileSync(hostTopChromePath, "utf8");

  assert.match(hostSource, /import \{[\s\S]*buildRunOfShowGameLaunchRoomUpdates[\s\S]*\} from '..\/..\/lib\/gameLaunchSupport';/);
  assert.match(
    hostSource,
    /buildRunOfShowGameLaunchRoomUpdates\(\{\s*item,\s*room: roomRef\.current \|\| \{\},\s*roomUsers: users,\s*startedAtMs\s*\}\)/s,
  );
  assert.match(hostSource, /Object\.assign\(roomUpdates, gameLaunchUpdates \|\| \{/);
  assert.match(directorPanelSource, /const buildSpotlightLaunchConfig = \(modeId = '', option = null\) => \{/);
  assert.match(directorPanelSource, /launchConfig: buildSpotlightLaunchConfig\(safeModeId, option\),/);
  assert.match(directorPanelSource, /requiresAudienceTakeover: safeModeId !== 'applause_countdown'/);
  assert.match(queueHudSource, /const getItemExecutionMeta = \(item = \{\}\) => \{/);
  assert.match(queueHudSource, /getRunOfShowItemCategoryLabel/);
  assert.match(queueHudSource, /launchLabel: modeKey \? `Launches \$\{modeKey\.replaceAll\('_', ' '\)\}` : 'Interactive launch'/);
  assert.match(queueHudSource, /const \[previewItemId, setPreviewItemId\] = React\.useState\(''\)/);
  assert.match(queueHudSource, /const renderSlotCard = \(item = null, fallbackLabel = '', fallbackSummary = ''\) => \(/);
  assert.match(queueHudSource, /Actions/);
  assert.match(queueHudSource, /Hide List/);
  assert.match(queueHudSource, /Show List/);
  assert.match(queueHudSource, /Moment Plan/);
  assert.match(queueHudSource, /Next 3 set/);
  assert.match(queueHudSource, /Order can flex\./);
  assert.match(queueHudSource, /Full List/);
  assert.match(queueHudSource, />\s*Previous\s*</);
  assert.match(queueHudSource, />\s*Stop\s*</);
  assert.match(queueHudSource, /Earlier/);
  assert.match(queueHudSource, /Later/);
  assert.match(queueHudSource, /Fix/);
  assert.match(queueHudSource, /Preview/);
  assert.match(queueHudSource, /Edit/);
  assert.match(queueHudSource, /Order can flex/);
  assert.doesNotMatch(queueHudSource, /\{moreOpen \? 'Less' : 'More'\}/);
  assert.doesNotMatch(chromeSource, /compactRunOfShowToolsOpen/);
  assert.doesNotMatch(chromeSource, /\? \(compactRunOfShowDense \? 'Hide' : 'Less'\) : 'More'/);
});

test("Host-facing moment language uses sting instead of cue where it would collide with queue", () => {
  const hostSource = readFileSync(hostAppPath, "utf8");
  const directorPanelSource = readFileSync(runOfShowDirectorPanelPath, "utf8");
  const chromeSource = readFileSync(hostTopChromePath, "utf8");

  assert.match(directorPanelSource, /Scene Sting/);
  assert.match(directorPanelSource, /Sting Options/);
  assert.match(directorPanelSource, /No sting attached\./);
  assert.match(chromeSource, /Sting live/);
  assert.match(hostSource, /Scene sting/);
  assert.match(hostSource, /Next up sting fired/);
  assert.doesNotMatch(directorPanelSource, /Scene Cue/);
  assert.doesNotMatch(chromeSource, /Cue live/);
});

test("Host top chrome does not duplicate the run-of-show bar once queue tabs own that surface", () => {
  const chromeSource = readFileSync(hostTopChromePath, "utf8");
  const liveOpsSource = readFileSync(hostQueueTabPath, "utf8");

  assert.doesNotMatch(chromeSource, /text-\[10px\] uppercase tracking-\[0\.26em\] text-cyan-200\/80">Run Of Show</);
  assert.doesNotMatch(chromeSource, /compactRunOfShowItems\.length > 0/);
  assert.match(liveOpsSource, /queue-surface-tab-add-desktop/);
  assert.match(liveOpsSource, /queue-surface-tab-queue-desktop/);
  assert.match(liveOpsSource, /queue-surface-tab-show-desktop/);
});

test("Host stage auto-end duration sync updates room metadata, not only the queue document", () => {
  const source = readFileSync(hostQueueTabPath, "utf8");

  assert.match(source, /const associatedBackingDurationSec = getAssociatedBackingDurationSec\(current\);/);
  assert.match(source, /performanceStartedDurationSec:\s*nextDuration/);
  assert.match(source, /currentPerformanceMeta:\s*\{\s*\.\.\.activeMeta,\s*durationSec:\s*nextDuration/s);
});

test("Host queue review presents Apple sing-along and YouTube backing as primary choices", () => {
  const source = readFileSync(hostQueueTabPath, "utf8");

  assert.match(source, /const resolveAppleSingAlongReviewRequest = useCallback/);
  assert.match(source, /source:\s*'apple'/);
  assert.match(source, /successMessage:\s*'Queued as Apple Music sing-along\.'/);
  assert.match(source, /Apple Sing-Along/);
  assert.match(source, /Find YouTube Backing/);
  assert.match(source, /resolveAppleSingAlongReviewRequest\(song\)/);
  assert.match(source, /canUseAppleSingAlong \|\| sourceLabel\.includes\('apple'\) \|\| sourceLabel\.includes\('itunes'\)/);
});

test("Scene image uploads stay on the callable host upload path", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /if \(mediaType === 'image' && file\.size && file\.size > 8 \* 1024 \* 1024\) \{/);
  assert.match(source, /toast\('Scene images must be 8 MB or smaller\.'\);/);
  assert.match(source, /if \(mediaType === 'image'\) \{\s*\(\{ storagePath, mediaUrl \} = await callableUpload\(\)\);/s);
  assert.doesNotMatch(source, /Scene preset callable upload failed; trying direct storage upload/);
});

test("Host queue review candidate cards stay inside narrow panels", () => {
  const source = readFileSync(hostQueueTabPath, "utf8");

  assert.match(source, /min-w-0 overflow-hidden rounded-2xl border border-white\/10 bg-black\/30 p-3/);
  assert.match(source, /mt-3 grid min-w-0 gap-2 overflow-hidden/);
  assert.match(source, /grid min-w-0 gap-3 xl:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(source, /break-words text-sm font-bold leading-snug text-white/);
  assert.match(source, /grid min-w-\[150px\] gap-2 sm:grid-cols-3 xl:grid-cols-1/);
});

test("Host top chrome keeps the dropdown strip lean", () => {
  const source = readFileSync(hostTopChromePath, "utf8");

  assert.doesNotMatch(source, /Quick Start|deck-quick-start-menu-toggle|showQuickStartMenu/);
  assert.doesNotMatch(source, /quickAudioControlClass|showInlineAudioQuickControls/);
  assert.match(source, /data-feature-id="deck-audio-menu-toggle"/);
  assert.match(source, /Audio \+ Mix/);
});

test("Run-of-show prep sections can collapse after opening", () => {
  const source = readFileSync(runOfShowDirectorPanelPath, "utf8");

  assert.match(source, /const toggleExclusivePrepStep = \(itemId = '', step = 'singer'\) => \{/);
  assert.match(source, /\[sectionKey\(safeItemId, 'prep_step_singer'\)\]: false,/);
  assert.match(source, /const hasExplicitPrepStepState = \['singer', 'song', 'track'\]\.some/);
  assert.match(source, /onToggle=\{\(\) => toggleExclusivePrepStep\(item\.id, 'singer'\)\}/);
  assert.match(source, /onToggle=\{\(\) => toggleExclusivePrepStep\(item\.id, 'song'\)\}/);
});

test("Run-of-show automation respects room auto mode and pauses for missing singers", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /const runOfShowAutomationEnabled = isRunOfShowRoom && \(runOfShowPolicy\?\.defaultAutomationMode \|\| 'auto'\) !== 'manual';/);
  assert.match(source, /const maybePauseRunOfShowAutomationForMissingSinger = useCallback\(async \(\) => \{/);
  assert.match(source, /const maybeResumeRunOfShowAutomationAfterSingerReady = useCallback\(async \(\) => \{/);
  assert.match(source, /getRunOfShowAutomationPauseState\(\{/);
  assert.match(source, /automationStatus:\s*pauseState\.status,/);
  assert.match(source, /toast\(pauseState\.detail \|\| 'Automation paused while the next performance waits on a singer\.'\);/);
  assert.match(source, /String\(runOfShowDirector\?\.automationStatus \|\| ''\)\.trim\(\)\.toLowerCase\(\) !== 'waiting_for_performer'/);
  assert.match(source, /automationPaused:\s*false,/);
  assert.match(source, /toast\('Singer ready\. Automation resumed\.'\);/);
});

test("HostApp auto-dismisses the post-performance backing prompt if the host ignores it", () => {
  const source = readFileSync(hostQueueTabPath, "utf8");

  assert.match(source, /const POST_PERFORMANCE_BACKING_PROMPT_AUTO_CLOSE_MS = 12000;/);
  assert.match(source, /if \(!postPerformanceBackingPrompt \|\| postPerformanceBackingPromptBusy\) return \(\) => \{\};/);
  assert.match(source, /setTimeout\(\(\) => \{\s*setPostPerformanceBackingPrompt\(\(currentPrompt\) => \(/);
  assert.match(source, /Closes automatically after a few seconds\./);
});

test("HostApp routes scene images through the host callable without a direct-storage fallback", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /if \(mediaType === 'image' && file\.size && file\.size > 8 \* 1024 \* 1024\) \{/);
  assert.match(source, /toast\('Scene images must be 8 MB or smaller\.'\);/);
  assert.match(source, /if \(mediaType === 'image'\) \{\s*\(\{ storagePath, mediaUrl \} = await callableUpload\(\)\);/s);
  assert.doesNotMatch(source, /Scene preset callable upload failed; trying direct storage upload/);
});

test("Host scene presets can be slotted into the conveyor and live below the queue", () => {
  const hostSource = readFileSync(hostAppPath, "utf8");
  const queueTabSource = readFileSync(hostQueueTabPath, "utf8");

  assert.match(queueTabSource, /data-feature-id="panel-tv-moments"/);
  assert.match(queueTabSource, /TV Moments/);
  assert.match(queueTabSource, /Queue Next Moment/);
  assert.match(queueTabSource, /Use In Run Of Show/);
  assert.match(hostSource, /const saveMediaAssetAsScenePreset = useCallback\(async \(item = \{\}, options = \{\}\) => \{/);
  assert.match(hostSource, /const useScenePresetInRunOfShow = useCallback\(async \(preset = \{\}\) => \{/);
  assert.match(hostSource, /const uploadMediaFileToRunOfShow = useCallback\(async \(file, options = \{\}\) => \{/);
  assert.match(hostSource, /Scene media needs an uploaded cloud URL before it can join Run Of Show\./);
  assert.match(hostSource, /onQueueScenePreset:\s*\(preset\)\s*=>\s*queueScenePresetAsMoment/);
  assert.match(hostSource, /onAddScenePresetToRunOfShow:\s*useScenePresetInRunOfShow/);
  assert.match(hostSource, /runOfShowSelectedItemId/);
  assert.match(hostSource, /onSelectionChange=\{setRunOfShowSelectedItemId\}/);
  assert.match(hostSource, /const queueScenePresetAsMoment = useCallback\(async \(preset = \{\}, options = \{\}\) => \{/);
  assert.match(hostSource, /takeoverScene:\s*'media_scene'/);
  assert.match(hostSource, /mediaSceneUrl:\s*mediaUrl,/);
  assert.match(
    queueTabSource,
    /<QueueListPanel[\s\S]*\/>\s*<div data-feature-id="panel-tv-moments">[\s\S]*TV Moments/,
    "TV Moments should render below the queue board instead of above it",
  );
});
