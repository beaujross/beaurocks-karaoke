import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostAppPath = path.resolve(__dirname, '../../src/apps/Host/HostApp.jsx');
const stagePanelPath = path.resolve(__dirname, '../../src/apps/Host/components/StageNowPlayingPanel.jsx');
const liveOpsPanelPath = path.resolve(__dirname, '../../src/apps/Host/components/HostLiveOpsPanel.jsx');

test('host stage runtime renders a consolidated live lane panel above the stage card', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');

  assert.match(hostAppSource, /import HostLiveOpsPanel from '\.\/components\/HostLiveOpsPanel';/);
  assert.match(hostAppSource, /<HostLiveOpsPanel[\s\S]*current=\{current\}/);
  assert.match(hostAppSource, /runOfShowFlightedItem=\{runOfShowStagedItem\}/);
  assert.match(hostAppSource, /runOfShowOnDeckItem=\{runOfShowNextItem\}/);
  assert.match(hostAppSource, /crowdPulse=\{crowdPulse\}/);
  assert.match(hostAppSource, /showStageSummaryHeader=\{false\}/);
  assert.match(hostAppSource, /h-full min-h-0 flex flex-col overflow-hidden/);
  assert.match(hostAppSource, /flex-1 min-h-0 overflow-y-auto custom-scrollbar/);
});

test('live lane panel collapses host runtime into now next and conveyor cards', () => {
  const source = readFileSync(liveOpsPanelPath, 'utf8');

  assert.match(source, /data-feature-id="host-live-ops-panel"/);
  assert.match(source, /Live Lane/);
  assert.match(source, /Now/);
  assert.match(source, /Next Singer/);
  assert.match(source, /Conveyor/);
  assert.match(source, /Crowd Pulse/);
  assert.match(source, /Start Next Singer/);
  assert.match(source, /Open Conveyor/);
  assert.match(source, /End Current/);
  assert.match(source, /Re-Queue Current/);
});

test('stage now playing panel can suppress its old summary header when the live lane is present', () => {
  const source = readFileSync(stagePanelPath, 'utf8');

  assert.match(source, /showStageSummaryHeader = true/);
  assert.match(source, /\{showStageSummaryHeader \? \(/);
  assert.match(source, /Live Stage/);
});
