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

test('room economy config exposes currency-aware starting balance and timed refill controls', () => {
  assert.match(source, /getRoomCurrencyPresentation/);
  assert.match(source, /Starting \{currencyPresentation\.plural\}/);
  assert.match(source, /Lobby refill \{currencyPresentation\.plural\}/);
  assert.match(source, /Every minutes/);
  assert.match(source, /Refill cap/);
  assert.match(source, /Award capped \{currencyPresentation\.plural\} while guests stay active/);
  assert.match(source, /BeauBucks, guest value, and support/);
  assert.match(source, /Participation points and guest rewards/);
  assert.match(source, /timedLobbyIntervalMin/);
  assert.match(source, /timedLobbyMaxPerGuest/);
});

test('authorized rooms explain platform-managed BeauBucks availability without a host off switch', () => {
  assert.match(source, /beauBucksControlAvailable = eventCreditsConfig\?\.beauBucksAuthorityEnabled === true/);
  assert.match(source, /data-feature-id="host-beaubucks-tonight-control"/);
  assert.match(source, /BeauBucks collection/);
  assert.match(source, /Guests keep BeauBucks and unlocked cosmetics on their account/);
  assert.match(source, /not a Room setting/);
  assert.match(source, /Always available/);
  assert.doesNotMatch(source, /beauBucksEnabledTonight: e\.target\.checked/);
  assert.doesNotMatch(source, />Authority</);
  assert.doesNotMatch(source, />Canary</);
});

test('Host can explicitly enable room-scoped fifth voting-reaction-slot purchases', () => {
  assert.match(source, /data-feature-id="host-reaction-slot-5-control"/);
  assert.match(source, /Let guests unlock a fifth voting emoji/);
  assert.match(source, /reactionSlot5PurchasesEnabled/);
  assert.match(source, /250 Room Points/);
  assert.match(source, /This room only/);
  assert.match(source, /1 swappable reaction/);
});
