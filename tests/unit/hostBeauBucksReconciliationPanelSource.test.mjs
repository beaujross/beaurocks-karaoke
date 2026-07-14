import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'vitest';

const source = fs.readFileSync(new URL('../../src/apps/Host/components/HostBeauBucksReconciliationPanel.jsx', import.meta.url), 'utf8');

test('diagnostics exposes reconciliation only as an on-demand read-only action', () => {
  assert.match(source, /data-beaubucks-reconciliation="read-only"/);
  assert.match(source, /Run read-only report/);
  assert.match(source, /callFunction\('reconcileBeauBucksShadowLedger', \{ roomCode \}\)/);
  assert.doesNotMatch(source, /useEffect/);
  assert.doesNotMatch(source, /setInterval|setTimeout/);
});

test('diagnostics explains legacy authority and separates attribution', () => {
  assert.match(source, /Legacy balance/);
  assert.match(source, /Shadow is not live money/);
  assert.match(source, /Canonical songs:/);
  assert.match(source, /Backing tracks:/);
});

test('diagnostics separates spend-boundary readiness from balance migration', () => {
  assert.match(source, /data-beaubucks-spend-readiness/);
  assert.match(source, /Canary spend boundary/);
  assert.match(source, /Safe replays/);
  assert.match(source, /Ledger gaps/);
  assert.match(source, /legacy room balance stays authoritative/);
  assert.match(source, /destructive backfill is not allowed/);
});
