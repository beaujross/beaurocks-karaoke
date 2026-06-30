import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('Pitch Runner host rescue stays inside the game instead of triggering Vibe Sync strobe', () => {
  assert.match(hostSource, /activeMode === 'flappy_bird'[\s\S]*kind: 'rescue'[\s\S]*label: 'PITCH LOCK'/);
  assert.doesNotMatch(hostSource, /activeMode === 'flappy_bird'[\s\S]*lightMode: 'strobe'[\s\S]*toast\('Pitch lock sent\.'\)/);
  assert.doesNotMatch(hostSource, /activeMode === 'flappy_bird'[\s\S]*strobeSessionId: now[\s\S]*toast\('Pitch lock sent\.'\)/);
});
