import {
    db,
    addDoc,
    collection,
    doc,
    getDoc,
    writeBatch,
    updateDoc,
    serverTimestamp,
    increment,
    callFunction,
    ensureAppCheckToken,
    resolveQueueSongLyrics as resolveQueueSongLyricsCallable
} from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import { EMOJI } from '../../../lib/emoji';
import {
    buildSongKey,
    ensureSong,
    ensureTrack,
    resolveSongCatalog,
    resolveCanonicalTrackIdentity,
    resolveCanonicalTrackIdentityBatch,
    upsertSongLyrics,
    extractYouTubeId
} from '../../../lib/songCatalog';
import { normalizeBackingChoice } from '../../../lib/playbackSource';

const YOUTUBE_PLAYLIST_QUEUE_MAX = 1000;
let catalogPermissionSkipLogged = false;

const isCatalogPermissionDeniedError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return (
        code.includes('permission-denied')
        || message.includes('permission-denied')
        || message.includes('host or moderator access required')
        || message.includes('catalog song')
        || message.includes('catalog track')
    );
};

const logCatalogPermissionSkip = (scope) => {
    if (catalogPermissionSkipLogged) return;
    catalogPermissionSkipLogged = true;
    console.info(`[HostQueue] ${scope} skipped: catalog write access is not available for this account.`);
};

const isQueuePermissionDeniedError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return (
        code.includes('permission-denied')
        || code.includes('forbidden')
        || message.includes('permission-denied')
        || message.includes('missing or insufficient permissions')
    );
};

const isQueueUnauthenticatedError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return (
        code.includes('unauthenticated')
        || message.includes('auth')
        || message.includes('sign in')
    );
};

const isQueueAppCheckError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return (
        code.includes('failed-precondition')
        && (message.includes('app check') || message.includes('appcheck') || message.includes('token required'))
    );
};

const isQueueNetworkError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return (
        code.includes('unavailable')
        || code.includes('deadline-exceeded')
        || message.includes('network')
        || message.includes('timed out')
    );
};

const getQueueWriteErrorMessage = (error, fallback = 'Could not add song right now.') => {
    if (isQueueAppCheckError(error)) return 'Security token expired. Refresh and try again.';
    if (isQueueUnauthenticatedError(error)) return 'Session expired. Sign in again and retry.';
    if (isQueuePermissionDeniedError(error)) return 'Queue write is blocked for this account or room.';
    if (isQueueNetworkError(error)) return 'Network issue while writing queue. Try again.';
    return fallback;
};

const parseYouTubePlaylistId = (input = '') => {
    if (!input) return '';
    const raw = String(input || '').trim();
    if (!raw) return '';
    try {
        const url = new URL(raw);
        const host = String(url.hostname || '').toLowerCase();
        if (host.includes('youtube.com') || host.includes('youtu.be')) {
            const listParam = url.searchParams.get('list');
            if (listParam) return listParam.trim();
        }
    } catch {
        // Not a URL, continue with id heuristics.
    }
    if ((/youtube\.com|youtu\.be/i.test(raw)) && /[?&]list=([^&]+)/i.test(raw)) {
        return (raw.match(/[?&]list=([^&]+)/i)?.[1] || '').trim();
    }
    // Accept direct playlist ids (PL..., UU..., OLAK5uy..., etc).
    if (/^[A-Za-z0-9_-]{10,}$/.test(raw) && /^(PL|UU|LL|OLAK5uy|RDCLAK|FL)/i.test(raw)) {
        return raw;
    }
    return '';
};

const normalizeYouTubePlaylistItems = (rawItems = []) => (
    (rawItems || [])
        .map((item) => ({
            id: item?.id || item?.snippet?.resourceId?.videoId || '',
            title: item?.title || item?.snippet?.title || 'Untitled',
            channel: item?.channelTitle || item?.snippet?.channelTitle || 'YouTube',
            thumbnail: item?.thumbnails?.medium?.url || item?.thumbnails?.default?.url || item?.snippet?.thumbnails?.medium?.url || '',
            url: item?.id ? `https://www.youtube.com/watch?v=${item.id}` : ''
        }))
        .filter((item) => item.id)
);

const resolveCanonicalIdentitySafe = async ({
    songId = '',
    title = '',
    artist = '',
    source = '',
    mediaUrl = '',
    appleMusicId = ''
} = {}) => {
    try {
        return await resolveCanonicalTrackIdentity({
            songId,
            title,
            artist,
            source,
            mediaUrl,
            appleMusicId
        });
    } catch (error) {
        console.warn('resolveCanonicalTrackIdentity failed', error);
        return null;
    }
};

const resolveCanonicalIdentityBatchSafe = async (items = []) => {
    try {
        return await resolveCanonicalTrackIdentityBatch(items);
    } catch (error) {
        console.warn('resolveCanonicalTrackIdentityBatch failed', error);
        return [];
    }
};

