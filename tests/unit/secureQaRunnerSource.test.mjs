import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'vitest';

const readSource = (path) => fs.readFileSync(path, 'utf8');

test('Windows secure QA runners use ProcessStartInfo APIs available in Windows PowerShell 5.1', () => {
  for (const path of [
    'scripts/qa/run-admin-prod-secure-win.ps1',
    'scripts/qa/run-host-room-hands-off-secure-win.ps1',
  ]) {
    const source = readSource(path);
    assert.match(source, /\.Arguments\s*=/);
    assert.match(source, /\.EnvironmentVariables\['QA_HOST_EMAIL'\]/);
    assert.match(source, /\.EnvironmentVariables\['QA_HOST_PASSWORD'\]/);
    assert.match(source, /\.EnvironmentVariables\['QA_APP_CHECK_DEBUG_TOKEN'\]/);
    assert.match(source, /qa-app-check-debug-token\.xml/);
    assert.match(source, /Import-Clixml -LiteralPath \$AppCheckTokenPath/);
    assert.match(source, /\.EnvironmentVariables\['DEBUG'\]\s*=\s*''/);
    assert.doesNotMatch(source, /\.ArgumentList\.Add/);
    assert.doesNotMatch(source, /\.Environment\['QA_HOST_(?:EMAIL|PASSWORD)'\]/);
  }
});

test('Firebase emulator runner strips production QA secrets and verbose debug logging', async () => {
  const {
    FIREBASE_EMULATOR_STRIPPED_ENV,
    parseFirebaseEmulatorArgs,
    sanitizedFirebaseEmulatorEnv,
  } = await import('../../scripts/qa/run-firebase-emulator-sanitized.mjs');

  const secretEnv = Object.fromEntries(
    FIREBASE_EMULATOR_STRIPPED_ENV.map((key) => [key, `secret-${key}`]),
  );
  const sanitized = sanitizedFirebaseEmulatorEnv({ SAFE_VALUE: 'kept', ...secretEnv });

  assert.equal(sanitized.SAFE_VALUE, 'kept');
  FIREBASE_EMULATOR_STRIPPED_ENV.forEach((key) => {
    assert.equal(sanitized[key], undefined);
  });
  assert.deepEqual(
    parseFirebaseEmulatorArgs([
      '--project',
      'demo-bross',
      '--only',
      'firestore',
      '--',
      'node tests/integration/example.test.cjs',
    ]),
    {
      firebaseArgs: ['--project', 'demo-bross', '--only', 'firestore'],
      testCommand: 'node tests/integration/example.test.cjs',
    },
  );
});

test('package Firebase emulator contracts all use the sanitized environment wrapper', () => {
  const packageJson = JSON.parse(readSource('package.json'));
  const emulatorScripts = Object.entries(packageJson.scripts).filter(
    ([name]) =>
      name === 'test:rules' ||
      (name.startsWith('test:callables:') &&
        name !== 'test:callables:public-recap-evidence'),
  );

  assert.ok(emulatorScripts.length > 0);
  const bypassingScripts = emulatorScripts
    .filter(
      ([, command]) => !command.includes('run-firebase-emulator-sanitized.mjs'),
    )
    .map(([name]) => name);
  assert.deepEqual(bypassingScripts, []);
});
