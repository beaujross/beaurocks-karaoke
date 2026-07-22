import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const source = readFileSync(new URL('../../src/apps/Host/HostApp.jsx', import.meta.url), 'utf8');

test('Money > Billing & Usage shows server-calculated capacity warnings and the hard cap', () => {
  expect(source).toMatch(/const formatUsageCapacityState = \(meter = null\) =>/);
  expect(source).toMatch(/meter\?\.hardLimitReached[\s\S]*100% · Capped/);
  expect(source).toMatch(/hardLimit[\s\S]*Not available/);
  expect(source).toMatch(/warningLevelBps[\s\S]*8000[\s\S]*Watch/);
  expect(source).toMatch(/Capacity Status/);
  expect(source).toMatch(/formatUsageCapacityState\(meter\)/);
});
