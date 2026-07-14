import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const hostSource = readFileSync(new URL('../../src/apps/Host/HostApp.jsx', import.meta.url), 'utf8');
const readinessSource = readFileSync(new URL('../../src/lib/youtubeEventReadiness.js', import.meta.url), 'utf8');
const adminSmokeSource = readFileSync(new URL('../../scripts/qa/admin-workspace-playwright-smoke.mjs', import.meta.url), 'utf8');

test('Room Library Curator exposes one low-noise YouTube event preflight', () => {
  expect(hostSource).toMatch(/buildYouTubeEventReadiness/);
  expect(hostSource).toMatch(/data-feature-id="youtube-event-readiness"/);
  expect(hostSource).toMatch(/Tonight's media preflight/);
  expect(readinessSource).toMatch(/Google Cloud Quotas is the source of truth/);
  expect(hostSource).toMatch(/youtubeEventReadiness\.checks\.map/);
  expect(hostSource).toMatch(/youtubeEventReadiness\.actions\.map/);
});
test('production Admin smoke protects the YouTube event preflight path', () => {
  expect(adminSmokeSource).toMatch(/desktop_youtube_event_preflight/);
  expect(adminSmokeSource).toMatch(/data-feature-id="open-youtube-curator"/);
  expect(adminSmokeSource).toMatch(/data-feature-id="youtube-event-readiness"/);
  expect(adminSmokeSource).toMatch(/Audio popover obscures the Admin media workspace/);
  expect(adminSmokeSource).toMatch(/Google Cloud Quotas is the source of truth/);
});
test('production Admin smoke can capture controlled cooldown evidence without burning live quota', () => {
  expect(adminSmokeSource).toMatch(/QA_YOUTUBE_COOLDOWN_EVIDENCE/);
  expect(adminSmokeSource).toMatch(/bross_youtube_quota_block_until_ms_v1/);
  expect(adminSmokeSource).toMatch(/Fallback Ready/);
  expect(adminSmokeSource).toMatch(/quota-exhaustion-fallback\.png/);
});