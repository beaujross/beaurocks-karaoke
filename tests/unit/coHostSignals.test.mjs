import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  COHOST_SIGNAL_COOLDOWN_MS,
  COHOST_SIGNAL_OPTIONS,
  COHOST_SIGNAL_WINDOW_MS,
  getCoHostSignalMeta,
  isCoHostSignalActivity,
} from '../../src/lib/coHostSignals.js';

test('co-host signal definitions stay intentionally small and stable', () => {
  assert.equal(COHOST_SIGNAL_OPTIONS.length, 5);
  assert.ok(COHOST_SIGNAL_WINDOW_MS > COHOST_SIGNAL_COOLDOWN_MS);
  assert.deepEqual(
    COHOST_SIGNAL_OPTIONS.map((entry) => entry.id),
    ['track_up', 'track_down', 'vocal_up', 'vocal_down', 'mix_issue'],
  );
});

test('co-host signal helpers resolve valid activity entries only', () => {
  assert.equal(getCoHostSignalMeta('track_up')?.shortLabel, 'Track Up');
  assert.equal(getCoHostSignalMeta('TRACK_DOWN')?.hostLabel, 'Track needs a trim');
  assert.equal(getCoHostSignalMeta('vocal_up')?.hostLabel, 'Vocals need a bump');
  assert.equal(getCoHostSignalMeta('mix_issue')?.hostLabel, 'Mix issue');
  assert.equal(getCoHostSignalMeta('unknown_signal'), null);
  assert.equal(isCoHostSignalActivity({ type: 'cohost_signal', signalId: 'vocal_down' }), true);
  assert.equal(isCoHostSignalActivity({ type: 'activity', signalId: 'vocal_down' }), false);
  assert.equal(isCoHostSignalActivity({ type: 'cohost_signal', signalId: 'unknown_signal' }), false);
});
