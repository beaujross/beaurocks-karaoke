import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..', '..');
const projectId = String(process.env.QA_FIREBASE_PROJECT_ID || 'beaurocks-karaoke-v2').trim();
const region = String(process.env.QA_FIREBASE_FUNCTIONS_REGION || 'us-west1').trim();
const roomCode = String(process.env.QA_BEAUBUCKS_ROOM_CODE || 'A6M6').trim().toUpperCase();
const email = String(process.env.QA_HOST_EMAIL || '').trim();
const password = String(process.env.QA_HOST_PASSWORD || '');

if (!email || !password) throw new Error('QA_HOST_EMAIL and QA_HOST_PASSWORD are required.');

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).reduce((values, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return values;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) return values;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    values[key] = rawValue.replace(/^['"]|['"]$/g, '');
    return values;
  }, {});
};

const localEnv = parseEnvFile(path.join(projectRoot, '.env.local'));
let apiKey = String(process.env.VITE_FIREBASE_API_KEY || localEnv.VITE_FIREBASE_API_KEY || '').trim();
if (!apiKey) {
  const runtimeConfigResponse = await fetch(`https://${projectId}.web.app/__/firebase/init.json`, { cache: 'no-store' });
  if (runtimeConfigResponse.ok) {
    const runtimeConfig = await runtimeConfigResponse.json();
    apiKey = String(runtimeConfig?.apiKey || '').trim();
  }
}
if (!apiKey) throw new Error('Firebase runtime config did not provide an API key.');

const jsonRequest = async (url, { method = 'GET', token = '', body = null } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error?.status || `HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return payload;
};

const callFunction = async (name, token, data) => {
  const payload = await jsonRequest(
    `https://${region}-${projectId}.cloudfunctions.net/${name}`,
    { method: 'POST', token, body: { data } },
  );
  if (payload?.error) throw new Error(payload.error.message || `${name} failed.`);
  return payload?.result || payload?.data || null;
};

const gcloudCommand = process.platform === 'win32'
  ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'gcloud auth print-access-token']]
  : ['gcloud', ['auth', 'print-access-token']];
const adminAccessToken = execFileSync(gcloudCommand[0], gcloudCommand[1], {
  cwd: projectRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
}).trim();
if (!adminAccessToken) throw new Error('Could not acquire a Google Cloud access token for readback.');

