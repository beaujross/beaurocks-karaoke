import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');
const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('host top chrome renders the ops strip and vibe meter from shared runtime state', () => {
  assert.match(source, /const OpsStatusPill = \(\{/);
  assert.match(source, /data-feature-id="top-chrome-vibe-meter"/);
  assert.match(source, /data-feature-id="top-chrome-ops-strip"/);
  assert.match(source, /Vibe Meter/);
  assert.match(source, /Ops Strip/);
  assert.match(source, /crowdPulseMeta\.alignmentLabel/);
  assert.match(source, /crowdPulseMeta\.hostDirective/);
  assert.match(source, /opsStatusItems\.map/);
  assert.match(hostAppSource, /const hostOpsStatus = useMemo/);
  assert.match(hostAppSource, /getYouTubeQuotaBlockedUntilMs/);
  assert.match(hostAppSource, /opsStatus=\{hostOpsStatus\}/);
});
