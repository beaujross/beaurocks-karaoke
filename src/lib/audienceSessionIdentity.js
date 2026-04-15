export const resolveAudienceSessionUid = ({
    authCurrentUid = '',
    authReadyUid = '',
    joinResultUid = '',
    routeUid = ''
} = {}) => {
    const candidates = [authCurrentUid, authReadyUid, joinResultUid, routeUid];
    for (const value of candidates) {
        const normalized = String(value || '').trim();
        if (normalized) return normalized;
    }
    return '';
};
