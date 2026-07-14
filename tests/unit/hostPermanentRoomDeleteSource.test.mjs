import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const hostSource = readFileSync(new URL('../../src/apps/Host/HostApp.jsx', import.meta.url), 'utf8');
const firebaseSource = readFileSync(new URL('../../src/lib/firebase.js', import.meta.url), 'utf8');
const functionsSource = readFileSync(new URL('../../functions/index.js', import.meta.url), 'utf8');

test('permanent room deletion is server-authorized and exact-code confirmed', () => {
  expect(hostSource).toMatch(/permanentlyDeleteHostRoom\(\{/);
  expect(hostSource).toMatch(/confirmationCode: normalizedCode/);
  expect(firebaseSource).toMatch(/callFunction\("permanentlyDeleteHostRoom"/);
  expect(functionsSource).toMatch(/exports\.permanentlyDeleteHostRoom = onCall/);
  expect(functionsSource).toMatch(/confirmationCode !== roomCode/);
  expect(functionsSource).toMatch(/Archive the room before permanently deleting it/);
  expect(functionsSource).toMatch(/\["owner", "admin"\]\.includes\(role\)/);
});

test('server purge owns all room artifacts while client rules remain closed', () => {
  expect(functionsSource).toMatch(/PERMANENT_ROOM_PURGE_COLLECTIONS/);
  expect(functionsSource).toMatch(/rootRef\.collection\("host_libraries"\)/);
  expect(functionsSource).toMatch(/db\.collection\("room_sessions"\)/);
  expect(functionsSource).toMatch(/deletedStorageObjectCount/);
  expect(hostSource).not.toMatch(/purgeRoomArtifactsForCode\(normalizedCode, \{ deleteHostLibrary: true \}\)/);
});
