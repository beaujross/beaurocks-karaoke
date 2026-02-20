import {
    db,
    addDoc,
    collection,
    doc,
    writeBatch,
    updateDoc,
    serverTimestamp,
    increment,
    callFunction
} from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import { EMOJI } from '../../../lib/emoji';
import {
    buildSongKey,
    ensureSong,
    ensureTrack,
    resolveSongCatalog,
    upsertSongLyrics,
    extractYouTubeId
} from '../../../lib/songCatalog';
import { normalizeBackingChoice } from '../../../lib/playbackSource';

const YOUTUBE_PLAYLIST_QUEUE_MAX = 1000;

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

    const addSong = async () => {
        const playlistId = parseYouTubePlaylistId(manual.url || '');
        if (playlistId) {
            if (!roomCode) {
                toast('Create or open a room first');
                return;
            }
            toast('Loading YouTube playlist...');
            try {
                const data = await callFunction('youtubePlaylist', {
                    playlistId,
                    maxTotal: YOUTUBE_PLAYLIST_QUEUE_MAX
                });
                const playlistItems = normalizeYouTubePlaylistItems(data?.items || []);
                const queueItems = playlistItems.filter((item) => item?.id && item?.url);
                if (!queueItems.length) {
                    toast('Playlist has no queueable videos.');
                    return;
                }
                const songsCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs');
                const basePriority = Date.now();
                const singerName = manual.singer || room?.hostName || hostName || 'Host';
                let queuedCount = 0;
                for (let start = 0; start < queueItems.length; start += 400) {
                    const chunk = queueItems.slice(start, start + 400);
                    const batch = writeBatch(db);
                    chunk.forEach((item, idx) => {
                        const globalIdx = start + idx;
                        const songRef = doc(songsCol);
                        batch.set(songRef, {
                            roomCode,
                            songId: buildSongKey(item.title, item.channel || 'YouTube'),
                            trackId: null,
                            trackSource: 'youtube',
                            songTitle: item.title,
                            artist: item.channel || 'YouTube',
                            singerName,
                            mediaUrl: item.url,
                            albumArtUrl: item.thumbnail || '',
                            lyrics: '',
                            lyricsTimed: null,
                            appleMusicId: '',
                            musicSource: '',
                            lyricsSource: '',
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
                toast('Could not queue playlist. Check playlist visibility and API setup.');
            }
            return;
        }

        if (!manual.song) return;
        const manualTitle = manual.song;
        const manualArtist = manual.artist || 'Unknown';
        const manualBacking = normalizeBackingChoice({
            mediaUrl: manual.url,
            appleMusicId: manual.appleMusicId
        });
        const manualUrl = manualBacking.mediaUrl;
        const resolvedAppleMusicId = manualBacking.appleMusicId;
        const songRecord = await ensureSong({
            title: manualTitle,
            artist: manualArtist,
            artworkUrl: manual.art || '',
            appleMusicId: resolvedAppleMusicId,
            verifyMeta: manual.art ? {} : false,
            verifiedBy: hostName || 'host'
        });
        const songId = songRecord?.songId || buildSongKey(manualTitle, manualArtist);
        const youtubeId = extractYouTubeId(manualUrl);
        const trackSource = resolvedAppleMusicId
            ? 'apple'
            : youtubeId
                ? 'youtube'
                : manualUrl
                    ? 'custom'
                    : '';
        const trackRecord = trackSource
            ? await ensureTrack({
                songId,
                source: trackSource,
                mediaUrl: manualUrl || '',
                appleMusicId: resolvedAppleMusicId,
                duration: manual.duration ? Math.round(manual.duration) : null,
                audioOnly: manual.audioOnly || isAudioUrl(manualUrl),
                backingOnly: !!manual.backingAudioOnly,
                addedBy: hostName || 'Host'
            })
            : null;
        let resolvedLyrics = manual.lyrics || '';
        let resolvedTimedLyrics = manual.lyricsTimed || null;
        let resolvedLyricsSource = manual.lyricsTimed ? 'apple' : (manual.lyrics ? 'manual' : '');
        if (!resolvedLyrics && !resolvedTimedLyrics && resolvedAppleMusicId) {
            const fetched = await fetchAppleTimedLyrics(manualTitle, manualArtist);
            if (fetched) {
                resolvedLyrics = fetched.lyrics || '';
                resolvedTimedLyrics = fetched.lyricsTimed || null;
                resolvedLyricsSource = fetched.lyricsSource || '';
            }
        }
        if (!resolvedLyrics && !resolvedTimedLyrics) {
            const generated = await fetchAiLyricsFallback(manualTitle, manualArtist);
            if (generated) {
                resolvedLyrics = generated.lyrics || '';
                resolvedLyricsSource = generated.lyricsSource || 'ai';
            }
        }
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
            roomCode,
            songId,
            trackId: trackRecord?.trackId || null,
            trackSource: trackSource || null,
            songTitle: manualTitle,
            artist: manualArtist,
            singerName: manual.singer,
            mediaUrl: manualUrl,
            albumArtUrl: manual.art || '',
            lyrics: resolvedLyrics,
            lyricsTimed: resolvedTimedLyrics,
            appleMusicId: resolvedAppleMusicId,
            musicSource: resolvedAppleMusicId ? 'apple' : '',
            lyricsSource: resolvedLyricsSource,
            duration: manual.duration ? Math.round(manual.duration) : 180,
            status: 'requested',
            timestamp: serverTimestamp(),
            priorityScore: Date.now(),
            emoji: EMOJI.mic,
            backingAudioOnly: manual.backingAudioOnly || false,
            audioOnly: manual.audioOnly || isAudioUrl(manualUrl)
        });
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
        toast('Song Added!');
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
                let songId = initialSongId;
                try {
                    const songRecord = await ensureSong({
                        title: r.trackName,
                        artist: r.artistName || 'Unknown',
                        artworkUrl: r.source === 'itunes' ? itunesArt : r.artworkUrl100 || '',
                        itunesId: isApple ? r.trackId : '',
                        appleMusicId: nextSong.appleMusicId,
                        verifyMeta: { lyricsSource: null, lyricsTimed: false },
                        verifiedBy: hostName || 'host'
                    });
                    songId = songRecord?.songId || songId;
                } catch (err) {
                    console.warn('ensureSong failed', err);
                }

                let trackRecord = null;
                if (trackSource) {
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
                        console.warn('ensureTrack failed', err);
                    }
                }

                try {
                    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', docRef.id), {
                        songId,
                        trackId: trackRecord?.trackId || null
                    });
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
                lyricsResolution: '',
                lyricsMessage: ''
            };
        } catch (err) {
            console.warn('Failed to queue song', err);
            toast('Could not add song (permissions)');
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

    return {
        addSong,
        addSongFromResult,
        startEdit,
        saveEdit,
        generateLyrics,
        syncEditDuration,
        addBonusToCurrent
    };
};

export default useQueueSongActions;
