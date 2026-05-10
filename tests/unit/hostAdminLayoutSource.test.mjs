import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');

test('admin general settings keep host panel layout controls attached to the audience layout section', () => {
  assert.match(source, /data-feature-id="admin-audience-host-layout-card"/);
  assert.match(source, /Audience \+ Host Layout/);
  assert.match(source, /Host Panel Layout/);
  assert.match(source, /Preview Surfaces/);
  assert.match(source, /data-feature-id="admin-host-panel-mode-toggle"/);
  assert.match(source, /Change the audience app flow and the host panel shell from one place/);
});
