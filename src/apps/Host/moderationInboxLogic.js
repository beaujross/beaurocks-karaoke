const nowMs = () => Date.now();

const toMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
};

export const buildModerationQueueSnapshot = ({
    doodleRequireReview = false,
    selfieRequireApproval = false,
    approvedUids = [],
    doodleSubmissions = [],
    selfieSubmissions = [],
    bingoSuggestions = {},
    bingoRevealed = {}
} = {}) => {
    const approvedUidSet = new Set(Array.isArray(approvedUids) ? approvedUids.filter(Boolean) : []);
    const pendingDoodles = doodleRequireReview
        ? (Array.isArray(doodleSubmissions) ? doodleSubmissions : []).filter((submission) => submission?.uid && !approvedUidSet.has(submission.uid))
        : [];
    const pendingSelfies = selfieRequireApproval
        ? (Array.isArray(selfieSubmissions) ? selfieSubmissions : []).filter((submission) => !submission?.approved)
        : [];
    const pendingBingoSuggestions = Object.entries(bingoSuggestions || {})
        .map(([rawIdx, suggestion]) => ({
            idx: Number(rawIdx),
            count: Number(suggestion?.count || 0),
            note: suggestion?.lastNote || '',
            lastAtMs: toMs(suggestion?.lastAt)
        }))
        .filter((entry) => Number.isFinite(entry.idx) && entry.count > 0 && !bingoRevealed?.[entry.idx])
        .sort((a, b) => (b.lastAtMs || 0) - (a.lastAtMs || 0));

    const doodleItems = pendingDoodles.map((submission) => ({
        key: `doodle-${submission.id}`,
        type: 'doodle',
        timestamp: toMs(submission?.timestamp),
        title: submission?.name || 'Guest sketch',
        subtitle: 'Doodle-oke submission awaiting review',
        image: submission?.image || null,
        submission
    }));
    const selfieItems = pendingSelfies.map((submission) => ({
        key: `selfie-${submission.id}`,
        type: 'selfie',
        timestamp: toMs(submission?.timestamp),
        title: submission?.userName || submission?.name || 'Guest selfie',
        subtitle: 'Selfie Challenge submission awaiting approval',
        image: submission?.url || null,
        submission
    }));
    const bingoItems = pendingBingoSuggestions.map((suggestion) => ({
        key: `bingo-${suggestion.idx}`,
        type: 'bingo',
        timestamp: suggestion.lastAtMs || 0,
        title: `Bingo Tile #${suggestion.idx + 1}`,
        subtitle: `${suggestion.count} vote${suggestion.count === 1 ? '' : 's'} from audience`,
        suggestion
    }));
    const queueItems = [...doodleItems, ...selfieItems, ...bingoItems]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 24);

    const oldestPendingAt = queueItems.length
        ? queueItems.reduce((minValue, item) => {
            const value = Number(item?.timestamp || 0);
            if (!value) return minValue;
            if (!minValue) return value;
            return Math.min(minValue, value);
        }, 0)
        : 0;

    return {
        queueItems,
        counts: {
            totalPending: pendingDoodles.length + pendingSelfies.length + pendingBingoSuggestions.length,
            doodlePending: pendingDoodles.length,
            selfiePending: pendingSelfies.length,
            bingoPending: pendingBingoSuggestions.length
        },
        oldestPendingAt
    };
};

export const deriveModerationSeverity = ({
    totalPending = 0,
    oldestPendingAt = 0,
    now = nowMs(),
    staleMs = 120000,
    criticalMs = 300000,
    criticalCount = 6,
    staleCount = 3
} = {}) => {
    const pending = Math.max(0, Number(totalPending || 0));
    if (!pending) return 'idle';
    const oldest = Number(oldestPendingAt || 0);
    const ageMs = oldest > 0 ? Math.max(0, now - oldest) : 0;
    if (pending >= criticalCount || ageMs >= criticalMs) return 'critical';
    if (pending >= staleCount || ageMs >= staleMs) return 'stale';
    return 'active';
};

export const moderationNeedsAttention = (severity = 'idle') =>
    severity === 'stale' || severity === 'critical';
