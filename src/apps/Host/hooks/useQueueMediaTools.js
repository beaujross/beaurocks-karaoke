import { useCallback } from 'react';
import { callFunction } from '../../../lib/firebase';
import {
    isYouTubeQuotaBlockedError,
    searchYouTubeCatalog
} from '../../../lib/youtubeSearchClient';
import {
    YOUTUBE_PLAYBACK_STATUSES,
    getYouTubeEmbedCacheStatus,
    isYouTubeEmbeddable,
    normalizeYouTubePlaybackState
} from '../../../lib/youtubePlaybackStatus';

const useQueueMediaTools = ({
    roomCode,
    ytIndex,
    setYtIndex,
    persistYtIndex,
    ytSearchQ,
    setYtSearchQ,
    youtubeSearchMode = 'karaoke',
    setYtSearchOpen,
    setYtSearchTarget,
    setYtEditingQuery,
    setYtResults,
    setYtLoading,
    setYtSearchError,
    setEmbedCache
}) => {
    const parseYouTubeId = useCallback((url = '') => {
        const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
        return match ? match[1] : '';
    }, []);

    const getMediaDurationFromUrl = useCallback((url, audioOnly = false) => new Promise((resolve) => {
        if (!url || typeof document === 'undefined') return resolve(null);
        const media = document.createElement(audioOnly ? 'audio' : 'video');
        media.preload = 'metadata';
        media.crossOrigin = 'anonymous';
        const cleanup = () => {
            media.removeAttribute('src');
            media.load();
        };
        const timeout = setTimeout(() => {
            cleanup();
            resolve(null);
        }, 4000);
        media.onloadedmetadata = () => {
            clearTimeout(timeout);
            const duration = Number.isFinite(media.duration) ? Math.round(media.duration) : null;
            cleanup();
            resolve(duration);
        };
        media.onerror = () => {
            clearTimeout(timeout);
            cleanup();
            resolve(null);
        };
        media.src = url;
    }), []);

    const fetchYouTubeDuration = useCallback(async (url) => {
        const id = parseYouTubeId(url);
        if (!id) return null;
        try {
            const data = await callFunction('youtubeDetails', {
                ids: [id],
                roomCode,
                usageContext: { source: 'host_queue_media_duration_lookup' }
            });
            return data?.items?.[0]?.durationSec || null;
        } catch {
            return null;
        }
    }, [parseYouTubeId, roomCode]);

    const resolveDurationForUrl = useCallback(async (url, audioOnly = false) => {
        if (!url) return null;
        const ytId = parseYouTubeId(url);
        if (ytId) return fetchYouTubeDuration(url);
        return getMediaDurationFromUrl(url, audioOnly);
    }, [fetchYouTubeDuration, getMediaDurationFromUrl, parseYouTubeId]);

    const fetchEmbedStatuses = useCallback(async (videoIds = []) => {
        const ids = videoIds.filter(Boolean);
        if (!ids.length) return {};
        try {
            const data = await callFunction('youtubeStatus', {
                ids,
                roomCode,
                usageContext: { source: 'host_queue_media_embed_status' }
            });
            const statusMap = new Map();
            (data?.items || []).forEach(item => {
                statusMap.set(item.id, getYouTubeEmbedCacheStatus(item));
            });
            setEmbedCache(prev => {
                const next = { ...prev };
                ids.forEach(id => {
                    if (statusMap.has(id)) {
                        next[id] = statusMap.get(id);
                    } else if (next[id] === 'testing') {
                        delete next[id];
                    }
                });
                return next;
            });
            return ids.reduce((acc, id) => {
                if (statusMap.has(id)) acc[id] = statusMap.get(id);
                return acc;
            }, {});
        } catch (e) {
            console.error('Embed status fetch failed', e);
            setEmbedCache(prev => {
                const next = { ...prev };
                ids.forEach(id => {
                    if (next[id] === 'testing') delete next[id];
                });
                return next;
            });
            return null;
        }
    }, [roomCode, setEmbedCache]);

    const searchYouTubeIndex = useCallback((query) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return ytIndex
            .filter(item => {
                if (!isYouTubeEmbeddable(item)) return false;
                const title = (item.trackName || '').toLowerCase();
                const artist = (item.artistName || '').toLowerCase();
                return title.includes(q) || artist.includes(q);
            })
            .slice(0, 10)
            .map(item => ({
                id: item.videoId,
                title: item.trackName,
                channel: item.artistName || 'YouTube',
                thumbnail: item.artworkUrl100,
                url: item.url,
                playable: item.playable === true,
                embeddable: item.embeddable === true,
                uploadStatus: item.uploadStatus || '',
                privacyStatus: item.privacyStatus || '',
                youtubePlaybackStatus: item.youtubePlaybackStatus || '',
                backingAudioOnly: item.backingAudioOnly === true,
                sourceDetail: item.sourceDetail || ''
            }));
    }, [ytIndex]);

    const searchYouTube = useCallback(async (queryOverride) => {
        const query = (queryOverride ?? ytSearchQ).trim();
        if (!query) return;
        const directVideoId = parseYouTubeId(query);
        const searchMode = String(youtubeSearchMode || 'karaoke').toLowerCase() === 'any' ? 'any' : 'karaoke';
        const searchQuery = searchMode === 'karaoke' && !directVideoId ? `${query} karaoke` : query;
        const resultSourceDetail = searchMode === 'karaoke'
            ? 'YouTube karaoke search result. Verified to embed on Public TV.'
            : 'YouTube search result. Verified to embed on Public TV.';
        setYtLoading(true);
        setYtSearchError('');
        try {
            const data = directVideoId
                ? await callFunction('youtubeDetails', {
                    ids: [directVideoId],
                    roomCode,
                    usageContext: { source: 'host_queue_media_url_lookup', surface: 'host' }
                })
                : await searchYouTubeCatalog({
                    query: searchQuery,
                    maxResults: 10,
                    playableOnly: true,
                    roomCode,
                    usageSource: searchMode === 'karaoke' ? 'host_queue_media_search_karaoke' : 'host_queue_media_search_any',
                    usageSurface: 'host',
                    timeoutMs: 8000
                });
            const results = (data?.items || [])
                .map(item => {
                    const itemId = String(item?.id || directVideoId || '').trim();
                    if (!itemId) return null;
                    const playbackState = normalizeYouTubePlaybackState(item);
                    if (!isYouTubeEmbeddable(playbackState)) return null;
                    return {
                        id: itemId,
                        title: item.title || 'YouTube Track',
                        channel: item.channelTitle || item.channel || 'YouTube',
                        thumbnail: item.thumbnails?.medium?.url || item.thumbnails?.default?.url || '',
                        url: `https://www.youtube.com/watch?v=${itemId}`,
                        playable: playbackState.playable,
                        embeddable: playbackState.embeddable,
                        uploadStatus: playbackState.uploadStatus,
                        privacyStatus: playbackState.privacyStatus,
                        youtubePlaybackStatus: playbackState.youtubePlaybackStatus || YOUTUBE_PLAYBACK_STATUSES.embeddable,
                        backingAudioOnly: false,
                        durationSec: Math.max(0, Math.round(Number(item.durationSec || 0))),
                        sourceDetail: directVideoId ? 'Pasted YouTube URL. Verified to embed on Public TV.' : resultSourceDetail
                    };
                })
                .filter(Boolean);
            setYtResults(results);
            setEmbedCache(prev => {
                const next = { ...prev };
                results.forEach((item) => {
                    next[item.id] = getYouTubeEmbedCacheStatus(item);
                });
                return next;
            });
            if (!results.length) {
                setYtSearchError(
                    directVideoId
                        ? 'That YouTube link cannot play inside BeauRocks. Try another link.'
                        : 'No embeddable YouTube results found. Try a different keyword.'
                );
            }
            const updated = (() => {
                const existing = new Map(ytIndex.map(item => [item.videoId, item]));
                results.forEach(item => {
                    existing.set(item.id, {
                        videoId: item.id,
                        source: 'youtube',
                        trackName: item.title,
                        artistName: item.channel,
                        artworkUrl100: item.thumbnail,
                        url: item.url,
                        playable: item.playable === true,
                        embeddable: item.embeddable === true,
                        uploadStatus: item.uploadStatus || '',
                        privacyStatus: item.privacyStatus || '',
                        youtubePlaybackStatus: item.youtubePlaybackStatus || '',
                        backingAudioOnly: item.backingAudioOnly === true,
                        durationSec: item.durationSec || 0,
                        sourceDetail: item.sourceDetail || 'YouTube search result. Verified to embed on Public TV.'
                    });
                });
                return Array.from(existing.values());
            })();
            if (persistYtIndex) {
                persistYtIndex(updated);
            } else {
                setYtIndex(updated);
            }
        } catch (e) {
            console.error('YouTube search error:', e);
            const fallbackResults = searchYouTubeIndex(query);
            const code = String(e?.code || '').toLowerCase();
            const message = String(e?.message || '').trim();
            if (fallbackResults.length) {
                setYtResults(fallbackResults);
                setEmbedCache(prev => {
                    const next = { ...prev };
                    fallbackResults.forEach((item) => {
                        next[item.id] = getYouTubeEmbedCacheStatus(item);
                    });
                    return next;
                });
                setYtSearchError(
                    isYouTubeQuotaBlockedError(e)
                        ? 'Live YouTube search is paused because the YouTube quota is exhausted. Showing indexed embeddable results.'
                        : 'Live YouTube search failed. Showing indexed embeddable results.'
                );
            } else if (isYouTubeQuotaBlockedError(e)) {
                setYtSearchError('Live YouTube search is temporarily paused because the YouTube quota is exhausted. Use indexed tracks or paste a direct URL.');
            } else if (code.includes('permission-denied')) {
                setYtSearchError('Live YouTube search is currently unavailable for this account. Use indexed tracks or paste a direct URL.');
            } else {
                setYtSearchError(message || 'YouTube search failed. Check server configuration.');
            }
        } finally {
            setYtLoading(false);
        }
    }, [
        persistYtIndex,
        searchYouTubeIndex,
        setYtIndex,
        setYtLoading,
        setYtResults,
        setYtSearchError,
        roomCode,
        setEmbedCache,
        parseYouTubeId,
        ytIndex,
        ytSearchQ,
        youtubeSearchMode
    ]);

    const openYtSearch = useCallback((target, query) => {
        const nextQuery = (query || '').trim();
        setYtSearchTarget(target);
        setYtSearchQ(nextQuery);
        setYtSearchOpen(true);
        setYtEditingQuery(false);
        if (nextQuery) {
            setTimeout(() => searchYouTube(nextQuery), 0);
        }
    }, [
        searchYouTube,
        setYtEditingQuery,
        setYtSearchOpen,
        setYtSearchQ,
        setYtSearchTarget
    ]);

    return {
        parseYouTubeId,
        resolveDurationForUrl,
        searchYouTube,
        openYtSearch,
        fetchEmbedStatuses
    };
};

export default useQueueMediaTools;
