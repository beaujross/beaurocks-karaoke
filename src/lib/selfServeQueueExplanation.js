import {
    SELF_SERVE_FORMATS,
    getSelfServeAuctionWindow,
    isSelfServeAuctionWindowLive,
    normalizeSelfServeFormat,
} from './selfServeKaraoke.js';

const normalizeSingerKey = (song = {}) => {
    const singerUid = String(song?.singerUid || '').trim();
    if (singerUid) return `uid:${singerUid}`;
    const singerName = String(song?.singerName || '').trim().toLowerCase();
    return singerName ? `name:${singerName}` : '';
};

const countCompletedTurns = (songs = [], singerKey = '') => (
    (Array.isArray(songs) ? songs : []).filter((entry) => {
        if (!singerKey || normalizeSingerKey(entry) !== singerKey) return false;
        return String(entry?.status || '').trim().toLowerCase() === 'performed';
    }).length
);

export const buildSelfServeQueueExplanation = ({
    room = {},
    songs = [],
    queue = [],
    nextQueueSong = null,
} = {}) => {
    const selfServeMode = room?.selfServeMode?.enabled ? room.selfServeMode : null;
    if (!nextQueueSong) {
        return {
            shortLabel: 'Open slot',
            detail: selfServeMode
                ? 'No ready singer is locked yet. The room will auto-lock the next safe slot as soon as someone joins.'
                : 'No singer is ready yet.',
        };
    }

    const readyCount = Array.isArray(queue) ? queue.length : 0;
    const rotation = String(room?.queueSettings?.rotation || 'round_robin').trim().toLowerCase() || 'round_robin';
    const firstTimeBoost = room?.queueSettings?.firstTimeBoost !== false;
    const singerCompletedTurns = countCompletedTurns(songs, normalizeSingerKey(nextQueueSong));
    const format = normalizeSelfServeFormat(selfServeMode?.format || '');

    if (!selfServeMode) {
        return {
            shortLabel: 'Queue-first',
            detail: 'The next ready singer is first in the queue.',
        };
    }

    if (readyCount <= 1) {
        return {
            shortLabel: 'Auto-locked',
            detail: 'Only one ready singer is in queue, so the room auto-locked the next slot.',
        };
    }

    if (format === SELF_SERVE_FORMATS.spotlightAuction) {
        const auctionWindow = getSelfServeAuctionWindow(selfServeMode);
        if (selfServeMode?.paidPriorityEnabled === false && auctionWindow.closed) {
            return {
                shortLabel: 'Auction complete',
                detail: 'The Spotlight Auction opening block is finished, so the room has returned to fair rotation.',
            };
        }
        if (selfServeMode?.paidPriorityEnabled === false) {
            return {
                shortLabel: 'Paid priority off',
                detail: 'Spotlight Auction is live with paid priority disabled, so fair rotation is keeping the room moving.',
            };
        }
        if (isSelfServeAuctionWindowLive(selfServeMode)) {
            return {
                shortLabel: 'Auction live',
                detail: `Spotlight Auction is running for the opening ${auctionWindow.slotCount} slots, and any unmatched moments fall back to fair rotation.`,
            };
        }
        return {
            shortLabel: 'Fallback rotation',
            detail: 'No verified priority block is active yet, so Spotlight Auction is using fair rotation to keep the room moving.',
        };
    }

    if (format === SELF_SERVE_FORMATS.showcase) {
        return {
            shortLabel: 'Showcase order',
            detail: 'Showcase mode is controlling the next slot with its structured performance order.',
        };
    }

    if (rotation === 'round_robin' && firstTimeBoost && singerCompletedTurns === 0) {
        return {
            shortLabel: 'First-time boost',
            detail: 'Open Stage is using fair rotation, and this singer has not performed yet tonight.',
        };
    }

    if (rotation === 'first_come') {
        return {
            shortLabel: 'First come',
            detail: 'Open Stage is using first-come ordering for the next slot.',
        };
    }

    return {
        shortLabel: 'Fair rotation',
        detail: 'Open Stage is using round-robin queue order to keep the next slot fair.',
    };
};
