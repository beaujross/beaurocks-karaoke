import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { buildBeauBucksAccountWalletMigrationReport } = require('../../functions/lib/beauBucksAccountWalletMigration');

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
  return [key, valueParts.length ? valueParts.join('=') : true];
}));
const projectId = String(args.project || process.env.GCLOUD_PROJECT || 'beaurocks-karaoke-v2').trim();
const limit = Math.max(1, Math.min(5000, Math.floor(Number(args.limit || 5000))));

const decodeValue = (value = {}) => {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return !!value.booleanValue;
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields || {});
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeValue);
  return undefined;
};
const decodeFields = (fields = {}) => Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));

const loadInput = () => {
  const inputPath = String(args.input || '').trim();
  if (!inputPath) return null;
  const parsed = JSON.parse(readFileSync(inputPath, 'utf8'));
  return Array.isArray(parsed) ? parsed : parsed.accounts;
};

const fetchAccounts = async () => {
  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'gcloud';
  const commandArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'gcloud auth print-access-token']
    : ['auth', 'print-access-token'];
  const accessToken = String(execFileSync(command, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })).trim();
  if (!accessToken) throw new Error('gcloud did not return an access token.');
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'beaurocks_ledger_accounts' }],
        where: { fieldFilter: { field: { fieldPath: 'currency' }, op: 'EQUAL', value: { stringValue: 'beaubucks' } } },
        limit,
      },
    }),
  });
  if (!response.ok) throw new Error(`Firestore query failed (${response.status}): ${await response.text()}`);
  const rows = await response.json();
  const accounts = rows.filter((row) => row.document).map((row) => ({
    documentId: String(row.document.name || '').split('/').pop(),
    ...decodeFields(row.document.fields || {}),
  }));
  return { accounts, truncated: accounts.length >= limit };
};

const input = loadInput();
const source = input ? { accounts: input, truncated: false } : await fetchAccounts();
const report = buildBeauBucksAccountWalletMigrationReport(source);
const output = { generatedAt: new Date().toISOString(), projectId, ...report };

if (args.json) console.log(JSON.stringify(output, null, 2));
else {
  console.log(`BeauBucks account-wallet migration: ${output.readyForAccountWalletCutover ? 'READY' : 'BLOCKED'}`);
  console.log(`Legacy accounts: ${output.summary.legacyAccountCount}`);
  console.log(`Positive legacy accounts: ${output.summary.positiveLegacyAccountCount}`);
  console.log(`Legacy balance total: ${output.summary.legacyBalanceTotal} BB`);
  console.log(`Persistent accounts: ${output.summary.persistentAccountCount}`);
  console.log(`Blockers: ${output.blockers.length}`);
  console.log(output.blockers.length
    ? 'Next: review the trusted --json output and approve an idempotent account-wallet migration before activation.'
    : 'Next: no positive or malformed legacy Room-wallet projection blocks account-wallet cutover.');
  if (output.blockers.length) console.log('Per-account details are available only in trusted local --json output.');
  console.log('This report is read-only and never moves balances.');
}
if (args.strict && !output.readyForAccountWalletCutover) process.exitCode = 2;
