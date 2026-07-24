import React, { Suspense, useEffect, useState, useRef } from 'react';
import { GAME_REGISTRY } from '../lib/gameRegistry';

const TV_VOICE_MIC_READY_KEY = 'beaurocks_tv_voice_mic_ready';

const GameCartridgeFallback = ({ title = 'Loading game', view = '' }) => (
    <div
        className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_30%),#020617] p-6 text-white"
        data-feature-id="game-cartridge-loading"
        role="status"
    >
        <div className="rounded-3xl border border-cyan-300/25 bg-black/55 px-8 py-7 text-center shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-200">{view === 'tv' ? 'Loading for the room' : 'Getting the game ready'}</div>
            <div className="mt-3 text-3xl font-black">{title}</div>
        </div>
    </div>
);

const GAME_RULES = {
    flappy_bird: {
        title: 'Pitch Runner',
        lines: [
            'Crowd mic first: calibrate a low and high note, then the room steers by trend.',
            'Sing higher, lower, or hold steady to keep the orb inside the safe lane.',
            'Shields, Breath, and extra lives turn misses into recoverable checkpoints.'
        ]
    },
    vocal_challenge: {
        title: 'Vocal Challenge',
        lines: [
            'Follow the target ribbon and hold your voice inside the lane.',
            'Locked notes score big, close notes still recover the phrase.',
            'Harmony Boost widens the lane when the room needs a crowd save.'
        ]
    },
    riding_scales: {
        title: 'Riding Scales',
        lines: [
            'First listen to the sustained guide notes, then echo the pattern back note by note.',
            'Use the breath window between notes; close matches still count.',
            'Scale Save gives the room another listen before the game takes a strike.'
        ]
    },
    team_pong: {
        title: 'Team Pong',
        lines: [
            'Your phone controls your team paddle: Save returns the ball before it drops.',
            'First side to the rally goal wins; team hits move the score bar.',
            'Chant to widen the return window, then Spike or Redirect to swing momentum.'
        ]
    },
    musical_moments: {
        title: 'Musical Moments',
        lines: [
            'Watch the loop and feel where the big hit lands.',
            'Audience phones tap the hit; the Host room mic scores the vocal lift.',
            'Timing is forgiving, so crowd energy matters more than frame-perfect latency.'
        ]
    },
    bingo: {
        title: 'Bingo',
        lines: [
            'Watch the TV board and use your phone when the host asks for a pick or suggestion.',
            'Mystery mode reveals the song clue after the tile locks in.',
            'The goal is simple: complete the chosen pattern before the room does.'
        ]
    },
    karaoke_bracket: {
        title: 'Sweet 16 Bracket',
        lines: [
            'Head-to-head karaoke matches decide each round.',
            'Match songs are pulled randomly from each singer Tight 15.',
            'Audience can vote live, then host advances winners until one champion remains.'
        ]
    },
    trivia_pop: {
        title: 'Trivia',
        lines: [
            'Your phone is the controller, so lock an answer before the timer ends.',
            'Fast correct picks matter more than perfect strategy.'
        ]
    },
    trivia_reveal: {
        title: 'Trivia',
        lines: [
            'Pick the correct answer before the timer ends.',
            'Correct answers earn points and bragging rights.'
        ]
    },
    wyr: {
        title: 'Would You Rather',
        lines: [
            'Pick a side on your phone and commit once.',
            'The fun is watching the room split in real time.'
        ]
    },
    wyr_reveal: {
        title: 'Would You Rather',
        lines: [
            'Vote for your favorite option.',
            'See the crowd split in real time.'
        ]
    }
};

