import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  HOST_LAUNCH_IDENTITY_DRAFT_KEY,
  buildHostLaunchDraftKey,
  clearHostLaunchDraftPart,
  hasRecoverableHostLaunchDraft,
  loadHostLaunchDraftPart,
  persistHostLaunchDraftPart,
  sanitizeHostLaunchEventCreditsDraft,
} from '../../src/apps/Host/hostLaunchDraftStorage.js';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

test('host launch draft storage restores intentional empty fields within seven days', () => {
  const storage = createStorage();
  const nowMs = Date.UTC(2026, 6, 18, 12);
  const ownerKey = 'host-one';
  const identityKey = buildHostLaunchDraftKey(HOST_LAUNCH_IDENTITY_DRAFT_KEY, ownerKey);
  assert.equal(persistHostLaunchDraftPart(
    identityKey,
    { roomName: '' },
    { storage, nowMs },
  ), true);
  const recovered = loadHostLaunchDraftPart(
    identityKey,
    { roomName: null },
    { storage, nowMs: nowMs + 1_000 },
  );
  assert.equal(recovered.restored, true);
  assert.equal(recovered.value.roomName, '');
  assert.equal(hasRecoverableHostLaunchDraft({ ownerKey, storage, nowMs: nowMs + 1_000 }), true);
  assert.equal(hasRecoverableHostLaunchDraft({ ownerKey: 'host-two', storage, nowMs: nowMs + 1_000 }), false);
});

test('host launch draft storage expires stale drafts and tolerates malformed storage', () => {
  const storage = createStorage();
  const nowMs = Date.UTC(2026, 6, 18, 12);
  persistHostLaunchDraftPart(
    HOST_LAUNCH_IDENTITY_DRAFT_KEY,
    { roomName: 'Old room' },
    { storage, nowMs: nowMs - (8 * 24 * 60 * 60 * 1000) },
  );
  assert.equal(loadHostLaunchDraftPart(
    HOST_LAUNCH_IDENTITY_DRAFT_KEY,
    {},
    { storage, nowMs },
  ).restored, false);
  storage.setItem(HOST_LAUNCH_IDENTITY_DRAFT_KEY, '{bad json');
  assert.equal(loadHostLaunchDraftPart(
    HOST_LAUNCH_IDENTITY_DRAFT_KEY,
    {},
    { storage, nowMs },
  ).restored, false);
});

test('host launch draft storage can be cleared without blocking setup', () => {
  const storage = createStorage();
  persistHostLaunchDraftPart(HOST_LAUNCH_IDENTITY_DRAFT_KEY, { roomName: 'Friday' }, { storage });
  assert.equal(clearHostLaunchDraftPart(HOST_LAUNCH_IDENTITY_DRAFT_KEY, storage), true);
  assert.equal(loadHostLaunchDraftPart(HOST_LAUNCH_IDENTITY_DRAFT_KEY, {}, { storage }).restored, false);
});

test('host launch recovery strips admission and promo codes before persistence', () => {
  const sanitized = sanitizeHostLaunchEventCreditsDraft({
    eventLabel: 'Fundraiser',
    claimCodes: {
      vip: 'VIPSECRET',
      skipLine: 'SKIPSECRET',
      websiteCheckIn: 'WEBSECRET',
      socialPromo: 'SOCIALSECRET',
    },
    promoCampaigns: [
      { id: 'door', label: 'Door code', code: 'DOORSECRET', pointsReward: 50 },
    ],
  });
  assert.equal(sanitized.eventLabel, 'Fundraiser');
  assert.deepEqual(sanitized.claimCodes, {
    vip: '',
    skipLine: '',
    websiteCheckIn: '',
    socialPromo: '',
  });
  assert.equal(sanitized.promoCampaigns[0].code, '');
  assert.equal(sanitized.promoCampaigns[0].pointsReward, 50);
});

test('host launch draft keys require and isolate a sanitized owner scope', () => {
  assert.equal(buildHostLaunchDraftKey(HOST_LAUNCH_IDENTITY_DRAFT_KEY, ''), '');
  assert.equal(
    buildHostLaunchDraftKey(HOST_LAUNCH_IDENTITY_DRAFT_KEY, ' host.one@example.com '),
    `${HOST_LAUNCH_IDENTITY_DRAFT_KEY}:hostoneexamplecom`,
  );
});
