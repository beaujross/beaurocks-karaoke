import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');
const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('host top chrome keeps the vibe meter but drops the redundant ops strip', () => {
  assert.match(source, /data-feature-id="top-chrome-vibe-meter"/);
  assert.match(source, /Vibe Meter/);
  assert.match(source, /const crowdPulseLabel = crowdPulseMeta\?\.alignmentLabel/);
  assert.match(source, /const crowdPulseDirective = crowdPulseMeta\?\.hostDirective/);
  assert.doesNotMatch(source, /OpsStatusPill/);
  assert.doesNotMatch(source, /data-feature-id="top-chrome-ops-strip"/);
  assert.doesNotMatch(source, /Ops Strip/);
  assert.match(hostAppSource, /const hostOpsStatus = useMemo/);
  assert.match(hostAppSource, /getYouTubeQuotaBlockedUntilMs/);
  assert.match(hostAppSource, /hostOpsStatus\?\.summary/);
});
