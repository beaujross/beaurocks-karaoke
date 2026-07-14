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
  assert.ok(
    source.indexOf('if (audienceGameMembershipGate.visible) return audienceGameMembershipGateScreen;')
      < source.indexOf('// --- VIBE SYNC OVERLAYS ---'),
  );
  assert.ok(
    source.indexOf('if (audienceGameMembershipGate.visible) return audienceGameMembershipGateScreen;')
      < source.indexOf('// --- GAME INTERCEPTION ---'),
  );
});

test('game-first join gate reuses the canonical join transaction and preserves the live destination', () => {
  assert.match(source, /data-singer-view="game-membership-gate"/);
  assert.match(source, /data-singer-join-name/);
  assert.match(source, /data-singer-join-button/);
  assert.match(source, /data-singer-rules-checkbox/);
  assert.match(source, /data-singer-rules-confirm/);
  assert.match(source, /const joined = await join\(\)/);
  assert.match(source, /Join and play \$\{audienceGameMembershipGate\.modeLabel\}/);
});

test('already joined guests and deterministic fixtures bypass the join-first gate contract', () => {
  assert.match(source, /hasRoomUser: !!user/);
  assert.match(source, /isDemoFixture: isMarketingDemoFixture/);
  assert.match(source, /if\(!user && !isMarketingDemoFixture\) return joinScreen/);
});
