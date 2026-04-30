import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostAppPath = 'src/apps/Host/HostApp.jsx';
const nightSetupFlowPath = 'src/apps/Host/hooks/useHostNightSetupFlow.js';
const firebasePath = 'src/lib/firebase.js';
const hostQaPath = 'scripts/qa/host-run-of-show-hostapp-playwright.mjs';

test('host operator analytics cover workspace, room setup, and media actions', () => {
  const hostAppSource = readFileSync(hostAppPath, 'utf8');
  const nightSetupFlowSource = readFileSync(nightSetupFlowPath, 'utf8');

  assert.match(hostAppSource, /host_workspace_viewed/);
  assert.match(hostAppSource, /host_scene_library_opened/);
  assert.match(hostAppSource, /host_room_media_uploaded/);
  assert.match(hostAppSource, /host_room_media_upload_failed/);
  assert.match(hostAppSource, /host_scene_preset_saved/);
  assert.match(hostAppSource, /host_run_of_show_media_attached/);
  assert.match(hostAppSource, /host_public_tv_scene_launched/);
  assert.match(hostAppSource, /host_room_settings_saved/);
  assert.match(hostAppSource, /host_room_settings_save_failed/);
  assert.match(nightSetupFlowSource, /host_night_setup_opened/);
});

test('analytics bridge exposes tracked events to browser QA without blocking Firebase analytics', () => {
  const firebaseSource = readFileSync(firebasePath, 'utf8');

  assert.match(firebaseSource, /window\.__beaurocksTrackedEvents/);
  assert.match(firebaseSource, /beaurocks:analytics-event/);
  assert.match(firebaseSource, /logEvent\(analytics, name, params\)/);
});

test('host browser QA covers room setup, run of show media handoff, modal open, reload, and analytics', () => {
  const qaSource = readFileSync(hostQaPath, 'utf8');

  assert.match(qaSource, /host_app_room_setup_save_action_visible/);
  assert.match(qaSource, /host_app_room_upload_handoff_controls_visible/);
  assert.match(qaSource, /host_app_stage_tv_library_modal_opens/);
  assert.match(qaSource, /host_app_reload_restores_host_workspace/);
  assert.match(qaSource, /host_app_operator_analytics_emitted/);
  assert.match(qaSource, /window\.__beaurocksTrackedEvents/);
});
