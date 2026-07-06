import { APP_ID } from '../../lib/assets';
import { db, doc, serverTimestamp, setDoc, updateDoc } from '../../lib/firebase';
import {
    buildSongKey,
    ensureSong,
    ensureTrack,
    extractYouTubeId,
    recordTrackFeedback
} from '../../lib/songCatalog';
import { buildTrustedCatalogEntry } from '../../lib/songRequestResolution';
import {
    normalizeBackingCandidateTelemetry,
    normalizeBackingTrackCandidate,
} from '../../lib/backingTrackRanking';
import {
    buildRejectedReviewState,
    buildResolvedReviewState,
} from '../../lib/queueSongReviewState';
import {
    RESOLUTION_STATUSES,
    isAudienceSelectedUnverifiedResolution,
} from '../../lib/requestModes';
import { normalizeYouTubePlaybackState } from '../../lib/youtubePlaybackStatus';

const getQueueSongRef = (songId = '') => doc(
    db,
    'artifacts',
    APP_ID,
    'public',
    'data',
    'karaoke_songs',
    String(songId || '').trim()
);
const getHostLibraryRef = (roomCode = '') => doc(
    db,
    'artifacts',
    APP_ID,
    'public',
    'data',
    'host_libraries',
    String(roomCode || '').trim()
);
const nowMs = () => Date.now();
const HOST_REVIEW_RETURN_LABEL = 'Needs your update';
const HOST_REVIEW_RETURN_DETAIL = 'The host sent this back so you can swap the backing track or ask for help.';

const buildRankedBackingCandidatePatch = ({
    song = {},
    songLike = {},
    existingEntry = {},
    videoId = '',
    mediaUrl = '',
    rating = 'up',
} = {}) => {
    const existingTelemetry = normalizeBackingCandidateTelemetry(existingEntry?.backingTelemetry || existingEntry?.telemetry || {});
    const telemetry = {
        ...existingTelemetry,
        hostUpvotes: existingTelemetry.hostUpvotes + (rating === 'down' ? 0 : 1),
        hostDownvotes: existingTelemetry.hostDownvotes + (rating === 'down' ? 1 : 0),
        usageCount: existingTelemetry.usageCount + 1,
        completionCount: existingTelemetry.completionCount + (rating === 'down' ? 0 : 1),
        skipCount: existingTelemetry.skipCount + (rating === 'down' ? 1 : 0),
    };
    const normalized = normalizeBackingTrackCandidate({
        canonicalSongId: song.songId,
        appleMusicId: songLike?.appleMusicId || existingEntry?.appleMusicId || '',
        provider: 'youtube',
        videoId,
        mediaUrl,
        title: song.songTitle || existingEntry?.trackName || '',
        artist: song.artist || existingEntry?.artistName || '',
        embeddable: songLike?.embeddable ?? existingEntry?.embeddable,
        uploadStatus: songLike?.uploadStatus || existingEntry?.uploadStatus || '',
        privacyStatus: songLike?.privacyStatus || existingEntry?.privacyStatus || '',
        youtubePlaybackStatus: songLike?.youtubePlaybackStatus || existingEntry?.youtubePlaybackStatus || '',
        backingAudioOnly: songLike?.backingAudioOnly === true || existingEntry?.backingAudioOnly === true,
        titleIntentMatch: 1,
        durationFit: Number(songLike?.durationFit ?? existingEntry?.durationFit ?? 0) || 0,
        sourceTrust: 1,
        viewCount: Number(songLike?.viewCount ?? existingEntry?.viewCount ?? 0) || 0,
        telemetry,
    }, {
        canonicalSongId: song.songId,
        appleMusicId: songLike?.appleMusicId || existingEntry?.appleMusicId || '',
        title: song.songTitle,
        artist: song.artist,
    });
    return {
        canonicalSongId: normalized.canonicalSongId,
        appleMusicId: normalized.appleMusicId,
        backingCandidateId: normalized.candidateId,
        backingProvider: normalized.provider,
        providerTrackId: normalized.providerTrackId,
        rankingScore: normalized.rankingScore,
        backingTelemetry: normalized.telemetry,
        titleIntentMatch: normalized.titleIntentMatch,
        durationFit: normalized.durationFit,
        sourceTrust: normalized.sourceTrust,
    };
};

