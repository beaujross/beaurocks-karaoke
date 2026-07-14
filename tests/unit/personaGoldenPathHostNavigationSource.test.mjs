import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const source = readFileSync(new URL('../../scripts/qa/persona-golden-paths-playwright.mjs', import.meta.url), 'utf8');

test('production persona QA requires a real direct Host-room URL before skipping navigation', () => {
  expect(source).toMatch(/alreadyInDirectHostRoom = sanitizeRoomCode\(currentUrl\.searchParams\.get\('room'\)\) === sanitizeRoomCode\(roomCode\)/);
  expect(source).toMatch(/currentUrl\.searchParams\.get\('mode'\)[\s\S]*=== 'host'/);
  expect(source).toMatch(/if \(!alreadyInDirectHostRoom\) \{[\s\S]*gotoWithSurfaceRedirectTolerance\(page, hostRoomUrl/);
  expect(source).toMatch(/openRequestedRoomFromBrowser/);
  expect(source).toMatch(/getByRole\('tab', \{ name: \/\^Existing Rooms\/i \}\)/);
  expect(source).toMatch(/input\[placeholder="Open by room code"\]/);
  expect(source).toMatch(/name: \/\^Open Room\$\/i/);
});

test('production persona QA tolerates browser aborts only after a real surface redirect', () => {
  expect(source).toMatch(/if \(!\/ERR_ABORTED\/i\.test\(String\(error\?\.message \|\| error\)\)\) throw error/);
  expect(source).toMatch(/if \(!page\.url\(\) \|\| page\.url\(\) === 'about:blank'\) throw error/);
});
