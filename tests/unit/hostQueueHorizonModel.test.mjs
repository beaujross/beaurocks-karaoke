import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
    buildHostQueueHorizonModel,
    deriveTonightLineupAutomationState,
    getHostLineupItemDurationSec,
} from '../../src/apps/Host/lib/hostQueueHorizonModel.js';

const performance = (id, title) => ({
    id,
    objectType: 'performance',
    title,
    subtitle: `${title} song`,
});

test('builds On Stage, Next, and Then from the live rotation', () => {
    const model = buildHostQueueHorizonModel({
        runtimeModel: {
            currentPerformance: performance('live', 'Alex'),
            nextPerformance: performance('next', 'Jordan'),
            rotationFlow: [
                performance('next', 'Jordan'),
                performance('then', 'Taylor'),
                performance('later', 'Sam'),
            ],
            roomControlsSummary: { autoDj: false },
        },
        queueTotalCount: 3,
        attentionCount: 2,
    });

    assert.deepEqual(model.segments.map((segment) => segment.label), ['On Stage', 'Next', 'Then']);
    assert.equal(model.remainingCount, 1);
    assert.equal(model.attentionCount, 2);
    assert.equal(model.automation.label, 'Auto-Advance Off');
    assert.match(model.automation.detail, /scenes and performances/i);
});

test('surfaces a planned moment before the next singer', () => {
    const model = buildHostQueueHorizonModel({
        runtimeModel: {
            currentPerformance: performance('live', 'Alex'),
            nextPerformance: {
                id: 'volley',
                objectType: 'moment',
                title: 'Volley Orb',
                subtitle: 'Planned room moment',
            },
            rotationFlow: [
                performance('next', 'Jordan'),
                performance('then', 'Taylor'),
            ],
            roomControlsSummary: { autoDj: true },
        },
        queueTotalCount: 2,
        runOfShowEnabled: true,
        runOfShowAutomationMode: 'auto',
    });

    assert.deepEqual(model.segments.map((segment) => segment.label), ['On Stage', 'On Deck', 'Next Singer']);
    assert.equal(model.segments[1].item.title, 'Volley Orb');
    assert.equal(model.remainingCount, 1);
    assert.equal(model.automation.label, 'Auto-Advance Running');
    assert.equal(model.automation.enabled, true);
});

test('distinguishes staged, blocked, manual, and finished progression states', () => {
    const staged = deriveTonightLineupAutomationState({
        runOfShowEnabled: true,
        director: { items: [{ id: 'scene', status: 'staged' }] },
    });
    assert.equal(staged.state, 'armed');

    const blocked = deriveTonightLineupAutomationState({
        runOfShowEnabled: true,
        director: { items: [{ id: 'song', status: 'blocked' }] },
        committedFlow: [{ id: 'song', status: 'blocked', raw: { status: 'blocked' } }],
    });
    assert.equal(blocked.state, 'blocked');

    const manual = deriveTonightLineupAutomationState({
        runOfShowEnabled: true,
        director: { items: [{ id: 'toast', status: 'ready', automationMode: 'manual' }] },
        committedFlow: [{ id: 'toast', status: 'ready', raw: { automationMode: 'manual' } }],
    });
    assert.equal(manual.state, 'manual');

    const finished = deriveTonightLineupAutomationState({
        runOfShowEnabled: true,
        director: { items: [{ id: 'done', status: 'complete' }] },
        committedFlow: [],
    });
    assert.equal(finished.state, 'finished');
});

test('requires repair when the live session disagrees with the lineup owner', () => {
    const state = deriveTonightLineupAutomationState({
        runOfShowEnabled: true,
        director: {
            currentItemId: 'performance-one',
            items: [{
                id: 'performance-one',
                type: 'performance',
                status: 'live',
                queueSongId: 'song-one',
                activePerformanceSessionId: 'session-one',
            }],
        },
        currentPerformanceSession: {
            state: 'playing',
            songId: 'song-two',
            sessionId: 'session-two',
        },
    });
    assert.equal(state.state, 'repair');
    assert.equal(state.enabled, false);
});

test('reports a preserved paused mixed lineup separately from an inactive lineup', () => {
    const model = buildHostQueueHorizonModel({
        runtimeModel: {
            currentPerformance: null,
            nextPerformance: null,
            rotationFlow: [],
            roomControlsSummary: { autoDj: true },
        },
        runOfShowEnabled: true,
        runOfShowAutomationMode: 'auto',
        runOfShowDirector: {
            automationPaused: true,
            items: [],
        },
    });

    assert.equal(model.automation.enabled, false);
    assert.equal(model.automation.paused, true);
    assert.equal(model.automation.label, 'Auto-Advance Paused');
    assert.match(model.automation.detail, /preserved/i);
});