const buildQueueSongYouTubePlaybackPatch = (candidate = null) => {
    const candidateSource = String(candidate?.source || '').trim().toLowerCase();
    const candidateMediaUrl = String(candidate?.mediaUrl || '').trim();
    const isYouTube = candidateSource === 'youtube' || !!extractYouTubeId(candidateMediaUrl);
    if (!isYouTube) {
        return {
            backingAudioOnly: false,
            youtubeEmbeddable: null,
            youtubeUploadStatus: '',
            youtubePrivacyStatus: '',
            youtubePlaybackStatus: '',
        };
    }
    const playbackState = normalizeYouTubePlaybackState(candidate || {});
    return {
        backingAudioOnly: playbackState.backingAudioOnly,
        youtubeEmbeddable: playbackState.embeddable,
        youtubeUploadStatus: playbackState.uploadStatus,
        youtubePrivacyStatus: playbackState.privacyStatus,
        youtubePlaybackStatus: playbackState.youtubePlaybackStatus,
    };
};

export const markQueueReviewAutoSuggestionProcessing = async ({ songId, searchQuery = '' } = {}) => (
    updateDoc(getQueueSongRef(songId), {
        reviewAutoSuggestionState: 'processing',
        reviewAutoSuggestionQuery: String(searchQuery || '').trim(),
        reviewAutoSuggestionUpdatedAt: serverTimestamp()
    })
);

export const markQueueReviewAutoSuggestionReady = async ({
    songId,
    topScore = 0,
    candidateCount = 0,
} = {}) => (
    updateDoc(getQueueSongRef(songId), {
        reviewAutoSuggestionState: 'review_ready',
        reviewAutoSuggestionTopScore: Number(topScore || 0),
        reviewAutoSuggestionCandidateCount: Math.max(0, Number(candidateCount || 0)),
        reviewAutoSuggestionUpdatedAt: serverTimestamp()
    })
);

export const markQueueReviewAutoSuggestionFallback = async ({ songId } = {}) => (
    updateDoc(getQueueSongRef(songId), {
        reviewAutoSuggestionState: 'review_ready',
        reviewAutoSuggestionUpdatedAt: serverTimestamp()
    })
);

export const applyQueueReviewAutoResolvedCandidate = async ({
    song = null,
    candidate = null,
} = {}) => {
    const songId = String(song?.id || '').trim();
    if (!songId || !candidate) return;
    const candidateSource = String(candidate?.source || '').trim().toLowerCase();
    const candidateMediaUrl = String(candidate?.mediaUrl || '').trim();
    const candidateAppleMusicId = String(candidate?.appleMusicId || '').trim();
    const candidateTrackId = String(candidate?.trackId || '').trim();
    await updateDoc(getQueueSongRef(songId), {
        trackId: candidateTrackId || null,
        trackSource: candidateSource || null,
        mediaUrl: candidateMediaUrl,
        appleMusicId: candidateAppleMusicId,
        ...buildQueueSongYouTubePlaybackPatch(candidate),
        ...buildResolvedReviewState({
            currentStatus: song?.status,
            candidateLayer: String(candidate?.layer || 'host_auto').trim() || 'host_auto',
            candidateSource
        }),
        playbackReady: !!(candidateMediaUrl || candidateAppleMusicId || candidateTrackId),
        mediaResolutionStatus: 'host_auto_selected',
        reviewAutoSuggestionState: 'auto_resolved',
        reviewAutoSuggestionTopScore: Number(candidate?.score || 0),
        reviewAutoSuggestionUpdatedAt: serverTimestamp()
    });
};

export const applyResolvedQueueReviewSelection = async ({
    song = null,
    candidate = null,
    resolvedSongId = '',
    resolvedTrackId = '',
    resolvedByUid = null,
    saveFavorite = false,
    submitTrustedReview = false,
} = {}) => {
    const songId = String(song?.id || '').trim();
    if (!songId || !candidate) return;
    const candidateSource = String(
        candidate?.source || (candidate?.appleMusicId ? 'apple' : candidate?.mediaUrl ? 'youtube' : 'custom')
    ).trim().toLowerCase();
    await updateDoc(getQueueSongRef(songId), {
        songId: String(resolvedSongId || song?.songId || '').trim() || null,
        trackId: String(resolvedTrackId || song?.trackId || '').trim() || null,
        trackSource: candidateSource || null,
        mediaUrl: candidate?.mediaUrl || '',
        appleMusicId: candidate?.appleMusicId || '',
        ...buildQueueSongYouTubePlaybackPatch(candidate),
        ...buildResolvedReviewState({
            currentStatus: song?.status,
            candidateLayer: candidate?.layer || 'room_recent',
            candidateSource,
            saveFavorite: !!saveFavorite,
            submitTrustedReview: !!submitTrustedReview
        }),
        reviewResolvedAt: serverTimestamp(),
        reviewResolvedBy: resolvedByUid || null,
    });
};

