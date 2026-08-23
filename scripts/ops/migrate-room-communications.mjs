#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let admin;
try {
  admin = require('firebase-admin');
} catch {
  admin = require('../../functions/node_modules/firebase-admin');
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const readArg = (name, fallback = '') => {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || '').trim() : fallback;
};
const roomFilter = readArg('--room').toUpperCase();
const limit = Math.max(0, Number(readArg('--limit', '0')) || 0);
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'beaurocks-karaoke-v2';

if (!admin.apps.length) {
  admin.initializeApp({ projectId, credential: admin.credential.applicationDefault() });
}

const db = admin.firestore();
const ROOT = db.collection('artifacts').doc('bross-app').collection('public').doc('data');
const now = () => admin.firestore.Timestamp.now();
const fromMs = (value) => admin.firestore.Timestamp.fromMillis(value);
const uid = (value) => String(value || '').trim().replace(/[^A-Za-z0-9:_-]/g, '').slice(0, 180);
const text = (value, max = 300) => String(value || '').trim().slice(0, max);
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : []).map(uid).filter(Boolean))];
const roomMatches = (roomCode) => !roomFilter || String(roomCode || '').trim().toUpperCase() === roomFilter;
const take = (docs) => limit ? docs.slice(0, limit) : docs;

const stats = {
  legacyPrivateMessages: 0,
  legacySignals: 0,
  roomsUpgraded: 0,
  activeInvitesBackfilled: 0,
  publicSensitiveDocsDeleted: 0,
};

const writeAndDelete = async ({ targetRef, payload, sourceRef }) => {
  if (!apply) return;
  const batch = db.batch();
  batch.set(targetRef, payload, { merge: true });
  batch.delete(sourceRef);
  await batch.commit();
  stats.publicSensitiveDocsDeleted += 1;
};

const migrateLegacyPrivateMessages = async () => {
  const snapshot = await ROOT.collection('chat_messages').get();
  for (const source of take(snapshot.docs)) {
    const data = source.data() || {};
    const roomCode = text(data.roomCode, 24).toUpperCase();
    const channel = text(data.channel, 32).toLowerCase();
    const isPrivate = data.toHost === true || ['host', 'dm', 'private'].includes(channel) || !!data.toUid;
    if (!isPrivate || !roomMatches(roomCode)) continue;
    const senderUid = uid(data.uid);
    const participantUid = data.toHost === true || channel === 'host'
      ? senderUid
      : uid(data.participantUid || data.toUid || senderUid);
    if (!roomCode || !participantUid) {
      console.warn('[room-comms-migrate] skipped private message with missing identity', source.path);
      continue;
    }
    const threadId = `${roomCode}_${participantUid}`.replace(/[^A-Za-z0-9_-]/g, '_');
    const targetRef = db.collection('room_private_messages').doc(`legacy_${source.id}`);
    const timestamp = data.timestamp || data.createdAt || now();
    await writeAndDelete({
      targetRef,
      sourceRef: source.ref,
      payload: {
        ...data,
        roomCode,
        participantUid,
        threadId,
        channel: data.toHost === true || channel === 'host' ? 'host' : 'dm',
        senderRole: data.toHost === true || channel === 'host' ? 'participant' : 'host',
        timestamp,
        createdAt: data.createdAt || timestamp,
        expiresAt: data.expiresAt || fromMs(Date.now() + (30 * 86400000)),
        legacyPublicPath: source.path,
        serverProvenance: 'legacy_private_chat_migration_v1',
      },
    });
    if (apply) {
      await db.collection('room_host_threads').doc(threadId).set({
        threadId,
        roomCode,
        participantUid,
        participantName: text(data.toHost === true ? data.user : data.toUser, 80) || 'Guest',
        status: 'open',
        lastMessagePreview: text(data.text, 120),
        lastMessageByRole: data.toHost === true || channel === 'host' ? 'participant' : 'host',
        updatedAt: timestamp,
        expiresAt: fromMs(Date.now() + (30 * 86400000)),
      }, { merge: true });
    }
    stats.legacyPrivateMessages += 1;
  }
};