test('flags legacy song-only automation when it would bypass planned scenes', () => {
    const model = buildHostQueueHorizonModel({
        runtimeModel: {
            currentPerformance: null,
            nextPerformance: null,
            rotationFlow: [],
            roomControlsSummary: { autoDj: true },
        },
        runOfShowEnabled: false,
    });

    assert.equal(model.automation.enabled, false);
    assert.equal(model.automation.limited, true);
    assert.equal(model.automation.label, 'Songs Only');
    assert.match(model.automation.detail, /scenes are being bypassed/i);
});

test('shows the committed mixed flow before unlinked queue performances', () => {
    const queueSongs = [
        { id: 'song-jordan', singerName: 'Jordan', songTitle: 'Believe', artist: 'Cher', emoji: '🪩' },
        { id: 'song-sam', singerName: 'Sam', songTitle: 'Purple Rain', artist: 'Prince' },
    ];
    const model = buildHostQueueHorizonModel({
        runtimeModel: {
            currentPerformance: performance('live', 'Alex'),
            nextPerformance: null,
            rotationFlow: [
                { ...performance('song-jordan', 'Jordan'), raw: queueSongs[0] },
                { ...performance('song-sam', 'Sam'), raw: queueSongs[1] },
            ],
            roomControlsSummary: { autoDj: false },
        },
        runOfShowDirector: {
            items: [
                {
                    id: 'performance-jordan',
                    type: 'performance',
                    sequence: 1,
                    status: 'ready',
                    destination: 'run_of_show',
                    preparedQueueSongId: 'song-jordan',
                    assignedPerformerName: 'Jordan',
                    songTitle: 'Believe',
                    artistName: 'Cher',
                },
                {
                    id: 'trivia-one',
                    type: 'trivia_break',
                    sequence: 2,
                    status: 'ready',
                    destination: 'run_of_show',
                    title: 'Cher Trivia',
                    notes: 'One question after Jordan',
                },
                {
                    id: 'announcement-one',
                    type: 'announcement',
                    sequence: 3,
                    status: 'planned',
                    destination: 'run_of_show',
                    title: 'Birthday Toast',
                },
                {
                    id: 'saved-later',
                    type: 'game_break',
                    sequence: 4,
                    status: 'ready',
                    destination: 'planner',
                    title: 'Saved Game',
                },
            ],
        },
        queueSongs,
        queueTotalCount: queueSongs.length,
    });

    assert.deepEqual(model.segments.map((segment) => segment.item.id), [
        'live',
        'performance-jordan',
        'trivia-one',
        'announcement-one',
        'song-sam',
    ]);
    assert.deepEqual(model.segments.map((segment) => segment.label), ['On Stage', 'Next', 'Then', 'Then', 'Then']);
    assert.equal(model.liveQueueMomentCount, 2);
    assert.equal(model.remainingCount, 0);
});

test('provides a useful empty state', () => {
    const model = buildHostQueueHorizonModel({
        runtimeModel: {
            currentPerformance: null,
            nextPerformance: null,
            rotationFlow: [],
            roomControlsSummary: { autoDj: false },
        },
    });

    assert.equal(model.empty, true);
    assert.deepEqual(model.segments, []);
    assert.equal(model.remainingCount, 0);
});

test('carries known performance and moment durations into the lineup transport', () => {
    const queueSongs = [{ id: 'song-one', singerName: 'Alex', songTitle: 'Song', duration: 242 }];
    const model = buildHostQueueHorizonModel({
        runtimeModel: { currentPerformance: null, nextPerformance: null, rotationFlow: [], roomControlsSummary: { autoDj: false } },
        runOfShowDirector: {
            items: [
                { id: 'song-slot', type: 'performance', status: 'ready', preparedQueueSongId: 'song-one' },
                { id: 'trivia-slot', type: 'trivia_break', status: 'ready', plannedDurationSec: 45 },
            ],
        },
        queueSongs,
    });

    assert.equal(model.timelineItems.length, 2);
    assert.equal(getHostLineupItemDurationSec(model.timelineItems[0]), 242);
    assert.equal(getHostLineupItemDurationSec(model.timelineItems[1]), 45);
});
