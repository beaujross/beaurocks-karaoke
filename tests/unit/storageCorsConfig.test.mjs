import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const corsConfig = JSON.parse(readFileSync('cors.json', 'utf8'));

test('Storage CORS allows production audience app origins for room photos', () => {
  const origins = new Set(corsConfig.flatMap((entry) => entry.origin || []));
  expect(origins.has('https://app.beaurocks.app')).toBe(true);
  expect(origins.has('https://beaurocks.app')).toBe(true);
  expect(origins.has('https://beaurocks-karaoke-v2.web.app')).toBe(true);
  expect(origins.has('https://beaurocks-karaoke-v2.firebaseapp.com')).toBe(true);
});
