import assert from 'node:assert/strict';
import {
    buildMissionDraftFromRoom,
    buildMissionPartyFromRoom,
    buildMissionPartyPayload,
    compileMissionDraftToRoomPayload,
    mergePayloadWithOverrides,
    getRecommendedHostAction,
    MISSION_FLOW_RULES
} from '../../src/apps/Host/missionControl.js';

const PRESETS = {
    casual: {
        id: 'casual',
        settings: {
            autoDj: true,
            autoBgMusic: true,
            autoPlayMedia: true,
            showVisualizerTv: true,
            showLyricsTv: false,
            showScoring: false,
            showFameLevel: false,
            allowSingerTrackSelect: true,
            marqueeEnabled: true,
            marqueeShowMode: 'idle',
            chatShowOnTv: false,
            chatTvMode: 'auto',
            bouncerMode: false,
            bingoShowTv: true,
            bingoVotingMode: 'host+votes',
            bingoAutoApprovePct: 45,
            bingoAudienceReopenEnabled: true,
            autoLyricsOnQueue: false,
            queueSettings: {
                limitMode: 'none',
                limitCount: 0,
                rotation: 'round_robin',
                firstTimeBoost: true
            },
            gameDefaults: {
                triviaRoundSec: 20,
                triviaAutoReveal: true,
                bingoVotingMode: 'host+votes',
                bingoAutoApprovePct: 45
            }
        }
    },
    competition: {
        id: 'competition',
        settings: {
            autoDj: false,
            autoBgMusic: false,
            autoPlayMedia: true,
            showVisualizerTv: false,
            showLyricsTv: true,
            showScoring: true,
            showFameLevel: true,
            allowSingerTrackSelect: false,
            marqueeEnabled: false,
            marqueeShowMode: 'idle',
            chatShowOnTv: false,
            chatTvMode: 'auto',
            bouncerMode: true,
            bingoShowTv: true,
            bingoVotingMode: 'host',
            bingoAutoApprovePct: 60,
            bingoAudienceReopenEnabled: true,
            autoLyricsOnQueue: true,
            queueSettings: {
                limitMode: 'per_night',
                limitCount: 2,
                rotation: 'round_robin',
                firstTimeBoost: false
            },
            gameDefaults: {
                triviaRoundSec: 15,
                triviaAutoReveal: true,
                bingoVotingMode: 'host',
                bingoAutoApprovePct: 60
            }
        }
    }
};

const run = () => {
    const fromRoom = buildMissionDraftFromRoom({
        hostNightPreset: 'competition',
        queueSettings: { limitMode: 'per_night', limitCount: 2, rotation: 'round_robin', firstTimeBoost: false },
        gamePreviewId: 'trivia_pop'
    });
    assert.equal(fromRoom.archetype, 'competition');
    assert.equal(fromRoom.flowRule, 'fair_turns');
    assert.equal(fromRoom.spotlightMode, 'trivia_pop');

    const compiledNoAi = compileMissionDraftToRoomPayload(
        {
            archetype: 'competition',
            flowRule: 'fair_turns',
            spotlightMode: 'trivia_pop',
            assistLevel: 'smart_assist'
        },
        { 'ai.generate_content': false },
        { presets: PRESETS, flowRules: MISSION_FLOW_RULES }
    );
    assert.equal(compiledNoAi.hostNightPreset, 'competition');
    assert.equal(compiledNoAi.queueSettings.limitMode, 'per_night');
    assert.equal(compiledNoAi.queueSettings.limitCount, 2);
    assert.equal(compiledNoAi.queueSettings.firstTimeBoost, false);
    assert.equal(compiledNoAi.autoLyricsOnQueue, false);
    assert.equal(compiledNoAi.gamePreviewId, 'trivia_pop');

    const compiledWithAi = compileMissionDraftToRoomPayload(
        {
            archetype: 'competition',
            flowRule: 'rapid_fire',
            spotlightMode: 'karaoke',
            assistLevel: 'smart_assist'
        },
        { 'ai.generate_content': true },
        { presets: PRESETS, flowRules: MISSION_FLOW_RULES }
    );
    assert.equal(compiledWithAi.queueSettings.limitMode, 'per_hour');
    assert.equal(compiledWithAi.queueSettings.rotation, 'first_come');
    assert.equal(compiledWithAi.autoLyricsOnQueue, true);
    assert.equal(compiledWithAi.gamePreviewId, null);

    const merged = mergePayloadWithOverrides(compiledWithAi, {
        'queueSettings.limitCount': 3,
        'showScoring': true
    });
    assert.equal(merged.queueSettings.limitCount, 3);
    assert.equal(merged.showScoring, true);

    const recModeration = getRecommendedHostAction({
        room: { activeMode: 'karaoke' },
        queue: [],
        current: null,
        pendingModerationCount: 2
    });
    assert.equal(recModeration.id, 'review_moderation');

    const recStart = getRecommendedHostAction({
        room: { activeMode: 'karaoke' },
        queue: [{ id: '1' }],
        current: null,
        pendingModerationCount: 0
    });
    assert.equal(recStart.id, 'start_next');

    const recHype = getRecommendedHostAction({
        room: { activeMode: 'bingo' },
        queue: [{ id: '1' }],
        current: { id: 'perf' },
        pendingModerationCount: 0
    });
    assert.equal(recHype.id, 'hype_moment');

    const partyFromRoom = buildMissionPartyFromRoom({
        missionControl: {
            party: {
                karaokeFirst: true,
                minSingingSharePct: 75,
                maxBreakDurationSec: 12,
                maxConsecutiveNonKaraokeModes: 1,
                state: {
                    singingMs: 120000,
                    groupMs: 20000
                }
            }
        }
    });
    assert.equal(partyFromRoom.karaokeFirst, true);
    assert.equal(partyFromRoom.minSingingSharePct, 75);
    assert.equal(partyFromRoom.maxBreakDurationSec, 12);
    assert.equal(partyFromRoom.state.singingMs, 120000);

    const defaultParty = buildMissionPartyPayload();
    assert.equal(defaultParty.karaokeFirst, true);
    assert.equal(defaultParty.minSingingSharePct, 70);
    assert.equal(defaultParty.maxConsecutiveNonKaraokeModes, 1);

    console.log('missionControl tests passed');
};

run();
