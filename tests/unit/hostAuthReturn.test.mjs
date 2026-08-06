import assert from 'node:assert/strict';
import { test } from 'vitest';
import { resolveHostDashboardReturnHref } from '../../src/apps/Marketing/hostAuthReturn.js';

const hostLocation = {
  origin: 'https://host.beaurocks.app',
  hostname: 'host.beaurocks.app',
  protocol: 'https:',
};

test('host onboarding returns to the invited Getting Started destination', () => {
  assert.equal(
    resolveHostDashboardReturnHref('/hub?tab=getting_started', hostLocation),
    '/hub?tab=getting_started',
  );
});

test('host authentication preserves a requested Host workspace destination', () => {
  assert.equal(
    resolveHostDashboardReturnHref('/?mode=host&view=queue&section=queue.catalog#catalog', hostLocation),
    '/?mode=host&view=queue&section=queue.catalog#catalog',
  );
});

test('host authentication rejects loops and non-Host destinations', () => {
  assert.equal(
    resolveHostDashboardReturnHref('/host-access?intent=host_dashboard_resume', hostLocation),
    '',
  );
  assert.equal(
    resolveHostDashboardReturnHref('/for-hosts?tab=getting_started', hostLocation),
    '',
  );
  assert.equal(
    resolveHostDashboardReturnHref('https://example.com/hub?tab=getting_started', hostLocation),
    '',
  );
});
