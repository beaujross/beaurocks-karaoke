import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hostSource = fs.readFileSync(path.join(root, 'src/apps/Host/HostApp.jsx'), 'utf8');
const firebaseSource = fs.readFileSync(path.join(root, 'src/lib/firebase.js'), 'utf8');

test('Host Billing & Usage exposes bounded Workspace and Room cost guardrails', () => {
  expect(hostSource).toContain('data-feature-id="usage-cost-guardrails"');
  expect(hostSource).toContain('Workspace Request Ceiling');
  expect(hostSource).toContain('Save Room Budget');
  expect(hostSource).toContain('Pause Live Search');
  expect(hostSource).toContain('Queue controls, Host override, cached and indexed tracks, local media, Room shutdown, and Room export remain available.');
});

test('Host guardrails mutate only through the protected callable wrapper', () => {
  expect(firebaseSource).toMatch(/const manageMyUsageControls = async/);
  expect(firebaseSource).toContain('requireAppCheckToken("manageMyUsageControls")');
  expect(hostSource).toContain("action: isRoom ? 'set_room_meter' : 'set_workspace_meter'");
  expect(hostSource).toContain("action: 'set_capability_state'");
});
