import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const callableSource = readFileSync('functions/roomCommunications.js', 'utf8');
const indexSource = readFileSync('functions/index.js', 'utf8');
const rulesSource = readFileSync('firestore.rules', 'utf8');
const hostChatSource = readFileSync('src/apps/Host/hooks/useHostChat.js', 'utf8');
const audienceSource = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
const tvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const migrationSource = readFileSync('scripts/ops/migrate-room-communications.mjs', 'utf8');

test('Room communication mutations are server-authorized and App Check protected', () => {
  assert.match(callableSource, /requireAppCheck\(request, id\)/);
  assert.match(callableSource, /requireNamedAccount\(request\)/);
  assert.match(callableSource, /sendRoomLoungeMessage:/);
  assert.match(callableSource, /sendRoomHostMessage:/);
  assert.match(callableSource, /sendRoomOperatorSignal:/);
  assert.match(callableSource, /manageRoomCoHostInvite:/);
  assert.match(indexSource, /createRoomCommunicationCallables/);
});

test('private Room lanes live outside the public artifact tree', () => {
  assert.match(rulesSource, /match \/room_private_messages\/\{messageId\}/);
  assert.match(rulesSource, /request\.auth\.uid == resource\.data\.participantUid/);
  assert.match(rulesSource, /match \/room_operator_signals\/\{signalId\}/);
  assert.match(rulesSource, /match \/room_cohost_invites\/\{inviteId\}/);
  assert.match(rulesSource, /allow create, update, delete: if false;/);
  assert.match(hostChatSource, /collection\(db, 'room_private_messages'\)/);
  assert.match(audienceSource, /collection\(db, 'room_private_messages'\)/);
});

test('Public TV consumes only the server-created lounge projection', () => {
  assert.match(tvSource, /collection\(db, 'artifacts', APP_ID, 'public', 'data', 'tv_chat_messages'\)/);
  assert.doesNotMatch(tvSource, /collection\(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'\)/);
  assert.match(callableSource, /send_room_lounge_message_tv_projection_v1/);
  const projectionBlock = callableSource.slice(
    callableSource.indexOf('root().collection(PUBLIC_TV_MESSAGES)'),
    callableSource.indexOf('await batch.commit()', callableSource.indexOf('root().collection(PUBLIC_TV_MESSAGES)')),
  );
  assert.doesNotMatch(projectionBlock, /uid,/);
});

test('co-host capability starts only after acceptance and ends at leave, revoke, or Room close', () => {
  assert.match(callableSource, /status: "invited"/);
  assert.match(callableSource, /if \(action === "accept"\)/);
  assert.match(callableSource, /coHostRoleSchemaVersion: 2/);
  assert.match(callableSource, /leaveRoomCoHostRole:/);
  assert.match(indexSource, /updates\.coHostUids = \[\]/);
  assert.match(audienceSource, /data-feature-id="cohost-invitation"/);
  assert.match(audienceSource, /Helper Home/);
});

test('legacy sensitive communication has a dry-run-first migration path', () => {
  assert.match(migrationSource, /const apply = args\.includes\('--apply'\)/);
  assert.match(migrationSource, /No writes made/);
  assert.match(migrationSource, /legacy_private_chat_migration_v1/);
  assert.match(migrationSource, /legacy_operator_signal_migration_v1/);
  assert.match(migrationSource, /batch\.delete\(sourceRef\)/);
});
