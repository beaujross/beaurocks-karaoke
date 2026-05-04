import { BG_TRACK_OPTIONS } from './bgTrackOptions.js';
import { getHostMomentCueMeta, HOST_MOMENT_CUES } from './hostMomentCues.js';

export const HOST_AUDIO_LIBRARY_CATEGORY_OPTIONS = Object.freeze([
    Object.freeze({ value: '', label: 'General Audio' }),
    Object.freeze({ value: 'sfx', label: 'SFX Library' }),
    Object.freeze({ value: 'bg', label: 'BG Music Library' }),
]);

export const HOST_AUDIO_MOMENT_CUE_OPTIONS = Object.freeze([
    Object.freeze({ value: '', label: 'No Auto Cue' }),
    ...HOST_MOMENT_CUES.map((cue) => Object.freeze({
        value: cue.id,
        label: cue.label,
    })),
]);

const HOST_AUDIO_LIBRARY_CATEGORY_SET = new Set(
    HOST_AUDIO_LIBRARY_CATEGORY_OPTIONS.map((option) => option.value)
);

export const normalizeHostAudioLibraryCategory = (value = '') => {
    const safeValue = String(value || '').trim().toLowerCase();
    return HOST_AUDIO_LIBRARY_CATEGORY_SET.has(safeValue) ? safeValue : '';
};

export const normalizeHostAudioMomentCueId = (value = '') => {
    const safeValue = String(value || '').trim().toLowerCase();
    return getHostMomentCueMeta(safeValue)?.id || '';
};

export const normalizeHostAudioLibraryItemMetadata = (item = {}) => {
    const audioLibraryCategory = normalizeHostAudioLibraryCategory(
        item?.audioLibraryCategory || item?.libraryCategory
    );
    const soundboardLabel = String(item?.soundboardLabel || '').trim();
    const hostMomentCueId = audioLibraryCategory === 'sfx'
        ? normalizeHostAudioMomentCueId(item?.hostMomentCueId)
        : '';
    const includeOnSoundboard = audioLibraryCategory === 'sfx'
        ? item?.includeOnSoundboard !== false
        : false;
    const bgAutoEligible = audioLibraryCategory === 'bg'
        ? item?.bgAutoEligible !== false
        : false;
    return {
        audioLibraryCategory,
        soundboardLabel,
        hostMomentCueId,
        includeOnSoundboard,
        bgAutoEligible,
    };
};

export const buildHostAudioUploadTrackId = (item = {}, index = 0) => {
    const rawId = String(item?.id || item?.storagePath || item?.url || '').trim();
    if (rawId) {
        return `upload_${rawId.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase()}`;
    }
    return `upload_audio_${Math.max(0, Number(index) || 0) + 1}`;
};

export const getHostAudioLibraryItemLabel = (item = {}) => {
    const metadata = normalizeHostAudioLibraryItemMetadata(item);
    return String(
        metadata.soundboardLabel
        || item?.title
        || item?.trackName
        || item?.fileName
        || 'Audio Upload'
    ).trim() || 'Audio Upload';
};

export const buildCustomBgTrackOption = (item = {}, index = 0) => {
    const metadata = normalizeHostAudioLibraryItemMetadata(item);
    if (metadata.audioLibraryCategory !== 'bg') return null;
    const url = String(item?.url || item?.mediaUrl || '').trim();
    if (!url) return null;
    return {
        id: buildHostAudioUploadTrackId(item, index),
        name: getHostAudioLibraryItemLabel(item),
        url,
        index: BG_TRACK_OPTIONS.length + Math.max(0, Number(index) || 0),
        sourceType: 'upload',
        sourceUploadId: String(item?.id || '').trim(),
        autoEligible: metadata.bgAutoEligible !== false,
    };
};

export const buildRoomBgTrackOptions = (items = []) => {
    const customTracks = (Array.isArray(items) ? items : [])
        .map((item, index) => buildCustomBgTrackOption(item, index))
        .filter(Boolean);
    return [...BG_TRACK_OPTIONS, ...customTracks];
};
