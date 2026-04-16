import React, { useMemo, useState } from 'react';
import GameContainer from '../../components/GameContainer';
import { FLAPPY_BIRD_TUNING, VOICE_GAME_FUN_DEFAULTS } from '../../games/vocalGameTuning';

const formatChip = (label, value) => (
    <div className="rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-200">
        <span className="text-zinc-500">{label}</span>{' '}
        <span className="text-white">{value}</span>
    </div>
);

const buildFixtures = (nowMs = Date.now()) => {
    const now = Number(nowMs || Date.now());
    return [
        {
            id: 'flappy_bird',
            title: 'Flappy Bird',
            subtitle: 'Static TV-state preview with the tuned thresholds and extra life budget visible.',
            chips: [
                formatChip('Lives', `${VOICE_GAME_FUN_DEFAULTS.flappyBird.lives}`),
                formatChip('Flap', `${Math.round(FLAPPY_BIRD_TUNING.flapThreshold * 100)}%`),
                formatChip('Shield', `${Math.round(FLAPPY_BIRD_TUNING.shieldThreshold * 100)}%`),
            ],
            gameState: {
                playerId: 'AMBIENT',
                playerName: 'THE CROWD',
                playerAvatar: 'O',
                inputSource: 'ambient',
                status: 'playing',
                score: 12,
                lives: VOICE_GAME_FUN_DEFAULTS.flappyBird.lives,
                birdY: 48,
                obstacles: [
                    { id: 'qa_ob_1', x: 58, gapTop: 18, gapHeight: 48 },
                    { id: 'qa_ob_2', x: 84, gapTop: 28, gapHeight: 46 },
                ],
                coins: [
                    { id: 'qa_coin_1', x: 66, y: 42 },
                ],
                voice: {
                    note: 'A',
                    confidence: 0.82,
                    volumeNormalized: 0.47,
                    stableNote: 'A',
                    stability: 0.76,
                    calibrating: false,
                },
                timestamp: now,
            },
        },
        {
            id: 'vocal_challenge',
            title: 'Vocal Challenge',
            subtitle: 'Near-match messaging, easy defaults, and the longer round pacing are locked in here.',
            chips: [
                formatChip('Default round', `${VOICE_GAME_FUN_DEFAULTS.vocalChallenge.durationSec}s`),
                formatChip('Default difficulty', VOICE_GAME_FUN_DEFAULTS.vocalChallenge.difficulty),
                formatChip('Guide tone', VOICE_GAME_FUN_DEFAULTS.vocalChallenge.guideTone ? 'on' : 'off'),
            ],
            gameState: {
                playerId: 'AMBIENT',
                playerName: 'THE CROWD',
                inputSource: 'ambient',
                mode: 'crowd',
                phase: 'playing',
                score: 88,
                streak: 4,
                difficulty: VOICE_GAME_FUN_DEFAULTS.vocalChallenge.difficulty,
                guideTone: VOICE_GAME_FUN_DEFAULTS.vocalChallenge.guideTone,
                sequence: ['C', 'E', 'D', 'F', 'E'],
                targetIndex: 1,
                targetNote: 'E',
                detectedNote: 'D',
                nextNoteAt: now + 3000,
                lastTargetChangeAt: now - 1200,
                turnEndsAt: now + 21000,
                assistUntil: 0,
                lastUpdated: now,
                voice: {
                    note: 'D',
                    confidence: 0.74,
                    volumeNormalized: 0.33,
                    stableNote: 'D',
                    stability: 0.6,
                    calibrating: false,
                },
                timestamp: now,
            },
        },
        {
            id: 'riding_scales',
            title: 'Riding Scales',
            subtitle: 'Replay-friendly crowd mode with the extra strike room and assist buffer visible.',
            chips: [
                formatChip('Default round', `${VOICE_GAME_FUN_DEFAULTS.ridingScales.durationSec}s`),
                formatChip('Max strikes', `${VOICE_GAME_FUN_DEFAULTS.ridingScales.maxStrikes}`),
                formatChip('Round reward', `${VOICE_GAME_FUN_DEFAULTS.ridingScales.rewardPerRound} pts`),
            ],
            gameState: {
                playerId: 'GROUP',
                playerName: 'THE CROWD',
                inputSource: 'crowd',
                mode: 'crowd',
                phase: 'input',
                round: 3,
                bestRound: 3,
                strikes: 1,
                difficulty: VOICE_GAME_FUN_DEFAULTS.ridingScales.difficulty,
                guideTone: VOICE_GAME_FUN_DEFAULTS.ridingScales.guideTone,
                maxStrikes: VOICE_GAME_FUN_DEFAULTS.ridingScales.maxStrikes,
                rewardPerRound: VOICE_GAME_FUN_DEFAULTS.ridingScales.rewardPerRound,
                sequence: ['C', 'D', 'E', 'F'],
                playbackIndex: 2,
                inputIndex: 2,
                nextAt: now + 2600,
                lastNoteAdvanceAt: now - 1200,
                assistUntil: 0,
                assistCharges: 1,
                detectedNote: 'E',
                lastUpdated: now,
                timestamp: now,
            },
        },
    ];
};