export const resolveQueueReviewSelectionForHost = async ({
    song = null,
    candidate = null,
    hostName = '',
    resolvedByUid = null,
    saveFavorite = false,
    submitTrustedReview = false,
    persistTrustedCatalogChoice = null,
} = {}) => {
    if (!song?.id || !candidate) return null;
    const canonicalTitle = String(song?.songTitle || '').trim();
    const canonicalArtist = String(song?.artist || 'Unknown').trim() || 'Unknown';
    const songRecord = await ensureSong({
        title: canonicalTitle,
        artist: canonicalArtist,
        artworkUrl: song?.albumArtUrl || '',
        verifyMeta: false,
        verifiedBy: hostName || 'host'
    });
    const resolvedSongId = songRecord?.songId || song?.songId || buildSongKey(canonicalTitle, canonicalArtist);
    const candidateSource = String(
        candidate?.source || (candidate?.appleMusicId ? 'apple' : candidate?.mediaUrl ? 'youtube' : 'custom')
    ).trim().toLowerCase();
    const trackRecord = await ensureTrack({
        songId: resolvedSongId,
        source: candidateSource || 'custom',
        mediaUrl: candidate?.mediaUrl || '',
        appleMusicId: candidate?.appleMusicId || '',
        label: candidate?.label || null,
        duration: candidate?.duration ?? song?.duration ?? null,
        audioOnly: candidateSource === 'apple',
        backingOnly: true,
        addedBy: hostName || 'Host',
        approvalState: submitTrustedReview ? 'submitted' : (candidate?.approvalState || 'candidate'),
        qualityScore: candidate?.score || candidate?.qualityScore || 0
    });
    const resolvedTrackId = trackRecord?.trackId || song?.trackId || null;
    await applyResolvedQueueReviewSelection({
        song,
        candidate,
        resolvedSongId,
        resolvedTrackId,
        resolvedByUid,
        saveFavorite,
        submitTrustedReview
    });
    if (saveFavorite && typeof persistTrustedCatalogChoice === 'function') {
        await persistTrustedCatalogChoice(song, {
            ...candidate,
            trackId: trackRecord?.trackId || candidate?.trackId || ''
        }, 'host_favorite');
    }
    return {
        resolvedSongId,
        resolvedTrackId
    };
};

export const persistTrustedCatalogChoiceForRoom = async ({
    roomCode = '',
    trustedCatalog = {},
    song = null,
    candidate = null,
    layer = 'host_favorite'
} = {}) => {
    const safeRoomCode = String(roomCode || '').trim();
    if (!safeRoomCode || !song?.songTitle || !candidate) return null;
    const resolvedSongId = String(song.songId || buildSongKey(song.songTitle, song.artist || 'Unknown')).trim();
    if (!resolvedSongId) return null;
    const currentEntry = (trustedCatalog?.[resolvedSongId] && typeof trustedCatalog[resolvedSongId] === 'object')
        ? trustedCatalog[resolvedSongId]
        : {};
    const nextEntry = buildTrustedCatalogEntry({
        existing: currentEntry,
        songId: resolvedSongId,
        title: song.songTitle || '',
        artist: song.artist || 'Unknown',
        trackId: candidate.trackId || '',
        mediaUrl: candidate.mediaUrl || '',
        appleMusicId: candidate.appleMusicId || '',
        source: candidate.source || '',
        label: candidate.label || '',
        layer,
        qualityScore: candidate.score || candidate.qualityScore || 0,
        rankingScore: candidate.rankingScore || 0,
        backingCandidateId: candidate.backingCandidateId || '',
        canonicalSongId: candidate.canonicalSongId || resolvedSongId,
        backingTelemetry: candidate.backingTelemetry || null,
        approvalState: layer === 'host_favorite' ? 'approved' : (candidate.approvalState || 'candidate')
    });
    await setDoc(getHostLibraryRef(safeRoomCode), {
        trustedCatalog: {
            [resolvedSongId]: nextEntry
        },
        updatedAt: serverTimestamp()
    }, { merge: true });
    return nextEntry;
};

