import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { buildRoomCostObservationReport } = require('../../functions/lib/roomCostObservationReport');

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
  return [key, valueParts.length ? valueParts.join('=') : true];
}));
const projectId = String(args.project || process.env.GCLOUD_PROJECT || 'beaurocks-karaoke-v2').trim();
const days = Math.max(1, Math.min(90, Math.floor(Number(args.days || 30))));
const limit = Math.max(1, Math.min(5000, Math.floor(Number(args.limit || 5000))));

const decodeFirestoreValue = (value = {}) => {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return !!value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue?.fields || {});
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeFirestoreValue);
  return undefined;
};

const decodeFirestoreFields = (fields = {}) => Object.fromEntries(
  Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]),
);

const readInputObservations = () => {
  const inputPath = String(args.input || '').trim();
  if (!inputPath) return null;
  const parsed = JSON.parse(readFileSync(inputPath, 'utf8'));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.observations)) return parsed.observations;
  throw new Error('Input JSON must be an observation array or contain an observations array.');
};

const fetchProductionObservations = async () => {
  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'gcloud';
  const commandArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'gcloud auth print-access-token']
    : ['auth', 'print-access-token'];
  const token = String(execFileSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })).trim();
  if (!token) throw new Error('gcloud did not return an access token.');
  const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'room_cost_observations' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'createdAt' },
            op: 'GREATER_THAN_OR_EQUAL',
            value: { timestampValue: since },
          },
        },
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Firestore query failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  const rows = await response.json();
  return rows
    .filter((row) => row.document?.fields)
    .map((row) => decodeFirestoreFields(row.document.fields));
};

const observations = readInputObservations() ?? await fetchProductionObservations();
const report = buildRoomCostObservationReport(observations);

if (args.json) {
  console.log(JSON.stringify({ projectId, days, ...report }, null, 2));
} else {
  console.log(`Room cost observation report: ${projectId}, trailing ${days} day(s)`);
  console.log(`Observations: ${report.observationCount}; Rooms: ${report.roomCount}; Room-days: ${report.roomDayCount}`);
  console.log(`Surfaces: Host ${report.bySurface.host}, sampled Audience ${report.bySurface.audience}, Public TV ${report.bySurface.public_tv}`);
  console.log(`Audience sample projection: ${report.estimatedAudienceSessionEquivalent} session-equivalents at 1/${report.audienceSampleModulus}`);
  console.log(`Guest-band Room-days: ${Object.entries(report.guestBandCoverage).map(([key, value]) => `${key} ${value}`).join(', ')}`);
  console.log(`Peak observed shape: ${report.peaks.participantsObserved} participants, ${report.peaks.activeSongsObserved} active songs, ${report.peaks.performedSongsObserved} recent performances`);
  console.log(`Privacy audit: ${report.privacy.rawIdentityFieldCount} raw identity fields`);
  console.log(`Percentile evidence ready: ${report.percentileEvidenceReady ? 'yes' : 'no'}`);
  for (const blocker of report.readinessBlockers) console.log(`- ${blocker}`);
}
