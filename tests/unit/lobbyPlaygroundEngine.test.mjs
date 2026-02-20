import assert from 'node:assert/strict';
import {
    createLobbyVolleyState,
    applyLobbyInteraction,
    getTierTransitions,
    getActiveParticipants,
    buildAwardPayload,
    quantizeToBeat,
    LOBBY_PLAYGROUND_ENGINE_CONSTANTS
} from '../../src/apps/TV/lobbyPlaygroundEngine.js';

const run = () => {
    const timeoutMs = Number(LOBBY_PLAYGROUND_ENGINE_CONSTANTS.STREAK_TIMEOUT_MS || 6200);
    const contributionWindowMs = Number(LOBBY_PLAYGROUND_ENGINE_CONSTANTS.CONTRIBUTION_WINDOW_MS || 28000);

    // Streak progression + reset timing.
    let state = createLobbyVolleyState();
    state = applyLobbyInteraction(state, { type: 'wave', uid: 'u1', userName: 'Ava', count: 1 }, 1000);
    assert.equal(state.streakCount, 1);
    const streakId = state.streakId;
    state = applyLobbyInteraction(state, { type: 'laser', uid: 'u2', userName: 'Ben', count: 1 }, 1700);
    assert.equal(state.streakCount, 2);
    state = applyLobbyInteraction(state, { type: 'echo', uid: 'u3', userName: 'Cam', count: 1 }, 1700 + timeoutMs + 60);
    assert.equal(state.streakCount, 1);
    assert.equal(state.streakId, streakId + 1);

    // Contribution weighting + anti-spam.
    let spamState = createLobbyVolleyState();
    spamState = applyLobbyInteraction(spamState, { type: 'wave', uid: 'u1', userName: 'Ava', count: 1 }, 1000);
    spamState = applyLobbyInteraction(spamState, { type: 'wave', uid: 'u1', userName: 'Ava', count: 1 }, 1120);
    spamState = applyLobbyInteraction(spamState, { type: 'wave', uid: 'u2', userName: 'Ben', count: 1 }, 1400);
    assert.ok(Number(spamState.interactions[0].weight) >= 0.99);
    assert.ok(Number(spamState.interactions[1].weight) < 0.5);
    assert.ok(Number(spamState.interactions[2].weight) >= 0.99);

    // Tier transition detection.
    let tierState = createLobbyVolleyState();
    for (let i = 0; i < 3; i += 1) {
        tierState = applyLobbyInteraction(tierState, { type: 'wave', uid: `u${i}`, userName: `U${i}` }, 2000 + (i * 400));
    }
    const tierBefore = tierState;
    tierState = applyLobbyInteraction(tierState, { type: 'laser', uid: 'u9', userName: 'Neo' }, 3400);
    const tierTransitions = getTierTransitions(tierBefore, tierState);
    assert.equal(tierTransitions.length, 1);
    assert.equal(tierTransitions[0].tier, 1);

    // Active participant selection window.
    let participantState = createLobbyVolleyState();
    participantState = applyLobbyInteraction(participantState, { type: 'wave', uid: 'old_user', userName: 'Old' }, 1000);
    participantState = applyLobbyInteraction(participantState, { type: 'echo', uid: 'new_user', userName: 'New' }, 1000 + contributionWindowMs - 50);
    const active = getActiveParticipants(participantState, 1000 + contributionWindowMs + 200);
    assert.equal(active.length, 1);
    assert.equal(active[0].uid, 'new_user');

    // Award payload caps + cooldown behavior.
    let payoutState = createLobbyVolleyState();
    for (let i = 0; i < 28; i += 1) {
        const uid = `p${i % 8}`;
        const type = ['wave', 'laser', 'echo', 'confetti'][i % 4];
        payoutState = applyLobbyInteraction(payoutState, { type, uid, userName: uid, count: 1 }, 5000 + (i * 320));
    }
    assert.equal(payoutState.currentTier >= 3, true);
    const payout = buildAwardPayload(payoutState, 5000 + (28 * 320));
    assert.equal(payout.shouldProcess, true);
    const maxParticipants = Number(LOBBY_PLAYGROUND_ENGINE_CONSTANTS.MAX_PARTICIPANTS_PER_PAYOUT || 6);
    assert.ok((payout.awards || []).length <= maxParticipants);
    const tierDef = (LOBBY_PLAYGROUND_ENGINE_CONSTANTS.TIER_DEFINITIONS || []).find((entry) => entry.tier === payout.tier);
    if (tierDef && !tierDef.visualOnly) {
        (payout.awards || []).forEach((entry) => {
            assert.ok(Number(entry.points) <= Number(tierDef.maxPointsPerUser || entry.points));
            assert.ok(Number(entry.points) > 0);
        });
    }
    const payoutAgain = buildAwardPayload(payout.nextState, 5000 + (28 * 320) + 50);
    assert.equal(payoutAgain.shouldProcess, false);
    assert.equal(payoutAgain.reason, 'already_paid');

    const cooldownState = {
        ...payoutState,
        paidTierKeys: {},
        lastPayoutAtMs: 5000 + (28 * 320) - 100
    };
    const cooldown = buildAwardPayload(cooldownState, 5000 + (28 * 320));
    assert.equal(cooldown.shouldProcess, false);
    assert.equal(cooldown.reason, 'cooldown');

    // Beat quantization + fallback.
    assert.equal(quantizeToBeat(1020, 500, 40), 1000);
    assert.equal(quantizeToBeat(1080, 500, 40), 1080);
    assert.equal(quantizeToBeat(1234, 0, 60), 1234);

    console.log('lobbyPlaygroundEngine tests passed');
};

run();
