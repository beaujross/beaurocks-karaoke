import { BG_TRACKS } from './gameDataConstants.js';

export const getBgTrackId = (name = '') => String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const BG_TRACK_OPTIONS = Object.freeze(
    (Array.isArray(BG_TRACKS) ? BG_TRACKS : []).map((track, index) => ({
        id: getBgTrackId(track?.name || `bg_track_${index + 1}`) || `bg_track_${index + 1}`,
        name: String(track?.name || `BG Track ${index + 1}`).trim() || `BG Track ${index + 1}`,
        url: String(track?.url || '').trim(),
        index,
    }))
);

export const getBgTrackById = (trackId = '') => {
    const safeTrackId = String(trackId || '').trim().toLowerCase();
    if (!safeTrackId) return null;
    return BG_TRACK_OPTIONS.find((track) => track.id === safeTrackId) || null;
};

export const getNextBgTrackIndex = (currentIndex = 0, trackCount = BG_TRACK_OPTIONS.length) => {
    const safeTrackCount = Math.max(0, Math.trunc(Number(trackCount) || 0));
    if (safeTrackCount <= 0) return 0;

    const numericIndex = Math.trunc(Number(currentIndex) || 0);
    const normalizedIndex = ((numericIndex % safeTrackCount) + safeTrackCount) % safeTrackCount;
    return (normalizedIndex + 1) % safeTrackCount;
};