const fetchYouTubeEmbeddableStatusMap = async (videoIds = [], { batchSize = 50, concurrency = 4 } = {}) => {
    const ids = [...new Set((Array.isArray(videoIds) ? videoIds : []).map((id) => String(id || '').trim()).filter(Boolean))];
    const statusMap = new Map();
    if (!ids.length) return statusMap;
    const safeBatchSize = Math.max(1, Math.min(50, Number(batchSize || 50)));
    const workerCount = Math.max(1, Math.min(Number(concurrency || 4), Math.ceil(ids.length / safeBatchSize)));
    let cursor = 0;
    const workers = Array.from({ length: workerCount }, async () => {
        while (cursor < ids.length) {
            const start = cursor;
            cursor += safeBatchSize;
            const chunkIds = ids.slice(start, start + safeBatchSize);
            if (!chunkIds.length) continue;
            try {
                const statusData = await callFunction('youtubeStatus', { ids: chunkIds });
                (statusData?.items || []).forEach((entry) => {
                    statusMap.set(entry.id, !!entry.embeddable);
                });
            } catch (error) {
                console.warn('youtubeStatus failed for playlist chunk', error);
            }
        }
    });
    await Promise.all(workers);
    return statusMap;
};

const useQueueSongActions = ({
    roomCode,
    room,
    hostName,
    manual,
    setManual,
    setSearchQ,
    current,
    editingSongId,
    setEditingSongId,
    editForm,
    setEditForm,
    isAudioUrl,
    resolveDurationForUrl,
    generateAIContent,
    getAppleMusicUserToken,
    toast
}) => {
    const fetchAiLyricsFallback = async (title, artist) => {
        if (!room?.autoLyricsOnQueue || typeof generateAIContent !== 'function') return null;
        const safeTitle = (title || '').trim();
        if (!safeTitle) return null;
        try {
            const generated = await generateAIContent('lyrics', {
                title: safeTitle,
                artist: (artist || '').trim()
            });
            const lyrics = String(generated?.lyrics || '').trim();
            if (!lyrics) return null;
            return {
                lyrics,
                lyricsSource: 'ai'
            };
        } catch (err) {
            console.warn('AI lyrics fallback failed', err);
            return null;
        }
    };

    const fetchAppleTimedLyrics = async (title, artist) => {
        const safeTitle = (title || '').trim();
        if (!safeTitle) return null;
        const safeArtist = (artist || '').trim();
        try {
            const cached = await resolveSongCatalog({
                title: safeTitle,
                artist: safeArtist || 'Unknown'
            });
            const hasTimed = Array.isArray(cached?.lyrics?.timedLyrics) && cached.lyrics.timedLyrics.length > 0;
            const hasText = !!(cached?.lyrics?.lyrics || '').trim();
            if (hasTimed || hasText) {
                return {
                    found: true,
                    appleMusicId: cached?.lyrics?.appleMusicId || cached?.track?.appleMusicId || '',
                    lyrics: cached?.lyrics?.lyrics || '',
                    lyricsTimed: hasTimed ? cached.lyrics.timedLyrics : null,
                    lyricsSource: cached?.lyrics?.source || 'catalog',
                    needsUserToken: false,
                    resolution: hasTimed ? 'catalog_timed' : 'catalog_text',
                    message: 'Lyrics loaded from catalog cache.'
                };
            }
        } catch (err) {
            console.warn('Catalog lyrics lookup failed', err);
        }

        try {
            const musicUserToken = getAppleMusicUserToken?.() || '';
            const res = await callFunction('appleMusicLyrics', {
                title: safeTitle,
                artist: safeArtist,
                storefront: 'us',
                musicUserToken
            });
            if (!res?.found && !res?.songId) {
                return {
                    found: false,
                    appleMusicId: '',
                    lyrics: '',
                    lyricsTimed: null,
                    lyricsSource: '',
                    needsUserToken: false,
                    resolution: 'no_match',
                    message: res?.message || 'No Apple Music match found.'
                };
            }
            const hasTimedLyrics = Array.isArray(res?.timedLyrics) && res.timedLyrics.length > 0;
            if (hasTimedLyrics || res?.lyrics) {
                try {
                    await upsertSongLyrics({
                        title: res?.title || safeTitle,
                        artist: res?.artist || safeArtist || 'Unknown',
                        lyrics: res?.lyrics || '',
                        lyricsTimed: hasTimedLyrics ? res.timedLyrics : null,
                        lyricsSource: hasTimedLyrics || res?.lyrics ? 'apple' : '',
                        appleMusicId: res?.songId ? String(res.songId) : '',
                        verifiedBy: hostName || 'host'
                    });
                } catch (cacheErr) {
                    console.warn('upsertSongLyrics failed', cacheErr);
                }
            }
            return {
                found: !!res?.found || !!res?.songId,
                appleMusicId: res?.songId ? String(res.songId) : '',
                lyrics: res?.lyrics || '',
                lyricsTimed: hasTimedLyrics ? res.timedLyrics : null,
                lyricsSource: hasTimedLyrics || res?.lyrics ? 'apple' : '',
                needsUserToken: !!res?.needsUserToken,
                resolution: hasTimedLyrics
                    ? 'apple_timed'
                    : res?.lyrics
                        ? 'apple_text'
                        : res?.needsUserToken
                            ? 'needs_user_token'
                            : 'apple_no_lyrics',
                message: res?.message || ''
            };
        } catch (err) {
            console.warn('Apple lyrics fetch failed', err);
            return {
                found: false,
                appleMusicId: '',
                lyrics: '',
                lyricsTimed: null,
                lyricsSource: '',
                needsUserToken: false,
                resolution: 'fetch_error',
                message: err?.message || 'Apple lyrics request failed.'
            };
        }
    };

    const resolveQueueLyrics = async ({
        title,
        artist,
        allowAiFallback = false
    }) => {
        const safeTitle = String(title || '').trim();
        const safeArtist = String(artist || '').trim();
        if (!safeTitle) {
            return {
                hasLyrics: false,
                hasTimedLyrics: false,
                lyrics: '',
                lyricsTimed: null,
                lyricsSource: '',
                appleMusicId: '',
                resolution: 'missing_title',
                message: '',
                needsUserToken: false
            };
        }

        const fetchedAppleLyrics = await fetchAppleTimedLyrics(safeTitle, safeArtist);
        if (fetchedAppleLyrics) {
            const hasTimedLyrics = Array.isArray(fetchedAppleLyrics.lyricsTimed) && fetchedAppleLyrics.lyricsTimed.length > 0;
            const hasPlainLyrics = !!String(fetchedAppleLyrics.lyrics || '').trim();
            if (hasTimedLyrics || hasPlainLyrics) {
                return {
                    hasLyrics: hasPlainLyrics,
                    hasTimedLyrics,
                    lyrics: fetchedAppleLyrics.lyrics || '',
                    lyricsTimed: hasTimedLyrics ? fetchedAppleLyrics.lyricsTimed : null,
                    lyricsSource: fetchedAppleLyrics.lyricsSource || 'apple',
                    appleMusicId: String(fetchedAppleLyrics.appleMusicId || '').trim(),
                    resolution: fetchedAppleLyrics.resolution || (hasTimedLyrics ? 'apple_timed' : 'apple_text'),
                    message: fetchedAppleLyrics.message || '',
                    needsUserToken: false
                };
            }
        }

        if (allowAiFallback) {
            const generatedLyrics = await fetchAiLyricsFallback(safeTitle, safeArtist);
            if (generatedLyrics?.lyrics) {
                return {
                    hasLyrics: true,
                    hasTimedLyrics: false,
                    lyrics: generatedLyrics.lyrics,
                    lyricsTimed: null,
                    lyricsSource: generatedLyrics.lyricsSource || 'ai',
                    appleMusicId: String(fetchedAppleLyrics?.appleMusicId || '').trim(),
                    resolution: 'ai_text',
                    message: '',
                    needsUserToken: false
                };
            }
        }

        return {
            hasLyrics: false,
            hasTimedLyrics: false,
            lyrics: '',
            lyricsTimed: null,
            lyricsSource: '',
            appleMusicId: String(fetchedAppleLyrics?.appleMusicId || '').trim(),
            resolution: fetchedAppleLyrics?.resolution || 'no_match',
            message: fetchedAppleLyrics?.message || '',
            needsUserToken: !!fetchedAppleLyrics?.needsUserToken
        };
    };

    const buildLyricsToastFromResult = (result = {}, timedOnly = false) => {
        const status = String(result?.status || '').trim().toLowerCase();
        const resolution = String(result?.resolution || '').trim().toLowerCase();
        const hasTimedLyrics = !!result?.hasTimedLyrics;
        const hasLyrics = !!result?.hasLyrics;
        if (hasTimedLyrics) return 'Timed lyrics ready.';
        if (hasLyrics) return 'Lyrics ready.';
        if (status === 'needs_user_token' || resolution === 'needs_user_token') {
            return 'Apple lyrics need host Apple Music authorization.';
        }
        if (status === 'capability_blocked' || resolution === 'capability_blocked') {
            return 'AI fallback blocked by current workspace entitlement.';
        }
        if (status === 'disabled' || resolution === 'pipeline_v2_disabled') {
            return 'Lyrics pipeline is disabled for this room.';
        }
        if (status === 'error') return 'Lyrics lookup hit a provider error.';
        if (timedOnly) return 'No timed lyrics found yet.';
        return 'No lyrics match found yet.';
    };

    const applyLocalLyricsFallbackToDoc = async ({
        songDocRef,
        title,
        artist,
        timedOnly = false
    }) => {
        let lyricsResult = {
            hasLyrics: false,
            hasTimedLyrics: false,
            lyrics: '',
            lyricsTimed: null,
            lyricsSource: '',
            resolution: 'no_match',
            message: '',
            needsUserToken: false
        };
        try {
            lyricsResult = await resolveQueueLyrics({
                title,
                artist,
                allowAiFallback: !timedOnly
            });
        } catch (error) {
            console.warn('Local queue lyrics fallback failed', error);
            lyricsResult = {
                hasLyrics: false,
                hasTimedLyrics: false,
                lyrics: '',
                lyricsTimed: null,
                lyricsSource: '',
                resolution: 'fetch_error',
                message: error?.message || '',
                needsUserToken: false
            };
        }

        const songSnap = await getDoc(songDocRef);
        const currentSongData = songSnap.exists() ? (songSnap.data() || {}) : {};
        const hasExistingTimedLyrics = Array.isArray(currentSongData?.lyricsTimed) && currentSongData.lyricsTimed.length > 0;
        const hasExistingLyrics = !!String(currentSongData?.lyrics || '').trim();
        const songUpdates = {
            lyricsGenerationUpdatedAt: serverTimestamp(),
            lyricsGenerationResolution: lyricsResult.resolution || '',
            lyricsGenerationStatus: (
                lyricsResult.hasTimedLyrics || lyricsResult.hasLyrics
                    ? 'resolved'
                    : lyricsResult.needsUserToken
                        ? 'needs_user_token'
                        : (lyricsResult.resolution === 'fetch_error' ? 'error' : 'no_match')
            )
        };
        if (!hasExistingTimedLyrics && !hasExistingLyrics && (lyricsResult.hasTimedLyrics || lyricsResult.hasLyrics)) {
            songUpdates.lyrics = lyricsResult.lyrics || '';
            songUpdates.lyricsTimed = lyricsResult.lyricsTimed || null;
            songUpdates.lyricsSource = lyricsResult.lyricsSource || '';
        }
        await updateDoc(songDocRef, songUpdates);

        return {
            status: songUpdates.lyricsGenerationStatus,
            resolution: songUpdates.lyricsGenerationResolution,
            hasLyrics: !!lyricsResult.hasLyrics || hasExistingLyrics,
            hasTimedLyrics: !!lyricsResult.hasTimedLyrics || hasExistingTimedLyrics,
            needsUserToken: !!lyricsResult.needsUserToken
        };
    };

    const resolveQueuedSongLyrics = async ({
        songDocId,
        title,
        artist,
        timedOnly = false,
        force = true
    }) => {
        if (!roomCode || !songDocId) return null;
        const songDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songDocId);
        try {
            await ensureAppCheckToken(false).catch(() => false);
            const callableResult = await resolveQueueSongLyricsCallable({
                roomCode,
                songId: songDocId,
                timedOnly: !!timedOnly,
                force: force !== false,
                musicUserToken: getAppleMusicUserToken?.() || ''
            });
            return {
                ...callableResult,
                toastMessage: buildLyricsToastFromResult(callableResult, timedOnly)
            };
        } catch (error) {
            console.warn('resolveQueueSongLyrics callable failed, using local fallback', error);
            const fallback = await applyLocalLyricsFallbackToDoc({
                songDocRef,
                title,
                artist,
                timedOnly
            });
            return {
                ...fallback,
                toastMessage: buildLyricsToastFromResult(fallback, timedOnly),
                localFallback: true
            };
        }
    };

    const addSong = async () => {
        const playlistId = parseYouTubePlaylistId(manual.url || '');
        if (playlistId) {
            if (!roomCode) {
                toast('Create or open a room first');
                return;
            }
            toast('Loading YouTube playlist...');
            try {
                await ensureAppCheckToken(false).catch(() => false);
                const data = await callFunction('youtubePlaylist', {
                    playlistId,
                    maxTotal: YOUTUBE_PLAYLIST_QUEUE_MAX
                });
                const playlistItems = normalizeYouTubePlaylistItems(data?.items || []);
                const statusMap = await fetchYouTubeEmbeddableStatusMap(
                    playlistItems.map((item) => item.id),
                    { batchSize: 50, concurrency: 4 }
                );
                const queueItems = playlistItems.filter((item) => item?.id && item?.url && statusMap.get(item.id) === true);
                if (!queueItems.length) {
                    toast('Playlist has no verified playable videos.');
                    return;
                }
                const songsCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs');
                const basePriority = Date.now();
                const singerName = manual.singer || room?.hostName || hostName || 'Host';
                let queuedCount = 0;
                for (let start = 0; start < queueItems.length; start += 100) {
                    const chunk = queueItems.slice(start, start + 100);
                    const canonicalBatch = await resolveCanonicalIdentityBatchSafe(
                        chunk.map((item) => ({
                            title: item.title,
                            artist: item.channel || 'YouTube',
                            source: 'youtube',
                            mediaUrl: item.url
                        }))
                    );
                    const canonicalByIndex = new Map(
                        canonicalBatch.map((entry) => [Number(entry?.index || 0), entry || null])
                    );
                    const preparedChunk = await Promise.all(
                        chunk.map(async (item, idx) => {
                            const canonicalMatch = canonicalByIndex.get(idx) || null;
                            const songId = String(canonicalMatch?.songId || buildSongKey(item.title, item.channel || 'YouTube')).trim();
                            const songTitle = canonicalMatch?.title || item.title;
                            const artist = canonicalMatch?.artist || item.channel || 'YouTube';
                            let trackId = canonicalMatch?.trackId || null;
                            if (canonicalMatch?.found && !trackId) {
                                try {
                                    const trackRecord = await ensureTrack({
                                        songId,
                                        source: 'youtube',
                                        mediaUrl: item.url,
                                        duration: 180,
                                        audioOnly: false,
                                        backingOnly: false,
                                        addedBy: hostName || 'Host'
                                    });
                                    trackId = trackRecord?.trackId || null;
                                } catch (err) {
                                    if (isCatalogPermissionDeniedError(err)) {
                                        logCatalogPermissionSkip('playlist.ensureTrack');
                                    } else {
                                        console.warn('playlist ensureTrack failed', err);
                                    }
                                }
                            }
                            return {
                                item,
                                songId,
                                trackId,
                                songTitle,
                                artist
                            };
                        })
                    );
                    const batch = writeBatch(db);
                    preparedChunk.forEach((prepared, idx) => {
                        const globalIdx = start + idx;
                        const songRef = doc(songsCol);
                        batch.set(songRef, {
                            roomCode,
                            songId: prepared.songId,
                            trackId: prepared.trackId || null,
                            trackSource: 'youtube',
                            songTitle: prepared.songTitle,
                            artist: prepared.artist,
                            singerName,
                            mediaUrl: prepared.item.url,
                            albumArtUrl: prepared.item.thumbnail || '',
                            lyrics: '',
                            lyricsTimed: null,
                            appleMusicId: '',
                            musicSource: '',
                            lyricsSource: '',
                            lyricsGenerationStatus: room?.autoLyricsOnQueue ? 'pending' : 'disabled',
                            lyricsGenerationResolution: room?.autoLyricsOnQueue ? 'pending' : 'disabled',
                            lyricsGenerationUpdatedAt: serverTimestamp(),
                            duration: 180,
                            status: 'requested',
                            timestamp: serverTimestamp(),
                            priorityScore: basePriority + globalIdx,
                            emoji: EMOJI.mic,
                            backingAudioOnly: false,
                            audioOnly: false
                        });
                    });
                    await batch.commit();
                    queuedCount += chunk.length;
                }
                setManual({
                    song: '',
                    artist: '',
                    singer: hostName || 'Host',
                    url: '',
                    art: '',
                    lyrics: '',
                    lyricsTimed: null,
                    appleMusicId: '',
                    duration: 180,
                    backingAudioOnly: false,
                    audioOnly: false
                });
                setSearchQ('');
                toast(`Queued ${queuedCount} songs from YouTube playlist`);
            } catch (err) {
                console.warn('YouTube playlist queue failed', err);
                toast(getQueueWriteErrorMessage(err, 'Could not queue playlist. Check playlist visibility and API setup.'));
            }
            return;
        }

        if (!manual.song) return;
        try {
            await ensureAppCheckToken(false).catch(() => false);
            const manualTitle = manual.song;
            const manualArtist = manual.artist || 'Unknown';
            const manualBacking = normalizeBackingChoice({
                mediaUrl: manual.url,
                appleMusicId: manual.appleMusicId
            });
            const manualUrl = manualBacking.mediaUrl;
            const resolvedAppleMusicId = manualBacking.appleMusicId;
            const initialSongId = buildSongKey(manualTitle, manualArtist);
            const youtubeId = extractYouTubeId(manualUrl);
            const trackSource = resolvedAppleMusicId
                ? 'apple'
                : youtubeId
                    ? 'youtube'
                    : manualUrl
                        ? 'custom'
                        : '';
            const hasManualTimedLyrics = Array.isArray(manual.lyricsTimed) && manual.lyricsTimed.length > 0;
            const hasManualLyrics = !!String(manual.lyrics || '').trim();
            const shouldAttemptLyricsEnrichment = !hasManualTimedLyrics && !hasManualLyrics && !!room?.autoLyricsOnQueue;
            const docRef = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
                roomCode,
                songId: initialSongId,
                trackId: null,
                trackSource: trackSource || null,
                songTitle: manualTitle,
                artist: manualArtist,
                singerName: manual.singer,
                mediaUrl: manualUrl,
                albumArtUrl: manual.art || '',
                lyrics: hasManualLyrics ? String(manual.lyrics || '') : '',
                lyricsTimed: hasManualTimedLyrics ? manual.lyricsTimed : null,
                appleMusicId: resolvedAppleMusicId,
                musicSource: resolvedAppleMusicId ? 'apple' : '',
                lyricsSource: hasManualLyrics || hasManualTimedLyrics ? 'manual' : '',
                lyricsGenerationStatus: (
                    hasManualLyrics || hasManualTimedLyrics
                        ? 'resolved'
                        : (shouldAttemptLyricsEnrichment ? 'pending' : 'disabled')
                ),
                lyricsGenerationResolution: (
                    hasManualLyrics || hasManualTimedLyrics
                        ? 'manual'
                        : (shouldAttemptLyricsEnrichment ? 'pending' : 'disabled')
                ),
                lyricsGenerationUpdatedAt: serverTimestamp(),
                duration: manual.duration ? Math.round(manual.duration) : 180,
                status: 'requested',
                timestamp: serverTimestamp(),
                priorityScore: Date.now(),
                emoji: EMOJI.mic,
                backingAudioOnly: manual.backingAudioOnly || false,
                audioOnly: manual.audioOnly || isAudioUrl(manualUrl)
            });

            toast(
                hasManualLyrics || hasManualTimedLyrics
                    ? 'Song Added!'
                    : 'Song Added! Resolving lyrics...'
            );

            void (async () => {
                const canonicalMatch = await resolveCanonicalIdentitySafe({
                    songId: initialSongId,
                    title: manualTitle,
                    artist: manualArtist,
                    source: trackSource,
                    mediaUrl: manualUrl,
                    appleMusicId: resolvedAppleMusicId
                });
                const canonicalTitle = canonicalMatch?.found ? (canonicalMatch.title || manualTitle) : manualTitle;
                const canonicalArtist = canonicalMatch?.found ? (canonicalMatch.artist || manualArtist) : manualArtist;
                let resolvedSongId = canonicalMatch?.songId || initialSongId;
                try {
                    const songRecord = await ensureSong({
                        title: canonicalTitle,
                        artist: canonicalArtist,
                        artworkUrl: manual.art || '',
                        appleMusicId: resolvedAppleMusicId,
                        verifyMeta: manual.art ? {} : false,
                        verifiedBy: hostName || 'host'
                    });
                    resolvedSongId = songRecord?.songId || resolvedSongId;
                } catch (err) {
                    if (isCatalogPermissionDeniedError(err)) {
                        logCatalogPermissionSkip('manual.ensureSong');
                    } else {
                        console.warn('manual ensureSong failed', err);
                    }
                }

                let trackRecord = null;
                if (trackSource) {
                    if (canonicalMatch?.trackId) {
                        trackRecord = { trackId: canonicalMatch.trackId };
                    } else {
                        try {
                            trackRecord = await ensureTrack({
                                songId: resolvedSongId,
                                source: trackSource,
                                mediaUrl: manualUrl || '',
                                appleMusicId: resolvedAppleMusicId,
                                duration: manual.duration ? Math.round(manual.duration) : null,
                                audioOnly: manual.audioOnly || isAudioUrl(manualUrl),
                                backingOnly: !!manual.backingAudioOnly,
                                addedBy: hostName || 'Host'
                            });
                        } catch (err) {
                            if (isCatalogPermissionDeniedError(err)) {
                                logCatalogPermissionSkip('manual.ensureTrack');
                            } else {
                                console.warn('manual ensureTrack failed', err);
                            }
                        }
                    }
                }

                try {
                    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', docRef.id), {
                        songId: resolvedSongId,
                        trackId: trackRecord?.trackId || null,
                        ...(canonicalMatch?.found ? {
                            songTitle: canonicalTitle,
                            artist: canonicalArtist
                        } : {})
                    });
                } catch (error) {
                    console.warn('Failed to persist manual queue song metadata', error);
                }

                if (!shouldAttemptLyricsEnrichment) return;
                const enrichment = await resolveQueuedSongLyrics({
                    songDocId: docRef.id,
                    title: manualTitle,
                    artist: manualArtist,
                    timedOnly: false,
                    force: true
                });
                if (enrichment?.toastMessage) {
                    toast(enrichment.toastMessage);
                }
            })();

            setManual({
                song: '',
                artist: '',
                singer: hostName || 'Host',
                url: '',
                art: '',
                lyrics: '',
                lyricsTimed: null,
                appleMusicId: '',
                duration: 180,
                backingAudioOnly: false,
                audioOnly: false
            });
            setSearchQ('');
        } catch (err) {
            console.warn('Failed to add manual song', err);
            toast(getQueueWriteErrorMessage(err, 'Could not add song right now.'));
        }
    };

    const addSongFromResult = async (r, options = {}) => {
        if (!r?.trackName) return;
        const singerOverride = typeof options === 'string' ? options : options?.singerName;
        const isApple = r.source === 'itunes';
        const explicitAppleId = isApple ? String(r.trackId || '') : '';
        const preferAppleDefault = isApple && !!explicitAppleId;
        const itunesArt = (r.artworkUrl100 || '').replace('100x100', '600x600');
        const selectedDuration = manual.duration || 180;
        const trackSource = preferAppleDefault
            ? 'apple'
            : (r.source === 'youtube' ? 'youtube' : r.source === 'local' ? 'custom' : (isApple ? 'apple' : ''));
        const mediaUrl = preferAppleDefault ? '' : (r.source === 'youtube' || r.source === 'local' ? (r.url || '') : '');
        const nextSong = {
            song: r.trackName,
            artist: r.artistName || '',
            singer: singerOverride || manual.singer || room?.hostName || hostName || 'Host',
            url: mediaUrl,
            art: r.source === 'itunes' ? itunesArt : r.artworkUrl100 || '',
            appleMusicId: preferAppleDefault ? explicitAppleId : '',
            duration: selectedDuration,
            backingAudioOnly: false,
            audioOnly: trackSource === 'apple' ? true : r.mediaType === 'audio' || isAudioUrl(r.url)
        };
        const initialSongId = buildSongKey(r.trackName, r.artistName || 'Unknown');

        try {
            await ensureAppCheckToken(false).catch(() => false);
            const docRef = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
                roomCode,
                songId: initialSongId,
                trackId: null,
                trackSource: trackSource || null,
                songTitle: nextSong.song,
                artist: nextSong.artist,
                singerName: nextSong.singer,
                mediaUrl: nextSong.url,
                albumArtUrl: nextSong.art || '',
                lyrics: '',
                lyricsTimed: null,
                appleMusicId: nextSong.appleMusicId,
                musicSource: nextSong.appleMusicId ? 'apple' : '',
                lyricsSource: '',
                lyricsGenerationStatus: room?.autoLyricsOnQueue ? 'pending' : 'disabled',
                lyricsGenerationResolution: room?.autoLyricsOnQueue ? 'pending' : 'disabled',
                lyricsGenerationUpdatedAt: serverTimestamp(),
                duration: nextSong.duration ? Math.round(nextSong.duration) : 180,
                status: 'requested',
                timestamp: serverTimestamp(),
                priorityScore: Date.now(),
                emoji: EMOJI.mic,
                backingAudioOnly: nextSong.backingAudioOnly || false,
                audioOnly: nextSong.audioOnly || isAudioUrl(nextSong.url)
            });

            const statusText = preferAppleDefault
                ? 'Queued with Apple backing (finalizing lyrics...)'
                : 'Queued (finalizing lyrics...)';
            toast(statusText);

            void (async () => {
                const canonicalMatch = await resolveCanonicalIdentitySafe({
                    songId: initialSongId,
                    title: r.trackName,
                    artist: r.artistName || 'Unknown',
                    source: trackSource,
                    mediaUrl,
                    appleMusicId: nextSong.appleMusicId
                });
                const canonicalTitle = canonicalMatch?.found ? (canonicalMatch.title || nextSong.song) : nextSong.song;
                const canonicalArtist = canonicalMatch?.found ? (canonicalMatch.artist || nextSong.artist || 'Unknown') : (nextSong.artist || 'Unknown');
                let songId = canonicalMatch?.songId || initialSongId;
                try {
                    const songRecord = await ensureSong({
                        title: canonicalTitle,
                        artist: canonicalArtist,
                        artworkUrl: r.source === 'itunes' ? itunesArt : r.artworkUrl100 || '',
                        itunesId: isApple ? r.trackId : '',
                        appleMusicId: nextSong.appleMusicId,
                        verifyMeta: { lyricsSource: null, lyricsTimed: false },
                        verifiedBy: hostName || 'host'
                    });
                    songId = songRecord?.songId || songId;
                } catch (err) {
                    if (isCatalogPermissionDeniedError(err)) {
                        logCatalogPermissionSkip('ensureSong');
                    } else {
                        console.warn('ensureSong failed', err);
                    }
                }

                let trackRecord = null;
                if (trackSource) {
                    if (canonicalMatch?.trackId) {
                        trackRecord = { trackId: canonicalMatch.trackId };
                    } else {
                        try {
                            trackRecord = await ensureTrack({
                                songId,
                                source: trackSource,
                                mediaUrl: mediaUrl || '',
                                appleMusicId: nextSong.appleMusicId,
                                duration: selectedDuration,
                                audioOnly: nextSong.audioOnly,
                                backingOnly: false,
                                addedBy: hostName || 'Host'
                            });
                        } catch (err) {
                            if (isCatalogPermissionDeniedError(err)) {
                                logCatalogPermissionSkip('ensureTrack');
                            } else {
                                console.warn('ensureTrack failed', err);
                            }
                        }
                    }
                }

                const shouldAttemptLyricsEnrichment = !!room?.autoLyricsOnQueue;
                try {
                    const songDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', docRef.id);
                    await updateDoc(songDocRef, {
                        songId,
                        trackId: trackRecord?.trackId || null,
                        ...(canonicalMatch?.found ? {
                            songTitle: canonicalTitle,
                            artist: canonicalArtist
                        } : {})
                    });

                    if (shouldAttemptLyricsEnrichment) {
                        const enrichment = await resolveQueuedSongLyrics({
                            songDocId: docRef.id,
                            title: nextSong.song,
                            artist: nextSong.artist,
                            timedOnly: false,
                            force: true
                        });
                        if (enrichment?.toastMessage) {
                            toast(enrichment.toastMessage);
                        }
                    }
                } catch (err) {
                    console.warn('Failed to apply queued song enrichment', err);
                }
            })();

            return {
                id: docRef.id,
                songTitle: nextSong.song,
                artist: nextSong.artist,
                singerName: nextSong.singer,
                mediaUrl: nextSong.url,
                albumArtUrl: nextSong.art || '',
                lyrics: '',
                lyricsTimed: null,
                appleMusicId: nextSong.appleMusicId || '',
                duration: nextSong.duration ? Math.round(nextSong.duration) : 180,
                statusText,
                lyricsGenerationStatus: room?.autoLyricsOnQueue ? 'pending' : 'disabled',
                lyricsGenerationResolution: room?.autoLyricsOnQueue ? 'pending' : 'disabled'
            };
        } catch (err) {
            console.warn('Failed to queue song', err);
            toast(getQueueWriteErrorMessage(err, 'Could not add song right now.'));
        }
    };

    const startEdit = (song) => {
        setEditingSongId(song.id);
        setEditForm({
            title: song.songTitle,
            artist: song.artist,
            singer: song.singerName,
            url: song.mediaUrl || '',
            art: song.albumArtUrl || '',
            lyrics: song.lyrics || '',
            lyricsTimed: song.lyricsTimed || null,
            appleMusicId: song.appleMusicId || '',
            duration: song.duration || 180
        });
    };

    const saveEdit = async () => {
        const durationNum = Number(editForm.duration);
        const safeDuration = Number.isFinite(durationNum) && durationNum > 0 ? Math.round(durationNum) : 180;
        const normalizedBacking = normalizeBackingChoice({
            mediaUrl: editForm.url,
            appleMusicId: editForm.appleMusicId
        });
        const normalizedUrl = normalizedBacking.mediaUrl;
        const normalizedAppleMusicId = normalizedBacking.appleMusicId;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', editingSongId), {
            songTitle: editForm.title,
            artist: editForm.artist,
            singerName: editForm.singer,
            mediaUrl: normalizedUrl,
            albumArtUrl: editForm.art,
            lyrics: editForm.lyrics,
            lyricsTimed: editForm.lyricsTimed || null,
            appleMusicId: normalizedAppleMusicId,
            musicSource: normalizedAppleMusicId ? 'apple' : '',
            lyricsSource: editForm.lyricsTimed ? 'apple' : (editForm.lyrics ? 'manual' : ''),
            duration: safeDuration,
            audioOnly: isAudioUrl(normalizedUrl)
        });
        setEditingSongId(null);
        toast('Song Updated');
    };

    const generateLyrics = async () => {
        if (!editForm.title || !editForm.artist) return toast('Needs Title & Artist');
        toast('Generating Lyrics...');
        const res = await generateAIContent('lyrics', { title: editForm.title, artist: editForm.artist });
        if (res && res.lyrics) {
            setEditForm(prev => ({ ...prev, lyrics: res.lyrics }));
            toast('Lyrics Generated!');
        } else {
            toast('Gen Failed');
        }
    };

    const syncEditDuration = async () => {
        if (!editForm.url) {
            toast('Add a media URL first');
            return;
        }
        const duration = await resolveDurationForUrl(editForm.url, isAudioUrl(editForm.url));
        if (duration) {
            setEditForm(prev => ({ ...prev, duration }));
            toast(`Duration set to ${duration}s`);
        } else {
            toast('Could not read duration');
        }
    };

    const addBonusToCurrent = async (amt) => {
        if (!current) return;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', current.id), {
            hostBonus: increment(amt)
        });
        toast(`Added ${amt} Bonus Pts!`);
    };

    const retryLyricsForSong = async (song) => {
        if (!song?.id) return;
        const result = await resolveQueuedSongLyrics({
            songDocId: song.id,
            title: song.songTitle || song.title || '',
            artist: song.artist || '',
            timedOnly: false,
            force: true
        });
        if (result?.toastMessage) toast(result.toastMessage);
    };

    const fetchTimedLyricsForSong = async (song) => {
        if (!song?.id) return;
        const result = await resolveQueuedSongLyrics({
            songDocId: song.id,
            title: song.songTitle || song.title || '',
            artist: song.artist || '',
            timedOnly: true,
            force: true
        });
        if (result?.toastMessage) toast(result.toastMessage);
    };

    return {
        addSong,
        addSongFromResult,
        startEdit,
        saveEdit,
        generateLyrics,
        syncEditDuration,
        addBonusToCurrent,
        retryLyricsForSong,
        fetchTimedLyricsForSong
    };
};

export default useQueueSongActions;
