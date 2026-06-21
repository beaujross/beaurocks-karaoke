#!/usr/bin/env node
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIREBASE_CLI_CLIENT_ID = process.env.FIREBASE_CLIENT_ID || '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = process.env.FIREBASE_CLIENT_SECRET || 'j9iVZfS8kkCEFUPaAeJV0sAi';

const getFirebaseCliConfigPaths = () => [
  process.env.FIREBASE_TOOLS_CONFIG,
  process.env.APPDATA ? path.join(process.env.APPDATA, 'configstore', 'firebase-tools.json') : '',
  process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json') : '',
].filter(Boolean);

let temporaryAdcPath = '';
let temporaryAdcDir = '';

const loadFirebaseCliAuthorizedUser = () => {
  for (const configPath of getFirebaseCliConfigPaths()) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const refreshToken = parsed?.tokens?.refresh_token;
      if (!refreshToken) continue;
      return {
        type: 'authorized_user',
        client_id: FIREBASE_CLI_CLIENT_ID,
        client_secret: FIREBASE_CLI_CLIENT_SECRET,
        refresh_token: refreshToken,
      };
    } catch (_) {}
  }
  return null;
};

const prepareFirebaseCliApplicationDefault = () => {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  const authorizedUser = loadFirebaseCliAuthorizedUser();
  if (!authorizedUser) return;
  const tempRoot = process.env.TEMP || process.env.TMP || projectRoot;
  temporaryAdcDir = fs.mkdtempSync(path.join(tempRoot, 'host-media-adc-'));
  temporaryAdcPath = path.join(temporaryAdcDir, 'application_default_credentials.json');
  fs.writeFileSync(temporaryAdcPath, JSON.stringify(authorizedUser));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = temporaryAdcPath;
};

const cleanupTemporaryApplicationDefault = () => {
  try { if (temporaryAdcPath) fs.rmSync(temporaryAdcPath, { force: true }); } catch (_) {}
  try { if (temporaryAdcDir) fs.rmSync(temporaryAdcDir, { force: true, recursive: true }); } catch (_) {}
};
process.once('exit', cleanupTemporaryApplicationDefault);

const loadAdmin = () => {
  try { return require('firebase-admin'); } catch (_) {}
  return require(path.join(projectRoot, 'functions', 'node_modules', 'firebase-admin'));
};

const admin = loadAdmin();
prepareFirebaseCliApplicationDefault();
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'beaurocks-karaoke-v2';
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.GCLOUD_STORAGE_BUCKET || (projectId + '.firebasestorage.app');
const credential = admin.credential.applicationDefault();
if (!admin.apps.length) admin.initializeApp({ projectId, storageBucket, credential });

const db = admin.firestore();
const bucket = admin.storage().bucket(storageBucket);
const ROOT = db.collection('artifacts').doc('bross-app').collection('public').doc('data');
const LEGACY_UPLOADS = 'room_uploads';
const LEGACY_SCENES = 'room_scene_presets';
const ACCOUNT_ASSETS = 'host_media_assets';
const ACCOUNT_SCENES = 'host_media_scene_presets';

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArg = (name, fallback = '') => {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || '').trim() : fallback;
};

const dryRun = hasFlag('--dry-run');
const copyStorage = hasFlag('--copy-storage');
const roomFilter = getArg('--room').toUpperCase();
const limit = Math.max(0, Number(getArg('--limit', '0')) || 0);

