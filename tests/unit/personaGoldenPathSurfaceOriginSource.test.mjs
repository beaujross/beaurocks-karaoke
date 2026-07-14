import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const source = readFileSync(new URL('../../scripts/qa/persona-golden-paths-playwright.mjs', import.meta.url), 'utf8');

test('production persona QA keeps Firebase fallback hosting on one valid origin', () => {
  expect(source).toMatch(/host\.endsWith\("\.web\.app"\) \|\| host\.endsWith\("\.firebaseapp\.com"\)/);
  expect(source).toMatch(/if \(!singleOriginHosting && host\.startsWith\("app\."\)\)/);
  expect(source).toMatch(/else if \(!singleOriginHosting && host && !host\.startsWith\("host\."\)/);
  expect(source).toMatch(/else if \(!singleOriginHosting && host && !host\.startsWith\("tv\."\)/);
});
