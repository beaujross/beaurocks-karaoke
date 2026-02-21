import assert from 'node:assert/strict';
import {
    AUTO_DJ_EVENTS,
    createAutoDjSequenceState,
    transitionAutoDjSequenceState,
    deriveAutoDjStepItems,
    describeAutoDjSequenceState
} from '../../src/apps/Host/autoDjStateMachine.js';

const run = () => {
    let state = createAutoDjSequenceState(1000);
    state = transitionAutoDjSequenceState(state, AUTO_DJ_EVENTS.START, { songId: 'song_a' }, 1200);
    assert.equal(state.phase, 'stage');
    state = transitionAutoDjSequenceState(state, AUTO_DJ_EVENTS.STAGE_READY, { songId: 'song_a' }, 1400);
    assert.equal(state.phase, 'applause');
    state = transitionAutoDjSequenceState(state, AUTO_DJ_EVENTS.APPLAUSE_RESULT, { songId: 'song_a' }, 1600);
    assert.equal(state.phase, 'scoring');
    state = transitionAutoDjSequenceState(state, AUTO_DJ_EVENTS.SCORING_COMPLETE, { songId: 'song_a' }, 1800);
    assert.equal(state.phase, 'transition');
    state = transitionAutoDjSequenceState(state, AUTO_DJ_EVENTS.TRANSITION_COMPLETE, { songId: 'song_a' }, 2000);
    assert.equal(state.phase, 'completed');

    const steps = deriveAutoDjStepItems(state);
    assert.equal(steps.length, 4);
    steps.forEach((step) => assert.equal(step.status, 'complete'));

    let failState = createAutoDjSequenceState(3000);
    failState = transitionAutoDjSequenceState(failState, AUTO_DJ_EVENTS.START, { songId: 'song_b' }, 3200);
    failState = transitionAutoDjSequenceState(failState, AUTO_DJ_EVENTS.FAIL, { songId: 'song_b', error: 'network' }, 3400);
    assert.equal(failState.status, 'retrying');
    failState = transitionAutoDjSequenceState(failState, AUTO_DJ_EVENTS.FAIL, { songId: 'song_b', error: 'network' }, 3500);
    assert.equal(failState.status, 'retrying');
    failState = transitionAutoDjSequenceState(failState, AUTO_DJ_EVENTS.FAIL, { songId: 'song_b', error: 'network' }, 3600);
    assert.equal(failState.status, 'error');

    const summary = describeAutoDjSequenceState(failState);
    assert.equal(summary.tone, 'danger');

    const reset = transitionAutoDjSequenceState(failState, AUTO_DJ_EVENTS.RESET, {}, 3700);
    assert.equal(reset.phase, 'idle');

    console.log('autoDjStateMachine tests passed');
};

run();
