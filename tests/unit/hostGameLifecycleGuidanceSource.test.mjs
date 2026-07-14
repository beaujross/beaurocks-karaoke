import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const queueSource = readFileSync('src/apps/Host/components/AddToQueueFormBody.jsx', 'utf8');
const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('Host game cards expose lifecycle guidance before queueing', () => {
  assert.match(queueSource, /getGameLifecycleLabel/);
  assert.match(queueSource, /data-game-lifecycle-label=\{pack\.id\}/);
  assert.match(queueSource, /const lifecycleLabel = activeMomentType === 'game'/);
});

test('run-of-show game starts pass through one compatibility guard before mutation', () => {
  assert.match(hostSource, /const requestedGameMode = getRunOfShowGameMode\(requestedItem\)/);
  assert.match(hostSource, /getRoomGameLaunchPreflight\(\{/);
  assert.match(hostSource, /room: roomRef\.current \|\| \{\}/);
  assert.match(hostSource, /performanceActive: Boolean\(roomRef\.current\?\.currentPerformanceMeta \|\| roomRef\.current\?\.currentPerformanceSession/);
  assert.match(hostSource, /if \(!compatibility\.allowed\)[\s\S]*return currentDirector/);
  assert.ok(hostSource.indexOf('if (!compatibility.allowed)') < hostSource.indexOf("executeRunOfShowAction({ roomCode, action: 'start', itemId })"));
});
