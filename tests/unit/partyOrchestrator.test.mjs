import assert from 'node:assert/strict';
import {
    PARTY_POLICY_DEFAULTS,
    normalizeMissionParty,
    shouldAllowGroupMoment,
    recordCompletedPerformance,
    recordGroupMoment,
    getSingingSharePct
} from '../../src/apps/Host/partyOrchestrator.js';

const run = () => {
    const defaults = normalizeMissionParty({});
    assert.equal(defaults.karaokeFirst, true);
    assert.equal(defaults.minSingingSharePct, PARTY_POLICY_DEFAULTS.minSingingSharePct);
    assert.equal(defaults.maxConsecutiveNonKaraokeModes, 1);

    const withSinging = recordCompletedPerformance(defaults.state, { durationSec: 180 });
    assert.equal(withSinging.singingMs, 180000);
    assert.equal(withSinging.songsSinceLastGroupMoment, 1);
    assert.equal(withSinging.consecutiveNonKaraokeModes, 0);

    const allowQuickBreak = shouldAllowGroupMoment({
        policy: defaults,
        flowState: withSinging,
        queueDepth: 2,
        requestedMode: 'ready_check',
        requestedDurationSec: 6
    });
    assert.equal(allowQuickBreak.allowed, true);

    const deniedByQueue = shouldAllowGroupMoment({
        policy: defaults,
        flowState: withSinging,
        queueDepth: 10,
        requestedMode: 'ready_check',
        requestedDurationSec: 6
    });
    assert.equal(deniedByQueue.allowed, false);
    assert.equal(deniedByQueue.reason, 'queue_guard');

    const deniedByShare = shouldAllowGroupMoment({
        policy: defaults,
        flowState: { singingMs: 60000, groupMs: 25000, songsSinceLastGroupMoment: 1, consecutiveNonKaraokeModes: 0 },
        queueDepth: 1,
        requestedMode: 'ready_check',
        requestedDurationSec: 20
    });
    assert.equal(deniedByShare.allowed, false);
    assert.equal(deniedByShare.reason, 'karaoke_share_guard');

    const deniedByHeavyGap = shouldAllowGroupMoment({
        policy: defaults,
        flowState: { singingMs: 180000, groupMs: 0, songsSinceLastGroupMoment: 0, consecutiveNonKaraokeModes: 0 },
        queueDepth: 1,
        requestedMode: 'strobe',
        requestedDurationSec: 15
    });
    assert.equal(deniedByHeavyGap.allowed, false);
    assert.equal(deniedByHeavyGap.reason, 'song_gap_required');

    const deniedByDuration = shouldAllowGroupMoment({
        policy: { ...defaults, maxBreakDurationSec: 8 },
        flowState: withSinging,
        queueDepth: 1,
        requestedMode: 'strobe',
        requestedDurationSec: 20
    });
    assert.equal(deniedByDuration.allowed, false);
    assert.equal(deniedByDuration.reason, 'duration_limit');

    const afterGroup = recordGroupMoment(withSinging, { mode: 'ready_check', durationSec: 6 });
    assert.equal(afterGroup.groupMs, 6000);
    assert.equal(afterGroup.songsSinceLastGroupMoment, 0);
    assert.equal(afterGroup.consecutiveNonKaraokeModes, 1);

    const deniedConsecutive = shouldAllowGroupMoment({
        policy: defaults,
        flowState: afterGroup,
        queueDepth: 1,
        requestedMode: 'ready_check',
        requestedDurationSec: 6
    });
    assert.equal(deniedConsecutive.allowed, false);
    assert.equal(deniedConsecutive.reason, 'consecutive_limit');

    const singingShare = getSingingSharePct({ singingMs: 210000, groupMs: 90000 });
    assert.equal(singingShare, 70);

    console.log('partyOrchestrator tests passed');
};

run();
