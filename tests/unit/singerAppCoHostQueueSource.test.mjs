import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';

const singerAppPath = path.resolve('src/apps/Mobile/SingerApp.jsx');

test('SingerApp keeps co-host queue assist inside the audience request flow', () => {
  const source = readFileSync(singerAppPath, 'utf8');

  assert.match(
    source,
    /const \[coHostQueueTargetUid, setCoHostQueueTargetUid\] = useState\(''\);/,
    'SingerApp should track the selected co-host queue target locally',
  );
  assert.match(
    source,
    /targetSingerUid: !targetSingerIsSelf \? targetSingerUid : null,/,
    'SingerApp should only send a targetSingerUid when the co-host is queueing for someone else',
  );
  assert.match(
    source,
    /Add songs for yourself or anyone already in the room\./,
    'SingerApp should explain the co-host queue-assist behavior in the request UI',
  );
  assert.match(
    source,
    /Current target: \{activeCoHostQueueTarget\?\.name \|\| 'You'\}/,
    'SingerApp should surface the active co-host queue target in the helper card',
  );
  assert.match(
    source,
    /Fewer buttons on purpose\. Use one broad note and the host can handle the exact adjustment\./,
    'SingerApp should explain the tightened co-host signal module copy',
  );
});