const GameContainer = ({ activeMode, rulesToken, view, closeLabel = 'Close', ...props }) => {
    // 1. Check if the current mode matches a registered game
    const GameComponent = GAME_REGISTRY[activeMode];
    const [showRules, setShowRules] = useState(false);
    const [launchCountdown, setLaunchCountdown] = useState(0);
    const lastRulesRef = useRef(null);
    const showClose = view === 'mobile' && typeof props.onClose === 'function';
    const isTv = view === 'tv';
    const normalizeMode = (mode) => {
        if (!mode) return null;
        if (mode.startsWith('trivia')) return 'trivia_pop';
        if (mode.startsWith('wyr')) return 'wyr';
        return mode;
    };

    useEffect(() => {
        if (!rulesToken) return;
        if (lastRulesRef.current === rulesToken) return;
        lastRulesRef.current = rulesToken;
        const showTimer = setTimeout(() => {
            setShowRules(true);
            setLaunchCountdown(isTv ? 3 : 0);
        }, 0);
        const countdownTimer = isTv ? setInterval(() => {
            setLaunchCountdown((value) => Math.max(0, value - 1));
        }, 1000) : null;
        const hideTimer = setTimeout(() => {
            setShowRules(false);
            setLaunchCountdown(0);
        }, isTv ? 3400 : 6000);
        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
            if (countdownTimer) clearInterval(countdownTimer);
        };
    }, [rulesToken, isTv]);

    // 3. If a game IS found, render it specifically
    // FIX: Explicitly pass activeMode down so the game knows its state
    const inputLabel = (() => {
        if (props.inputSource === 'ambient' || props.inputSource === 'local' || props.inputSource === 'crowd') {
            return 'Room mic';
        }
        if (props.inputSource === 'singer' || props.inputSource === 'turns') {
            return props.playerData?.playerName ? `${props.playerData.playerName} phone mic` : 'Phone mic';
        }
        return null;
    })();
    const normalizedMode = normalizeMode(activeMode);
    const voiceInputMode = String(props?.gameState?.voiceInput || props?.playerData?.voiceInput || '').trim().toLowerCase();
    const wantsLocalVoiceMic = voiceInputMode !== 'host'
        && view === 'tv'
        && props.isPlayer
        && ['flappy_bird', 'vocal_challenge', 'riding_scales'].includes(normalizedMode)
        && ['ambient', 'crowd', 'local'].includes(props.inputSource);
    const readTvVoiceMicReady = () => {
        if (typeof window === 'undefined') return false;
        try {
            return window.sessionStorage?.getItem(TV_VOICE_MIC_READY_KEY) === '1';
        } catch (_) {
            return false;
        }
    };
    const tvVoiceMicReady = !wantsLocalVoiceMic || readTvVoiceMicReady();

    const bingoMode = props?.gameState?.bingoMode || props?.playerData?.bingoMode || 'karaoke';
    const rulesConfig = (() => {
        if (!normalizedMode) return null;
        if (normalizedMode !== 'bingo') return GAME_RULES[normalizedMode] || null;
        if (bingoMode === 'mystery') {
            return {
                title: 'Mystery Bingo',
                lines: [
                    'One picker at a time locks one tile for this turn.',
                    'Locked pick reveals the song clue and queues the track.',
                    'Perform to pass the turn to the next picker.'
                ]
            };
        }
        return {
            title: 'Karaoke Bingo',
            lines: [
                'Spot moments on stage and suggest matching tiles.',
                'Host can approve suggestions or enable auto-approve votes.',
                'Complete line, corners, or blackout to trigger a win.'
            ]
        };
    })();

    if (!GameComponent) return null;

    return (
        <div className="absolute inset-0 z-[200] bg-black">
            {showClose && (
                <button
                    type="button"
                    onClick={props.onClose}
                    className="absolute top-6 right-6 z-[260] bg-black/70 border border-white/20 text-white px-4 py-2 rounded-full text-xs uppercase tracking-[0.35em] hover:border-cyan-300/60"
                    aria-label="Close game"
                >
                    {closeLabel}
                </button>
            )}
            {inputLabel && (
                <div className={`absolute top-6 left-6 z-[250] px-4 py-2 rounded-full text-xs uppercase tracking-[0.35em] border border-white/10 bg-black/70 text-white ${view === 'tv' ? 'text-sm' : ''}`}>
                    Input: {inputLabel}
                </div>
            )}
            {showRules && rulesConfig && (isTv ? (
                <div
                    className="pointer-events-none absolute inset-x-6 top-20 z-[300] flex justify-center"
                    role="status"
                    aria-live="polite"
                >
                    <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-cyan-300/25 bg-black/70 shadow-[0_18px_70px_rgba(0,0,0,0.42)] backdrop-blur-md">
                        <div className="flex items-stretch">
                            <div className="flex w-28 shrink-0 items-center justify-center bg-cyan-300 text-5xl font-black text-black">
                                {launchCountdown || 'GO'}
                            </div>
                            <div className="min-w-0 flex-1 px-6 py-4">
                                <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-100/80">Launch Countdown</div>
                                <div className="mt-1 text-4xl font-black text-white">{rulesConfig.title}</div>
                                <div className="mt-2 grid grid-cols-1 gap-1 text-lg text-zinc-100 md:grid-cols-3">
                                    {rulesConfig.lines.map((line, idx) => (
                                        <div key={idx} className="truncate rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">{line}</div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex w-44 shrink-0 items-center justify-center border-l border-white/10 px-4 text-center text-sm uppercase tracking-[0.22em] text-cyan-100">
                                Game visible now
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    className="absolute inset-0 z-[300] bg-black/80 flex items-center justify-center p-6"
                    onClick={() => setShowRules(false)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') setShowRules(false); }}
                >
                    <div className="max-w-4xl w-full bg-zinc-900/90 border border-white/10 rounded-[2.5rem] p-10 text-center">
                        <div className="uppercase tracking-[0.4em] text-zinc-400 mb-3 text-sm">Game Rules</div>
                        <div className="text-4xl font-bebas text-cyan-300 mb-6">{rulesConfig.title}</div>
                        <div className="space-y-4 text-zinc-100 text-lg">
                            {rulesConfig.lines.map((line, idx) => (
                                <div key={idx}>{line}</div>
                            ))}
                        </div>
                        <div className="text-sm text-zinc-400 mt-6">Tap to continue</div>
                    </div>
                </div>
            ))}
            {wantsLocalVoiceMic && !tvVoiceMicReady ? (
                <div className="absolute inset-0 z-[220] flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_24%),linear-gradient(180deg,#030712_0%,#020617_50%,#000000_100%)] p-6 text-white">
                    <div className="w-full max-w-2xl rounded-[2.5rem] border border-cyan-300/25 bg-black/70 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                        <div className="text-[11px] font-black uppercase tracking-[0.34em] text-cyan-200/80">Room Voice Control</div>
                        <div className="mt-4 text-4xl font-black tracking-tight text-white">
                            Room mic is waiting for host setup
                        </div>
                        <div className="mt-4 text-base leading-7 text-zinc-300">
                            Voice games should be armed from the host controls so the public TV can stay display-only. If this room still uses TV mic capture, grant mic access during host setup before launching.
                        </div>

                    </div>
                </div>
            ) : (
                <Suspense fallback={<GameCartridgeFallback title={rulesConfig?.title || 'Loading game'} view={view} />}>
                    <GameComponent activeMode={activeMode} view={view} {...props} />
                </Suspense>
            )}
        </div>
    );
};

export default GameContainer;
