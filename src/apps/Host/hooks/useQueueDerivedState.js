import { useMemo } from 'react';
import {
    getBackingSourceLabel,
    isBackingPlaying,
    normalizeBackingChoice,
    resolveStageMediaUrl
} from '../../../lib/playbackSource';

const formatWaitTime = (seconds) => {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remMins}m`;
    return `${mins}m`;
};

const useQueueDerivedState = ({ songs, room, users, appleMusicPlaying }) => {
    const safeSongs = useMemo(() => (Array.isArray(songs) ? songs : []), [songs]);
    const safeUsers = useMemo(() => (Array.isArray(users) ? users : []), [users]);

    const current = useMemo(
        () => safeSongs.find(s => s.status === 'performing'),
        [safeSongs]
    );
    const hasLyrics = !!current?.lyrics || (Array.isArray(current?.lyricsTimed) && current.lyricsTimed.length > 0);
    const queue = useMemo(
        () => safeSongs
            .filter(s => s.status === 'requested')
            .sort((a, b) => (a.priorityScore || 0) - (b.priorityScore || 0)),
        [safeSongs]
    );
    const pending = useMemo(
        () => safeSongs.filter(s => s.status === 'pending'),
        [safeSongs]
    );
    const lobbyCount = safeUsers.length;
    const queueCount = queue.length;
    const waitTimeSec = useMemo(() => queue.reduce((sum, s) => {
        const duration = Number(s.duration);
        return sum + (Number.isFinite(duration) && duration > 0 ? duration : 300);
    }, 0), [queue]);

    const currentMediaUrl = resolveStageMediaUrl(current, room);
    const currentBacking = normalizeBackingChoice({
        mediaUrl: currentMediaUrl,
        appleMusicId: current?.appleMusicId
    });
    const currentUsesAppleBacking = currentBacking.usesAppleBacking;
    const currentSourcePlaying = isBackingPlaying({
        usesAppleBacking: currentUsesAppleBacking,
        room,
        appleMusicPlaying
    });
    const currentSourceLabel = getBackingSourceLabel({
        usesAppleBacking: currentUsesAppleBacking,
        mediaUrl: currentMediaUrl
    });
    const currentSourceToneClass = currentUsesAppleBacking
        ? 'text-emerald-300'
        : currentBacking.isYouTube
            ? 'text-red-300'
            : currentMediaUrl
                ? 'text-cyan-200'
                : 'text-zinc-400';

    return {
        current,
        hasLyrics,
        queue,
        pending,
        lobbyCount,
        queueCount,
        waitTimeSec,
        formatWaitTime,
        currentMediaUrl,
        currentUsesAppleBacking,
        currentSourcePlaying,
        currentSourceLabel,
        currentSourceToneClass
    };
};

export default useQueueDerivedState;