const migrateLegacySignals = async () => {
  const snapshot = await ROOT.collection('activities').where('type', '==', 'cohost_signal').get();
  for (const source of take(snapshot.docs)) {
    const data = source.data() || {};
    const roomCode = text(data.roomCode, 24).toUpperCase();
    if (!roomMatches(roomCode)) continue;
    const legacyType = text(data.signalId, 80).toLowerCase();
    const area = legacyType === 'track_issue' ? 'track' : legacyType === 'vocal_issue' ? 'vocal' : legacyType === 'mix_issue' ? 'mix' : '';
    const type = area ? 'audio_attention' : legacyType;
    if (!roomCode || !['wrong_backing', 'audio_attention', 'guest_help', 'next_not_ready', 'pacing'].includes(type)) continue;
    const actorUid = uid(data.uid || data.actorUid);
    const timestamp = data.timestamp || data.createdAt || now();
    await writeAndDelete({
      targetRef: db.collection('room_operator_signals').doc(`legacy_${source.id}`),
      sourceRef: source.ref,
      payload: {
        signalId: `legacy_${source.id}`,
        roomCode,
        type,
        audioArea: area,
        status: 'delivered',
        actorUid,
        actorUids: unique([actorUid]),
        actorName: text(data.user || data.actorName, 80) || 'Co-Host',
        count: Math.max(1, Number(data.count || 1) || 1),
        performanceId: text(data.performanceId, 180),
        performanceSongTitle: text(data.performanceSongTitle, 180),
        performanceArtistName: text(data.performanceArtistName, 180),
        performanceSingerName: text(data.performanceSingerName, 120),
        signalScope: data.signalScope === 'performance' ? 'performance' : 'room',
        createdAt: data.createdAt || timestamp,
        deliveredAt: timestamp,
        updatedAt: timestamp,
        expiresAt: fromMs(Date.now() + (2 * 3600000)),
        legacyPublicPath: source.path,
        serverProvenance: 'legacy_operator_signal_migration_v1',
      },
    });
    stats.legacySignals += 1;
  }
};

const migrateRoomRoles = async () => {
  const snapshot = await ROOT.collection('rooms').get();
  for (const roomSnap of take(snapshot.docs)) {
    const room = roomSnap.data() || {};
    const roomCode = roomSnap.id.toUpperCase();
    if (!roomMatches(roomCode)) continue;
    const primaryHostUid = uid(room.hostUid);
    const legacyCoHosts = unique(room.runOfShowRoles?.coHosts || []);
    const coHostUids = unique([...(room.coHostUids || []), ...legacyCoHosts]).filter((entry) => entry !== primaryHostUid);
    const hostUids = unique([primaryHostUid, ...(room.hostUids || [])]).filter((entry) => entry === primaryHostUid || !coHostUids.includes(entry));
    const needsUpgrade = Number(room.coHostRoleSchemaVersion || 0) < 2
      || JSON.stringify(coHostUids) !== JSON.stringify(unique(room.coHostUids || []))
      || JSON.stringify(hostUids) !== JSON.stringify(unique(room.hostUids || []));
    if (!needsUpgrade) continue;
    if (apply) {
      await roomSnap.ref.set({
        coHostRoleSchemaVersion: 2,
        coHostUids,
        hostUids,
        runOfShowRoles: { ...(room.runOfShowRoles || {}), coHosts: coHostUids },
        updatedAt: now(),
      }, { merge: true });
      for (const targetUid of coHostUids) {
        const inviteId = `${roomCode}_${targetUid}`.replace(/[^A-Za-z0-9_-]/g, '_');
        await db.collection('room_cohost_invites').doc(inviteId).set({
          inviteId,
          roomCode,
          targetUid,
          status: 'active',
          migratedAt: now(),
          updatedAt: now(),
          expiresAt: fromMs(Date.now() + (12 * 3600000)),
        }, { merge: true });
        stats.activeInvitesBackfilled += 1;
      }
    } else {
      stats.activeInvitesBackfilled += coHostUids.length;
    }
    stats.roomsUpgraded += 1;
  }
};

console.log(`[room-comms-migrate] ${apply ? 'APPLY' : 'DRY RUN'} project=${projectId} room=${roomFilter || 'ALL'} limit=${limit || 'none'}`);
await migrateLegacyPrivateMessages();
await migrateLegacySignals();
await migrateRoomRoles();
console.log('[room-comms-migrate] complete', stats);
if (!apply) console.log('[room-comms-migrate] No writes made. Re-run with --apply after reviewing this report.');