const sanitizePathPart = (value = '') => String(value || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file';
const nowMs = () => Date.now();

const buildDownloadUrl = ({ bucketName, storagePath, token }) => (

  'https://firebasestorage.googleapis.com/v0/b/'
  + encodeURIComponent(bucketName)
  + '/o/'
  + encodeURIComponent(storagePath)
  + '?alt=media&token='
  + encodeURIComponent(token)
);

const copyLegacyStorage = async ({ ownerUid, roomCode, legacyStoragePath, fileName, mediaUrl }) => {
  const sourcePath = String(legacyStoragePath || '').trim();
  if (dryRun || !copyStorage || !sourcePath) return { storagePath: sourcePath, mediaUrl };
  const safeOwnerUid = sanitizePathPart(ownerUid);
  const safeRoomCode = sanitizePathPart(roomCode);
  const safeFileName = sanitizePathPart(fileName || sourcePath.split('/').pop() || 'media');
  const nextPath = 'host_media/' + safeOwnerUid + '/legacy/' + safeRoomCode + '/' + nowMs() + '_' + safeFileName;
  const sourceFile = bucket.file(sourcePath);
  const [exists] = await sourceFile.exists();
  if (!exists) {
    console.warn('[media-migrate] storage source missing, keeping legacy path:', sourcePath);
    return { storagePath: sourcePath, mediaUrl };
  }
  const [metadata] = await sourceFile.getMetadata().catch(() => [{}]);
  const token = String(metadata?.metadata?.firebaseStorageDownloadTokens || '').split(',').filter(Boolean)[0] || crypto.randomUUID();
  await sourceFile.copy(bucket.file(nextPath));
  await bucket.file(nextPath).setMetadata({
    contentType: metadata?.contentType || undefined,
    cacheControl: metadata?.cacheControl || 'public,max-age=604800',
    metadata: { ...(metadata?.metadata || {}), firebaseStorageDownloadTokens: token },
  });
  return {
    storagePath: nextPath,
    mediaUrl: buildDownloadUrl({ bucketName: bucket.name, storagePath: nextPath, token }),
  };
};

const getRooms = async () => {
  if (roomFilter) {
    const snap = await ROOT.collection('rooms').doc(roomFilter).get();
    return snap.exists ? [{ id: snap.id, ...snap.data() }] : [];
  }
  const snap = await ROOT.collection('rooms').get();
  const rooms = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return limit ? rooms.slice(0, limit) : rooms;
};

const setDoc = async (ref, payload) => {
  if (dryRun) return;
  await ref.set(payload, { merge: true });
};

const migrateRoomUploads = async (room) => {
  const roomCode = String(room.id || room.roomCode || '').trim().toUpperCase();
  const ownerUid = String(room.hostUid || (Array.isArray(room.hostUids) ? room.hostUids[0] : '') || '').trim();
  if (!roomCode || !ownerUid) return { uploads: 0, scenes: 0 };

  const uploadSnap = await ROOT.collection(LEGACY_UPLOADS).where('roomCode', '==', roomCode).get();
  let uploads = 0;
  for (const doc of uploadSnap.docs) {
    const data = doc.data() || {};
    const copied = await copyLegacyStorage({
      ownerUid,
      roomCode,
      legacyStoragePath: data.storagePath,
      fileName: data.fileName,
      mediaUrl: data.mediaUrl || data.url || '',
    });
    const payload = {
      ...data,
      ownerUid,
      roomCode,
      roomCodes: Array.from(new Set([roomCode, ...((Array.isArray(data.roomCodes) ? data.roomCodes : []).filter(Boolean))])),
      libraryScope: 'account',
      collectionName: ACCOUNT_ASSETS,
      legacyCollection: LEGACY_UPLOADS,
      legacyDocId: doc.id,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedAtMs: nowMs(),
      storagePath: copied.storagePath,
      mediaUrl: copied.mediaUrl || data.mediaUrl || data.url || '',
      url: copied.mediaUrl || data.url || data.mediaUrl || '',
    };
    await setDoc(ROOT.collection(ACCOUNT_ASSETS).doc(doc.id), payload);
    uploads += 1;
  }

  const sceneSnap = await ROOT.collection(LEGACY_SCENES).where('roomCode', '==', roomCode).get();
  let scenes = 0;
  for (const doc of sceneSnap.docs) {
    const data = doc.data() || {};
    const copied = await copyLegacyStorage({
      ownerUid,
      roomCode,
      legacyStoragePath: data.storagePath,
      fileName: data.fileName,
      mediaUrl: data.mediaUrl || '',
    });
    const sourceUploadId = String(data.sourceUploadId || '').trim();
    const payload = {
      ...data,
      ownerUid,
      roomCode,
      roomCodes: Array.from(new Set([roomCode, ...((Array.isArray(data.roomCodes) ? data.roomCodes : []).filter(Boolean))])),
      libraryScope: 'account',
      collectionName: ACCOUNT_SCENES,
      sourceUploadCollection: sourceUploadId ? ACCOUNT_ASSETS : '',
      legacyCollection: LEGACY_SCENES,
      legacyDocId: doc.id,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedAtMs: nowMs(),
      storagePath: copied.storagePath,
      mediaUrl: copied.mediaUrl || data.mediaUrl || '',
    };
    await setDoc(ROOT.collection(ACCOUNT_SCENES).doc(doc.id), payload);
    scenes += 1;
  }
  return { uploads, scenes };
};

const main = async () => {
  console.log('[media-migrate] starting', { dryRun, copyStorage, room: roomFilter || 'ALL', limit });
  const rooms = await getRooms();
  let totalUploads = 0;
  let totalScenes = 0;
  for (const room of rooms) {
    const result = await migrateRoomUploads(room);
    totalUploads += result.uploads;
    totalScenes += result.scenes;
    if (result.uploads || result.scenes) {
      console.log('[media-migrate] room', room.id, result);
    }
  }
  console.log('[media-migrate] complete', { rooms: rooms.length, uploads: totalUploads, scenes: totalScenes, dryRun, copyStorage });
};

main().catch((error) => {
  console.error('[media-migrate] failed', error);
  process.exitCode = 1;
});
