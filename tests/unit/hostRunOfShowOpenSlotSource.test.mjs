import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('HostApp distinguishes truly open run-of-show performance slots before fast fill', () => {
  assert.match(hostAppSource, /const isOpenRunOfShowPerformanceSlot = \(item = \{\}\) => \{/);
  assert.match(hostAppSource, /queueLinkState === 'linked'/);
  assert.match(hostAppSource, /assignedPerformerUid \|\| item\?\.assignedPerformerName/);
  assert.match(hostAppSource, /item\?\.songId \|\| item\?\.songTitle \|\| item\?\.artistName/);
  assert.match(hostAppSource, /approvedSubmissionId/);
  assert.match(hostAppSource, /backingPlan\?\.playbackReady === true/);
  assert.match(hostAppSource, /const runOfShowOpenPerformanceSlots = useMemo/);
  assert.match(hostAppSource, /\.filter\(\(item\) => isOpenRunOfShowPerformanceSlot\(item\)\)/);
});

test('HostApp bulk fill clamps by open slots and ready songs before assigning', () => {
  assert.match(hostAppSource, /const fillRunOfShowOpenSlotsFromQueue = useCallback\(async \(\{ limit \} = \{\}\) => \{/);
  assert.match(hostAppSource, /Math\.min\(openSlots\.length, readyQueueSongs\.length, Math\.floor\(numericLimit\)\)/);
  assert.match(hostAppSource, /Math\.min\(openSlots\.length, readyQueueSongs\.length\)/);
  assert.match(hostAppSource, /for \(let index = 0; index < maxAssignments; index \+= 1\)/);
  assert.match(hostAppSource, /await assignQueueSongToRunOfShowItem\(queueSong\.id, slot\.id\)/);
  assert.match(hostAppSource, /if \(maxAssignments > 1\)/);
  assert.match(hostAppSource, /Filled \$\{maxAssignments\} upcoming slot/);
});
