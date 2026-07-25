import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const cameraSource = readFileSync('src/components/LiveStageCamera.jsx', 'utf8');
const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const hostChromeSource = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');

test('Live Stage Cam is progressive enhancement with local video-only capture', () => {
  assert.match(cameraSource, /if \(!enabled\) return null;/);
  assert.match(cameraSource, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(cameraSource, /audio: false/);
  assert.match(cameraSource, /stream\?\.getTracks\?\.\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(cameraSource, /cameraIsLive \? 'opacity-100' : 'opacity-0'/);
  assert.match(cameraSource, /if \(!mountedRef\.current \|\| !enabledRef\.current\)/);
  assert.match(cameraSource, /stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(cameraSource, /navigator\.mediaDevices\.enumerateDevices\(\)/);
  assert.match(cameraSource, /LIVE_STAGE_CAMERA_DEVICE_STORAGE_KEY/);
  assert.match(cameraSource, /isLiveStageCameraDeviceFallbackError/);
});

test('Live Stage Cam supports full-stage and safe-corner composition layers', () => {
  assert.match(cameraSource, /fullStage\s*\?\s*'absolute inset-0 z-\[5\]'/);
  assert.match(cameraSource, /absolute z-\[45\] aspect-video/);
  assert.match(cameraSource, /resolveLiveStageCameraCorner/);
  assert.match(cameraSource, /presentationProfile === 'cinema'/);
});

test('Public TV mounts the camera inside its stage composition', () => {
  assert.match(publicTvSource, /<LiveStageCamera/);
  assert.match(publicTvSource, /mode=\{liveStageCameraMode\}/);
  assert.match(publicTvSource, /requestedCorner=\{liveStageCameraCorner\}/);
});

test('host TV controls keep camera choices compact and optional', () => {
  assert.match(hostChromeSource, /data-feature-id="deck-tv-live-stage-camera"/);
  assert.match(hostChromeSource, /Camera-free layouts stay complete/);
  assert.match(hostChromeSource, /\[LIVE_STAGE_CAMERA_MODES\.off, 'Off'\]/);
  assert.match(hostChromeSource, /\[LIVE_STAGE_CAMERA_MODES\.full, 'Full Stage'\]/);
  assert.match(hostChromeSource, /\[LIVE_STAGE_CAMERA_MODES\.corner, 'Corner'\]/);
  assert.match(hostChromeSource, /onClick=\{\(\) => applyLiveStageCameraMode\(mode\)\}/);
  assert.match(hostChromeSource, /press C to choose a local camera or capture card/);
});

test('Public TV camera source controls stay a compact local popover', () => {
  assert.match(cameraSource, /data-feature-id="live-stage-camera-controls"/);
  assert.match(cameraSource, /data-feature-id="live-stage-camera-device-select"/);
  assert.match(cameraSource, /window\.addEventListener\('keydown', handleCameraShortcut\)/);
  assert.match(cameraSource, /Saved on this browser only\. Press C to close\./);
});
