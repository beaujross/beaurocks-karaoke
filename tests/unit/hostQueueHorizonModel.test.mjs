import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildHostQueueHorizonModel } from '../../src/apps/Host/lib/hostQueueHorizonModel.js';

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
    assert.equal(model.automation.label, 'Songs: Manual');
    assert.match(model.automation.detail, /performance advancement only/);
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
    });

    assert.deepEqual(model.segments.map((segment) => segment.label), ['On Stage', 'On Deck', 'Next Singer']);
    assert.equal(model.segments[1].item.title, 'Volley Orb');
    assert.equal(model.remainingCount, 1);
    assert.equal(model.automation.label, 'Songs: Auto');
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
