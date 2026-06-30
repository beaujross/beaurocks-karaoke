import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..', '..');
const functionsSource = readFileSync(resolve(root, 'functions', 'index.js'), 'utf8');
const storageRules = readFileSync(resolve(root, 'storage.rules'), 'utf8');
const firestoreRules = readFileSync(resolve(root, 'firestore.rules'), 'utf8');
const firebaseClientSource = readFileSync(resolve(root, 'src', 'lib', 'firebase.js'), 'utf8');

test('org media ingest exposes a sessionized callable and finalize processor', () => {
  assert.match(functionsSource, /onObjectFinalized/);
  assert.match(functionsSource, /exports\.createMediaUploadSession = onCall/);
  assert.match(functionsSource, /exports\.finalizeOrgMediaUpload = onObjectFinalized/);
  assert.match(functionsSource, /org_media\/[^/]+\/incoming\/[^/]+/);
  assert.match(functionsSource, /collection\(ORG_MEDIA_ASSETS_COLLECTION\)\.doc\(assetId\)/);
  assert.match(functionsSource, /collection\(LEGACY_HOST_MEDIA_ASSETS_COLLECTION\)\.doc\(assetId\)/);
});

test('org media direct uploads are gated by pending upload sessions', () => {
  assert.match(storageRules, /function mediaUploadSessionDocPath\(orgId, sessionId\)/);
  assert.match(storageRules, /match \/org_media\/\{orgId\}\/incoming\/\{sessionId\}\/\{fileName\}/);
  assert.match(storageRules, /data\.status == 'pending_upload'/);
  assert.match(storageRules, /data\.safeFileName == fileName/);
  assert.match(storageRules, /request\.resource\.size <= firestore\.get\(mediaUploadSessionDocPath\(orgId, sessionId\)\)\.data\.maxBytes/);
  assert.match(storageRules, /request\.resource\.contentType\.matches\('\^image\/\.\*\$'\)/);
});

test('org media docs are server-owned but readable by the right host context', () => {
  assert.match(firestoreRules, /match \/organizations\/\{orgId\}\/media_upload_sessions\/\{sessionId\}/);
  assert.match(firestoreRules, /resource\.data\.ownerUid == request\.auth\.uid/);
  assert.match(firestoreRules, /match \/organizations\/\{orgId\}\/media_assets\/\{assetId\}/);
  assert.match(firestoreRules, /allow write: if false;/);
});

test('client exposes createMediaUploadSession wrapper', () => {
  assert.match(firebaseClientSource, /const createMediaUploadSession = async \(payload = \{\}\) => \{/);
  assert.match(firebaseClientSource, /callFunction\('createMediaUploadSession', payload \|\| \{\}\)/);
  assert.match(firebaseClientSource, /createMediaUploadSession,/);
});