export const clearTrustedCatalogBackingForRoom = async ({
    roomCode = '',
    trustedCatalog = {},
    song = null,
    candidate = {}
} = {}) => {
    const safeRoomCode = String(roomCode || '').trim();
    if (!safeRoomCode || !song?.songTitle) return false;
    const resolvedSongId = String(song.songId || buildSongKey(song.songTitle, song.artist || 'Unknown')).trim();
    if (!resolvedSongId) return false;
    const currentEntry = (trustedCatalog?.[resolvedSongId] && typeof trustedCatalog[resolvedSongId] === 'object')
        ? trustedCatalog[resolvedSongId]
        : null;
    if (!currentEntry) return false;

    const candidateMediaUrl = String(candidate.mediaUrl || '').trim();
    const candidateTrackId = String(candidate.trackId || '').trim();
    const candidateAppleMusicId = String(candidate.appleMusicId || '').trim();
    const candidateVideoId = extractYouTubeId(candidateMediaUrl);
    const prefixes = ['hostFavorite', 'roomRecent'];
    let changed = false;
    const nextEntry = {
        ...currentEntry,
        songId: resolvedSongId,
        title: String(song.songTitle || currentEntry.title || '').trim(),
        artist: String(song.artist || currentEntry.artist || 'Unknown').trim(),
        updatedAtMs: nowMs()
    };

    prefixes.forEach((prefix) => {
        const existingMediaUrl = String(currentEntry[`${prefix}MediaUrl`] || '').trim();
        const existingTrackId = String(currentEntry[`${prefix}TrackId`] || '').trim();
        const existingAppleMusicId = String(currentEntry[`${prefix}AppleMusicId`] || '').trim();
        const existingVideoId = extractYouTubeId(existingMediaUrl);
        const matches = (
            (candidateTrackId && existingTrackId && candidateTrackId === existingTrackId)
            || (candidateAppleMusicId && existingAppleMusicId && candidateAppleMusicId === existingAppleMusicId)
            || (candidateMediaUrl && existingMediaUrl && candidateMediaUrl === existingMediaUrl)
            || (candidateVideoId && existingVideoId && candidateVideoId === existingVideoId)
        );
        if (!matches) return;
        changed = true;
        nextEntry[`${prefix}TrackId`] = '';
        nextEntry[`${prefix}MediaUrl`] = '';
        nextEntry[`${prefix}AppleMusicId`] = '';
        nextEntry[`${prefix}Source`] = '';
        nextEntry[`${prefix}Label`] = '';
        nextEntry[`${prefix}QualityScore`] = 0;
        nextEntry[`${prefix}RankingScore`] = 0;
        nextEntry[`${prefix}BackingCandidateId`] = '';
        nextEntry[`${prefix}CanonicalSongId`] = '';
        nextEntry[`${prefix}BackingTelemetry`] = null;
        nextEntry[`${prefix}ApprovalState`] = 'candidate';
        nextEntry[`${prefix}UpdatedAtMs`] = nowMs();
    });

    if (!changed) return false;
    await setDoc(getHostLibraryRef(safeRoomCode), {
        trustedCatalog: {
            [resolvedSongId]: nextEntry
        },
        updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
};

export const saveHostBackingPreferenceForRoom = async ({
    roomCode = '',
    trustedCatalog = {},
    ytIndex = [],
    songLike = null,
    rating = 'up',
    onUpsertYtIndexEntries = null,
    onPersistTrustedCatalogChoice = null,
    onTrackFeedbackError = null
} = {}) => {
    const mediaUrl = String(songLike?.mediaUrl || '').trim();
    const videoId = extractYouTubeId(mediaUrl);
    if (!videoId) {
        return { handled: false, reason: 'non_youtube' };
    }
    if (typeof onUpsertYtIndexEntries !== 'function') {
        throw new Error('YouTube index updater is unavailable.');
    }
    const songTitle = String(songLike?.songTitle || '').trim();
    const artist = String(songLike?.artist || 'Unknown').trim() || 'Unknown';
    const song = {
        songId: String(songLike?.songId || buildSongKey(songTitle, artist)).trim(),
        songTitle,
        artist
    };
    const existingEntry = Array.isArray(ytIndex)
        ? ytIndex.find((entry) => String(entry?.videoId || '').trim() === videoId)
        : null;
    const baseQualityScore = Math.max(0, Number(existingEntry?.qualityScore || 0));
    const explicitEmbeddable = songLike?.embeddable === true
        || songLike?.youtubeEmbeddable === true
        || existingEntry?.embeddable === true
        || String(songLike?.youtubePlaybackStatus || existingEntry?.youtubePlaybackStatus || '').trim().toLowerCase() === 'embeddable';
    const playbackState = normalizeYouTubePlaybackState({
        playable: songLike?.playable === true || existingEntry?.playable === true || explicitEmbeddable,
        embeddable: explicitEmbeddable,
        uploadStatus: songLike?.uploadStatus || songLike?.youtubeUploadStatus || existingEntry?.uploadStatus || '',
        privacyStatus: songLike?.privacyStatus || songLike?.youtubePrivacyStatus || existingEntry?.privacyStatus || '',
        youtubePlaybackStatus: explicitEmbeddable ? 'embeddable' : (songLike?.youtubePlaybackStatus || existingEntry?.youtubePlaybackStatus || ''),
        backingAudioOnly: songLike?.backingAudioOnly === true || existingEntry?.backingAudioOnly === true,
    });
    const rankingPatch = buildRankedBackingCandidatePatch({
        song,
        songLike: {
            ...songLike,
            embeddable: playbackState.embeddable,
            uploadStatus: playbackState.uploadStatus,
            privacyStatus: playbackState.privacyStatus,
            youtubePlaybackStatus: playbackState.youtubePlaybackStatus,
            backingAudioOnly: playbackState.backingAudioOnly,
        },
        existingEntry,
        videoId,
        mediaUrl,
        rating
    });
    const candidate = {
        trackId: String(songLike?.trackId || '').trim(),
        mediaUrl,
        appleMusicId: String(songLike?.appleMusicId || rankingPatch.appleMusicId || '').trim(),
        source: 'youtube',
        label: 'Host-approved YouTube track',
        playable: playbackState.playable,
        embeddable: playbackState.embeddable,
        uploadStatus: playbackState.uploadStatus,
        privacyStatus: playbackState.privacyStatus,
        youtubePlaybackStatus: playbackState.youtubePlaybackStatus,
        backingAudioOnly: playbackState.backingAudioOnly,
        qualityScore: Math.max(baseQualityScore, 120),
        ...rankingPatch
    };

    if (rating === 'down') {
        await onUpsertYtIndexEntries([{
            videoId,
            trackName: songTitle || existingEntry?.trackName || 'YouTube Track',
            artistName: artist || existingEntry?.artistName || 'YouTube',
            artworkUrl100: songLike?.albumArtUrl || existingEntry?.artworkUrl100 || '',
            url: mediaUrl,
            playable: false,
            qualityScore: 0,
            sourceDetail: 'Host marked this track as a bad fit for future requests.',
            sourceDiscovery: 'host_feedback',
            failureCountDelta: 1,
            ...rankingPatch
        }]);
        if (roomCode) {
            await recordTrackFeedback({
                rating: 'down',
                roomCode,
                songId: song.songId,
                title: songTitle,
                artist,
                mediaUrl,
                appleMusicId: candidate.appleMusicId,
                trackId: candidate.trackId,
                source: candidate.source,
                label: candidate.label,
                qualityScore: candidate.qualityScore,
                backingCandidateId: candidate.backingCandidateId,
                canonicalSongId: candidate.canonicalSongId,
                rankingScore: candidate.rankingScore,
                backingTelemetry: candidate.backingTelemetry,
                albumArtUrl: songLike?.albumArtUrl || existingEntry?.artworkUrl100 || '',
                verifiedBy: 'host'
            }).catch((error) => {
                if (typeof onTrackFeedbackError === 'function') {
                    onTrackFeedbackError(error);
                }
            });
        }
        await clearTrustedCatalogBackingForRoom({
            roomCode,
            trustedCatalog,
            song,
            candidate
        });
        return { handled: true, preference: 'down', videoId, song, candidate };
    }

    await onUpsertYtIndexEntries([{
        videoId,
        trackName: songTitle || existingEntry?.trackName || 'YouTube Track',
        artistName: artist || existingEntry?.artistName || 'YouTube',
        artworkUrl100: songLike?.albumArtUrl || existingEntry?.artworkUrl100 || '',
        url: mediaUrl,
        playable: true,
        embeddable: candidate?.embeddable === true || existingEntry?.embeddable === true,
        uploadStatus: candidate?.uploadStatus || existingEntry?.uploadStatus || '',
        privacyStatus: candidate?.privacyStatus || existingEntry?.privacyStatus || '',
        youtubePlaybackStatus: candidate?.youtubePlaybackStatus || existingEntry?.youtubePlaybackStatus || '',
        backingAudioOnly: candidate?.backingAudioOnly === true || existingEntry?.backingAudioOnly === true,
        qualityScore: Math.max(baseQualityScore, 140),
        sourceDetail: 'Host marked this track as a good fit for future requests.',
        sourceDiscovery: 'host_feedback',
        ...rankingPatch
    }]);
    if (typeof onPersistTrustedCatalogChoice === 'function') {
        await onPersistTrustedCatalogChoice(song, candidate, 'host_favorite');
    } else {
        await persistTrustedCatalogChoiceForRoom({
            roomCode,
            trustedCatalog,
            song,
            candidate,
            layer: 'host_favorite'
        });
    }
    return { handled: true, preference: 'up', videoId, song, candidate };
};

export const applyRejectedQueueReviewSelection = async ({
    songId = '',
    resolvedByUid = null,
} = {}) => (
    updateDoc(getQueueSongRef(songId), {
        ...buildRejectedReviewState(),
        reviewResolvedAt: serverTimestamp(),
        reviewResolvedBy: resolvedByUid || null
    })
);

export const returnAudienceSelectedBackingToReview = async ({ songId = '' } = {}) => (
    updateDoc(getQueueSongRef(songId), {
        resolutionStatus: RESOLUTION_STATUSES.reviewRequired,
        resolutionLayer: 'manual_review',
        reviewRequestedAt: serverTimestamp(),
        audienceStatusTag: HOST_REVIEW_RETURN_LABEL,
        audienceStatusDetail: HOST_REVIEW_RETURN_DETAIL,
        audienceStatusTone: 'attention',
        audienceStatusUpdatedAt: serverTimestamp(),
    })
);

export const resolveAudienceSelectedBackingChoice = async ({ songLike = null } = {}) => {
    const songId = String(songLike?.id || '').trim();
    if (!songId || !isAudienceSelectedUnverifiedResolution(songLike?.resolutionStatus)) return;
    await updateDoc(getQueueSongRef(songId), {
        ...buildResolvedReviewState({
            currentStatus: songLike?.status,
            candidateLayer: 'host_favorite',
            candidateSource: 'youtube',
            saveFavorite: true
        }),
        reviewResolvedAt: serverTimestamp(),
        audienceStatusTag: '',
        audienceStatusDetail: '',
        audienceStatusTone: '',
        audienceStatusUpdatedAt: serverTimestamp(),
    });
};

export const applyAudienceSelectedBackingDecision = async ({
    songLike = null,
    action = 'approve',
    onRateBackingPreference = null
} = {}) => {
    const safeAction = String(action || 'approve').trim().toLowerCase();
    const songId = String(songLike?.id || '').trim();
    if (!songId || typeof onRateBackingPreference !== 'function') {
        return { handled: false, outcome: 'ignored' };
    }

    if (!isAudienceSelectedUnverifiedResolution(songLike?.resolutionStatus)) {
        if (safeAction === 'approve') {
            await onRateBackingPreference(songLike, 'up');
            return { handled: true, outcome: 'saved_up' };
        }
        if (safeAction === 'avoid') {
            await onRateBackingPreference(songLike, 'down');
            return { handled: true, outcome: 'saved_down' };
        }
        return { handled: false, outcome: 'ignored' };
    }

    if (safeAction === 'avoid') {
        await onRateBackingPreference(songLike, 'down');
        if (String(songLike?.status || '').trim().toLowerCase() !== 'performing') {
            await returnAudienceSelectedBackingToReview({ songId });
            return { handled: true, outcome: 'returned_to_review' };
        }
        return { handled: true, outcome: 'saved_down' };
    }

    if (safeAction === 'approve') {
        await onRateBackingPreference(songLike, 'up');
        await resolveAudienceSelectedBackingChoice({ songLike });
        return { handled: true, outcome: 'approved_saved' };
    }

    return { handled: false, outcome: 'ignored' };
};
