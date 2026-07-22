export const CURRENCY_IDS = Object.freeze({
    points: 'points',
    beaubucks: 'beaubucks',
    fame: 'fame',
});

export const CURRENCY_VISUALS = Object.freeze({
    points: Object.freeze({
        id: 'points',
        label: 'Points',
        shortLabel: 'PTS',
        iconText: 'P',
        textClass: 'text-cyan-50',
        mutedTextClass: 'text-cyan-100/70',
        borderClass: 'border-cyan-300/35',
        surfaceClass: 'bg-cyan-400/12',
        glowClass: 'shadow-[0_0_22px_rgba(34,211,238,0.2)]',
        gradientClass: 'from-cyan-300 to-sky-500',
    }),
    beaubucks: Object.freeze({
        id: 'beaubucks',
        label: 'BeauBucks',
        shortLabel: 'BB',
        iconText: 'B$',
        textClass: 'text-fuchsia-50',
        mutedTextClass: 'text-fuchsia-100/70',
        borderClass: 'border-fuchsia-300/40',
        surfaceClass: 'bg-fuchsia-500/14',
        glowClass: 'shadow-[0_0_24px_rgba(217,70,239,0.24)]',
        gradientClass: 'from-violet-400 via-fuchsia-400 to-pink-400',
    }),
    fame: Object.freeze({
        id: 'fame',
        label: 'Fame',
        shortLabel: 'FAME',
        iconText: '★',
        textClass: 'text-amber-50',
        mutedTextClass: 'text-amber-100/70',
        borderClass: 'border-amber-300/40',
        surfaceClass: 'bg-amber-400/12',
        glowClass: 'shadow-[0_0_22px_rgba(251,191,36,0.2)]',
        gradientClass: 'from-amber-200 via-yellow-400 to-orange-500',
    }),
});

export const getCurrencyVisual = (currency = 'points') => (
    CURRENCY_VISUALS[String(currency || '').trim().toLowerCase()] || CURRENCY_VISUALS.points
);
