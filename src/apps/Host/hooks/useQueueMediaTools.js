import { useCallback } from 'react';
import { callFunction } from '../../../lib/firebase';

const useQueueMediaTools = ({
    ytIndex,
    setYtIndex,
    persistYtIndex,
    ytSearchQ,
    setYtSearchQ,
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
            const data = await callFunction('youtubeDetails', { ids: [id] });
            return data?.items?.[0]?.durationSec || null;
        } catch {
            return null;
        }
    }, [parseYouTubeId]);

    const resolveDurationForUrl = useCallback(async (url, audioOnly = false) => {
        if (!url) return null;
        const ytId = parseYouTubeId(url);
        if (ytId) return fetchYouTubeDuration(url);
        return getMediaDurationFromUrl(url, audioOnly);
    }, [fetchYouTubeDuration, getMediaDurationFromUrl, parseYouTubeId]);

    const fetchEmbedStatuses = useCallback(async (videoIds = []) => {
        const ids = videoIds.filter(Boolean);
        if (!ids.length) return;
        try {
            const data = await callFunction('youtubeStatus', { ids });
            const statusMap = new Map();
            (data?.items || []).forEach(item => {
                statusMap.set(item.id, item.embeddable ? 'ok' : 'fail');
            });
            setEmbedCache(prev => {
                const next = { ...prev };
                ids.forEach(id => {
                    if (statusMap.has(id)) next[id] = statusMap.get(id);
                });
                return next;
            });
        } catch (e) {
            console.error('Embed status fetch failed', e);
        }
    }, [setEmbedCache]);

    const searchYouTubeIndex = useCallback((query) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return ytIndex
            .filter(item => {
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
                url: item.url
            }));
    }, [ytIndex]);

    const searchYouTube = useCallback(async (queryOverride) => {
        const query = (queryOverride ?? ytSearchQ).trim();
        if (!query) return;
        setYtLoading(true);
        setYtSearchError('');
        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Search timed out.')), 8000));
            const data = await Promise.race([
                callFunction('youtubeSearch', { query: `${query} karaoke`, maxResults: 10 }),
                timeout
            ]);
            const results = (data?.items || []).map(item => ({
                id: item.id,
                title: item.title,
                channel: item.channelTitle,
                thumbnail: item.thumbnails?.medium?.url || item.thumbnails?.default?.url || '',
                url: `https://www.youtube.com/watch?v=${item.id}`
            }));
            setYtResults(results);
            const updated = (() => {
                const existing = new Map(ytIndex.map(item => [item.videoId, item]));
                results.forEach(item => {
                    existing.set(item.id, {
                        videoId: item.id,
                        source: 'youtube',
                        trackName: item.title,
                        artistName: item.channel,
                        artworkUrl100: item.thumbnail,
                        url: item.url
                    });
                });
                return Array.from(existing.values());
            })();
            if (persistYtIndex) {
                persistYtIndex(updated);
            } else {
                setYtIndex(updated);
            }
            fetchEmbedStatuses(results.map(item => item.id));
        } catch (e) {
            console.error('YouTube search error:', e);
            const fallbackResults = searchYouTubeIndex(query);
            if (fallbackResults.length) {
                setYtResults(fallbackResults);
                setYtSearchError('Live YouTube search failed. Showing indexed playlist results.');
            } else {
                setYtSearchError(e?.message || 'YouTube search failed. Check server configuration.');
            }
        } finally {
            setYtLoading(false);
        }
    }, [
        fetchEmbedStatuses,
        persistYtIndex,
        searchYouTubeIndex,
        setYtIndex,
        setYtLoading,
        setYtResults,
        setYtSearchError,
        ytIndex,
        ytSearchQ
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
        openYtSearch
    };
};

export default useQueueMediaTools;
