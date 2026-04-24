import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostAppPath = path.resolve(__dirname, "../../src/apps/Host/HostApp.jsx");
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

test("Run of show queue and board surfaces expose clear-show controls", () => {
  const queueHudSource = readFileSync(runOfShowQueueHudPath, "utf8");
  const directorPanelSource = readFileSync(runOfShowDirectorPanelPath, "utf8");

  assert.match(queueHudSource, /onClear,/);
  assert.match(queueHudSource, />\s*Clear Show\s*</);
  assert.match(directorPanelSource, /onClearRunOfShow,/);
  assert.match(directorPanelSource, />\s*Clear Show\s*</);
});

test("HostApp restores queue tools after stop and previews the audience app", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /const handleStopRunOfShowAndRestoreQueueTools = useCallback\(async \(\) => \{/);
  assert.match(source, /setShowAddForm\(true\);/);
  assert.match(source, /setShowQueueList\(true\);/);
  assert.match(source, /normalizeAudiencePreviewMode/);
  assert.match(source, /audienceLaunchUrl=\{activeRoomLaunchUrls\.audienceUrl\}/);
  assert.match(source, /title="Audience app live preview"/);
  assert.match(source, /const shouldApplyRunOfShowRemoteSync = Date\.now\(\) - runOfShowLocalEditAtRef\.current > 1500;/);
});

test("HostApp keeps the queue runtime mounted when the host leaves the queue view", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(
    source,
    /data-host-queue-runtime="mounted"[\s\S]*<QueueTab \{\.\.\.queueTabProps\} runtimeVisible=\{tab === 'stage'\} \/>/,
    "QueueTab owns host-side automation timers and should stay mounted while its UI is hidden",
  );
  assert.match(
    source,
    /className=\{tab === 'stage' \? '' : 'hidden'\}/,
    "Queue UI should be hidden, not unmounted, outside the stage tab",
  );
  assert.match(
    source,
    /if \(!runtimeVisible\) return \(\) => \{\};/,
    "Hidden queue runtime should not keep the command palette keyboard shortcut active",
  );
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

  assert.match(hostSource, /import \{\s*buildRunOfShowGameLaunchRoomUpdates\s*\} from '..\/..\/lib\/gameLaunchSupport';/);
  assert.match(
    hostSource,
    /buildRunOfShowGameLaunchRoomUpdates\(\{\s*item,\s*room: roomRef\.current \|\| \{\},\s*roomUsers: users,\s*startedAtMs\s*\}\)/s,
  );
  assert.match(hostSource, /Object\.assign\(roomUpdates, gameLaunchUpdates \|\| \{/);
  assert.match(directorPanelSource, /const buildSpotlightLaunchConfig = \(modeId = '', option = null\) => \{/);
  assert.match(directorPanelSource, /launchConfig: buildSpotlightLaunchConfig\(safeModeId, option\),/);
  assert.match(directorPanelSource, /requiresAudienceTakeover: safeModeId !== 'applause_countdown'/);
  assert.match(queueHudSource, /const getItemExecutionMeta = \(item = \{\}\) => \{/);
  assert.match(queueHudSource, /lane: 'Game'/);
  assert.match(queueHudSource, /launchLabel: modeKey \? `Launches \$\{modeKey\.replaceAll\('_', ' '\)\}` : 'Interactive launch'/);
});

test("Host stage auto-end duration sync updates room metadata, not only the queue document", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /const associatedBackingDurationSec = getAssociatedBackingDurationSec\(current\);/);
  assert.match(source, /performanceStartedDurationSec:\s*nextDuration/);
  assert.match(source, /currentPerformanceMeta:\s*\{\s*\.\.\.activeMeta,\s*durationSec:\s*nextDuration/s);
});

test("Host queue review presents Apple sing-along and YouTube backing as primary choices", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /const resolveAppleSingAlongReviewRequest = useCallback/);
  assert.match(source, /source:\s*'apple'/);
  assert.match(source, /successMessage:\s*'Queued as Apple Music sing-along\.'/);
  assert.match(source, /Apple Sing-Along/);
  assert.match(source, /Find YouTube Backing/);
  assert.match(source, /resolveAppleSingAlongReviewRequest\(song\)/);
  assert.match(source, /canUseAppleSingAlong \|\| sourceLabel\.includes\('apple'\) \|\| sourceLabel\.includes\('itunes'\)/);
});

test("Host queue review candidate cards stay inside narrow panels", () => {
  const source = readFileSync(hostAppPath, "utf8");

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
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /const POST_PERFORMANCE_BACKING_PROMPT_AUTO_CLOSE_MS = 12000;/);
  assert.match(source, /if \(!postPerformanceBackingPrompt \|\| postPerformanceBackingPromptBusy\) return \(\) => \{\};/);
  assert.match(source, /setTimeout\(\(\) => \{\s*setPostPerformanceBackingPrompt\(\(currentPrompt\) => \(/);
  assert.match(source, /Closes automatically after a few seconds\./);
});
