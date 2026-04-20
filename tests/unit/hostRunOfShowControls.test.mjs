import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostAppPath = path.resolve(__dirname, "../../src/apps/Host/HostApp.jsx");
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

test("Run-of-show performance launch resolves real media duration before seeding auto-end timing", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /await resolveHostDurationForUrl\(nextMediaUrl, isAudioUrl\(nextMediaUrl\)\)\.catch\(\(\) => null\)/);
  assert.match(source, /queueSong\.performanceStartedDurationSec = performanceDurationSec;/);
  assert.match(source, /currentPerformanceMeta:\s*\{[\s\S]*durationSec:\s*performanceDurationSec,/);
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
