import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const source = readFileSync(new URL('../../scripts/qa/persona-golden-paths-playwright.mjs', import.meta.url), 'utf8');

test('production persona QA asserts background state and capability on Host and TV', () => {
  expect(source).toMatch(/BACKGROUND_AUDIO_QA_STATES = new Set/);
  expect(source).toMatch(/BACKGROUND_AUDIO_QA_CAPABILITIES = new Set/);
  expect(source).toMatch(/window\.__qaBackgroundAudioState\?\.key && window\.__qaBackgroundAudioState\?\.capabilityKey/);
  expect(source).toMatch(/assertBackgroundAudioQaSnapshot\(backgroundSnapshot, 'Host'\)/);
  expect(source).toMatch(/assertBackgroundAudioQaSnapshot\(backgroundSnapshot, 'TV'\)/);
  expect(source).toMatch(/waitForEvent\('dialog', \{ timeout: Math\.min\(10000, timeoutMs\) \}\)/);
  expect(source).toMatch(/\^Delete\(\?: Upload\)\?\$/);
  expect(source).toMatch(/const deleteClickPromise = deleteCard[\s\S]*const dialog = await dialogPromise;[\s\S]*await dialog\.accept\(\);[\s\S]*await deleteClickPromise;/);
});
