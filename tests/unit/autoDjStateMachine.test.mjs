import assert from 'node:assert/strict';
import { test } from "vitest";
import {
    AUTO_DJ_EVENTS,
    createAutoDjSequenceState,
    transitionAutoDjSequenceState,
    deriveAutoDjStepItems,
    describeAutoDjSequenceState,
    getAutoDjQueueAdvanceIntent
} from '../../src/apps/Host/autoDjStateMachine.js';

test("autoDjStateMachine.test", () => {
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
});

test("Auto DJ queue advance intent starts a playable YouTube queue item independent from TV mode", () => {
    const intent = getAutoDjQueueAdvanceIntent({
        autoDjEnabled: true,
        activeMode: 'karaoke',
        showLyricsTv: true,
        showVideoTv: false,
        songs: [
            {
                id: 'song_youtube',
                status: 'requested',
                mediaUrl: 'https://youtube.com/watch?v=abc123',
                playbackReady: true,
                priorityScore: 2
            }
        ],
        appleMusicEnabled: false,
        now: 1000
    });

    assert.equal(intent.shouldStart, true);
    assert.equal(intent.reason, 'ready');
    assert.equal(intent.songId, 'song_youtube');
});

test("Auto DJ queue advance intent reports why it cannot start", () => {
    const playableSong = {
        id: 'song_ready',
        status: 'requested',
        mediaUrl: 'https://youtube.com/watch?v=ready',
        playbackReady: true
    };

    assert.equal(
        getAutoDjQueueAdvanceIntent({
            autoDjEnabled: true,
            activeMode: 'applause',
            songs: [playableSong]
        }).reason,
        'applause_active'
    );

    assert.equal(
        getAutoDjQueueAdvanceIntent({
            autoDjEnabled: true,
            activeMode: 'karaoke',
            readyCheckActive: true,
            songs: [playableSong]
        }).reason,
        'ready_check_active'
    );

    assert.equal(
        getAutoDjQueueAdvanceIntent({
            autoDjEnabled: true,
            activeMode: 'karaoke',
            autoMomentLive: true,
            songs: [playableSong]
        }).reason,
        'auto_moment_live'
    );

    assert.equal(
        getAutoDjQueueAdvanceIntent({
            autoDjEnabled: true,
            activeMode: 'karaoke',
            runOfShowEnabled: true,
            programMode: 'run_of_show',
            songs: [playableSong]
        }).reason,
        'run_of_show_active'
    );

    assert.equal(
        getAutoDjQueueAdvanceIntent({
            autoDjEnabled: true,
            activeMode: 'karaoke',
            songs: [
                {
                    id: 'song_apple',
                    status: 'requested',
                    appleMusicId: 'apple-track',
                    playbackReady: true
                }
            ],
            appleMusicEnabled: false
        }).reason,
        'no_playable_queue'
    );
});

test("Auto DJ queue advance intent waits for the configured post-performance delay", () => {
    const intent = getAutoDjQueueAdvanceIntent({
        autoDjEnabled: true,
        activeMode: 'karaoke',
        songs: [
            {
                id: 'song_ready',
                status: 'requested',
                mediaUrl: 'https://youtube.com/watch?v=ready',
                playbackReady: true
            }
        ],
        lastPerformanceTs: 1000,
        autoDjDelaySec: 10,
        now: 5000
    });

    assert.equal(intent.shouldStart, false);
    assert.equal(intent.reason, 'waiting_delay');
    assert.equal(intent.delayMs, 6000);
    assert.equal(intent.songId, 'song_ready');
});
