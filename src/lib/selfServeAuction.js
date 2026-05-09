export const getSelfServeAuctionState = (selfServeMode = null) => {
    const source = selfServeMode && typeof selfServeMode === 'object' ? selfServeMode : {};
    const auctionState = source?.auctionState && typeof source.auctionState === 'object' ? source.auctionState : {};
    const leaderboard = Array.isArray(auctionState.leaderboard)
        ? auctionState.leaderboard
            .map((entry, index) => ({
                uid: String(entry?.uid || '').trim(),
                singerName: String(entry?.singerName || 'Guest').trim() || 'Guest',
                songId: String(entry?.songId || '').trim(),
                songTitle: String(entry?.songTitle || 'Song').trim() || 'Song',
                amountCents: Math.max(0, Number(entry?.amountCents || 0) || 0),
                eventCount: Math.max(0, Number(entry?.eventCount || 0) || 0),
                qualifiedAtMs: Math.max(0, Number(entry?.qualifiedAtMs || 0) || 0),
                lastPurchaseAtMs: Math.max(0, Number(entry?.lastPurchaseAtMs || 0) || 0),
                queueIndex: Math.max(0, Number(entry?.queueIndex ?? index) || index),
                sourceProvider: String(entry?.sourceProvider || '').trim().toLowerCase(),
            }))
            .filter((entry) => entry.uid && entry.songId)
        : [];
    return {
        active: auctionState?.active !== false,
        syncedAtMs: Math.max(0, Number(auctionState?.syncedAtMs || 0) || 0),
        totalQualifiedSupporters: Math.max(0, Number(auctionState?.totalQualifiedSupporters || leaderboard.length) || leaderboard.length),
        summary: String(auctionState?.summary || '').trim(),
        leaderboard,
    };
};

export const getSelfServeAuctionLead = (selfServeMode = null) => {
    const state = getSelfServeAuctionState(selfServeMode);
    return state.leaderboard[0] || null;
};
