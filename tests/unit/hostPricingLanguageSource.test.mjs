import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path) => readFileSync(path, 'utf8');
const forHostsSource = read('src/apps/Marketing/pages/ForHostsPage.jsx');
const marketingSource = read('src/apps/Marketing/MarketingSite.jsx');
const hostHubSource = read('src/apps/HostRelations/HostRelationsApp.jsx');
const hostAppSource = read('src/apps/Host/HostApp.jsx');
const setupReadySource = read('src/apps/Host/components/ComplimentaryHostSetupReady.jsx');
const helpSource = read('src/apps/Help/HelpCenter.jsx');
const functionsSource = read('functions/index.js');

const approvedTestingPromise = 'Approved testing access is $0 while your invitation is active.';
const futureChoicePromise = 'Access will not convert automatically; you must explicitly opt in before any charge.';
const usagePromise = 'Billing & Usage shows metered product usage and limits for transparency; testing counters are not a bill.';

test('public Host acquisition distinguishes a free application from approved testing access', () => {
  assert.match(forHostsSource, /Applying is free and does not start a subscription\./);
  assert.match(forHostsSource, /Approved testing is \$0/);
  assert.match(marketingSource, /Selected Hosts currently receive approved testing access for \$0, with no card or automatic charge\./);
  assert.doesNotMatch(forHostsSource, /Pricing is not open during testing/);
});

test('approved Host surfaces repeat one current-access and future-choice contract', () => {
  [forHostsSource, hostHubSource, hostAppSource, setupReadySource, helpSource, functionsSource].forEach((source) => {
    assert.ok(source.includes(approvedTestingPromise));
    assert.ok(source.includes(futureChoicePromise));
  });
});

test('usage transparency is described as metering rather than a bill', () => {
  [forHostsSource, hostHubSource, hostAppSource, helpSource, functionsSource].forEach((source) => {
    assert.ok(source.includes(usagePromise));
  });
});

test('waitlist and approval emails preserve the same no-surprise payment boundary', () => {
  assert.match(functionsSource, /Applying to the Host waitlist is free\. You do not need an account, card, or subscription\./);
  assert.match(functionsSource, /No card is required, no subscription was started, and there are no automatic charges\./);
  assert.match(functionsSource, /you will see the price, what is included, and the terms before deciding/);
});
