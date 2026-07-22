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

test('Money > Billing & Usage leads with one readiness answer and preserves advanced tools behind named disclosures', () => {
  const usageHome = source.indexOf('data-feature-id="host-usage-home"');
  const roomPlanner = source.indexOf('data-feature-id="room-capacity-planner"');
  const technicalDetails = source.indexOf('data-feature-id="technical-usage-details"');
  expect(source).toContain('buildHostUsageReadiness');
  expect(usageHome).toBeGreaterThan(-1);
  expect(roomPlanner).toBeGreaterThan(usageHome);
  expect(technicalDetails).toBeGreaterThan(roomPlanner);
  expect(source).toContain('<details data-feature-id="usage-cost-guardrails"');
  expect(source).toContain('<details data-feature-id="invoice-tools"');
  expect(source).toContain('Purchase readiness');
  expect(source).toContain("if (target?.tagName === 'DETAILS') target.open = true");
  expect(source).toContain('Meter rates shown here are not an Additional usage quote or an open purchase offer.');
  expect(source).not.toContain('>Overage Estimate</div>');
});
