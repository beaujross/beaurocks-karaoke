import {
  db,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';
import { normalizeBackingChoice, resolveStageMediaUrl } from '../../lib/playbackSource';

const nowMs = () => Date.now();

const createStageStartError = (code = 'stage_start_failed', message = 'Could not start this performance.') => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const normalizeDurationSec = (value = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
};

const getPerformanceSessionSourceType = ({
  usesAppleBacking = false,
  effectiveBacking = {},
  mediaUrl = '',
} = {}) => {
  if (usesAppleBacking) return 'apple_music';
  if (effectiveBacking?.isYouTube) return 'youtube';
  const safeMediaUrl = String(mediaUrl || '').trim().toLowerCase();
  if (/\.(mp3|m4a|wav|ogg|aac|flac)(\?|$)/i.test(safeMediaUrl)) return 'native_audio';
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(safeMediaUrl)) return 'native_video';
  return safeMediaUrl ? 'backing_media' : 'none';
};

const getAssociatedBackingDurationSec = (song = {}) => {
  const candidates = [
    song?.performanceStartedDurationSec,
    song?.backingPlan?.durationSec,
    song?.selectedBacking?.durationSec,
    song?.approvedBacking?.durationSec,
    song?.approvedBrowseBacking?.durationSec,
    song?.mediaDurationSec,
    song?.backingDurationSec,
    song?.trackDurationSec,
    song?.durationSec,
    song?.duration,
  ];
  for (const candidate of candidates) {
    const durationSec = normalizeDurationSec(candidate);
    if (durationSec > 0) return durationSec;
  }
  return 0;
};

