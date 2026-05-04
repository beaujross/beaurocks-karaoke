export const TV_REACTION_LABELS = Object.freeze({
    fire: 'Hype',
    heart: 'Love',
    clap: 'Clap',
    drink: 'Cheers',
    rocket: 'Boost',
    diamond: 'Gem',
    money: 'Bloom',
    crown: 'Royal',
    strum: 'Strum'
});

export const getTvReactionLabel = (type = '') => {
    const key = String(type || '').trim().toLowerCase();
    if (key.startsWith('vote_')) return 'Vote';
    if (TV_REACTION_LABELS[key]) return TV_REACTION_LABELS[key];
    if (!key) return 'Reaction';
    return key
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

export const getTvReactionThemeKey = (type = '') => ({
    rocket: 'rocket',
    diamond: 'diamond',
    crown: 'crown',
    money: 'blossom',
    drink: 'drink',
    fire: 'fire',
    heart: 'heart',
    clap: 'clap'
}[String(type || '').trim().toLowerCase()] || 'default');

export const getTvReactionEmojiClass = (type = '') => ({
    rocket: 'reaction-emoji-rocket text-[clamp(2.75rem,9vw,8rem)]',
    diamond: 'reaction-emoji-diamond text-[clamp(3rem,9.5vw,9rem)]',
    crown: 'reaction-emoji-crown text-[clamp(3.25rem,10vw,10rem)]',
    money: 'reaction-emoji-blossom text-[clamp(3rem,9.5vw,9rem)]',
    drink: 'reaction-emoji-drink text-[clamp(2.5rem,8vw,6rem)]',
    fire: 'reaction-emoji-fire text-[clamp(2.5rem,8vw,6rem)]',
    heart: 'reaction-emoji-heart text-[clamp(2.5rem,8vw,6rem)]',
    clap: 'reaction-emoji-clap text-[clamp(2.5rem,8vw,6rem)]'
}[String(type || '').trim().toLowerCase()] || 'animate-float text-[clamp(2rem,6vw,4rem)]');

const hashTvMotionSeed = (value = '') => {
    const source = String(value || '');
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
        hash = ((hash << 5) - hash) + source.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash);
};

export const getTvReactionLaneLeft = ({ id = '', type = '', index = 0, wide = false } = {}) => {
    const seed = hashTvMotionSeed(`${type}:${id}:${index}:lane`);
    const lanes = wide ? [16, 26, 36, 46, 56, 66, 76] : [18, 28, 38, 48, 58, 66];
    const laneBase = lanes[seed % lanes.length];
    const jitter = ((seed % 7) - 3) * 1.35;
    return Math.max(12, Math.min(80, laneBase + jitter));
};

