import { BG_TRACKS } from './gameDataConstants';

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
