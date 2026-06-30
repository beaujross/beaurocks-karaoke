import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const source = readFileSync('src/hooks/usePitch.js', 'utf8');

test('usePitch memoizes primitive options so mic capture does not remount on every rerender', () => {
  assert.match(
    source,
    /const \{\s*minVolumeThreshold = 0\.02,[\s\S]*uiUpdateIntervalMs = 50,[\s\S]*deviceId = ''\s*\} = options;/,
    'usePitch should unpack primitive options before memoizing the config',
  );
  assert.match(
    source,
    /const opts = useMemo\(\(\) => \(\{[\s\S]*uiUpdateIntervalMs,[\s\S]*deviceId[\s\S]*\}\), \[[\s\S]*uiUpdateIntervalMs,[\s\S]*deviceId[\s\S]*\]\);/,
    'usePitch should memoize from primitive option fields instead of the raw options object identity',
  );
  assert.doesNotMatch(
    source,
    /const opts = useMemo\(\(\) => \(\{[\s\S]*\}\), \[options\]\);/,
    'usePitch should not depend on the raw options object because callers pass fresh literals during normal rerenders',
  );
});

test('usePitch reports microphone startup, stream, and error state', () => {
  assert.match(source, /const \[streamActive, setStreamActive\] = useState\(false\)/, 'usePitch should expose whether a browser mic stream actually opened');
  assert.match(source, /const \[micStatus, setMicStatus\] = useState\('idle'\)/, 'usePitch should expose startup/calibration/live/error state');
  assert.match(source, /const \[micError, setMicError\] = useState\(''\)/, 'usePitch should expose permission and startup errors');
  assert.match(source, /navigator\.mediaDevices\?\.getUserMedia/, 'usePitch should explicitly guard unavailable browser mic capture');
  assert.match(source, /deviceId: \{ exact: opts\.deviceId \}/, 'usePitch should support a selected input device for Host mic setup');
  assert.match(source, /setMicStatus\('calibrating'\)/, 'usePitch should identify calibration so host UI can guide the operator');
  assert.match(source, /setMicStatus\('live'\)/, 'usePitch should report when calibration is complete');
  assert.match(source, /setMicStatus\(name === 'NotAllowedError' \|\| name === 'SecurityError' \? 'blocked' : 'error'\)/, 'usePitch should distinguish blocked mic permission from generic startup failures');
  assert.match(source, /return \{ pitch, volume, note, confidence, volumeNormalized, stableNote, stability, calibrating, noiseFloor, isSinging, streamActive, micStatus, micError, audioState \}/, 'usePitch should return mic lifecycle state to Host');
});

test('usePitch guards AudioContext close calls during rapid mic restarts', () => {
  assert.match(source, /const closeAudioContext = \(\) => \{[\s\S]*ctx\.state !== 'closed'[\s\S]*ctx\.close\(\)\.catch\(\(\) => \{\}\)/, 'usePitch should not close an already closed AudioContext');
  assert.doesNotMatch(source, /audioCtx\.current\.close\(\); audioCtx\.current = null;/, 'usePitch should use the guarded close helper instead of raw close calls');
});
