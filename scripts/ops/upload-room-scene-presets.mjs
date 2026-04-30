import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pipeline } from 'node:stream/promises';

const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');

const APP_ID = 'bross-app';
const ROOT_COLLECTION = `artifacts/${APP_ID}/public/data`;
const SCENE_TITLE_OVERRIDES = Object.freeze({
  'AHB Show for 12.17.mp4': 'AHB Show for 12.17',
  '2nd Annual Asian Arts & Heritage Festival 4.2025.mp4': '2nd Annual Asian Arts & Heritage Festival 4.2025',
  'aahf-dance-4.11.png': 'AAHF Dance 4.11',
  'aahf-festivaleventlist-flyer.png': 'AAHF Festival Event List Flyer',
  'aahf-festivalfinale-al.png': 'AAHF Festival Finale AL',
  'aahf-karaoke.png': 'AAHF Karaoke',
  'aahf-mahjongboathouse-flyer.png': 'AAHF Mahjong Boathouse Flyer',
  'aahf-monologues-flyer.png': 'AAHF Monologues Flyer',
  'aahf-morales-flyer.png': 'AAHF Morales Flyer',
  'aahf-strawberryfestival-flyer.png': 'AAHF Strawberry Festival Flyer',
  'aahf-strawberyfields-flyer.png': 'AAHF Strawberry Fields Flyer',
  'JAPANESE HERITAGE NIGHT.png': 'Japanese Heritage Night',
});

const args = process.argv.slice(2);

const readFlag = (flagName, fallback = '') => {
  const index = args.indexOf(flagName);
  if (index < 0) return fallback;
  const value = args[index + 1];
  return typeof value === 'string' ? value : fallback;
};

const hasFlag = (flagName) => args.includes(flagName);

const roomCode = String(readFlag('--room', '')).trim().toUpperCase();
const durationSec = Math.max(5, Math.min(600, Number(readFlag('--duration', '20')) || 20));
const createdBy = String(readFlag('--created-by', 'Codex Ops')).trim() || 'Codex Ops';
const fileArgs = args.filter((value, index) => {
  if (value.startsWith('--')) return false;
  const prev = args[index - 1] || '';
  return !['--room', '--duration', '--created-by'].includes(prev);
});

if (hasFlag('--help') || !roomCode || !fileArgs.length) {
  console.log([
    'Usage:',
    '  node scripts/ops/upload-room-scene-presets.mjs --room AAHF [--duration 20] [--created-by "DJ BeauRocks"] <file> [<file> ...]',
    '',
    'Notes:',
    '  - Requires GOOGLE_APPLICATION_CREDENTIALS to be set.',
    '  - Uploads images or videos into Storage and creates Firestore docs in room_scene_presets.',
  ].join('\n'));
  process.exit(hasFlag('--help') ? 0 : 1);
}

const normalizeTitleFromName = (fileName = '') => {
  if (SCENE_TITLE_OVERRIDES[fileName]) return SCENE_TITLE_OVERRIDES[fileName];
  const raw = String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';
  return raw
    .split(' ')
    .map((word) => {
      if (!word) return word;
      if (/^aahf$/i.test(word)) return 'AAHF';
      if (/^[A-Z0-9.&]+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

const safeStorageFileName = (fileName = '') => {
  const ext = path.extname(fileName) || '.png';
  const base = path.basename(fileName, ext)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 90);
  return `${base || 'scene'}${ext}`;
};

const contentTypeForExt = (fileName = '') => {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.webm') return 'video/webm';
  return 'image/png';
};

const mediaTypeForContentType = (contentType = '') => (
  String(contentType || '').toLowerCase().startsWith('video/') ? 'video' : 'image'
);

const initAdmin = async () => {
  if (admin.apps.length) return admin.app();
  const credential = admin.credential.applicationDefault();
  const projectId = await credential.getProjectId();
  admin.initializeApp({
    credential,
    storageBucket: `${projectId}.firebasestorage.app`,
  });
  return admin.app();
};

const main = async () => {
  await initAdmin();
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const roomRef = db.doc(`${ROOT_COLLECTION}/rooms/${roomCode}`);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) {
    throw new Error(`Room ${roomCode} was not found.`);
  }

  const existingSceneSnap = await db.collection(`${ROOT_COLLECTION}/room_scene_presets`)
    .where('roomCode', '==', roomCode)
    .get();
  const existingByFileName = new Map();
  existingSceneSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const key = String(data.fileName || '').trim().toLowerCase();
    if (key) existingByFileName.set(key, { id: docSnap.id, ...data });
  });

  const results = [];
  for (const rawFile of fileArgs) {
    const fullPath = path.resolve(rawFile);
    const fileName = path.basename(fullPath);
    const duplicate = existingByFileName.get(fileName.trim().toLowerCase());
    if (duplicate) {
      results.push({
        action: 'skipped',
        fileName,
        reason: `existing scene preset ${duplicate.id}`,
      });
      continue;
    }

    const stats = await fs.stat(fullPath);
    const title = normalizeTitleFromName(fileName);
    const safeName = safeStorageFileName(fileName);
    const storagePath = `room_scene_media/${roomCode}/${Date.now()}_${safeName}`;
    const token = crypto.randomUUID();
    const contentType = contentTypeForExt(fileName);
    const mediaType = mediaTypeForContentType(contentType);
    const destination = bucket.file(storagePath);
    const writeStream = destination.createWriteStream({
      resumable: stats.size > 8 * 1024 * 1024,
      metadata: {
        contentType,
        cacheControl: 'public,max-age=604800',
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });
    await pipeline(fsSync.createReadStream(fullPath), writeStream);

    const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(token)}`;
    const createdAtMs = Date.now();
    const payload = {
      roomCode,
      title,
      mediaUrl,
      mediaType,
      durationSec,
      storagePath,
      fileName,
      size: stats.size,
      sourceUploadId: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs,
      createdBy,
    };
    const docRef = await db.collection(`${ROOT_COLLECTION}/room_scene_presets`).add(payload);
    results.push({
      action: 'uploaded',
      id: docRef.id,
      fileName,
      title,
      storagePath,
    });
  }

  console.log(JSON.stringify({
    roomCode,
    durationSec,
    createdBy,
    results,
  }, null, 2));
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
