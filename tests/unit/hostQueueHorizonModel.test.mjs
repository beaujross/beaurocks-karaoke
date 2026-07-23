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
    assert.equal(model.automation.label, 'Manual');
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
    assert.equal(model.automation.label, 'Auto-DJ');
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
