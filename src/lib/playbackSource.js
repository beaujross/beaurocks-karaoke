const extractYouTubeId = (input = '') => {
    if (!input) return '';
    const match = input.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
    return match ? match[1] : '';
};

const normalizeMediaUrl = (value = '') => (value || '').trim();

export const normalizeBackingChoice = ({ mediaUrl = '', appleMusicId = '' } = {}) => {
    const normalizedMediaUrl = normalizeMediaUrl(mediaUrl);
    const normalizedAppleMusicId = normalizedMediaUrl ? '' : String(appleMusicId || '');
    const youtubeId = extractYouTubeId(normalizedMediaUrl);
    return {
        mediaUrl: normalizedMediaUrl,
        appleMusicId: normalizedAppleMusicId,
        usesAppleBacking: !normalizedMediaUrl && !!normalizedAppleMusicId,
        youtubeId,
        isYouTube: !!youtubeId
    };
};

export const resolveStageMediaUrl = (currentSong, room) => {
    if (currentSong) return normalizeMediaUrl(currentSong.mediaUrl);
    return normalizeMediaUrl(room?.mediaUrl);
};

export const resolveQueuePlayback = (song, autoPlayEnabled = true) => {
    const backing = normalizeBackingChoice(song || {});
    const hasMedia = !!(backing.mediaUrl || backing.usesAppleBacking);
    return {
        ...backing,
        hasMedia,
        autoStartMedia: hasMedia && !!autoPlayEnabled
    };
};

export const isBackingPlaying = ({ usesAppleBacking = false, room, appleMusicPlaying = false } = {}) => {
    if (usesAppleBacking) {
        const status = (room?.appleMusicPlayback?.status || '').toLowerCase();
        return status === 'playing' || !!appleMusicPlaying;
    }
    return !!room?.videoPlaying;
};

export const getBackingSourceLabel = ({ usesAppleBacking = false, mediaUrl = '' } = {}) => {
    if (usesAppleBacking) return 'Apple Music';
    if (extractYouTubeId(mediaUrl)) return 'YouTube';
    if (mediaUrl) return 'Local';
    return 'No backing';
};
