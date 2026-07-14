import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const source = readFileSync(new URL('../../scripts/qa/persona-golden-paths-playwright.mjs', import.meta.url), 'utf8');

test('production persona QA waits for authenticated Host content before checking controls', () => {
  expect(source).toMatch(/document\.body\?\.innerText[\s\S]*trim\(\)\.length > 50/);
  expect(source).toMatch(/timeout: Math\.min\(30000, timeoutMs\)/);
  expect(source).toMatch(/await delay\(1200\);[\s\S]*const directReady = await getGameLaunchpadDetail\(page\)/);
  expect(source).toMatch(/initialStateStartedAt/);
  expect(source).toMatch(/Singer surface did not reach an explicit join or main\/game state/);
  expect(source).toMatch(/Expected five effective setup domains before room creation/);
});
