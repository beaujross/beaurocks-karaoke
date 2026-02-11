import {
    db,
    addDoc,
    collection,
    doc,
    updateDoc,
    serverTimestamp,
    increment,
    callFunction
} from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import { EMOJI } from '../../../lib/emoji';
import { buildSongKey, ensureSong, ensureTrack, extractYouTubeId } from '../../../lib/songCatalog';
import { normalizeBackingChoice } from '../../../lib/playbackSource';

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
    const fetchAppleTimedLyrics = async (title, artist) => {
        const safeTitle = (title || '').trim();
        if (!safeTitle) return null;
        try {
            const musicUserToken = getAppleMusicUserToken?.() || '';
            const res = await callFunction('appleMusicLyrics', {
                title: safeTitle,
                artist: (artist || '').trim(),
                storefront: 'us',
                musicUserToken
            });
            if (!res?.found && !res?.songId) return null;
            const hasTimedLyrics = Array.isArray(res?.timedLyrics) && res.timedLyrics.length > 0;
            return {
                appleMusicId: res?.songId ? String(res.songId) : '',
                lyrics: res?.lyrics || '',
                lyricsTimed: hasTimedLyrics ? res.timedLyrics : null,
                lyricsSource: hasTimedLyrics || res?.lyrics ? 'apple' : '',
                needsUserToken: !!res?.needsUserToken
            };
        } catch (err) {
            console.warn('Apple lyrics fetch failed', err);
            return null;
        }
    };

    const addSong = async () => {
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

    const addSongFromResult = async (r) => {
        if (!r?.trackName) return;
        const isApple = r.source === 'itunes';
        const explicitAppleId = isApple ? String(r.trackId || '') : '';
        const fetchedApple = await fetchAppleTimedLyrics(r.trackName, r.artistName || '');
        const appleId = fetchedApple?.appleMusicId || explicitAppleId;
        const preferAppleDefault = isApple && !!appleId;
        const playbackAppleMusicId = preferAppleDefault ? appleId : '';
        const itunesArt = (r.artworkUrl100 || '').replace('100x100', '600x600');
        let songId = buildSongKey(r.trackName, r.artistName || 'Unknown');
        try {
            const songRecord = await ensureSong({
                title: r.trackName,
                artist: r.artistName || 'Unknown',
                artworkUrl: r.source === 'itunes' ? itunesArt : r.artworkUrl100 || '',
                itunesId: isApple ? r.trackId : '',
                appleMusicId: playbackAppleMusicId,
                verifyMeta: { lyricsSource: null, lyricsTimed: false },
                verifiedBy: hostName || 'host'
            });
            songId = songRecord?.songId || songId;
        } catch (err) {
            console.warn('ensureSong failed', err);
        }
        const trackSource = preferAppleDefault
            ? 'apple'
            : (r.source === 'youtube' ? 'youtube' : r.source === 'local' ? 'custom' : (isApple ? 'apple' : ''));
        const mediaUrl = preferAppleDefault ? '' : (r.source === 'youtube' || r.source === 'local' ? (r.url || '') : '');
        let trackRecord = null;
        if (trackSource) {
            try {
                trackRecord = await ensureTrack({
                    songId,
                    source: trackSource,
                    mediaUrl,
                    appleMusicId: playbackAppleMusicId,
                    duration: manual.duration || null,
                    audioOnly: trackSource === 'apple' ? true : r.mediaType === 'audio' || isAudioUrl(r.url),
                    backingOnly: false,
                    addedBy: hostName || 'Host'
                });
            } catch (err) {
                console.warn('ensureTrack failed', err);
            }
        }
        const nextSong = {
            song: r.trackName,
            artist: r.artistName || '',
            singer: manual.singer || room?.hostName || hostName || 'Host',
            url: mediaUrl,
            art: r.source === 'itunes' ? itunesArt : r.artworkUrl100 || '',
            lyrics: fetchedApple?.lyrics || '',
            lyricsTimed: fetchedApple?.lyricsTimed || null,
            appleMusicId: playbackAppleMusicId,
            duration: manual.duration || 180,
            backingAudioOnly: false,
            audioOnly: trackSource === 'apple' ? true : r.mediaType === 'audio' || isAudioUrl(r.url)
        };
        try {
            const docRef = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
                roomCode,
                songId,
                trackId: trackRecord?.trackId || null,
                trackSource: trackSource || null,
                songTitle: nextSong.song,
                artist: nextSong.artist,
                singerName: nextSong.singer,
                mediaUrl: nextSong.url,
                albumArtUrl: nextSong.art || '',
                lyrics: nextSong.lyrics || '',
                lyricsTimed: nextSong.lyricsTimed || null,
                appleMusicId: nextSong.appleMusicId,
                musicSource: nextSong.appleMusicId ? 'apple' : '',
                lyricsSource: fetchedApple?.lyricsSource || '',
                duration: nextSong.duration ? Math.round(nextSong.duration) : 180,
                status: 'requested',
                timestamp: serverTimestamp(),
                priorityScore: Date.now(),
                emoji: EMOJI.mic,
                backingAudioOnly: nextSong.backingAudioOnly || false,
                audioOnly: nextSong.audioOnly || isAudioUrl(nextSong.url)
            });
            const statusText = fetchedApple?.lyricsTimed?.length
                ? 'Queued with Apple backing and timed lyrics'
                : fetchedApple?.lyrics
                    ? 'Queued with Apple backing and plain lyrics'
                    : (preferAppleDefault ? 'Queued with Apple backing' : 'Queued');
            toast(statusText);
            return {
                id: docRef.id,
                songTitle: nextSong.song,
                artist: nextSong.artist,
                singerName: nextSong.singer,
                mediaUrl: nextSong.url,
                albumArtUrl: nextSong.art || '',
                lyrics: nextSong.lyrics || '',
                lyricsTimed: nextSong.lyricsTimed || null,
                appleMusicId: nextSong.appleMusicId || '',
                duration: nextSong.duration ? Math.round(nextSong.duration) : 180,
                statusText
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
