import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('HostApp imports the extracted open-slot helper before fast fill', () => {
  assert.match(hostAppSource, /import \{ computeOpenSlotAssignments, isOpenRunOfShowPerformanceSlot \} from '\.\/lib\/openSlotSuggestions';/);
  assert.match(hostAppSource, /const runOfShowOpenPerformanceSlots = useMemo/);
  assert.match(hostAppSource, /\.filter\(\(item\) => isOpenRunOfShowPerformanceSlot\(item\)\)/);
});

test('HostApp bulk fill relies on the extracted assignment planner before assigning', () => {
  assert.match(hostAppSource, /const fillRunOfShowOpenSlotsFromQueue = useCallback\(async \(\{ limit \} = \{\}\) => \{/);
  assert.match(hostAppSource, /const assignments = computeOpenSlotAssignments\(\{ openSlots, readyQueueSongs, limit \}\);/);
  assert.match(hostAppSource, /for \(const entry of assignments\)/);
  assert.match(hostAppSource, /await assignQueueSongToRunOfShowItem\(queueSong\.id, slot\.id\)/);
  assert.match(hostAppSource, /if \(assignments\.length > 1\)/);
  assert.match(hostAppSource, /Filled \$\{assignments\.length\} upcoming slot/);
});
