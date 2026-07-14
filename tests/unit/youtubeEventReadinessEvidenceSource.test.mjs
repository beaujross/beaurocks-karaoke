import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const evidenceSource = readFileSync(new URL('../../scripts/qa/youtube-audit-product-evidence-screenshots.mjs', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../../src/lib/youtubeSearchClient.js', import.meta.url), 'utf8');

test('YouTube audit evidence and deployment config include the event-readiness contract', () => {
  expect(evidenceSource).toMatch(/Tonight's media preflight/);
  expect(evidenceSource).toMatch(/data-feature-id="open-youtube-curator"/);
  expect(evidenceSource).toMatch(/data-feature-id="youtube-event-readiness"/);
  expect(evidenceSource).toMatch(/getByText\("Audio \+ Mix", \{ exact: true \}\)\.waitFor\(\{ state: "detached"/);
  expect(evidenceSource).toMatch(/Google Cloud Quotas is the source of truth/);
  expect(envExample).toMatch(/VITE_YOUTUBE_DAILY_SEARCH_LIST_CALL_LIMIT=100/);
  expect(envExample).toMatch(/VITE_YOUTUBE_DAILY_GENERAL_DATA_UNIT_LIMIT=10000/);
  expect(clientSource).toMatch(/dailySearchListCallLimitSource/);
  expect(clientSource).toMatch(/official_default/);
});
