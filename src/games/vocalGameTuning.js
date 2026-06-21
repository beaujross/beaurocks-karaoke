const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const VOICE_GAME_FUN_DEFAULTS = Object.freeze({
    flappyBird: {
        lives: 5,
        difficulty: 'easy'
    },
    vocalChallenge: {
        durationSec: 50,
        difficulty: 'easy',
        guideTone: true
    },
    ridingScales: {
        durationSec: 50,
        maxStrikes: 6,
        rewardPerRound: 50,
        difficulty: 'easy',
        guideTone: true
    }
});

export const FLAPPY_BIRD_TUNING = Object.freeze({
    flapThreshold: 0.22,
    flapResetThreshold: 0.09,
    spikeThreshold: 0.035,
    glideThreshold: 0.11,
    shieldThreshold: 0.42,
    baseGravity: 0.15,
    flapForce: -5.2,
    minSpawnMs: 1850,
    startGraceMs: 3600,
    startCountdownMs: 1400,
    warmupFlightMs: 3200,
    firstObstacleDelayMs: 4200,
    hostAssistDefaultMs: 4800,
    hostAssistBannerMs: 2400,
    hostAssistLift: 11,
    invincibleMs: 2600,
    stableBoostThreshold: 0.42,
    speedBoostPerFrame: 0.28,
    speedNormalPerFrame: 0.36,
    crowdGapForgiveness: 8,
    soloGapForgiveness: 6,
    initialRecoveryVelocity: -3.2
});

export const getVocalChallengeDifficultyConfig = (difficulty = 'easy', { crowdMode = false } = {}) => {
    if (difficulty === 'hard') {
        return crowdMode
            ? { intervalMs: 1850, holdMs: 115, minConfidence: 0.24, minStability: 0.14 }
            : { intervalMs: 1650, holdMs: 125, minConfidence: 0.3, minStability: 0.2 };
    }
    if (difficulty === 'standard') {
        return crowdMode
            ? { intervalMs: 2200, holdMs: 95, minConfidence: 0.19, minStability: 0.08 }
            : { intervalMs: 1950, holdMs: 105, minConfidence: 0.25, minStability: 0.14 };
    }
    return crowdMode
        ? { intervalMs: 2550, holdMs: 80, minConfidence: 0.14, minStability: 0.05 }
        : { intervalMs: 2250, holdMs: 92, minConfidence: 0.19, minStability: 0.1 };
};

export const getVocalChallengeSequenceLength = (difficulty = 'easy') => {
    if (difficulty === 'hard') return 9;
    if (difficulty === 'standard') return 6;
    return 4;
};

export const getRidingScalesStepMs = (round = 1, difficulty = 'easy') => {
    const baseByDifficulty = {
        easy: 1800,
        standard: 1650,
        hard: 1450
    };
    const base = clamp((baseByDifficulty[difficulty] || 1650) - (Math.max(0, Number(round || 1) - 1) * 40), 820, 1850);
    const jitter = Math.floor((Math.random() * 160) - 80);
    return clamp(base + jitter, 760, 1900);
};

export const buildRidingScalesStepMsList = (length = 3, round = 1, difficulty = 'easy') =>
    Array.from({ length }, () => getRidingScalesStepMs(round, difficulty));

export const getRidingScalesLengthIncrement = (round = 1, difficulty = 'easy') => {
    if (difficulty === 'hard') {
        return round < 3 ? 1 : (round % 2 === 0 ? 2 : 1);
    }
    if (difficulty === 'standard') {
        return round < 5 ? 1 : (round % 3 === 0 ? 2 : 1);
    }
    return 1;
};

export const getRidingScalesHoldMs = (difficulty = 'easy') => {
    if (difficulty === 'hard') return 150;
    if (difficulty === 'standard') return 120;
    return 95;
};
