import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('admin general settings keep layout controls behind progressive disclosure', () => {
  assert.match(source, /<details data-feature-id="admin-audience-host-layout-card"/);
  assert.match(source, /App layouts/);
  assert.match(source, /Host Panel Layout/);
  assert.match(source, /Preview Surfaces/);
  assert.match(source, /data-feature-id="admin-host-panel-mode-toggle"/);
  assert.match(source, /Audience: \{audienceShellVariant/);
  assert.match(source, /<details className="rounded-2xl border border-amber-400\/20[\s\S]*Account-gated reactions/);
});
test('full-screen Admin workspace owns the foreground above persistent Host chrome', () => {
  assert.match(source, /inAdminWorkspace \? 'fixed inset-0 z-\[200\]'/);
});
