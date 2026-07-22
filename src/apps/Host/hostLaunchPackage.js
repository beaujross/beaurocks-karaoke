const normalizeLaunchUrl = (value = '') => String(value || '').trim();

const buildLaunchMessage = ({ applied, tvReady, tvOpened, joinLinkReady, joinLinkCopied }) => {
    if (!applied) {
        return 'Room setup was not saved. Review Tonight Setup and try again.';
    }
    if (tvOpened && joinLinkCopied) {
        return 'Room launched: Public TV opened and the Audience App link was copied.';
    }
    if (!tvReady && !joinLinkReady) {
        return 'Room is ready, but its Public TV and Audience App links are unavailable. Reopen the Room from Host Dashboard and try again.';
    }
    if (!tvOpened && !joinLinkCopied) {
        return 'Room is ready. Open Public TV and copy the Audience App link from Host Dashboard.';
    }
    if (!tvOpened) {
        return tvReady
            ? 'Room is ready and the Audience App link was copied. Your browser blocked Public TV; use Launch TV in Host Dashboard.'
            : 'Room is ready and the Audience App link was copied. Public TV is unavailable right now.';
    }
    return joinLinkReady
        ? 'Room is ready and Public TV opened. Copy the Audience App link from Host Dashboard.'
        : 'Room is ready and Public TV opened. The Audience App link is unavailable right now.';
};

export const runRoomLaunchPackage = async ({
    roomCode = '',
    tvUrl = '',
    audienceUrl = '',
    applySetup,
    openPublicTv,
    copyAudienceLink,
} = {}) => {
    const normalizedRoomCode = String(roomCode || '').trim().toUpperCase();
    const normalizedTvUrl = normalizeLaunchUrl(tvUrl);
    const normalizedAudienceUrl = normalizeLaunchUrl(audienceUrl);
    const result = {
        ok: false,
        applied: false,
        roomCode: normalizedRoomCode,
        tvReady: !!normalizedTvUrl,
        tvOpened: false,
        joinLinkReady: !!normalizedAudienceUrl,
        joinLinkCopied: false,
        needsRecovery: true,
        message: '',
    };

    if (!normalizedRoomCode || typeof applySetup !== 'function') {
        result.message = 'Open a Room before launching.';
        return result;
    }

    if (normalizedTvUrl && typeof openPublicTv === 'function') {
        try {
            result.tvOpened = await openPublicTv(normalizedTvUrl) === true;
        } catch (_error) {
            result.tvOpened = false;
        }
    }

    try {
        result.applied = await applySetup() === true;
    } catch (_error) {
        result.applied = false;
    }

    if (!result.applied) {
        result.message = buildLaunchMessage(result);
        return result;
    }

    if (normalizedAudienceUrl && typeof copyAudienceLink === 'function') {
        try {
            result.joinLinkCopied = await copyAudienceLink(normalizedAudienceUrl) === true;
        } catch (_error) {
            result.joinLinkCopied = false;
        }
    }

    result.ok = true;
    result.needsRecovery = !result.tvOpened || !result.joinLinkCopied;
    result.message = buildLaunchMessage(result);
    return result;
};

export default runRoomLaunchPackage;
