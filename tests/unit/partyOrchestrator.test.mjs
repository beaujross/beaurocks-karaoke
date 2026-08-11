import assert from 'node:assert/strict';
import { test } from "vitest";
import {
    PARTY_AUTO_MOMENT_DEFAULTS,
    PARTY_POLICY_DEFAULTS,
    normalizeMissionParty,
    shouldAllowGroupMoment,
    recordCompletedPerformance,
    recordGroupMoment,
    getSingingSharePct,
    recommendAutoCrowdMoment,
    canLaunchScheduledAutoCrowdMoment,
    getAutoPartyStageHandoff
} from '../../src/apps/Host/partyOrchestrator.js';

test("partyOrchestrator.test", () => {
    const defaults = normalizeMissionParty({});
    assert.equal(defaults.karaokeFirst, true);
    assert.equal(defaults.minSingingSharePct, PARTY_POLICY_DEFAULTS.minSingingSharePct);
    assert.equal(defaults.maxConsecutiveNonKaraokeModes, 1);
    assert.equal(defaults.autoCrowdMomentsEnabled, false);
    assert.deepEqual(defaults.autoCrowdMomentPreferredTypes, PARTY_AUTO_MOMENT_DEFAULTS.autoCrowdMomentPreferredTypes);

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

    const autoReadyCheck = recommendAutoCrowdMoment({
        party: {
            ...defaults,
            autoCrowdMomentsEnabled: true,
            autoCrowdMomentPreferredTypes: ['ready_check']
        },
        flowState: withSinging,
        queueDepth: 2,
        hasCurrentSinger: false,
        activeMode: 'karaoke'
    });
    assert.equal(autoReadyCheck.allowed, true);
    assert.equal(autoReadyCheck.type, 'ready_check');
    assert.equal(autoReadyCheck.breakDurationSec, PARTY_AUTO_MOMENT_DEFAULTS.autoCrowdMomentReadyCheckSec);

    const autoVolley = recommendAutoCrowdMoment({
        party: {
            ...defaults,
            autoCrowdMomentsEnabled: true,
            autoCrowdMomentPreferredTypes: ['volley', 'ready_check']
        },
        flowState: { ...withSinging, songsSinceLastGroupMoment: 2 },
        queueDepth: 1,
        lobbyVolleyEnabled: true,
        hasCurrentSinger: false,
        activeMode: 'karaoke'
    });
    assert.equal(autoVolley.allowed, true);
    assert.equal(autoVolley.type, 'volley');

    const cadenceGuard = recommendAutoCrowdMoment({
        party: {
            ...defaults,
            autoCrowdMomentsEnabled: true,
            autoCrowdMomentEverySongs: 3,
            autoCrowdMomentPreferredTypes: ['trivia']
        },
        flowState: { ...withSinging, songsSinceLastGroupMoment: 2 },
        queueDepth: 1,
        activeMode: 'karaoke'
    });
    assert.equal(cadenceGuard.allowed, false);
    assert.equal(cadenceGuard.reason, 'cadence');

    const autoTrivia = recommendAutoCrowdMoment({
        party: {
            ...defaults,
            autoCrowdMomentsEnabled: true,
            autoCrowdMomentEverySongs: 3,
            autoCrowdMomentTriviaSec: 18,
            autoCrowdMomentPreferredTypes: ['trivia', 'would_you_rather']
        },
        flowState: { ...withSinging, songsSinceLastGroupMoment: 3 },
        queueDepth: 1,
        activeMode: 'karaoke'
    });
    assert.equal(autoTrivia.allowed, true);
    assert.equal(autoTrivia.type, 'trivia');
    assert.equal(autoTrivia.breakDurationSec, 18);

    const disabledAuto = recommendAutoCrowdMoment({
        party: defaults,
        flowState: withSinging,
        queueDepth: 1
    });
    assert.equal(disabledAuto.allowed, false);
    assert.equal(disabledAuto.reason, 'disabled');
});
test('scheduled crowd moments yield when the next performance starts', () => {
    const idleBreak = canLaunchScheduledAutoCrowdMoment({
        scheduledLastPerformanceTs: 1000,
        currentLastPerformanceTs: 1000,
        eligibleLastPerformanceTs: 1000,
        activeMode: 'karaoke'
    });
    assert.deepEqual(idleBreak, { allowed: true, reason: 'ok' });

    assert.equal(canLaunchScheduledAutoCrowdMoment({
        scheduledLastPerformanceTs: 1000,
        currentLastPerformanceTs: 1000,
        stageActivationPending: true
    }).reason, 'stage_activation_pending');
    assert.equal(canLaunchScheduledAutoCrowdMoment({
        scheduledLastPerformanceTs: 1000,
        currentLastPerformanceTs: 1000,
        hasCurrentSinger: true
    }).reason, 'singer_live');
    assert.equal(canLaunchScheduledAutoCrowdMoment({
        scheduledLastPerformanceTs: 1000,
        currentLastPerformanceTs: 2000
    }).reason, 'performance_changed');
    assert.equal(canLaunchScheduledAutoCrowdMoment({
        scheduledLastPerformanceTs: 1000,
        currentLastPerformanceTs: 1000,
        eligibleLastPerformanceTs: 0
    }).reason, 'performance_not_eligible');
});

test('Auto Party releases backing playback only after the game and TV settle window', () => {
    const room = {
        activeMode: 'karaoke',
        lightMode: 'off',
        lobbyVolleyEnabled: false,
        readyCheck: { active: false },
        missionControl: {
            autoMoment: {
                key: 'volley_1000',
                status: 'completed',
                stagePlaybackReleaseAtMs: 11900
            }
        }
    };

    assert.deepEqual(getAutoPartyStageHandoff({
        room,
        completedAutoMomentKey: 'volley_1000',
        now: 11500
    }), {
        allowed: false,
        reason: 'release_time_pending',
        retryAfterMs: 400,
        releaseAtMs: 11900
    });

    assert.equal(getAutoPartyStageHandoff({
        room,
        completedAutoMomentKey: 'volley_1000',
        now: 11900
    }).allowed, true);
});

test('Auto Party keeps backing playback blocked until every public presentation flag clears', () => {
    const baseRoom = {
        activeMode: 'karaoke',
        lightMode: 'off',
        lobbyVolleyEnabled: false,
        readyCheck: { active: false },
        missionControl: {
            autoMoment: {
                key: 'moment_1',
                status: 'completed',
                stagePlaybackReleaseAtMs: 1000
            }
        }
    };

    assert.equal(getAutoPartyStageHandoff({
        room: { ...baseRoom, missionControl: { autoMoment: { ...baseRoom.missionControl.autoMoment, status: 'live' } } },
        now: 2000
    }).reason, 'auto_moment_live');
    assert.equal(getAutoPartyStageHandoff({
        room: { ...baseRoom, activeMode: 'trivia_pop' },
        now: 2000
    }).reason, 'mode_live');
    assert.equal(getAutoPartyStageHandoff({
        room: { ...baseRoom, lobbyVolleyEnabled: true },
        now: 2000
    }).reason, 'volley_live');
    assert.equal(getAutoPartyStageHandoff({
        room: { ...baseRoom, readyCheck: { active: true } },
        now: 2000
    }).reason, 'ready_check_live');
    assert.equal(getAutoPartyStageHandoff({
        room: baseRoom,
        completedAutoMomentKey: 'failed_moment_that_never_started',
        now: 2000
    }).allowed, true);
});