export const startQueueSongOnStage = async ({
  songId = '',
  songs = [],
  room = {},
  roomCode = '',
  allowCurrentId = null,
  resolveDurationForUrl,
  isAudioUrl,
  holdAutoBgDuringStageActivation,
  playAppleMusicTrack,
  stopAppleMusic,
  updateRoom,
  logActivity,
  emoji = {},
  performanceMetaExtras = {},
  extraRoomUpdates = {},
} = {}) => {
  const safeSongId = String(songId || '').trim();
  if (!safeSongId) {
    throw createStageStartError('queue_item_missing', 'Queued item not found');
  }
  const queueSongs = Array.isArray(songs) ? songs : [];
  const safeAllowedCurrentId = String(allowCurrentId || '').trim();
  const currentSong = queueSongs.find((entry) => entry?.status === 'performing');
  if (currentSong && currentSong.id !== safeSongId && currentSong.id !== safeAllowedCurrentId) {
    throw createStageStartError('stage_blocked_existing_performer', 'Another singer is already on stage');
  }

  holdAutoBgDuringStageActivation?.();

  let queueSong = queueSongs.find((entry) => entry?.id === safeSongId) || null;
  if (!queueSong) {
    try {
      const songSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', safeSongId));
      if (songSnap.exists()) {
        queueSong = { id: safeSongId, ...songSnap.data() };
      }
    } catch (error) {
      throw createStageStartError(
        'queue_item_lookup_failed',
        error?.message || 'Failed to load queue item for stage start',
      );
    }
  }
  if (!queueSong) {
    throw createStageStartError('queue_item_missing', 'Queued item not found');
  }

  const roomSnapshot = room && typeof room === 'object' ? room : {};
  const stageMediaUrl = resolveStageMediaUrl(queueSong, roomSnapshot);
  const effectiveBacking = normalizeBackingChoice({
    mediaUrl: stageMediaUrl,
    appleMusicId: queueSong?.appleMusicId,
  });
  const songMediaUrl = effectiveBacking.mediaUrl;
  const useAppleBacking = effectiveBacking.usesAppleBacking;
  const performanceStartedAtMs = nowMs();
  const associatedBackingDurationSec = getAssociatedBackingDurationSec(queueSong);
  const resolvedBackingDurationSec = !useAppleBacking && songMediaUrl
    ? normalizeDurationSec(await resolveDurationForUrl(stageMediaUrl, isAudioUrl(stageMediaUrl)).catch(() => null))
    : 0;
  const measuredDuration = useAppleBacking
    ? Math.max(
      associatedBackingDurationSec,
      normalizeDurationSec(queueSong?.duration),
      normalizeDurationSec(roomSnapshot?.appleMusicPlayback?.durationSec),
    )
    : resolvedBackingDurationSec || associatedBackingDurationSec;
  const performanceDurationSec = Math.max(
    30,
    normalizeDurationSec(measuredDuration || queueSong?.duration || 180) || 180,
  );
  const durationSource = useAppleBacking
    ? 'apple_music'
    : resolvedBackingDurationSec > 0
      ? 'backing_media'
      : associatedBackingDurationSec > 0
        ? 'backing_metadata'
        : normalizeDurationSec(queueSong?.duration) > 0
          ? 'canonical_or_manual'
          : 'fallback';
  const durationConfidence = useAppleBacking || resolvedBackingDurationSec > 0
    ? 'high'
    : associatedBackingDurationSec > 0
      ? 'medium'
      : 'low';
  const autoEndSafe = useAppleBacking || resolvedBackingDurationSec > 0 || associatedBackingDurationSec > 0;
  const stageDisplayFlags = {
    showLyricsTv: !!roomSnapshot?.showLyricsTv,
    showVisualizerTv: !!roomSnapshot?.showVisualizerTv,
    showLyricsSinger: !!roomSnapshot?.showLyricsSinger,
  };
  const autoStartMedia = !!(roomSnapshot?.autoPlayMedia !== false) && !!(songMediaUrl || useAppleBacking);
  const performanceSessionId = `perf_${safeSongId}_${performanceStartedAtMs}`;
  const performanceSessionSourceType = getPerformanceSessionSourceType({
    usesAppleBacking: useAppleBacking,
    effectiveBacking,
    mediaUrl: songMediaUrl,
  });
  const currentPerformanceSession = {
    sessionId: performanceSessionId,
    songId: safeSongId,
    sourceType: performanceSessionSourceType,
    appleMusicId: queueSong?.appleMusicId || '',
    mediaUrl: songMediaUrl || '',
    startedAtMs: performanceStartedAtMs,
    playbackState: autoStartMedia ? 'starting' : 'idle',
    playerReportedDurationSec: performanceDurationSec,
    expectedDurationSec: performanceDurationSec,
    lastHeartbeatAtMs: autoStartMedia ? performanceStartedAtMs : 0,
    lastReportedAtMs: performanceStartedAtMs,
    completionReason: '',
    watchdogDeadlineMs: performanceStartedAtMs + ((performanceDurationSec + 90) * 1000),
  };

  await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', safeSongId), {
    status: 'performing',
    performingStartedAt: serverTimestamp(),
    performanceStartedDurationSec: performanceDurationSec,
    duration: performanceDurationSec,
    backingDurationSec: resolvedBackingDurationSec || associatedBackingDurationSec || null,
    durationSource,
    durationConfidence,
    autoEndSafe,
  });

  if (useAppleBacking && autoStartMedia) {
    await playAppleMusicTrack(queueSong.appleMusicId, {
      title: queueSong.songTitle,
      artist: queueSong.artist,
      duration: performanceDurationSec,
    });
    await updateRoom({
      activeMode: 'karaoke',
      'announcement.active': false,
      mediaUrl: '',
      singAlongMode: false,
      videoPlaying: false,
      videoStartTimestamp: null,
      pausedAt: null,
      currentPerformanceMeta: {
        songId: safeSongId,
        startedAtMs: performanceStartedAtMs,
        durationSec: performanceDurationSec,
        backingDurationSec: resolvedBackingDurationSec || associatedBackingDurationSec || null,
        durationSource,
        durationConfidence,
        autoEndSafe,
        source: 'apple_music',
        appleMusicId: queueSong.appleMusicId || '',
        ...performanceMetaExtras,
      },
      currentPerformanceSession,
      videoVolume: 100,
      ...stageDisplayFlags,
      ...extraRoomUpdates,
    });
  } else {
    await stopAppleMusic?.();
    await updateRoom({
      activeMode: 'karaoke',
      'announcement.active': false,
      mediaUrl: songMediaUrl,
      singAlongMode: false,
      videoPlaying: autoStartMedia && !!songMediaUrl,
      videoStartTimestamp: autoStartMedia ? performanceStartedAtMs : null,
      pausedAt: null,
      currentPerformanceMeta: {
        songId: safeSongId,
        startedAtMs: performanceStartedAtMs,
        durationSec: performanceDurationSec,
        backingDurationSec: resolvedBackingDurationSec || associatedBackingDurationSec || null,
        durationSource,
        durationConfidence,
        autoEndSafe,
        source: songMediaUrl ? 'backing_media' : 'none',
        mediaUrl: songMediaUrl || '',
        ...performanceMetaExtras,
      },
      currentPerformanceSession,
      videoVolume: 100,
      ...stageDisplayFlags,
      ...extraRoomUpdates,
      appleMusicPlayback: null,
    });
  }

  logActivity?.(roomCode, queueSong.singerName, 'took the stage!', emoji?.mic || 'mic');
  return {
    song: queueSong,
    performanceDurationSec,
    performanceStartedAtMs,
    useAppleBacking,
    autoStartMedia,
    songMediaUrl,
  };
};