const VoiceGamePanel = ({ fixture, roomCode = '', index = 0 }) => {
    const [rulesToken] = useState(() => index + 1);
    const room = useMemo(() => ({
        roomCode,
        activeMode: fixture.id,
        gameRulesId: rulesToken,
    }), [fixture.id, roomCode, rulesToken]);

    return (
        <section
            data-voice-game-qa-panel={fixture.id}
            className="rounded-[28px] border border-white/10 bg-zinc-950/85 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
        >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                    <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/75">Voice Game QA</div>
                    <div className="mt-2 text-3xl font-black tracking-tight text-white">{fixture.title}</div>
                    <div className="mt-2 text-sm text-zinc-400">{fixture.subtitle}</div>
                </div>
                <div className="flex flex-wrap gap-2" data-voice-game-qa-chips={fixture.id}>
                    {fixture.chips.map((chip, chipIndex) => (
                        <React.Fragment key={`${fixture.id}_chip_${chipIndex}`}>{chip}</React.Fragment>
                    ))}
                </div>
            </div>
            <div
                data-voice-game-qa-frame={fixture.id}
                className="relative h-[640px] overflow-hidden rounded-[24px] border border-white/10 bg-black"
            >
                <GameContainer
                    activeMode={fixture.id}
                    roomCode={roomCode}
                    gameState={fixture.gameState}
                    playerData={fixture.gameState}
                    room={room}
                    user={{ uid: 'qa_voice_guest', name: 'QA Guest', avatar: 'O' }}
                    users={[]}
                    isPlayer={false}
                    inputSource="remote"
                    rulesToken={rulesToken}
                    view="tv"
                />
            </div>
        </section>
    );
};

export default function VoiceGamesQaHarness({ roomCode = 'DEMOVOICE' }) {
    const fixtures = useMemo(() => buildFixtures(Date.now()), []);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_22%),linear-gradient(180deg,#020617_0%,#09090b_50%,#020617_100%)] px-6 py-8 text-white">
            <div
                className="mx-auto max-w-[1520px]"
                data-voice-games-qa-ready="true"
                data-voice-games-qa-room={roomCode}
            >
                <div className="mb-6 rounded-[28px] border border-white/10 bg-black/35 px-6 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                    <div className="text-[11px] uppercase tracking-[0.34em] text-cyan-200/75">Local Playwright Harness</div>
                    <div className="mt-2 text-4xl font-black tracking-tight text-white">Voice Games Fun Pass</div>
                    <div className="mt-3 max-w-3xl text-sm text-zinc-300">
                        Real game components, frozen fixture state, no live room dependency. Each panel opens with the player rules visible first, then the live game frame sits behind it for follow-up assertions.
                    </div>
                </div>

                <div className="space-y-6">
                    {fixtures.map((fixture, index) => (
                        <VoiceGamePanel
                            key={fixture.id}
                            fixture={fixture}
                            roomCode={roomCode}
                            index={index}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
