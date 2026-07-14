import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/EventCreditsConfigPanel.jsx', 'utf8');

test('room economy explains the guest value loop before advanced pacing controls', () => {
  assert.match(source, /getRoomEconomySummary/);
  assert.match(source, /data-room-economy-guest-loop="true"/);
  assert.match(source, /economySummary\.cards\.map/);
  assert.match(source, /data-room-economy-guidance="true"/);
  assert.match(source, /Check before guests join/);
  assert.match(source, /Balance pacing/);
  assert.match(source, /Adjust grants and automatic refills/);
  assert.match(source, /<details className="mt-4 rounded-2xl border border-cyan-300\/15/);
});
