import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const singer = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
const tv = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const presentation = readFileSync('src/lib/gameLifecyclePresentation.js', 'utf8');
const statusCard = readFileSync('src/components/GameLifecycleStatusCard.jsx', 'utf8');

test('shared presentation resolves lifecycle slots and exposes ownership to both surfaces', () => {
  assert.match(presentation, /resolveGameLifecycleSlots\(room\)/);
  assert.match(presentation, /lifecycleSlots\.primaryMode/);
  assert.match(statusCard, /data-game-lifecycle-slot=\{presentation\.slot/);
  assert.match(statusCard, /data-game-lifecycle-mode=\{presentation\.modeId/);
});

test('Audience derives lifecycle guidance once and covers cartridge, Doodle, and Selfie shells', () => {
  assert.match(singer, /const gameLifecyclePresentation = useMemo\(\(\) => getGameLifecyclePresentation\(room \|\| \{\}\), \[room\]\)/);
  assert.equal((singer.match(/GameLifecycleStatusCard presentation=\{gameLifecyclePresentation\} surface="audience"/g) || []).length, 3);
  assert.match(singer, /GameLifecycleStatusCard presentation=\{popTriviaLifecyclePresentation\} surface="audience"/);
});

test('TV uses the same lifecycle presentation for cartridge, Doodle, and Selfie shells', () => {
  assert.match(tv, /const gameLifecyclePresentation = useMemo\(\(\) => getGameLifecyclePresentation\(room \|\| \{\}\), \[room\]\)/);
  assert.equal((tv.match(/GameLifecycleStatusCard presentation=\{gameLifecyclePresentation\} surface="tv"/g) || []).length, 3);
  assert.match(tv, /GameLifecycleStatusCard presentation=\{popTriviaLifecyclePresentation\} surface="tv"/);
});