export const getTvReactionMotionSpec = ({ type = '', id = '', index = 0 } = {}) => {
    const key = String(type || '').trim().toLowerCase();
    const themeKey = getTvReactionThemeKey(key);
    const seed = hashTvMotionSeed(`${key}:${id}:${index}`);
    const direction = seed % 2 === 0 ? 1 : -1;
    const pick = (items = []) => items[seed % items.length];
    const base = {
        themeKey,
        variant: 'drift-right',
        durationMs: 11200 + (seed % 1800),
        driftX: 30 + (seed % 52),
        riseY: 116 + (seed % 112),
        rotateDeg: -6 + (seed % 13),
        scaleBoost: 1.04 + ((seed % 8) * 0.022),
        entryX: direction * (8 + (seed % 12)),
        entryY: 38 + (seed % 10),
        swayX: 10 + (seed % 16),
        swayY: 12 + (seed % 18),
        spinDeg: 8 + (seed % 20),
        exitScale: 0.92,
    };
    if (key === 'clap') {
        return {
            ...base,
            variant: 'applause',
            durationMs: 11800 + (seed % 1200),
            driftX: 10 + (seed % 14),
            riseY: 72 + (seed % 32),
            rotateDeg: -4 + (seed % 9),
            scaleBoost: 1.08 + ((seed % 5) * 0.024),
            entryX: direction * (4 + (seed % 6)),
            entryY: 48 + (seed % 8),
            swayX: 20 + (seed % 16),
            swayY: 14 + (seed % 10),
            spinDeg: 10 + (seed % 10),
            exitScale: 0.9
        };
    }
    if (key === 'heart') {
        return {
            ...base,
            variant: 'heart',
            durationMs: 12600 + (seed % 1200),
            driftX: 14 + (seed % 18),
            riseY: 88 + (seed % 36),
            rotateDeg: -8 + (seed % 17),
            scaleBoost: 1.1 + ((seed % 5) * 0.024),
            entryX: direction * (6 + (seed % 10)),
            entryY: 40 + (seed % 8),
            swayX: 18 + (seed % 14),
            swayY: 10 + (seed % 12),
            spinDeg: 10 + (seed % 12),
            exitScale: 0.94
        };
    }
    if (key === 'drink') {
        return {
            ...base,
            variant: 'cheers',
            durationMs: 11400 + (seed % 1200),
            driftX: 36 + (seed % 42),
            riseY: 82 + (seed % 42),
            rotateDeg: -10 + (seed % 21),
            entryX: direction * (24 + (seed % 14)),
            entryY: 44 + (seed % 10),
            swayX: 28 + (seed % 20),
            swayY: 18 + (seed % 14),
            spinDeg: 18 + (seed % 14),
            exitScale: 0.91
        };
    }
    if (key === 'money') {
        return {
            ...base,
            variant: 'blossom',
            durationMs: 12200 + (seed % 1000),
            driftX: 56 + (seed % 54),
            riseY: 84 + (seed % 36),
            rotateDeg: -14 + (seed % 29),
            scaleBoost: 1.1 + ((seed % 5) * 0.024),
            entryX: direction * (18 + (seed % 16)),
            entryY: 42 + (seed % 10),
            swayX: 34 + (seed % 24),
            swayY: 20 + (seed % 16),
            spinDeg: 24 + (seed % 16),
            exitScale: 0.9
        };
    }
    if (key === 'rocket') {
        return {
            ...base,
            variant: 'launch',
            durationMs: 11600 + (seed % 1000),
            driftX: 88 + (seed % 62),
            riseY: 156 + (seed % 54),
            rotateDeg: -18 + (seed % 37),
            scaleBoost: 1.16 + ((seed % 5) * 0.026),
            entryX: direction * (16 + (seed % 12)),
            entryY: 58 + (seed % 12),
            swayX: 14 + (seed % 10),
            swayY: 24 + (seed % 16),
            spinDeg: 30 + (seed % 18),
            exitScale: 0.88
        };
    }
    if (key === 'diamond') {
        return {
            ...base,
            variant: 'prism',
            durationMs: 13000 + (seed % 1200),
            driftX: 16 + (seed % 22),
            riseY: 92 + (seed % 36),
            rotateDeg: -6 + (seed % 13),
            scaleBoost: 1.14 + ((seed % 5) * 0.024),
            entryX: direction * (10 + (seed % 8)),
            entryY: 38 + (seed % 8),
            swayX: 16 + (seed % 12),
            swayY: 10 + (seed % 10),
            spinDeg: 40 + (seed % 26),
            exitScale: 0.95
        };
    }
    if (key === 'crown') {
        return {
            ...base,
            variant: 'royal',
            durationMs: 12800 + (seed % 1200),
            driftX: 18 + (seed % 20),
            riseY: 94 + (seed % 34),
            rotateDeg: -5 + (seed % 11),
            scaleBoost: 1.14 + ((seed % 5) * 0.024),
            entryX: direction * (4 + (seed % 6)),
            entryY: 46 + (seed % 8),
            swayX: 8 + (seed % 8),
            swayY: 14 + (seed % 10),
            spinDeg: 8 + (seed % 8),
            exitScale: 0.95
        };
    }
    if (key === 'fire') {
        return {
            ...base,
            variant: 'ember',
            durationMs: 11800 + (seed % 1000),
            driftX: 24 + (seed % 30),
            riseY: 138 + (seed % 52),
            rotateDeg: -8 + (seed % 17),
            scaleBoost: 1.16 + ((seed % 5) * 0.026),
            entryX: direction * (10 + (seed % 10)),
            entryY: 50 + (seed % 10),
            swayX: 24 + (seed % 18),
            swayY: 28 + (seed % 18),
            spinDeg: 16 + (seed % 18),
            exitScale: 0.88
        };
    }
    return { ...base, variant: pick(['drift-left', 'drift-right', 'hover', 'bounce']) };
};
