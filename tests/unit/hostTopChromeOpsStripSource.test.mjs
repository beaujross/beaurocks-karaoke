import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');
const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('host top chrome keeps the vibe meter but drops the redundant ops strip', () => {
  assert.match(source, /data-feature-id="top-chrome-vibe-meter"/);
  assert.match(source, /<NavStatusLight[\s\S]*label="Apple"/);
  assert.match(source, /<NavStatusLight[\s\S]*label="AI"/);
  assert.match(source, /<NavStatusLight[\s\S]*label=\{String\(permissionLevel \|\| 'unknown'\)\.toUpperCase\(\)\}/);
  assert.match(source, /inline-flex min-w-0 items-center gap-1\.5 rounded-lg border px-2 py-1 text-\[10px\] uppercase tracking-\[0\.14em\]/);
  assert.match(source, /<span className="text-zinc-100 hidden lg:inline">Vibe<\/span>/);
  assert.match(source, /const crowdPulseLabel = crowdPulseMeta\?\.alignmentLabel/);
  assert.match(source, /const crowdPulseDirective = crowdPulseMeta\?\.hostDirective/);
  assert.match(source, /<div className="hidden xl:flex items-center gap-2">[\s\S]*\[\s*\{ key: 'stage', label: 'Queue' \},[\s\S]*\{ key: 'lobby', label: 'Audience' \}\s*\]\.map/);
  assert.match(source, /\[\s*\{ key: 'stage', label: 'Queue' \},[\s\S]*\{ key: 'admin', label: 'Admin' \}\s*\]\.map/);
  assert.match(source, /title="Open Admin"/);
  assert.match(source, /fa-solid fa-gear text-base lg:text-lg/);
  assert.doesNotMatch(source, /OpsStatusPill/);
  assert.doesNotMatch(source, /data-feature-id="top-chrome-ops-strip"/);
  assert.doesNotMatch(source, /Ops Strip/);
  assert.match(hostAppSource, /const hostOpsStatus = useMemo/);
  assert.match(hostAppSource, /getYouTubeQuotaBlockedUntilMs/);
  assert.match(hostAppSource, /hostOpsStatus\?\.summary/);
});
