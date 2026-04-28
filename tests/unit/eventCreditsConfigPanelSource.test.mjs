import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/EventCreditsConfigPanel.jsx', 'utf8');

test('event credits config panel exposes co-host credit policy and reaction cooldown controls', () => {
  assert.match(source, /CO_HOST_CREDIT_POLICY_OPTIONS/);
  assert.match(source, /Co-host credit policy/);
  assert.match(source, /Free reactions/);
  assert.match(source, /Unlimited co-host/);
  assert.match(source, /Reaction tap cooldown/);
  assert.match(source, /Shared by emoji reactions and the applause clap button/);
  assert.match(source, /normalizeReactionTapCooldownMs\(Number\(e\.target\.value \|\| 0\) \* 1000\)/);
});

test('event credits config panel exposes join credits and timed refill controls', () => {
  assert.match(source, /Join credits/);
  assert.match(source, /Lobby refill/);
  assert.match(source, /Every minutes/);
  assert.match(source, /Refill cap/);
  assert.match(source, /Award capped lobby refill credits while guests stay active/);
  assert.match(source, /timedLobbyIntervalMin/);
  assert.match(source, /timedLobbyMaxPerGuest/);
});
