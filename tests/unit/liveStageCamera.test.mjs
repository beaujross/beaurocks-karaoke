import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  LIVE_STAGE_CAMERA_CORNERS,
  LIVE_STAGE_CAMERA_MODES,
  buildLiveStageCameraVideoConstraints,
  getLiveStageCameraModeLabel,
  isLiveStageCameraDeviceFallbackError,
  normalizeLiveStageCameraCorner,
  normalizeLiveStageCameraMode,
  resolveLiveStageCameraCorner,
} from '../../src/lib/liveStageCamera.js';

test('Live Stage Cam defaults to an optional off state', () => {
  assert.equal(normalizeLiveStageCameraMode(''), LIVE_STAGE_CAMERA_MODES.off);
  assert.equal(normalizeLiveStageCameraMode('unexpected'), LIVE_STAGE_CAMERA_MODES.off);
  assert.equal(getLiveStageCameraModeLabel('off'), 'Off');
});

test('Live Stage Cam accepts full-stage and corner scene placements', () => {
  assert.equal(normalizeLiveStageCameraMode('FULL'), LIVE_STAGE_CAMERA_MODES.full);
  assert.equal(normalizeLiveStageCameraMode('corner'), LIVE_STAGE_CAMERA_MODES.corner);
  assert.equal(getLiveStageCameraModeLabel('full'), 'Full Stage');
  assert.equal(getLiveStageCameraModeLabel('corner'), 'Corner');
});

test('explicit camera corners are preserved', () => {
  assert.equal(normalizeLiveStageCameraCorner('bottom_right'), LIVE_STAGE_CAMERA_CORNERS.bottomRight);
  assert.equal(resolveLiveStageCameraCorner({
    requestedCorner: LIVE_STAGE_CAMERA_CORNERS.bottomRight,
    lyricsVisible: true,
    scoreVisible: true,
  }), LIVE_STAGE_CAMERA_CORNERS.bottomRight);
});

test('automatic corner placement avoids active TV HUD regions', () => {
  assert.equal(resolveLiveStageCameraCorner({
    lyricsVisible: true,
  }), LIVE_STAGE_CAMERA_CORNERS.topLeft);
  assert.equal(resolveLiveStageCameraCorner({
    scoreVisible: true,
  }), LIVE_STAGE_CAMERA_CORNERS.bottomRight);
  assert.equal(resolveLiveStageCameraCorner({
    stageInfoVisible: true,
  }), LIVE_STAGE_CAMERA_CORNERS.topRight);
  assert.equal(resolveLiveStageCameraCorner({
    cinema: true,
  }), LIVE_STAGE_CAMERA_CORNERS.bottomLeft);
});

test('camera constraints use the system default until a local device is selected', () => {
  assert.deepEqual(buildLiveStageCameraVideoConstraints().deviceId, undefined);
  assert.deepEqual(
    buildLiveStageCameraVideoConstraints('capture-card-1').deviceId,
    { exact: 'capture-card-1' },
  );
});

test('missing saved devices fall back while permission failures remain explicit', () => {
  assert.equal(isLiveStageCameraDeviceFallbackError({ name: 'NotFoundError' }), true);
  assert.equal(isLiveStageCameraDeviceFallbackError({ name: 'OverconstrainedError' }), true);
  assert.equal(isLiveStageCameraDeviceFallbackError({ name: 'NotAllowedError' }), false);
});
