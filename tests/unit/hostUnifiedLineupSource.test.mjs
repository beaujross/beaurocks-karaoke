import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queuePanelSource = readFileSync('src/apps/Host/components/QueueListPanel.jsx', 'utf8');
const queueTabSource = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');
const directorSource = readFileSync('src/apps/Host/components/RunOfShowDirectorPanel.jsx', 'utf8');
const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('Tonight\'s Lineup vertical queue receives committed Show Plan performances and moments', () => {
  assert.match(queueTabSource, /lineupPlanItems=\{momentPrepTimelineItems\}/);
  assert.match(queuePanelSource, /data-feature-id="unified-tonights-lineup-plan"/);
  assert.match(queuePanelSource, /Performances \+ planned moments/);
  assert.match(queuePanelSource, /data-lineup-plan-item-type=\{item\.type\}/);
  assert.match(queuePanelSource, /onMoveRunOfShowItem\?\.\(plannedDragId, itemIndex - fromIndex\)/);
  assert.match(queuePanelSource, /onMoveItem\?\.\(item\.id, -1\)/);
  assert.match(queuePanelSource, /onMoveItem\?\.\(item\.id, 1\)/);
  assert.match(queuePanelSource, /onMoveQueueItem\?\.\(item\.queueSongId, -1\)/);
  assert.match(queuePanelSource, /onMoveQueueItem\?\.\(item\.queueSongId, 1\)/);
  assert.match(queuePanelSource, /reorderQueue\?\.\(draggedItem\.queueSongId, item\.queueSongId\)/);
  assert.match(queuePanelSource, /onDeleteItem\?\.\(item\.id\)/);
  assert.match(queuePanelSource, /This cannot be undone/);
  assert.match(queueTabSource, /onDeleteRunOfShowItem=\{onDeleteRunOfShowItem\}/);
  assert.match(hostSource, /onDeleteRunOfShowItem: deleteRunOfShowItem/);
  assert.match(queuePanelSource, /projectedQueueSongIds/);
  assert.match(queuePanelSource, /unprojectedQueue\.map/);
  assert.match(queuePanelSource, /onOpenPerformance=\{setSelectedSongId\}/);
  assert.doesNotMatch(queuePanelSource, /label=\{hasProjectedQueueSongs \? 'Performance controls'/);
});

test('scheduled prompt moments persist a separate reveal phase before completion', () => {
  const functionsSource = readFileSync('functions/index.js', 'utf8');
  assert.match(hostSource, /RUN_OF_SHOW_PROMPT_REVEAL_SEC = 8/);
  assert.match(hostSource, /lifecyclePhase = promptItem \? \(promptReveal \? 'complete' : 'reveal'\) : 'complete'/);
  assert.match(hostSource, /revealRunOfShowPromptItem\(runOfShowLiveItem\.id\)/);
  assert.match(hostSource, /onCompleteRunOfShowPrompt=\{advanceRunOfShowNext\}/);
  assert.match(functionsSource, /action === "reveal"/);
  assert.match(functionsSource, /roomPatch\.activeMode = trivia \? "trivia_reveal" : "wyr_reveal"/);
  assert.match(functionsSource, /assertPromptCompletionPreservesPerformanceLineup/);
});

test('repeating crowd-moment automation is materialized into the shared lineup', () => {
  assert.match(queueTabSource, /crowdMomentAutomation=\{room\?\.missionControl\?\.party \|\| \{\}\}/);
  assert.match(queuePanelSource, /data-feature-id="lineup-crowd-moment-automation"/);
  assert.match(queuePanelSource, /every \{crowdAutomationCadence\} performance/);
  assert.match(queuePanelSource, /Visible occurrences are placed directly into this lineup/);
  assert.match(queuePanelSource, /Lineup owned/);
  assert.match(queuePanelSource, /Add editable Trivia Moment/);
  assert.match(hostSource, /materializedRule\.enabled && !scheduledItem/);
  assert.match(hostSource, /betweenSongGenerationInFlightRef/);
  assert.match(hostSource, /runOfShowItemId: scheduledItem\.id/);
  assert.match(hostSource, /contentState: 'generation_failed'/);
});

test('Trivia Moments can be edited or generated from previous performances', () => {
  assert.match(queuePanelSource, /data-feature-id="lineup-trivia-question-editor"/);
  assert.match(queuePanelSource, /Save question/);
  assert.match(queuePanelSource, /Generate from previous performances/);
  assert.match(hostSource, /generateRunOfShowTriviaFromPreviousPerformances/);
  assert.match(hostSource, /\['performed', 'complete', 'completed'\]/);
  assert.match(hostSource, /contentSource: 'ai_previous_performances'/);
  assert.match(directorSource, /onGenerateTriviaForItem/);
  assert.match(directorSource, /Generate From Previous Performances/);
  assert.match(queuePanelSource, /data-feature-id="lineup-wyr-question-editor"/);
  assert.match(queuePanelSource, /Save choices/);
  assert.match(hostSource, /generateRunOfShowWyrFromPreviousPerformances/);
  assert.doesNotMatch(hostSource.slice(
    hostSource.indexOf('const generateRunOfShowTriviaFromPreviousPerformances'),
    hostSource.indexOf('const addScenePresetToRunOfShow'),
  ), /singerName:/);
});

test('Host language keeps full-screen Trivia Moments separate from in-song Pop-Up Trivia', () => {
  assert.match(directorSource, /data-feature-id="trivia-moment-pop-up-distinction"/);
  assert.match(directorSource, /scheduled, full-screen question between performances/);
  assert.match(directorSource, /generated for a specific backing track and appears while that performance is playing/);
  assert.match(queuePanelSource, /Pop-Up Trivia is a separate in-song companion/);
  assert.doesNotMatch(directorSource, /Legacy scene type:/);
});
