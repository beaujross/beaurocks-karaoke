import assert from 'node:assert/strict';
import { test } from 'vitest';

import { DEAD_AIR_AUTOFILL_SOURCE } from '../../src/apps/Host/deadAirAutopilot.js';
import { recordCompletedPerformance } from '../../src/apps/Host/partyOrchestrator.js';
import {
    getRoomFlowSnapshot,
    ROOM_FLOW_OWNERS
} from '../../src/apps/Host/roomFlowOrchestrator.js';

test('roomFlowOrchestrator suppresses queue automation while run of show owns the room', () => {
    const flow = getRoomFlowSnapshot({
        roomCode: 'ROOM1',
        room: {
            activeMode: 'karaoke',
            autoDjDelaySec: 10,
            runOfShowEnabled: true,
            programMode: 'run_of_show',
            missionControl: {
                deadAirFiller: {
                    enabled: true,
                    mode: 'auto_fill',
                    songs: [{ title: 'Sweet Caroline', artist: 'Neil Diamond' }]
                }
            }
        },
        songs: [
            {
                id: 'song_1',
                status: 'requested',
                mediaUrl: 'https://youtube.com/watch?v=abc123',
                playbackReady: true,
                priorityScore: 1
            }
        ],
        autoDjEnabled: true,
        party: {
            autoCrowdMomentsEnabled: true,
            state: recordCompletedPerformance({}, { durationSec: 180 })
        },
        assistLevel: 'autopilot_first',
        lastPerformanceTs: 1000,
        queuedCount: 1,
        performingCount: 0,
        runOfShowNextItem: { id: 'ros_next_1' },
        fallbackDeadAirSongs: [{ title: 'Sweet Caroline', artist: 'Neil Diamond' }],
        now: 1000
    });

    assert.equal(flow.owner, ROOM_FLOW_OWNERS.runOfShow);
    assert.equal(flow.autoDjIntent.reason, 'run_of_show_active');
    assert.equal(flow.autoPartyIntent.reason, 'run_of_show_active');
    assert.equal(flow.deadAirIntent.reason, 'queue_busy');
});

test('roomFlowOrchestrator arms between-singer bridge before auto dj when a real singer is next', () => {
    const flow = getRoomFlowSnapshot({
        roomCode: 'ROOM2',
        room: {
            activeMode: 'karaoke',
            autoDjDelaySec: 10,
            autoDj: true,
            missionControl: {
                party: {
                    autoCrowdMomentsEnabled: true,
                    autoCrowdMomentPreferredTypes: ['ready_check'],
                    state: recordCompletedPerformance({}, { durationSec: 180 })
                }
            }
        },
        songs: [
            {
                id: 'song_real',
                status: 'requested',
                mediaUrl: 'https://youtube.com/watch?v=next123',
                playbackReady: true,
                priorityScore: 1
            }
        ],
        autoDjEnabled: true,
        party: {
            autoCrowdMomentsEnabled: true,
            autoCrowdMomentPreferredTypes: ['ready_check'],
            state: recordCompletedPerformance({}, { durationSec: 180 })
        },
        assistLevel: 'autopilot_first',
        lastPerformanceTs: 1000,
        queuedCount: 1,
        performingCount: 0,
        now: 12000
    });

    assert.equal(flow.owner, ROOM_FLOW_OWNERS.betweenSingers);
    assert.equal(flow.autoPartyIntent.shouldStart, true);
    assert.equal(flow.autoPartyIntent.moment.type, 'ready_check');
    assert.equal(flow.autoDjIntent.shouldStart, true);
    assert.equal(flow.autoDjIntent.songId, 'song_real');
});

test('roomFlowOrchestrator suppresses auto party when the next queued item is dead-air autofill', () => {
    const flow = getRoomFlowSnapshot({
        roomCode: 'ROOM3',
        room: {
            activeMode: 'karaoke',
            autoDjDelaySec: 10,
            autoDj: true,
            missionControl: {
                party: {
                    autoCrowdMomentsEnabled: true,
                    autoCrowdMomentPreferredTypes: ['ready_check'],
                    state: recordCompletedPerformance({}, { durationSec: 180 })
                }
            }
        },
        songs: [
            {
                id: 'song_fill',
                status: 'requested',
                mediaUrl: 'https://youtube.com/watch?v=filler123',
                playbackReady: true,
                priorityScore: 1,
                automationSource: DEAD_AIR_AUTOFILL_SOURCE
            }
        ],
        autoDjEnabled: true,
        party: {
            autoCrowdMomentsEnabled: true,
            autoCrowdMomentPreferredTypes: ['ready_check'],
            state: recordCompletedPerformance({}, { durationSec: 180 })
        },
        assistLevel: 'autopilot_first',
        lastPerformanceTs: 1000,
        queuedCount: 1,
        performingCount: 0,
        now: 12000
    });

    assert.equal(flow.owner, ROOM_FLOW_OWNERS.queueReady);
    assert.equal(flow.nextQueuedSongIsDeadAir, true);
    assert.equal(flow.autoPartyIntent.reason, 'dead_air_autofill_next');
    assert.equal(flow.autoDjIntent.shouldStart, true);
    assert.equal(flow.autoDjIntent.songId, 'song_fill');
});

test('roomFlowOrchestrator arms dead-air recovery only when the room is truly empty', () => {
    const flow = getRoomFlowSnapshot({
        roomCode: 'ROOM4',
        room: {
            activeMode: 'karaoke',
            autoDjDelaySec: 10,
            missionControl: {
                deadAirFiller: {
                    enabled: true,
                    mode: 'auto_fill',
                    songs: [{ title: 'Mr. Brightside', artist: 'The Killers' }]
                }
            }
        },
        songs: [],
        autoDjEnabled: true,
        party: { state: {} },
        assistLevel: 'autopilot_first',
        lastPerformanceTs: 2000,
        queuedCount: 0,
        performingCount: 0,
        fallbackDeadAirSongs: [{ title: 'Mr. Brightside', artist: 'The Killers' }],
        now: 2000
    });

    assert.equal(flow.owner, ROOM_FLOW_OWNERS.deadAirRecovery);
    assert.equal(flow.deadAirIntent.shouldQueue, true);
    assert.equal(flow.deadAirIntent.song.title, 'Mr. Brightside');
});
