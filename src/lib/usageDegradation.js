export const USAGE_CONTROL_REASON_CODES = Object.freeze({
    platformCircuitOpen: 'usage_platform_circuit_open',
    capabilityCircuitOpen: 'usage_capability_circuit_open',
    workspaceUnavailable: 'usage_workspace_unavailable',
    workspaceHardLimitReached: 'usage_workspace_hard_limit_reached',
    roomHardLimitReached: 'usage_room_hard_limit_reached',
});

const KNOWN_REASON_CODES = new Set(Object.values(USAGE_CONTROL_REASON_CODES));

const normalizeCapability = (value = '') => String(value || '').trim().toLowerCase();

export const readUsageControlReason = (error = null) => {
    const candidates = [
        error?.details?.reasonCode,
        error?.customData?.details?.reasonCode,
        error?.data?.reasonCode,
        error?.reasonCode,
    ];
    return candidates
        .map((value) => String(value || '').trim().toLowerCase())
        .find((value) => KNOWN_REASON_CODES.has(value)) || '';
};

export const isUsageControlBlockedError = (error = null) => !!readUsageControlReason(error);

export const getUsageDegradationMessage = ({ capabilityId = '', surface = 'host', reasonCode = '' } = {}) => {
    const capability = normalizeCapability(capabilityId);
    const audience = String(surface || '').trim().toLowerCase() === 'audience';
    const roomLimit = reasonCode === USAGE_CONTROL_REASON_CODES.roomHardLimitReached;
    const limitLabel = roomLimit ? 'This Room has reached its provider budget.' : 'Fresh provider requests are paused.';

    if (capability.startsWith('youtube')) {
        return audience
            ? `${limitLabel} You can still choose from the song catalog and available indexed tracks.`
            : `${limitLabel} Indexed tracks, the song catalog, and local media still work.`;
    }
    if (capability.startsWith('apple')) {
        return `${limitLabel} Cached lyrics, the song catalog, and manual lyric tools still work.`;
    }
    if (capability.startsWith('ai')) {
        return `${limitLabel} Cached content and manual Host controls still work.`;
    }
    return `${limitLabel} The queue, scoring, room controls, and Public TV playback still work.`;
};

export const getUsageDegradationMessageForError = (error = null, options = {}) => {
    const reasonCode = readUsageControlReason(error);
    if (!reasonCode) return '';
    const capabilityId = String(
        options.capabilityId
        || error?.details?.capabilityId
        || error?.customData?.details?.capabilityId
        || ''
    ).trim();
    return getUsageDegradationMessage({ ...options, capabilityId, reasonCode });
};
