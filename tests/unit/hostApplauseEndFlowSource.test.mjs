import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/HostQueueTab.jsx', 'utf8');

test('manual host end routes through applause auto-finalize instead of bypassing the TV applause flow', () => {
  assert.match(
    source,
    /const applauseRunning = applauseMode === 'applause_countdown' \|\| applauseMode === 'applause' \|\| applauseMode === 'applause_result';/,
    'Host end-performance logic should treat the full applause sequence as one active flow.',
  );
  assert.match(
    source,
    /await startApplauseSequence\(\{ songId: targetSongId, autoFinalize: true \}\);/,
    'Manual end should start the applause sequence with auto-finalize enabled.',
  );
  assert.doesNotMatch(
    source,
    /if \(!autoDj\) \{\s*autoDjApplausePendingSongRef\.current = '';\s*clearAutoDjApplauseFallback\(\);\s*const runUpdateStatus = updateStatusRef\.current;\s*if \(!runUpdateStatus\) return;\s*await runUpdateStatus\(targetSongId, 'performed'\);/s,
    'Manual end should no longer bypass applause and mark songs performed immediately when Auto-DJ is off.',
  );
  assert.match(
    source,
    /const pendingSongId = autoDjApplausePendingSongRef\.current;\s*if \(!pendingSongId\) return;\s*if \(room\?\.activeMode !== 'applause_result'\) return;/s,
    'Applause auto-finalize should run whenever a pending performance reaches applause results.',
  );
  assert.doesNotMatch(
    source,
    /useEffect\(\(\) => \{\s*if \(!autoDj\) return;\s*const pendingSongId = autoDjApplausePendingSongRef\.current;/s,
    'Applause auto-finalize should not be disabled when the host is running manual stage flow.',
  );
});
