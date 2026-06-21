import React, { useCallback, useEffect, useState, useRef } from 'react';
import { GAME_REGISTRY } from '../lib/gameRegistry';

const TV_VOICE_MIC_READY_KEY = 'beaurocks_tv_voice_mic_ready';

const GAME_RULES = {
    flappy_bird: {
        title: 'Pitch Runner',
        lines: [
            'Crowd mic first: one person calibrates, then the whole room can sing to steer.',
            'Keep the orb inside the glowing note gap, and use Breath if the room needs a reset.',
            'Missing a gate is not the end, because extra lives and host assist keep the run moving.'
        ]
    },
    vocal_challenge: {
        title: 'Vocal Challenge',
        lines: [
            'Watch the glowing note and sing with it together as it shifts.',
            'Near matches still score, so staying loud and close is better than going silent.',
            'Harmony Boost widens the lane when the room needs a confidence save.'
        ]
    },
    riding_scales: {
        title: 'Riding Scales',
        lines: [
            'First listen, then echo the pattern back note by note.',
            'The pattern ramps gently, and most misses turn into replays instead of hard fails.',
            'Scale Save gives the room another listen before the game takes a strike.'
        ]
    },
    team_pong: {
        title: 'Team Pong',
        lines: [
            'Phones are the controllers here, so tap when the ball reaches your side.',
            'Everyone on your team can help keep the rally alive.',
            'The longer the rally lasts, the more dramatic the finish gets.'
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
    const lastRulesRef = useRef(null);
    const showClose = view === 'mobile' && typeof props.onClose === 'function';
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
        const showTimer = setTimeout(() => setShowRules(true), 0);
        const hideTimer = setTimeout(() => setShowRules(false), 6000);
        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, [rulesToken]);

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
    const wantsLocalVoiceMic = view === 'tv'
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
    const [tvVoiceMicReady, setTvVoiceMicReady] = useState(() => !wantsLocalVoiceMic || readTvVoiceMicReady());
    const [tvVoiceMicPending, setTvVoiceMicPending] = useState(false);
    const [tvVoiceMicError, setTvVoiceMicError] = useState('');

    useEffect(() => {
        setTvVoiceMicReady(!wantsLocalVoiceMic || readTvVoiceMicReady());
        setTvVoiceMicPending(false);
        setTvVoiceMicError('');
    }, [wantsLocalVoiceMic, normalizedMode]);

    const requestTvVoiceMic = useCallback(async () => {
        if (!wantsLocalVoiceMic || tvVoiceMicPending) return;
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            setTvVoiceMicError('Mic unavailable on this browser');
            return;
        }
        setTvVoiceMicPending(true);
        setTvVoiceMicError('');
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = AudioCtx ? new AudioCtx() : null;
            if (ctx?.state === 'suspended') {
                await ctx.resume();
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            if (ctx && typeof ctx.close === 'function') {
                await ctx.close().catch(() => {});
            }
            try {
                window.sessionStorage?.setItem(TV_VOICE_MIC_READY_KEY, '1');
            } catch (_) {
                // Ignore storage failures and keep the session-local state only.
            }
            setTvVoiceMicReady(true);
        } catch (error) {
            setTvVoiceMicError('Enable mic on this TV to control the game');
            console.warn('TV voice mic prime failed', error);
        } finally {
            setTvVoiceMicPending(false);
        }
    }, [tvVoiceMicPending, wantsLocalVoiceMic]);

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
            {showRules && rulesConfig && (
                <div
                    className="absolute inset-0 z-[300] bg-black/80 flex items-center justify-center p-6"
                    onClick={() => setShowRules(false)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') setShowRules(false); }}
                >
                    <div className={`max-w-4xl w-full bg-zinc-900/90 border border-white/10 rounded-[2.5rem] p-10 text-center ${view === 'tv' ? 'shadow-[0_0_80px_rgba(34,211,238,0.3)]' : ''}`}>
                        <div className={`uppercase tracking-[0.4em] text-zinc-400 mb-3 ${view === 'tv' ? 'text-base' : 'text-sm'}`}>Game Rules</div>
                        <div className={`${view === 'tv' ? 'text-7xl' : 'text-4xl'} font-bebas text-cyan-300 mb-6`}>{rulesConfig.title}</div>
                        <div className={`space-y-4 text-zinc-100 ${view === 'tv' ? 'text-4xl' : 'text-lg'}`}>
                            {rulesConfig.lines.map((line, idx) => (
                                <div key={idx}>{line}</div>
                            ))}
                        </div>
                        <div className={`${view === 'tv' ? 'text-xl' : 'text-sm'} text-zinc-400 mt-6`}>Tap to continue</div>
                    </div>
                </div>
            )}
            {wantsLocalVoiceMic && !tvVoiceMicReady ? (
                <div className="absolute inset-0 z-[220] flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_24%),linear-gradient(180deg,#030712_0%,#020617_50%,#000000_100%)] p-6 text-white">
                    <div className="w-full max-w-2xl rounded-[2.5rem] border border-cyan-300/25 bg-black/70 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                        <div className="text-[11px] font-black uppercase tracking-[0.34em] text-cyan-200/80">TV Voice Control</div>
                        <div className="mt-4 text-4xl font-black tracking-tight text-white">
                            Enable room mic to start this voice game
                        </div>
                        <div className="mt-4 text-base leading-7 text-zinc-300">
                            This TV owns the room mic for crowd sing-along mode. Tap once on the TV device to grant microphone access, then the warmup rules and game will launch.
                        </div>
                        <button
                            type="button"
                            onClick={requestTvVoiceMic}
                            disabled={tvVoiceMicPending}
                            className={`mt-6 inline-flex items-center justify-center gap-3 rounded-full border border-cyan-300/40 bg-cyan-400/18 px-6 py-3 text-sm font-black uppercase tracking-[0.22em] text-cyan-50 ${tvVoiceMicPending ? 'cursor-not-allowed opacity-70' : 'hover:bg-cyan-400/28'}`}
                        >
                            <i className={`fa-solid ${tvVoiceMicPending ? 'fa-spinner fa-spin' : 'fa-microphone-lines'}`}></i>
                            {tvVoiceMicPending ? 'Enabling Mic...' : 'Enable Room Mic'}
                        </button>
                        {tvVoiceMicError ? (
                            <div className="mt-4 text-sm text-amber-200">
                                {tvVoiceMicError}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : (
                <GameComponent activeMode={activeMode} view={view} {...props} />
            )}
        </div>
    );
};

export default GameContainer;
