const extractYouTubeId = (input = '') => {
    if (!input) return '';
    const match = input.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
    return match ? match[1] : '';
};

const normalizeMediaUrl = (value = '') => (value || '').trim();

const buildYouTubeWatchUrl = (youtubeId = '') => {
    const safeId = String(youtubeId || '').trim();
    return safeId ? `https://www.youtube.com/watch?v=${safeId}` : '';
};

export const normalizeBackingChoice = ({ mediaUrl = '', appleMusicId = '', youtubeId: explicitYouTubeId = '' } = {}) => {
    const normalizedMediaUrl = normalizeMediaUrl(mediaUrl) || buildYouTubeWatchUrl(explicitYouTubeId);
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
    if (currentSong) return normalizeBackingChoice(currentSong).mediaUrl;
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

export const isQueueEntryPlayable = (song = {}, { appleMusicEnabled = true } = {}) => {
    const status = String(song?.mediaResolutionStatus || '').trim().toLowerCase();
    if (status === 'needs_backing' || status === 'pending_youtube_match') return false;
    if (song?.playbackReady === false) return false;
    const backing = normalizeBackingChoice(song || {});
    if (backing.usesAppleBacking) return !!appleMusicEnabled;
    return !!backing.mediaUrl;
};

export const isBackingPlaying = ({ usesAppleBacking = false, room, appleMusicPlaying = false } = {}) => {
    if (usesAppleBacking) {
        const status = (room?.appleMusicPlayback?.status || '').toLowerCase();
        return status === 'playing' || !!appleMusicPlaying;
    }
    const sessionState = String(room?.currentPerformanceSession?.playbackState || '').trim().toLowerCase();
    if (sessionState === 'paused' || sessionState === 'ended') return false;
    if (sessionState === 'playing') return true;
    return !!room?.videoPlaying && !room?.pausedAt;
};

const cleanPlaybackText = (value = '') => String(value || '').trim();

export const getBackingSourceLabel = ({ usesAppleBacking = false, mediaUrl = '', source = '', variant = 'full' } = {}) => {
    const normalizedSource = cleanPlaybackText(source).toLowerCase();
    const compact = variant === 'compact';
    if (usesAppleBacking || ['apple', 'apple_music', 'itunes'].includes(normalizedSource)) {
        return compact ? 'Apple full song' : 'Apple Music full song';
    }
    if (normalizedSource === 'youtube' || extractYouTubeId(mediaUrl)) {
        return compact ? 'YouTube backing' : 'YouTube karaoke backing';
    }
    if (mediaUrl || ['local', 'upload', 'canonical', 'known'].includes(normalizedSource)) {
        return 'Known backing';
    }
    return 'No backing';
};


const normalizePlaybackStatus = (value = '') => {
    const status = cleanPlaybackText(value).toLowerCase();
    if (status === 'playing' || status === 'paused' || status === 'ended') return status;
    return status || 'idle';
};

const getPlaybackStatusLabel = (status = '') => {
    if (status === 'playing') return 'Playing';
    if (status === 'paused') return 'Paused';
    if (status === 'ended') return 'Ended';
    return 'Ready';
};

const getPlaybackElapsedSec = ({ startedAt = 0, pausedAt = 0, status = '', nowMs = Date.now() } = {}) => {
    const safeStartedAt = Number(startedAt || 0);
    if (!safeStartedAt) return 0;
    const endAt = status === 'paused' && Number(pausedAt || 0) > 0
        ? Number(pausedAt || 0)
        : Number(nowMs || Date.now());
    return Math.max(0, Math.round((endAt - safeStartedAt) / 1000));
};

export const getAppleMusicPlaybackDisplay = ({ currentSong = null, room = null, nowMs = Date.now() } = {}) => {
    const playback = room?.appleMusicPlayback && typeof room.appleMusicPlayback === 'object'
        ? room.appleMusicPlayback
        : {};
    const currentBacking = normalizeBackingChoice(currentSong || {});
    const currentUsesApple = currentBacking.usesAppleBacking;
    const playbackId = cleanPlaybackText(playback?.id);
    const playbackType = cleanPlaybackText(playback?.type || (currentUsesApple ? 'song' : '')) || 'song';
    if (!currentUsesApple && !playbackId) {
        return { active: false };
    }

    const status = normalizePlaybackStatus(playback?.status || (playbackId ? 'playing' : 'idle'));
    const isPerformance = currentUsesApple || playbackType === 'song';
    const title = isPerformance
        ? (cleanPlaybackText(currentSong?.songTitle || currentSong?.title) || cleanPlaybackText(playback?.title) || 'Apple Music Track')
        : (cleanPlaybackText(playback?.title) || cleanPlaybackText(room?.appleMusicAutoPlaylistTitle) || 'Apple Music Playlist');
    const subtitle = isPerformance
        ? (cleanPlaybackText(currentSong?.artist || currentSong?.artistName) || cleanPlaybackText(playback?.artist) || 'Apple Music')
        : (playbackType === 'station' ? 'Apple Music station' : 'Background music');
    const durationSec = Math.max(0, Math.round(Number(
        playback?.durationSec
        || currentSong?.durationSec
        || currentSong?.duration
        || room?.currentPerformanceMeta?.durationSec
        || 0
    )));
    const elapsedSec = getPlaybackElapsedSec({
        startedAt: playback?.startedAt || room?.currentPerformanceMeta?.startedAtMs || 0,
        pausedAt: playback?.pausedAt || 0,
        status,
        nowMs
    });
    const progressPct = durationSec > 0
        ? Math.max(0, Math.min(100, Math.round((elapsedSec / durationSec) * 100)))
        : 0;

    return {
        active: true,
        type: playbackType,
        id: currentUsesApple ? cleanPlaybackText(currentSong?.appleMusicId) : playbackId,
        title,
        subtitle,
        status,
        statusLabel: getPlaybackStatusLabel(status),
        eyebrow: isPerformance ? 'Apple Music Backing' : 'Apple Music Background',
        detail: isPerformance ? 'Host-controlled Apple Music playback' : 'Auto-DJ background playlist',
        durationSec,
        elapsedSec,
        progressPct,
        isPerformance
    };
};
