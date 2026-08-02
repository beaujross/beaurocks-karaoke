import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const FIREBASE_EMULATOR_STRIPPED_ENV = Object.freeze([
  'DEBUG',
  'QA_APP_CHECK_DEBUG_TOKEN',
  'QA_HOST_EMAIL',
  'QA_HOST_PASSWORD',
  'QA_ALLOWED_HOST_EMAILS',
  'QA_BLOCKED_HOST_EMAILS',
  'QA_ALLOW_SUPERADMIN',
  'VIBE_OPERATOR_EMAIL',
  'VIBE_OPERATOR_PASSWORD',
]);

export function sanitizedFirebaseEmulatorEnv(source = process.env) {
  const env = { ...source };
  FIREBASE_EMULATOR_STRIPPED_ENV.forEach((key) => {
    delete env[key];
  });
  return env;
}

export function parseFirebaseEmulatorArgs(argv) {
  const separatorIndex = argv.indexOf('--');
  if (separatorIndex < 0 || separatorIndex === argv.length - 1) {
    throw new Error(
      'Usage: node scripts/qa/run-firebase-emulator-sanitized.mjs <firebase args> -- "<test command>"',
    );
  }

  const firebaseArgs = argv.slice(0, separatorIndex);
  const commandParts = argv.slice(separatorIndex + 1);
  return {
    firebaseArgs,
    testCommand: commandParts.join(' '),
  };
}

export function runFirebaseEmulatorSanitized(argv = process.argv.slice(2)) {
  const { firebaseArgs, testCommand } = parseFirebaseEmulatorArgs(argv);
  const npmCliPath = process.env.npm_execpath;
  if (!npmCliPath) {
    throw new Error(
      'The sanitized Firebase emulator runner must be launched through an npm script.',
    );
  }
  const child = spawn(
    process.execPath,
    [
      npmCliPath,
      'exec',
      '--yes',
      '--',
      'firebase-tools',
      'emulators:exec',
      ...firebaseArgs,
      testCommand,
    ],
    {
      env: sanitizedFirebaseEmulatorEnv(),
      stdio: 'inherit',
      windowsHide: true,
    },
  );

  child.once('error', (error) => {
    console.error(`[firebase-emulator-sanitized] Failed to start: ${error.message}`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    if (signal) {
      console.error(`[firebase-emulator-sanitized] Stopped by signal ${signal}`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runFirebaseEmulatorSanitized();
}
