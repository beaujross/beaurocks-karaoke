import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('billing workspace includes a live ops health panel tied to shared runtime status', () => {
  assert.match(source, /data-feature-id="admin-live-ops-health"/);
  assert.match(source, /Live Ops Health/);
  assert.match(source, /Current room alignment and workspace provider status in one place\./);
  assert.match(source, /Room Alignment/);
  assert.match(source, /With Host/);
  assert.match(source, /Workspace Status Lights/);
  assert.match(source, /hostOpsStatus\?\.items/);
  assert.match(source, /crowdPulse\?\.alignmentLabel/);
  assert.match(source, /crowdPulse\?\.hostDirective/);
  assert.match(source, /appleSearchTelemetry\?\.recentSearches/);
  assert.match(source, /youtubeSearchTelemetry\?\.recentSearches/);
  assert.match(source, /youtubeSearchTelemetry\?\.cacheHitPct/);
  assert.match(source, /youtubeSearchTelemetry\?\.liveSharePct/);
  assert.match(source, /aiGenerationTelemetry\?\.recentGenerations/);
  assert.match(source, /recent Apple searches/);
  assert.match(source, /recent generations/);
});
