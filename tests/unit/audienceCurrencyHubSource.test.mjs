import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const singerSource = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
const collectionSource = readFileSync(
  'src/apps/Mobile/components/AudienceReactionCollection.jsx',
  'utf8',
);
const functionsSource = readFileSync('functions/index.js', 'utf8');

test('audience wallet separates Points, BeauBucks, and the Reaction Bank', () => {
  assert.match(singerSource, /data-feature-id="audience-currency-tabs"/);
  assert.match(singerSource, /audience-currency-tab-\$\{item\.id\}/);
  assert.match(singerSource, /Get More Points/);
  assert.match(singerSource, /Get BeauBucks/);
  assert.match(singerSource, /Reaction Bank/);
});

test('reaction bank merchandises the in-app button, screen flourish, value, and recharge', () => {
  assert.match(collectionSource, /data-feature-id="reaction-merch-preview"/);
  assert.match(collectionSource, /data-feature-id="reaction-bank-filters"/);
  assert.match(collectionSource, /Your button/);
  assert.match(collectionSource, /On-screen flourish/);
  assert.match(collectionSource, /Preview \$\{reaction\.label\}/);
  assert.match(collectionSource, /→ \+\{selectedReaction\.scoreValue\} score/);
  assert.match(collectionSource, /Recharge/);
  assert.match(collectionSource, /not a better Point-to-score exchange rate/);
});

test('earning surfaces use tracked sharing and verified campaign language', () => {
  assert.match(singerSource, /data-feature-id="audience-share-party-invite"/);
  assert.match(singerSource, /audience_room_invite_started/);
  assert.match(singerSource, /audience_room_invite_shared/);
  assert.match(singerSource, /Share the direct join link and fill tonight's queue/);
  assert.match(singerSource, /promo code or another verified campaign/);
  assert.match(singerSource, /Opening a social link alone never awards Points/);
});

test('BeauBucks experience follows server rollout authority rather than room economy toggles', () => {
  assert.match(
    functionsSource,
    /const isRoomBeauBucksExperienceEnabled = \(\{ roomCode = "", roomData = \{\} \} = \{\}\) =>\s*isRoomBeauBucksAuthorityEnabled\(\{ roomCode, roomData \}\);/,
  );
  assert.doesNotMatch(functionsSource, /unavailableReason:[\s\S]{0,220}host_disabled/);
  assert.doesNotMatch(functionsSource, /unavailableReason:[\s\S]{0,220}room_points_disabled/);
});
