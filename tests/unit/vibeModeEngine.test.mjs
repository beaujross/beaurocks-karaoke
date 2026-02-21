import assert from 'node:assert/strict';
import {
    deriveBangerModeState,
    deriveBalladModeState,
    deriveStrobeModeState,
    getVibeModeTierTransitions,
    buildVibeModeRewardPayload,
    VIBE_MODE_ENGINE_CONSTANTS
} from '../../src/apps/TV/vibeModeEngine.js';

const run = () => {
    const now = 100000;

    const spamEvents = [
        { type: 'fire', uid: 'u1', count: 9, timestampMs: now - 2000 },
        { type: 'fire', uid: 'u1', count: 9, timestampMs: now - 1800 },
        { type: 'rocket', uid: 'u2', count: 4, timestampMs: now - 1400 }
    ];
    const banger = deriveBangerModeState({ combo: 42, events: spamEvents, nowMs: now });
    assert.equal(banger.mode, 'banger');
    assert.ok(banger.score > 0);
    assert.ok(banger.uniqueParticipants >= 2);
    assert.ok(banger.rawCount <= (VIBE_MODE_ENGINE_CONSTANTS.USER_EVENT_CAP * 2));

    const ballad = deriveBalladModeState({
        combo: 30,
        chatCount: 4,
        events: [
            { type: 'heart', uid: 'u1', count: 3, timestampMs: now - 1200 },
            { type: 'drink', uid: 'u2', count: 2, timestampMs: now - 900 }
        ],
        nowMs: now
    });
    assert.equal(ballad.mode, 'ballad');
    assert.ok(ballad.score > 20);

    const strobe = deriveStrobeModeState({
        totalTaps: 140,
        leaderCount: 5,
        phase: 'active',
        events: [
            { type: 'strobe_tap', uid: 'u1', count: 70, timestampMs: now - 1100 },
            { type: 'strobe_tap', uid: 'u2', count: 35, timestampMs: now - 900 },
            { type: 'clap', uid: 'u3', count: 8, timestampMs: now - 600 }
        ],
        nowMs: now
    });
    assert.equal(strobe.mode, 'strobe');
    assert.ok(strobe.score > 35);

    const lowState = { mode: 'banger', tier: 1, score: 30 };
    const highState = { mode: 'banger', tier: 3, score: 78 };
    const transitions = getVibeModeTierTransitions(lowState, highState);
    assert.equal(transitions.length, 2);
    assert.equal(transitions[0].tier, 2);
    assert.equal(transitions[1].tier, 3);

    const rewardVisualOnly = buildVibeModeRewardPayload(
        { mode: 'ballad', tier: 2, score: 52 },
        now,
        { visualOnly: false, lastPayoutAt: 0, payoutCooldownMs: 4000 }
    );
    assert.equal(rewardVisualOnly.shouldProcess, true);
    assert.equal(rewardVisualOnly.visualOnly, true);

    const rewardPoints = buildVibeModeRewardPayload(
        { mode: 'strobe', tier: 4, score: 93 },
        now,
        { visualOnly: false, lastPayoutAt: 0, payoutCooldownMs: 4000 }
    );
    assert.equal(rewardPoints.shouldProcess, true);
    assert.equal(rewardPoints.visualOnly, false);
    assert.ok(Number(rewardPoints.pointsBudget || 0) > 0);

    const rewardCooldown = buildVibeModeRewardPayload(
        { mode: 'strobe', tier: 4, score: 93 },
        now,
        { visualOnly: false, lastPayoutAt: now - 500, payoutCooldownMs: 4000 }
    );
    assert.equal(rewardCooldown.shouldProcess, false);
    assert.equal(rewardCooldown.reason, 'cooldown');

    console.log('vibeModeEngine tests passed');
};

run();
