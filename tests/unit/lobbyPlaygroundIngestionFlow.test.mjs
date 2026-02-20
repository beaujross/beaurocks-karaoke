import assert from 'node:assert/strict';
import {
    createLobbyVolleyState,
    applyLobbyInteraction,
    deriveComboMoment,
    getTierTransitions,
    buildAwardPayload
} from '../../src/apps/TV/lobbyPlaygroundEngine.js';

const ingestLobbyReactionEvents = ({
    events = [],
    paused = false,
    visualOnlyForced = false
} = {}) => {
    let state = createLobbyVolleyState();
    const combos = [];
    const transitions = [];
    const awards = [];

    events.forEach((event, idx) => {
        if (paused) return;
        const nowMs = Number(event?.timestampMs || (1000 + (idx * 400)));
        const prevState = state;
        state = applyLobbyInteraction(
            state,
            {
                type: event?.type,
                uid: event?.uid,
                userName: event?.userName,
                avatar: event?.avatar,
                count: event?.count || 1
            },
            nowMs
        );
        const combo = deriveComboMoment(prevState, {
            type: event?.type,
            uid: event?.uid,
            userName: event?.userName,
            avatar: event?.avatar,
            count: event?.count || 1,
            timestampMs: nowMs
        });
        if (combo) combos.push(combo);
        const tierChanges = getTierTransitions(prevState, state);
        if (tierChanges.length) transitions.push(...tierChanges);
        const payload = buildAwardPayload(state, nowMs);
        if (payload?.shouldProcess) {
            const normalized = {
                ...payload,
                visualOnly: visualOnlyForced || payload.visualOnly
            };
            awards.push(normalized);
            state = payload.nextState || state;
        }
    });

    return { state, combos, transitions, awards };
};

const run = () => {
    const events = [
        { type: 'lobby_play_wave', uid: 'a', userName: 'A', timestampMs: 1000 },
        { type: 'lobby_play_laser', uid: 'b', userName: 'B', timestampMs: 1700 },
        { type: 'lobby_play_echo', uid: 'c', userName: 'C', timestampMs: 2400 },
        { type: 'lobby_play_confetti', uid: 'd', userName: 'D', timestampMs: 3000 }
    ];
    const coordinated = ingestLobbyReactionEvents({ events });
    assert.equal(coordinated.state.streakCount, 4);
    assert.ok(coordinated.combos.some((combo) => combo.key === 'wave_laser'));
    assert.ok(coordinated.combos.some((combo) => combo.key === 'echo_confetti'));
    assert.ok(coordinated.transitions.some((transition) => transition.tier === 1));

    const payoutEvents = Array.from({ length: 28 }, (_, idx) => ({
        type: `lobby_play_${['wave', 'laser', 'echo', 'confetti'][idx % 4]}`,
        uid: `u${idx % 7}`,
        userName: `U${idx % 7}`,
        timestampMs: 10000 + (idx * 380)
    }));
    const payoutRun = ingestLobbyReactionEvents({ events: payoutEvents });
    assert.ok(payoutRun.awards.length > 0);
    assert.ok(payoutRun.awards.some((award) => award.visualOnly === false || award.awards.length === 0));
    payoutRun.awards.forEach((award) => {
        const recipientCount = Array.isArray(award.awards) ? award.awards.length : 0;
        assert.ok(recipientCount <= 6);
    });

    const forcedVisual = ingestLobbyReactionEvents({ events: payoutEvents, visualOnlyForced: true });
    assert.ok(forcedVisual.awards.length > 0);
    assert.equal(forcedVisual.awards.every((award) => award.visualOnly), true);

    const pausedRun = ingestLobbyReactionEvents({ events, paused: true });
    assert.equal(pausedRun.state.streakCount, 0);
    assert.equal(pausedRun.combos.length, 0);
    assert.equal(pausedRun.awards.length, 0);

    console.log('lobbyPlayground ingestion flow tests passed');
};

run();