const documentUrl = (documentPath) => (
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`
);
const readDocument = async (documentPath) => jsonRequest(documentUrl(documentPath), { token: adminAccessToken });
const fieldValue = (document, field) => {
  const value = document?.fields?.[field];
  if (!value) return null;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.booleanValue !== undefined) return !!value.booleanValue;
  if (value.stringValue !== undefined) return String(value.stringValue);
  return null;
};

const authResult = await jsonRequest(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
  { method: 'POST', body: { email, password, returnSecureToken: true } },
);
const idToken = String(authResult?.idToken || '');
const uid = String(authResult?.localId || '');
if (!idToken || !uid) throw new Error('QA authentication did not return an ID token and UID.');

const joinResult = await callFunction('joinRoomAudience', idToken, {
  roomCode,
  name: 'BeauRocks QA',
  avatar: '😀',
  installId: `qa-spend-${uid.slice(-12)}`,
});
if (joinResult?.spendAuthority !== 'server_canary') {
  throw new Error(`Expected server_canary authority in ${roomCode}, received ${joinResult?.spendAuthority || 'missing'}.`);
}

const roomUserPath = `artifacts/bross-app/public/data/room_users/${roomCode}_${uid}`;
const userPath = `users/${uid}`;
const beforeRoomUser = await readDocument(roomUserPath);
const beforeUser = await readDocument(userPath);
const balanceBefore = Number(fieldValue(beforeRoomUser, 'points') || 0);
const globalBalanceBefore = Number(fieldValue(beforeUser, 'pointsBalance') || 0);
if (balanceBefore < 2) throw new Error(`Canary QA account needs at least 2 room credits; found ${balanceBefore}.`);

const clientOperationId = `qa_reaction:${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
const spendPayload = {
  roomCode,
  kind: 'reaction',
  clientOperationId,
  payload: { reactionType: 'clap', performanceId: 'qa-accounting-acceptance' },
};
const accepted = await callFunction('spendAudienceRoomCredits', idToken, spendPayload);
if (accepted?.outcome !== 'accepted' || Number(accepted?.chargedAmount) !== 2) {
  throw new Error(`Expected accepted 2-credit spend; received ${JSON.stringify(accepted)}`);
}
const duplicate = await callFunction('spendAudienceRoomCredits', idToken, spendPayload);
if (duplicate?.outcome !== 'accepted' || duplicate?.duplicate !== true) {
  throw new Error(`Expected duplicate accepted replay; received ${JSON.stringify(duplicate)}`);
}

const operationDocumentId = crypto
  .createHash('sha256')
  .update(`${roomCode}:${uid}:${clientOperationId}`)
  .digest('hex');
const ledgerDocumentId = crypto
  .createHash('sha256')
  .update(`audience_spend:${operationDocumentId}`)
  .digest('hex');
const [afterRoomUser, afterUser, operation, ledger] = await Promise.all([
  readDocument(roomUserPath),
  readDocument(userPath),
  readDocument(`beaurocks_spend_operations/${operationDocumentId}`),
  readDocument(`beaurocks_ledger_entries/${ledgerDocumentId}`),
]);

const balanceAfter = Number(fieldValue(afterRoomUser, 'points') || 0);
const globalBalanceAfter = Number(fieldValue(afterUser, 'pointsBalance') || 0);
if (balanceBefore - balanceAfter !== 2) throw new Error(`Expected room balance delta 2; received ${balanceBefore - balanceAfter}.`);
if (globalBalanceAfter !== globalBalanceBefore) throw new Error('Room-local spend changed the global points balance.');
if (
  fieldValue(operation, 'outcome') !== 'accepted'
  || fieldValue(operation, 'chargedAmount') !== 2
  || Number(fieldValue(operation, 'replayCount') || 0) < 1
) {
  throw new Error('Spend operation readback did not match the accepted result and duplicate replay telemetry.');
}
if (
  fieldValue(ledger, 'type') !== 'reaction_spend'
  || fieldValue(ledger, 'direction') !== 'debit'
  || fieldValue(ledger, 'amount') !== 2
) {
  throw new Error('Shadow ledger readback did not match the typed 2-credit debit.');
}

const reconciliation = await callFunction('reconcileBeauBucksShadowLedger', idToken, { roomCode });
if (!reconciliation?.spendReadiness || reconciliation?.migrationReadiness?.balanceAuthority !== 'legacy') {
  throw new Error('Production reconciliation did not return spend readiness with legacy balance authority.');
}
if ((reconciliation.spendReadiness.coverage?.missingLedgerOperationIds || []).includes(operationDocumentId)) {
  throw new Error('Production readiness report marked the accepted QA operation as missing its ledger debit.');
}
if (Number(reconciliation.spendReadiness.summary?.duplicateReplayCount || 0) < 1) {
  throw new Error('Production readiness report did not include duplicate replay evidence.');
}

console.log(JSON.stringify({
  ok: true,
  roomCode,
  spendAuthority: joinResult.spendAuthority,
  outcome: accepted.outcome,
  chargedAmount: accepted.chargedAmount,
  duplicateOutcome: duplicate.outcome,
  duplicate: duplicate.duplicate,
  roomBalanceDelta: balanceBefore - balanceAfter,
  globalBalanceUnchanged: globalBalanceAfter === globalBalanceBefore,
  operationOutcome: fieldValue(operation, 'outcome'),
  operationReplayCount: Number(fieldValue(operation, 'replayCount') || 0),
  ledgerType: fieldValue(ledger, 'type'),
  ledgerDirection: fieldValue(ledger, 'direction'),
  ledgerAmount: fieldValue(ledger, 'amount'),
  spendBoundaryReady: reconciliation.spendReadiness.boundaryReady,
  spendReadinessBlockers: reconciliation.spendReadiness.blockers,
  acceptedOperationCount: reconciliation.spendReadiness.summary.acceptedOperationCount,
  distinctAcceptedAccountCount: reconciliation.spendReadiness.summary.distinctAcceptedAccountCount,
  duplicateReplayCount: reconciliation.spendReadiness.summary.duplicateReplayCount,
  ledgerGapCount: [
    ...(reconciliation.spendReadiness.coverage?.missingLedgerOperationIds || []),
    ...(reconciliation.spendReadiness.coverage?.invalidLedgerOperationIds || []),
    ...(reconciliation.spendReadiness.coverage?.unexpectedLedgerOperationIds || []),
    ...(reconciliation.spendReadiness.coverage?.orphanLedgerOperationIds || []),
  ].length,
  balanceReadMigrationReady: reconciliation.migrationReadiness.balanceReadMigrationReady,
  balanceAuthority: reconciliation.migrationReadiness.balanceAuthority,
}, null, 2));
