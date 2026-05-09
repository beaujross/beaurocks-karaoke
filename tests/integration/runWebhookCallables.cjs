const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { installIoGuards } = require('./harness.cjs');

installIoGuards();

const tests = [
  'tests/integration/givebutterWebhook.test.cjs',
  'tests/integration/stripeWebhook.test.cjs',
];
let failed = false;
for (const relativePath of tests) {
  const label = path.basename(relativePath);
  console.log(`Running ${label}...`);
  const result = spawnSync(process.execPath, [relativePath], {
    stdio: 'inherit',
    env: process.env,
  });
  if ((result.status || 0) !== 0) {
    failed = true;
    break;
  }
}
process.exitCode = failed ? 1 : 0;
