import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  PANEL_LAYOUT_DEFAULTS,
  PANEL_LAYOUT_PRESETS,
  resolvePanelLayoutState,
  matchPanelLayoutPreset,
  parsePersistedPanelState,
} from '../../src/apps/Host/hooks/useQueueTabState.js';

test('queue tab panel helpers preserve new live snapshot state across defaults and presets', () => {
  assert.equal(PANEL_LAYOUT_DEFAULTS.liveOpsOpen, true);
  assert.equal(PANEL_LAYOUT_PRESETS.all_open.liveOpsOpen, true);
  assert.equal(PANEL_LAYOUT_PRESETS.collapsed.liveOpsOpen, false);

  const resolved = resolvePanelLayoutState({ stagePanelOpen: false });
  assert.equal(resolved.stagePanelOpen, false);
  assert.equal(resolved.liveOpsOpen, true);
  assert.equal(resolved.tvControlsOpen, true);
});

test('queue tab panel helpers match presets and tolerate invalid persisted data', () => {
  assert.equal(matchPanelLayoutPreset(PANEL_LAYOUT_PRESETS.default), 'default');
  assert.equal(matchPanelLayoutPreset(PANEL_LAYOUT_PRESETS.performance), 'performance');
  assert.equal(matchPanelLayoutPreset(PANEL_LAYOUT_PRESETS.collapsed), 'collapsed');
  assert.equal(matchPanelLayoutPreset({ stagePanelOpen: false, liveOpsOpen: true }), null);

  assert.equal(parsePersistedPanelState(''), null);
  assert.equal(parsePersistedPanelState('{bad json'), null);

  const parsed = parsePersistedPanelState(JSON.stringify({
    workspace: 'custom',
    layout: {
      stagePanelOpen: false,
      liveOpsOpen: false,
      tvControlsOpen: 'yes',
      pendingQueueOpen: false,
    },
  }));

  assert.equal(parsed.workspace, 'custom');
  assert.equal(parsed.layout.stagePanelOpen, false);
  assert.equal(parsed.layout.liveOpsOpen, false);
  assert.equal(parsed.layout.pendingQueueOpen, false);
  assert.equal(parsed.layout.tvControlsOpen, true);
  assert.equal(parsed.layout.showQueueList, true);
});
