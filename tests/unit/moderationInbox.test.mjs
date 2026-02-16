import assert from 'node:assert/strict';
import {
    buildModerationQueueSnapshot,
    deriveModerationSeverity,
    moderationNeedsAttention
} from '../../src/apps/Host/moderationInboxLogic.js';

const run = () => {
    const snapshot = buildModerationQueueSnapshot({
        doodleRequireReview: true,
        selfieRequireApproval: true,
        approvedUids: ['approved-uid'],
        doodleSubmissions: [
            { id: 'd1', uid: 'approved-uid', timestamp: 1000, name: 'Approved Doodle' },
            { id: 'd2', uid: 'pending-uid', timestamp: 3000, name: 'Pending Doodle' }
        ],
        selfieSubmissions: [
            { id: 's1', approved: true, timestamp: 2000, userName: 'Approved Selfie' },
            { id: 's2', approved: false, timestamp: 6000, userName: 'Pending Selfie' }
        ],
        bingoSuggestions: {
            0: { count: 2, lastAt: { seconds: 5 }, lastNote: 'Crowd wants this tile' },
            1: { count: 1, lastAt: { seconds: 4 }, lastNote: 'Old tile' }
        },
        bingoRevealed: { 1: true }
    });

    assert.equal(snapshot.counts.doodlePending, 1);
    assert.equal(snapshot.counts.selfiePending, 1);
    assert.equal(snapshot.counts.bingoPending, 1);
    assert.equal(snapshot.counts.totalPending, 3);
    assert.equal(snapshot.queueItems.length, 3);
    assert.deepEqual(snapshot.queueItems.map((item) => item.type), ['selfie', 'bingo', 'doodle']);
    assert.equal(snapshot.oldestPendingAt, 3000);

    const severityIdle = deriveModerationSeverity({
        totalPending: 0,
        oldestPendingAt: 0,
        now: 1_000_000
    });
    assert.equal(severityIdle, 'idle');

    const severityActive = deriveModerationSeverity({
        totalPending: 2,
        oldestPendingAt: 980_000,
        now: 1_000_000
    });
    assert.equal(severityActive, 'active');

    const severityStale = deriveModerationSeverity({
        totalPending: 3,
        oldestPendingAt: 990_000,
        now: 1_000_000
    });
    assert.equal(severityStale, 'stale');

    const severityCritical = deriveModerationSeverity({
        totalPending: 1,
        oldestPendingAt: 600_000,
        now: 1_000_000
    });
    assert.equal(severityCritical, 'critical');

    assert.equal(moderationNeedsAttention('idle'), false);
    assert.equal(moderationNeedsAttention('active'), false);
    assert.equal(moderationNeedsAttention('stale'), true);
    assert.equal(moderationNeedsAttention('critical'), true);

    console.log('moderationInbox tests passed');
};

run();
