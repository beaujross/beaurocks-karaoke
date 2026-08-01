import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { test } from 'vitest';

const require = createRequire(import.meta.url);
const { createHostCommunicationCallables } = require('../../functions/hostCommunications.js');

class TestHttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const buildCallables = ({ isAdmin = false, isSuperAdmin = isAdmin, hostApproved = true, appCheckValid = true, docs = [], thread = null } = {}) => {
  const queries = [];
  const collection = {
    limit: (limit) => ({ get: async () => ({ docs: docs.slice(0, limit) }) }),
    orderBy: () => ({ limit: (limit) => ({ get: async () => ({ docs: docs.slice(0, limit) }) }) }),
    where: (field, operator, value) => {
      queries.push({ field, operator, value });
      return { orderBy: () => ({ limit: (limit) => ({ get: async () => ({ docs: docs.slice(0, limit) }) }) }) };
    },
    doc: () => ({
      get: async () => thread || ({ exists: false, id: '', data: () => ({}) }),
    }),
  };
  const firestore = () => ({ collection: () => collection });
  firestore.Timestamp = { now: () => ({ toMillis: () => 1000 }) };
  firestore.FieldValue = { increment: (value) => value };
  const callables = createHostCommunicationCallables({
    admin: { firestore },
    onCall: (_options, handler) => handler,
    HttpsError: TestHttpsError,
    requireAuth: () => 'host-1',
    getDirectoryModeratorAccess: async () => ({ isAdmin, mode: isSuperAdmin ? 'super_admin' : '' }),
    resolveHostWorkspaceAccess: async () => ({ hasHostWorkspaceAccess: true, hostApprovalEnabled: hostApproved }),
    checkRateLimit: () => {},
    checkDurableRateLimit: async () => {},
    enforceAppCheckIfEnabled: () => {},
    requireAppCheck: () => {
      if (!appCheckValid) throw new TestHttpsError('failed-precondition', 'App Check token required.');
    },
  });
  return { callables, queries };
};

const request = (data = {}) => ({
  data,
  auth: { token: { email: 'host@example.com', name: 'Alex Host' } },
  rawRequest: {},
});

test('an unapproved account cannot read approved-Host updates', async () => {
  const { callables } = buildCallables({ hostApproved: false });
  await assert.rejects(
    callables.listHostAnnouncements(request()),
    (error) => error.code === 'permission-denied' && /Active Host invitation/.test(error.message),
  );
});

test('an approved Host cannot use the super-admin publishing desk', async () => {
  const { callables } = buildCallables();
  await assert.rejects(
    callables.upsertHostAnnouncement(request({ title: 'Update', body: 'Details' })),
    (error) => error.code === 'permission-denied' && /Super admin/.test(error.message),
  );
});

test('a directory admin is not implicitly a Host Operations super admin', async () => {
  const { callables } = buildCallables({ isAdmin: true, isSuperAdmin: false });
  await assert.rejects(
    callables.upsertHostAnnouncement(request({ title: 'Update', body: 'Details' })),
    (error) => error.code === 'permission-denied' && /Super admin/.test(error.message),
  );
});

test('Host communication mutations reject a missing App Check token', async () => {
  const { callables } = buildCallables({ appCheckValid: false });
  await assert.rejects(
    callables.createHostSupportThread(request({ title: 'Help', body: 'Question' })),
    (error) => error.code === 'failed-precondition' && /App Check/.test(error.message),
  );
});
test('an approved Host thread list is queried by owner instead of scanning shared conversations', async () => {
  const { callables, queries } = buildCallables();
  const result = await callables.listHostSupportThreads(request());

  assert.equal(result.ok, true);
  assert.deepEqual(queries, [{ field: 'ownerUid', operator: '==', value: 'host-1' }]);
});

test('an approved Host cannot open another Host private support conversation', async () => {
  const privateThread = {
    exists: true,
    id: 'thread-2',
    data: () => ({ ownerUid: 'host-2', title: 'Private issue', status: 'open' }),
  };
  const { callables } = buildCallables({ thread: privateThread });

  await assert.rejects(
    callables.getHostSupportThread(request({ threadId: 'thread-2' })),
    (error) => error.code === 'permission-denied' && /private/.test(error.message),
  );
});
