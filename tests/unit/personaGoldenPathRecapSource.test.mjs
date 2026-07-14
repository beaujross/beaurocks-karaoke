import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const source = readFileSync(new URL('../../scripts/qa/persona-golden-paths-playwright.mjs', import.meta.url), 'utf8');

test('production persona QA accepts the server-rendered missing-recap fallback', () => {
  expect(source).toMatch(/recap not found/);
  expect(source).toMatch(/stateEl\.waitFor\(\{ state: "attached", timeout: Math\.min\(10000, timeoutMs\) \}\)/);
});
