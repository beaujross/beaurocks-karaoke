import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(__dirname, '../../src/apps/Mobile/SingerApp.jsx'), 'utf8');

test('Audience resolves room-user membership before exposing active takeover controls', () => {
  assert.match(source, /roomUserMembershipResolved, setRoomUserMembershipResolved/);
  assert.match(source, /setRoomUserMembershipResolved\(false\)[\s\S]+onSnapshot\(doc\(db,[\s\S]+room_users/);
  assert.match(source, /setRoomUserMembershipResolved\(true\)/);
  assert.match(source, /if \(!user && !roomUserMembershipResolved && activeUid && !isMarketingDemoFixture\)/);
  assert.match(source, /data-singer-view="membership-connecting"/);
});

test('joining during a live game uses the same canonical join screen as every room state', () => {
  assert.doesNotMatch(source, /data-singer-view="game-membership-gate"/);
  assert.doesNotMatch(source, /audienceGameMembershipGateScreen/);
  assert.match(source, /data-singer-view="join"/);
  assert.match(source, /data-singer-join-name/);
  assert.match(source, /data-singer-join-button/);
  assert.match(source, /data-singer-rules-checkbox/);
  assert.match(source, /data-singer-rules-confirm/);
  assert.match(source, /if \(!user && !isMarketingDemoFixture\) return joinScreen/);
});

test('already joined guests and deterministic fixtures bypass the canonical join screen', () => {
  assert.match(source, /if \(!user && !roomUserMembershipResolved && activeUid && !isMarketingDemoFixture\)/);
  assert.match(source, /data-singer-view="membership-connecting"/);
  assert.match(source, /if \(!user && !isMarketingDemoFixture\) return joinScreen/);
});
