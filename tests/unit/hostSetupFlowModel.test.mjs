import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { HOST_ONBOARDING_STEPS } from '../../src/apps/Host/hostAppData.js';
import {
  COMPLIMENTARY_HOST_SETUP_STEPS,
  getHostSetupSteps,
} from '../../src/apps/Host/hostSetupFlowModel.js';

const hostAppSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const readySource = readFileSync('src/apps/Host/components/ComplimentaryHostSetupReady.jsx', 'utf8');

test('complimentary Host setup asks for only profile confirmation and completion', () => {
  assert.deepEqual(
    getHostSetupSteps({ complimentaryTestingAccess: true }),
    [
      { key: 'identity', label: 'Host Profile' },
      { key: 'ready', label: 'Ready' },
    ],
  );
  assert.equal(getHostSetupSteps({ complimentaryTestingAccess: true }), COMPLIMENTARY_HOST_SETUP_STEPS);
});

test('the paid-capable setup definition remains available behind its existing flag', () => {
  assert.equal(getHostSetupSteps({ complimentaryTestingAccess: false }), HOST_ONBOARDING_STEPS);
});

test('HostApp uses the shorter flow only for complimentary testing access', () => {
  assert.match(hostAppSource, /getHostSetupSteps\(\{ complimentaryTestingAccess \}\)/);
  assert.match(hostAppSource, /complimentaryTestingAccess \? 'Save Host Profile' : 'Continue to Plan'/);
  assert.match(hostAppSource, /complimentaryTestingAccess \? \(\s*<ComplimentaryHostSetupReady/);
  assert.match(readySource, /Continue to Room Setup/);
  assert.match(readySource, /No card is required, no subscription was started, and there are no automatic charges\./);
});
