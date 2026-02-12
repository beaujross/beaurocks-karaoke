import React, { useEffect, useState, useRef } from 'react';
import { GAME_REGISTRY } from '../lib/gameRegistry';

const GAME_RULES = {
    flappy_bird: {
        title: 'Flappy Bird (Voice)',
        lines: [
            'Use your voice to fly: louder = up, quieter = down.',
            'Avoid the clefs and chase the high score.',
            'Stay steady to keep control.'
        ]
    },
    vocal_challenge: {
        title: 'Vocal Challenge',
        lines: [
            'Follow the melody notes as they change.',
            'Hold each pitch to build your streak.',
            'Smooth vocals = max points.'
        ]
    },
    riding_scales: {
        title: 'Riding Scales',
        lines: [
            'Listen to the sequence, then repeat it.',
            'The pattern grows each round.',
            'Three strikes and the round ends.'
        ]
    },
    bingo: {
        title: 'Bingo',
        lines: [
            'Watch the board on TV and tap to suggest a square.',
            'Mystery mode reveals the song + artist.',
            'First to line up wins.'
        ]
    },
    karaoke_bracket: {
        title: 'Sweet 16 Bracket',
        lines: [
            'Head-to-head karaoke matches decide each round.',
            'Match songs are pulled randomly from each singer Tight 15.',
            'Host advances winners until one champion remains.'
        ]
    },
    trivia_pop: {
        title: 'Trivia',
        lines: [
            'Pick the correct answer before the timer ends.',
            'Correct answers earn points and bragging rights.'
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
            'Vote for your favorite option.',
            'See the crowd split in real time.'
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

const GameContainer = ({ activeMode, rulesToken, view, ...props }) => {
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
                    Close
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
            <GameComponent activeMode={activeMode} view={view} {...props} />
        </div>
    );
};

export default GameContainer;
