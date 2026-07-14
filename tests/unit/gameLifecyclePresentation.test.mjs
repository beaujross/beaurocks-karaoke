import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getGameLifecyclePresentation } from '../../src/lib/gameLifecyclePresentation.js';

test('Trivia tells audiences what to do and who reveals', () => {
  const view = getGameLifecyclePresentation({ activeMode: 'trivia_pop', triviaQuestion: { status: 'asking', autoReveal: true } });
  assert.equal(view.phaseLabel, 'Your turn');
  assert.equal(view.audienceAction, 'Choose A, B, C, or D on your phone.');
  assert.equal(view.revealOwner, 'The result reveals automatically.');
});

test('Doodle and Selfie change instructions during voting and reveal', () => {
  assert.equal(getGameLifecyclePresentation({ activeMode: 'doodle_oke', doodleOke: { status: 'voting' } }).audienceAction, 'Vote for one approved drawing.');
  const selfie = getGameLifecyclePresentation({ activeMode: 'selfie_challenge', selfieChallenge: { status: 'ended' } });
  assert.equal(selfie.phaseLabel, 'Result');
  assert.match(selfie.nextStep, /returns the room to karaoke/);
});

test('Bingo remains an all-night companion with a concrete action', () => {
  const view = getGameLifecyclePresentation({ activeMode: 'bingo', bingoData: ['One'] });
  assert.equal(view.lifecycleLabel, 'All-night companion');
  assert.match(view.audienceAction, /Mark matching moments/);
});

test('ordinary karaoke without a companion does not show game guidance', () => {
  assert.equal(getGameLifecyclePresentation({ activeMode: 'karaoke' }).visible, false);
});
