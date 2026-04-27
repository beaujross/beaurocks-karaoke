import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const queueSource = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');
const directorPanelSource = readFileSync('src/apps/Host/components/RunOfShowDirectorPanel.jsx', 'utf8');

test('host queue tab exposes bounded song face-off controls', () => {
  assert.match(queueSource, /subjectType: 'queue_faceoff'/);
  assert.match(queueSource, /releasePolicy: 'suggest_then_host_confirm'/);
  assert.match(queueSource, /Start Co-Host Vote/);
  assert.match(queueSource, /Open To Audience/);
  assert.match(queueSource, /One vote per joined user\. Host confirms the winning song before the queue changes\./);
  assert.match(queueSource, /buildQueueFaceOffSongArtwork/);
  assert.match(queueSource, /Make \$\{\(queueFaceOffWinnerSong\.singerName \|\| 'Winner'\)\} - \$\{buildQueueFaceOffSongLabel\(queueFaceOffWinnerSong\)\} Next/);
  assert.match(queueSource, /subjectType: 'slot_fill_choice'/);
  assert.match(queueSource, /Start Slot-Fill Vote/);
  assert.match(queueSource, /Open Slot Fill To Audience/);
  assert.match(queueSource, /One vote per joined user\. Host confirms the winning singer before assigning the slot\./);
  assert.match(queueSource, /Assign \$\{\(slotFillWinnerSong\.singerName \|\| 'Winner'\)\} - \$\{buildQueueFaceOffSongLabel\(slotFillWinnerSong\)\} To \$\{slotFillTarget\.label\}/);
});

test('run-of-show panel mirrors face-off labels and guardrails', () => {
  assert.match(directorPanelSource, /Co-Host Song Face-Off/);
  assert.match(directorPanelSource, /Audience Song Face-Off/);
  assert.match(directorPanelSource, /Co-Host Slot Fill/);
  assert.match(directorPanelSource, /Audience Slot Fill/);
  assert.match(directorPanelSource, /activeReleaseWindow\?\.choiceLabels\?\.slot_scene/);
  assert.match(directorPanelSource, /Promoted Co-Host/);
  assert.match(directorPanelSource, /activeReleaseChoiceSongs/);
  assert.match(directorPanelSource, /One vote per joined user, then the host confirms the winning song before changing the queue\./);
  assert.match(directorPanelSource, /One vote per joined user, then the host confirms who fills the next performance slot\./);
});
