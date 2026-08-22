import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const singer = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
const deck = readFileSync('src/apps/Mobile/components/AudienceReactionDeck.jsx', 'utf8');
const host = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const horizon = readFileSync('src/apps/Host/components/HostQueueHorizon.jsx', 'utf8');
const topChrome = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');
const queueActions = readFileSync('src/apps/Host/hooks/useQueueSongActions.js', 'utf8');

test('audience join, reaction sizing, fifth slot, and Fame entry follow the simplified design', () => {
  assert.doesNotMatch(singer, /Pick your profile avatar\. It identifies/);
  assert.doesNotMatch(singer, /avatar-storefront-jump-nav/);
  assert.doesNotMatch(singer, /game-membership-gate/);
  assert.match(singer, /data-feature-id="audience-fame-entry"/);
  assert.match(deck, /h-\[88px\][\s\S]*isGrid \? 'text-6xl' : 'text-4xl'/);
  assert.match(deck, /data-reaction-layout/);
  assert.match(deck, /min-h-\[136px\]/);
  assert.match(singer, /layout=\{tab === 'home' \? 'grid' : 'strip'\}/);
  assert.match(deck, /data-feature-id="reaction-deck-unlock-slot-5"/);
});

test('Tonight\'s Lineup owns mode switching, Show Time, and known item durations', () => {
  assert.match(horizon, /data-feature-id="host-lineup-night-mode"/);
  assert.match(horizon, /h-11 w-\[132px\][\s\S]*sm:w-\[168px\]/);
  assert.match(horizon, /appearance-none rounded-xl border[\s\S]*\[color-scheme:dark\]/);
  assert.match(horizon, /aria-busy=\{experiencePending\}/);
  assert.match(horizon, /data-feature-id="host-lineup-show-time"/);
  assert.match(horizon, /getHostLineupItemDurationSec/);
  assert.match(host, /changeNightExperienceQuick/);
  assert.doesNotMatch(topChrome, /Show Time/);
  assert.doesNotMatch(topChrome, /data-night-plan-chip/);
});

test('host catalogue submission does not wait for remote duration probing', () => {
  const addResult = queueActions.slice(
    queueActions.indexOf('const addSongFromResult'),
    queueActions.indexOf('const startEdit'),
  );
  const queueWriteIndex = addResult.indexOf('const docRef = await addDoc');
  const durationProbeIndex = addResult.indexOf('await resolvePreferredDuration');
  assert.ok(queueWriteIndex >= 0);
  assert.ok(durationProbeIndex > queueWriteIndex);
  assert.match(addResult, /void \(async \(\) => \{/);
});
