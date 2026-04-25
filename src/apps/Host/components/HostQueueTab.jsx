import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AddToQueueFormBody from './AddToQueueFormBody';
import SoundboardControls from './SoundboardControls';
import HostChatPanel from './HostChatPanel';
import QueueListPanel from './QueueListPanel';
import HostLiveOpsPanel from './HostLiveOpsPanel';
import StageNowPlayingPanel from './StageNowPlayingPanel';
import RunOfShowQueueHud from './RunOfShowQueueHud';
import useQueueTabState from '../hooks/useQueueTabState';
import useQueueDerivedState from '../hooks/useQueueDerivedState';
import useQueueSurfaceController from '../hooks/useQueueSurfaceController';
import useQueueReorder from '../hooks/useQueueReorder';
import useQueueMediaTools from '../hooks/useQueueMediaTools';
import useQueueSongActions from '../hooks/useQueueSongActions';
import { useToast } from '../../../context/ToastContext';
import {
  db,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  auth,
  callFunction,
} from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import { SOUNDS } from '../../../lib/gameDataConstants';
import { createLogger } from '../../../lib/logger';
import { POP_TRIVIA_VOTE_TYPE } from '../../../lib/popTrivia';
import HOST_UI_FEATURE_CHECKLIST from '../hostUiFeatureChecklist';
import {
  applyAudienceSelectedBackingDecision,
  applyQueueReviewAutoResolvedCandidate,
  applyRejectedQueueReviewSelection,
  markQueueReviewAutoSuggestionFallback,
  markQueueReviewAutoSuggestionProcessing,
  markQueueReviewAutoSuggestionReady,
  persistTrustedCatalogChoiceForRoom,
  resolveQueueReviewSelectionForHost,
  saveHostBackingPreferenceForRoom,
} from '../queueSongReviewActions';
import { buildSongKey, ensureSong } from '../../../lib/songCatalog';
import {
  buildCollaborationSuggestionMap,
  rankSongRequestCandidates,
} from '../../../lib/songRequestResolution';
import {
  getYouTubeEmbedCacheStatus,
  isYouTubeEmbeddable,
  normalizeYouTubePlaybackState,
  YOUTUBE_PLAYBACK_STATUSES,
} from '../../../lib/youtubePlaybackStatus';
import { normalizeBackingChoice, resolveStageMediaUrl } from '../../../lib/playbackSource';
import {
  AUTO_DJ_EVENTS,
  createAutoDjSequenceState,
  transitionAutoDjSequenceState,
  deriveAutoDjStepItems,
  describeAutoDjSequenceState,
} from '../autoDjStateMachine';
import { getAutoEndSchedule, getTrackDurationSecFromSearchResult } from '../hostPlaybackAutomation';

const QueueYouTubeSearchModal = React.lazy(() => import('./QueueYouTubeSearchModal'));
const QueueEditSongModal = React.lazy(() => import('./QueueEditSongModal'));
const hostLogger = createLogger('HostQueueTab');
const nowMs = () => Date.now();

const stripKaraokeDecorators = (value = '') =>
  String(value || '')
    .replace(/\s*-\s*Karaoke Version(?:\s+from\s+.*)?$/i, '')
    .replace(/\s*\((?:official\s+)?(?:karaoke|instrumental)(?:\s+version|\s+track|\s+video)?\)\s*$/i, '')
    .replace(/\s*\[(?:official\s+)?(?:karaoke|instrumental).*?\]\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const parseDecoratedSongTitle = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return { title: '', artist: '' };

  const karaokeVersionMatch = raw.match(/^(.*?)\s*-\s*(.*?)\s*-\s*Karaoke Version(?: from (.*))?$/i);
  if (karaokeVersionMatch) {
    return {
      title: stripKaraokeDecorators(String(karaokeVersionMatch[2] || '').trim() || raw),
      artist: String(karaokeVersionMatch[1] || '').trim(),
    };
  }

  const instrumentalPipeMatch = raw.match(/^(.*?)\s*\((?:karaoke|instrumental)\)\s*\|\s*(.*)$/i);
  if (instrumentalPipeMatch) {
    return {
      title: stripKaraokeDecorators(String(instrumentalPipeMatch[1] || '').trim() || raw),
      artist: String(instrumentalPipeMatch[2] || '').trim(),
    };
  }

  return {
    title: stripKaraokeDecorators(raw),
    artist: '',
  };
};

const getRecapDisplayMeta = (song = {}) => {
  const rawSongTitle = String(song?.songTitle || song?.title || '').trim();
  const parsed = parseDecoratedSongTitle(rawSongTitle);
  const explicitArtist = String(song?.canonicalArtist || song?.artist || '').trim();
  const shouldPreferParsedArtist = !explicitArtist || /karaoke|instrumental|youtube/i.test(explicitArtist);

  return {
    songTitle: stripKaraokeDecorators(
      String(song?.canonicalTitle || song?.displaySongTitle || parsed.title || rawSongTitle).trim(),
    ) || 'Featured Performance',
    artist: shouldPreferParsedArtist ? (parsed.artist || explicitArtist) : explicitArtist,
    singerName: String(song?.singerName || song?.performerName || song?.displayName || '').trim() || 'Guest',
    sourceSongTitle: rawSongTitle || null,
  };
};

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
  ];
  for (const candidate of candidates) {
    const durationSec = normalizeDurationSec(candidate);
    if (durationSec > 0) return durationSec;
  }
  return 0;
};

const startQueueSongOnStage = async ({
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

const parseYouTubeVideoId = (input = '') => {
  if (!input) return '';
  try {
    const url = new URL(input.trim());
    if (url.hostname.includes('youtu.be')) return url.pathname.replace('/', '');
    const v = url.searchParams.get('v');
    if (v) return v;
  } catch (_error) {
    // noop
  }
  return input.trim().length >= 6 ? input.trim() : '';
};

const buildQueueReviewSearchQuery = (song = {}) => (
  [song?.songTitle, song?.artist].map((value) => String(value || '').trim()).filter(Boolean).join(' ')
);

const isStrongQueueReviewCandidate = (candidate = null) => {
  if (!candidate || typeof candidate !== 'object') return false;
  const score = Number(candidate.score || 0);
  const titleScore = Number(candidate.titleScore || 0);
  const artistScore = Number(candidate.artistScore || 0);
  const layer = String(candidate.layer || '').trim().toLowerCase();
  const approvalState = String(candidate.approvalState || '').trim().toLowerCase();
  if (score >= 300) return true;
  if (score >= 240 && titleScore >= 80 && (artistScore >= 24 || approvalState === 'approved')) return true;
  if ((layer === 'host_favorite' || layer === 'room_recent') && score >= 220 && titleScore >= 80) return true;
  return false;
};

const isYouTubeQueueReviewCandidate = (candidate = null) => {
  if (!candidate || typeof candidate !== 'object') return false;
  const source = String(candidate.source || '').trim().toLowerCase();
  const mediaUrl = String(candidate.mediaUrl || '').trim();
  return source === 'youtube' || !!parseYouTubeVideoId(mediaUrl);
};

const prioritizeQueueReviewCandidates = (candidates = []) => (
  [...(Array.isArray(candidates) ? candidates : [])].sort((left, right) => {
    const leftScore = Number(left?.score || 0);
    const rightScore = Number(right?.score || 0);
    const leftYouTube = isYouTubeQueueReviewCandidate(left);
    const rightYouTube = isYouTubeQueueReviewCandidate(right);
    const leftPriority = leftScore
      + (leftYouTube ? (isStrongQueueReviewCandidate(left) ? 140 : leftScore >= 160 ? 90 : 0) : 0);
    const rightPriority = rightScore
      + (rightYouTube ? (isStrongQueueReviewCandidate(right) ? 140 : rightScore >= 160 ? 90 : 0) : 0);
    if (rightPriority !== leftPriority) return rightPriority - leftPriority;
    return rightScore - leftScore;
  })
);

const pickPreferredQueueReviewCandidate = (candidates = []) => prioritizeQueueReviewCandidates(candidates)[0] || null;

const getRoomCodeFromLocation = () => {
  if (typeof window === 'undefined') return '';
  try {
    return String(new URLSearchParams(window.location.search).get('room') || '').trim().toUpperCase();
  } catch {
    return '';
  }
};

const generateAIContent = async (type, context) => {
  try {
    const roomCode = getRoomCodeFromLocation();
    const payload = roomCode
      ? { type, context, roomCode, usageContext: { source: `host_${type}` } }
      : { type, context, usageContext: { source: `host_${type}` } };
    const data = await callFunction('geminiGenerate', payload);
    return data?.result || null;
  } catch (error) {
    hostLogger.error('AI Error', error);
    return null;
  }
};

const normalizeYouTubeSearchItems = (rawItems = [], { reason = 'youtube_search', hideNonEmbeddable = false } = {}) => (
  (rawItems || [])
    .map((item) => {
      const videoId = String(item?.id || '').trim();
      if (!videoId) return null;
      const playbackState = normalizeYouTubePlaybackState(item);
      if (hideNonEmbeddable && !isYouTubeEmbeddable(playbackState)) return null;
      const durationSec = Math.max(0, Math.round(Number(item?.durationSec || 0)));
      return {
        source: 'youtube',
        videoId,
        trackName: String(item?.title || 'YouTube Track').trim() || 'YouTube Track',
        artistName: String(item?.channelTitle || item?.channel || 'YouTube').trim() || 'YouTube',
        artworkUrl100: item?.thumbnails?.medium?.url || item?.thumbnails?.default?.url || '',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        durationSec,
        playable: playbackState.playable,
        embeddable: playbackState.embeddable,
        uploadStatus: playbackState.uploadStatus,
        privacyStatus: playbackState.privacyStatus,
        youtubePlaybackStatus: playbackState.youtubePlaybackStatus,
        backingAudioOnly: playbackState.backingAudioOnly,
        sourceReason: reason,
        sourceDetail: reason === 'apple_missing'
          ? (playbackState.backingAudioOnly
            ? 'Apple Music account not connected. This YouTube track opens in an external host window.'
            : 'Apple Music account not connected. Showing verified embeddable YouTube tracks.')
          : (playbackState.backingAudioOnly
            ? 'YouTube track is not embeddable and opens in an external host window.'
            : 'Verified YouTube embeddable track.'),
      };
    })
    .filter(Boolean)
);

const annotateQueueSearchResults = (items = [], { sourceReason = '', sourceDetail = '' } = {}) => (
  (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    sourceReason: item?.sourceReason || sourceReason || '',
    sourceDetail: item?.sourceDetail || sourceDetail || '',
  }))
);

const mergeUniqueQueueSearchResults = (...groups) => {
  const merged = [];
  const seen = new Set();
  groups.flat().forEach((entry) => {
    if (!entry) return;
    const key = [
      String(entry.source || ''),
      String(entry.trackId || ''),
      String(entry.videoId || ''),
      String(entry.url || ''),
      String(entry.trackName || ''),
      String(entry.artistName || ''),
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(entry);
  });
  return merged;
};

const getTimestampMs = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const summarizePopTriviaVotes = (entries = []) => {
  const participantKeys = new Set();
  const answerKeys = new Set();
  entries.forEach((entry) => {
    if (!entry || entry.type !== POP_TRIVIA_VOTE_TYPE) return;
    const questionId = String(entry?.questionId || '').trim();
    if (!questionId) return;
    const voterKey = entry?.uid
      ? `uid:${entry.uid}`
      : `guest:${String(entry?.userName || 'Guest').trim().toLowerCase()}|${String(entry?.avatar || '').trim()}`;
    if (!voterKey) return;
    participantKeys.add(voterKey);
    answerKeys.add(`${questionId}::${voterKey}`);
  });
  return {
    participantCount: participantKeys.size,
    answerCount: answerKeys.size,
  };
};

const isDirectChatMessage = (message = {}) => (
  !!message?.toHost
  || !!message?.toUid
  || message?.channel === 'host'
  || message?.channel === 'dm'
);

const isLoungeChatMessage = (message = {}) => !isDirectChatMessage(message);

const POST_PERFORMANCE_BACKING_PROMPT_AUTO_CLOSE_MS = 12000;
const HostQueueTab = ({ songs, room, roomCode, hostBase, tvBase, tvLaunchUrl = '', updateRoom, logActivity, localLibrary, playSfxSafe, users, sfxMuted, setSfxMuted, sfxLevel, sfxVolume, setSfxVolume, searchSources, ytIndex, setYtIndex, persistYtIndex, hideNonEmbeddableYouTube = false, autoDj, holdAutoBgDuringStageActivation, chatShowOnTv, setChatShowOnTv, chatUnread, dmUnread, chatEnabled, setChatEnabled, chatAudienceMode, setChatAudienceMode, chatDraft, setChatDraft, chatMessages, sendHostChat, sendHostDmMessage, itunesBackoffRemaining, pinnedChatIds, setPinnedChatIds, chatViewMode, handleChatViewMode, appleMusicAuthorized = false, appleMusicPlaying, appleMusicStatus, playAppleMusicTrack, pauseAppleMusic, resumeAppleMusic, stopAppleMusic, hostName, fetchTop100Art, openChatSettings, dmTargetUid, setDmTargetUid, dmDraft, setDmDraft, getAppleMusicUserToken, silenceAll, compactViewport, layoutMode = 'desktop', showLegacyLiveEffects = true, commandPaletteRequestToken = 0, onUpsertYtIndexEntries, runOfShowEnabled = false, runOfShowDirector = null, runOfShowLiveItem = null, runOfShowStagedItem = null, runOfShowNextItem = null, runOfShowPreflightReport = null, onOpenRunOfShow, onOpenRunOfShowIssue, onStartRunOfShow, onAdvanceRunOfShow, onRewindRunOfShow, onToggleRunOfShowPause, onStopRunOfShow, onClearRunOfShow, onReturnCurrentToQueue, runOfShowAssignableSlots = [], onAssignQueueSongToRunOfShowItem, scenePresets = [], scenePresetUploading = false, scenePresetUploadProgress = 0, onCreateScenePreset, onLaunchScenePreset, onQueueScenePreset, onAddScenePresetToRunOfShow, onClearScenePreset, onDeleteScenePreset, crowdPulse = null, ytDiagnosticsMap = {}, fetchYtDiagnostics = async () => null, getYtDiagnosticsKey = () => '', getTrackDiagnosticsTone = () => null, getTrackDiagnosticsSupport = () => '', runtimeVisible = true, styles, emoji, smallWaveform }) => {
    const STYLES = styles;
    const EMOJI = emoji;
    const SmallWaveform = smallWaveform;
    const {
        stagePanelOpen,
        setStagePanelOpen,
        soundboardOpen,
        setSoundboardOpen,
        chatOpen,
        setChatOpen,
        applyWorkspacePreset,
        searchQ,
        setSearchQ,
        autocompleteProvider,
        setAutocompleteProvider,
        showAddForm,
        setShowAddForm,
        reviewQueueOpen,
        setReviewQueueOpen,
        pendingQueueOpen,
        setPendingQueueOpen,
        readyQueueOpen,
        setReadyQueueOpen,
        assignedQueueOpen,
        setAssignedQueueOpen,
        results,
        setResults,
        manual,
        setManual,
        quickAddOnResultClick,
        setQuickAddOnResultClick,
        quickAddLoadingKey,
        setQuickAddLoadingKey,
        quickAddNotice,
        setQuickAddNotice,
        lyricsOpen,
        setLyricsOpen,
        manualSingerMode,
        setManualSingerMode,
        editingSongId,
        setEditingSongId,
        editForm,
        setEditForm,
        customBonus,
        setCustomBonus,
        showQueueList,
        setShowQueueList,
        showQueueSummaryBar,
        setShowQueueSummaryBar,
        ytSearchOpen,
        setYtSearchOpen,
        ytSearchTarget,
        setYtSearchTarget,
        ytSearchQ,
        setYtSearchQ,
        ytEditingQuery,
        setYtEditingQuery,
        ytResults,
        setYtResults,
        ytLoading,
        setYtLoading,
        ytSearchError,
        setYtSearchError,
        embedCache,
        setEmbedCache,
        _testingVideoId,
        setTestingVideoId,
        _previewIframe,
        _setPreviewIframe
    } = useQueueTabState({ hostName, roomCode });
    const [scenePresetTitle, setScenePresetTitle] = useState('');
    const [scenePresetDurationSec, setScenePresetDurationSec] = useState(20);
    const [showScenePresets, setShowScenePresets] = useState(true);

    const SectionHeader = ({ label, open, onToggle, toneClass = '', featureId = '' }) => (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={!!open}
            data-feature-id={featureId || undefined}
            className={`w-full min-h-[46px] gap-3 rounded-2xl px-1 text-left touch-manipulation flex items-center justify-between ${STYLES.header} ${toneClass}`}
        >
            <span className="min-w-0 flex-1">{label}</span>
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25 text-zinc-200">
                <i className={`fa-solid fa-chevron-down transition-transform ${open ? 'rotate-180' : ''}`}></i>
            </span>
        </button>
    );
    const toast = useToast() || console.log;
    const hallOfFameTimerRef = useRef(null);
    const autoDjApplausePendingSongRef = useRef('');
    const autoDjApplauseFallbackTimerRef = useRef(null);
    const autoDjAutoEndKeyRef = useRef('');
    const performanceSessionCompletionKeyRef = useRef('');
    const currentPlaybackDurationSyncKeyRef = useRef('');
    const updateStatusRef = useRef(null);
    const mediaOverrideStopRef = useRef('');
    const commandInputRef = useRef(null);
    const autoDjObservedSongRef = useRef('');
    const autoDjObservedPerfTsRef = useRef(0);
    const reviewAutoSuggestingIdsRef = useRef(new Set());
    const postPerformanceBackingPromptKeyRef = useRef('');
    const [commandOpen, setCommandOpen] = useState(false);
    const [commandQuery, setCommandQuery] = useState('');
    const [autoDjSequenceState, setAutoDjSequenceState] = useState(() => createAutoDjSequenceState());
    const [queueSearchSourceNote, setQueueSearchSourceNote] = useState('');
    const [queueSearchNoResultHint, setQueueSearchNoResultHint] = useState('');
    const [trustedCatalog, setTrustedCatalog] = useState({});
    const [reviewActionBusyKey, setReviewActionBusyKey] = useState('');
    const [backingDecisionBusyKey, setBackingDecisionBusyKey] = useState('');
    const [postPerformanceBackingPrompt, setPostPerformanceBackingPrompt] = useState(null);
    const [postPerformanceBackingPromptBusy, setPostPerformanceBackingPromptBusy] = useState(false);
    const [desktopQueueSurfaceTab, setDesktopQueueSurfaceTab] = useState('queue');
    const essentialsMode = false;
    const roomChatMessages = chatMessages.filter((msg) => isLoungeChatMessage(msg));
    const hostDmMessages = chatMessages.filter((msg) => isDirectChatMessage(msg));
    const {
        current,
        hasLyrics,
        reviewRequired,
        queue,
        assigned,
        held,
        pending,
        lobbyCount,
        waitTimeSec,
        formatWaitTime,
        currentMediaUrl,
        currentUsesAppleBacking,
        currentSourcePlaying,
        currentSourceLabel,
        currentSourceToneClass
    } = useQueueDerivedState({ songs, room, users, appleMusicPlaying });
    const queueSurface = useQueueSurfaceController({
        layoutMode,
        reviewRequired,
        pending,
        queue,
        assigned,
        held,
        showAddForm,
        setShowAddForm,
        showQueueList,
        setShowQueueList,
        reviewQueueOpen,
        setReviewQueueOpen,
        pendingQueueOpen,
        setPendingQueueOpen,
        readyQueueOpen,
        setReadyQueueOpen,
        assignedQueueOpen,
        setAssignedQueueOpen
    });
    useEffect(() => {
        if (!roomCode) {
            setTrustedCatalog({});
            return () => {};
        }
        const unsub = onSnapshot(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode),
            (snap) => {
                const data = snap.data() || {};
                const nextCatalog = (data?.trustedCatalog && typeof data.trustedCatalog === 'object' && !Array.isArray(data.trustedCatalog))
                    ? data.trustedCatalog
                    : {};
                setTrustedCatalog(nextCatalog);
            }
        );
        return () => unsub();
    }, [roomCode]);
    const autoDjStepItems = useMemo(
        () => deriveAutoDjStepItems(autoDjSequenceState),
        [autoDjSequenceState]
    );
    const autoDjSequenceSummary = useMemo(
        () => describeAutoDjSequenceState(autoDjSequenceState),
        [autoDjSequenceState]
    );
    const pushAutoDjEvent = useCallback((event, payload = {}) => {
        setAutoDjSequenceState((prev) => transitionAutoDjSequenceState(prev, event, payload, nowMs()));
    }, []);
    const runUiFeatureCheck = () => {
        if (typeof document === 'undefined') return;
        const missing = HOST_UI_FEATURE_CHECKLIST.filter((item) => !document.querySelector(item.selector));
        if (missing.length) {
            hostLogger.debug('[Host UI Feature Check] Missing controls:', missing);
            toast(`UI feature check: ${missing.length} missing control(s).`);
            return;
        }
        toast(`UI feature check passed (${HOST_UI_FEATURE_CHECKLIST.length} controls).`);
    };
    const describeQueueLyricsStatus = useCallback((song = {}) => {
        const status = String(song?.lyricsGenerationStatus || '').trim().toLowerCase();
        const hasTimed = Array.isArray(song?.lyricsTimed) && song.lyricsTimed.length > 0;
        const hasLyrics = !!String(song?.lyrics || '').trim();
        if (status === 'pending') return 'Queued. Finalizing lyrics...';
        if (status === 'needs_user_token') return 'Queued. Apple lyrics need host Apple Music authorization.';
        if (status === 'capability_blocked') return 'Queued. Lyrics fallback is unavailable right now.';
        if (status === 'error') return 'Queued. Lyrics provider error; retry from queue actions.';
        if (status === 'disabled') return 'Queued. Lyrics pipeline is disabled right now.';
        if (status === 'resolved') {
            if (hasTimed) return 'Queue enrichment complete: timed lyrics ready.';
            if (hasLyrics) return 'Queue enrichment complete: lyrics ready.';
            return 'Queue enrichment complete.';
        }
        if (status === 'no_match') return 'Queued. No lyrics match found yet.';
        if (hasTimed) return 'Queue enrichment complete: timed lyrics ready.';
        if (hasLyrics) return 'Queue enrichment complete: lyrics ready.';
        return 'Queued.';
    }, []);
    useEffect(() => {
        try {
            localStorage.setItem('bross_quick_add_on_result_click', quickAddOnResultClick ? '1' : '0');
        } catch {
            // Ignore storage failures.
        }
    }, [quickAddOnResultClick]);
    useEffect(() => {
        if (!quickAddNotice) return;
        const status = String(quickAddNotice?.lyricsGenerationStatus || '').trim().toLowerCase();
        const timeoutMs = status === 'pending' ? 18000 : 8000;
        const timeout = setTimeout(() => setQuickAddNotice(null), timeoutMs);
        return () => clearTimeout(timeout);
    }, [quickAddNotice, setQuickAddNotice]);
    useEffect(() => {
        if (!quickAddNotice?.id || !roomCode) return;
        const songRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', quickAddNotice.id);
        const unsub = onSnapshot(songRef, (snap) => {
            if (!snap.exists()) {
                setQuickAddNotice((prev) => (prev?.id === quickAddNotice.id ? null : prev));
                return;
            }
            const song = snap.data() || {};
            setQuickAddNotice((prev) => {
                if (!prev || prev.id !== quickAddNotice.id) return prev;
                return {
                    ...prev,
                    lyrics: song.lyrics || '',
                    lyricsTimed: song.lyricsTimed || null,
                    lyricsSource: song.lyricsSource || '',
                    lyricsGenerationStatus: song.lyricsGenerationStatus || prev.lyricsGenerationStatus || '',
                    lyricsGenerationResolution: song.lyricsGenerationResolution || prev.lyricsGenerationResolution || '',
                    statusText: describeQueueLyricsStatus(song)
                };
            });
        });
        return () => unsub();
    }, [quickAddNotice?.id, roomCode, setQuickAddNotice, describeQueueLyricsStatus]);
    useEffect(() => {
        if (autoDj) return;
        autoDjObservedSongRef.current = '';
        autoDjObservedPerfTsRef.current = 0;
        setAutoDjSequenceState(createAutoDjSequenceState());
    }, [autoDj]);
    useEffect(() => {
        if (!autoDj) return;
        const songId = String(current?.id || '').trim();
        if (!songId) return;
        if (autoDjObservedSongRef.current === songId) return;
        autoDjObservedSongRef.current = songId;
        pushAutoDjEvent(AUTO_DJ_EVENTS.START, { songId });
        pushAutoDjEvent(AUTO_DJ_EVENTS.STAGE_READY, { songId });
    }, [autoDj, current?.id, pushAutoDjEvent]);
    useEffect(() => {
        if (!autoDj) return;
        const perfTs = getTimestampMs(room?.lastPerformance?.timestamp);
        if (!perfTs) return;
        if (autoDjObservedPerfTsRef.current === perfTs) return;
        autoDjObservedPerfTsRef.current = perfTs;
        const completedSongId = String(room?.lastPerformance?.id || room?.lastPerformance?.songDocId || '').trim();
        if (completedSongId) {
            pushAutoDjEvent(AUTO_DJ_EVENTS.SCORING_COMPLETE, { songId: completedSongId });
            pushAutoDjEvent(AUTO_DJ_EVENTS.TRANSITION_COMPLETE, { songId: completedSongId });
        }
    }, [autoDj, room?.lastPerformance?.timestamp, room?.lastPerformance?.id, room?.lastPerformance?.songDocId, pushAutoDjEvent]);
    useEffect(() => {
        if (!current) {
            mediaOverrideStopRef.current = '';
            return;
        }
        const stageMediaUrl = resolveStageMediaUrl(current, room);
        const effectiveBacking = normalizeBackingChoice({
            mediaUrl: stageMediaUrl,
            appleMusicId: current?.appleMusicId
        });
        const appleStatus = (room?.appleMusicPlayback?.status || '').toLowerCase();
        const shouldStopApple = !!effectiveBacking.mediaUrl && (appleStatus === 'playing' || appleStatus === 'paused' || appleMusicPlaying);
        if (!shouldStopApple) {
            mediaOverrideStopRef.current = '';
            return;
        }
        const key = `${current.id || 'current'}|${effectiveBacking.mediaUrl}|${appleStatus}|${appleMusicPlaying ? '1' : '0'}`;
        if (mediaOverrideStopRef.current === key) return;
        mediaOverrideStopRef.current = key;
        let cancelled = false;
        (async () => {
            try {
                await stopAppleMusic?.();
                if (!cancelled) {
                    await updateRoom({ appleMusicPlayback: null });
                }
            } catch (err) {
                hostLogger.debug('Failed to stop Apple Music during media override', err);
            }
        })();
        return () => { cancelled = true; };
    }, [current?.id, current?.mediaUrl, current?.appleMusicId, room?.mediaUrl, room?.appleMusicPlayback?.status, appleMusicPlaying, stopAppleMusic, updateRoom, current, room]);
    useEffect(() => () => {
        if (hallOfFameTimerRef.current) clearTimeout(hallOfFameTimerRef.current);
        if (autoDjApplauseFallbackTimerRef.current) {
            clearTimeout(autoDjApplauseFallbackTimerRef.current);
            autoDjApplauseFallbackTimerRef.current = null;
        }
    }, []);
    useEffect(() => {
        if (!runtimeVisible) return () => {};
        const onKeyDown = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setCommandOpen(prev => !prev);
                setCommandQuery('');
                return;
            }
            if (event.key === 'Escape' && commandOpen) {
                setCommandOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [commandOpen, runtimeVisible]);
    useEffect(() => {
        if (runtimeVisible) return;
        setCommandOpen(false);
        setCommandQuery('');
    }, [runtimeVisible]);
    useEffect(() => {
        if (!commandOpen) return;
        const timer = setTimeout(() => commandInputRef.current?.focus(), 0);
        return () => clearTimeout(timer);
    }, [commandOpen]);
    useEffect(() => {
        if (!runtimeVisible) return;
        if (!commandPaletteRequestToken) return;
        setCommandOpen(true);
        setCommandQuery('');
    }, [commandPaletteRequestToken, runtimeVisible]);

    const runPaletteCommand = async (command) => {
        if (!command?.enabled || typeof command?.run !== 'function') return;
        try {
            await command.run();
            setCommandOpen(false);
            setCommandQuery('');
        } catch (error) {
            hostLogger.error('Command failed', error);
            toast('Command failed');
        }
    };
    const undoQuickAdd = async () => {
        if (!quickAddNotice?.id) return;
        try {
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', quickAddNotice.id));
            toast(`Removed ${quickAddNotice.songTitle}`);
            setQuickAddNotice(null);
        } catch {
            toast('Undo failed');
        }
    };
    const changeQuickAddBacking = () => {
        if (!quickAddNotice) return;
        startEdit({
            id: quickAddNotice.id,
            songTitle: quickAddNotice.songTitle,
            artist: quickAddNotice.artist,
            singerName: quickAddNotice.singerName,
            mediaUrl: quickAddNotice.mediaUrl || '',
            albumArtUrl: quickAddNotice.albumArtUrl || '',
            lyrics: quickAddNotice.lyrics || '',
            lyricsTimed: quickAddNotice.lyricsTimed || null,
            appleMusicId: quickAddNotice.appleMusicId || '',
            duration: quickAddNotice.duration || 180
        });
        setQuickAddNotice(null);
    };
    const generateManualLyrics = async () => {
        if (!manual.song || !manual.artist) return toast('Need Song & Artist');
        toast('Generating Lyrics...');
        const res = await generateAIContent('lyrics', { title: manual.song, artist: manual.artist });
        if (res && res.lyrics) {
            setManual(prev => ({ ...prev, lyrics: res.lyrics, lyricsTimed: null, appleMusicId: '' }));
            setLyricsOpen(true);
            toast('Lyrics Generated!');
        } else {
            toast('Gen Failed');
        }
    };

    const {
        dragQueueId,
        setDragQueueId,
        dragOverId,
        setDragOverId,
        reorderQueue,
        touchReorderAvailable,
        touchReorderEnabled,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd
    } = useQueueReorder({
        queue,
        toast,
        touchReorderActive: queueSurface.touchReorderActive,
        onPersist: async (list) => {
            const base = nowMs();
            await Promise.all(list.map((item, idx) =>
                updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', item.id), { priorityScore: base + idx })
            ));
        }
    });
    const isAudioUrl = useCallback((url) => /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(url || ''), []);
    const {
        parseYouTubeId,
        resolveDurationForUrl,
        searchYouTube,
        openYtSearch,
        fetchEmbedStatuses
    } = useQueueMediaTools({
        roomCode,
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
        setEmbedCache,
        hideNonEmbeddableYouTube
    });
    const persistTrustedCatalogChoiceRef = useRef(null);
    const upsertYtIndexEntriesRef = useRef(null);
    useEffect(() => {
        upsertYtIndexEntriesRef.current = typeof onUpsertYtIndexEntries === 'function' ? onUpsertYtIndexEntries : null;
    }, [onUpsertYtIndexEntries]);
    const queueTabUpsertYtIndexEntries = useCallback(async (...args) => {
        if (typeof upsertYtIndexEntriesRef.current !== 'function') {
            throw new Error('YouTube index updater is unavailable.');
        }
        return upsertYtIndexEntriesRef.current(...args);
    }, []);
    const {
        addSong,
        addSongFromResult,
        startEdit,
        saveEdit,
        generateLyrics,
        syncEditDuration,
        addBonusToCurrent,
        retryLyricsForSong,
        fetchTimedLyricsForSong
    } = useQueueSongActions({
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
        onPersistTrustedCatalogChoice: (...args) => persistTrustedCatalogChoiceRef.current?.(...args),
        onUpsertYtIndexEntries: (...args) => upsertYtIndexEntriesRef.current?.(...args),
        toast
    });

    // Hybrid Search Logic
    useEffect(() => { 
        if(searchQ.length < 3) {
            setResults([]);
            setQueueSearchSourceNote('');
            setQueueSearchNoResultHint('');
            return;
        } 
        let cancelled = false;
        const t = setTimeout(async () => { 
            const normalizedQuery = String(searchQ || '').trim();
            const normalizedLower = normalizedQuery.toLowerCase();
            const preferredAutocompleteSource = String(autocompleteProvider || 'youtube').toLowerCase();

            // 1. Local Search
            const localMatchesRaw = searchSources.local
                ? localLibrary.filter(s =>
                    s.title.toLowerCase().includes(normalizedLower) ||
                    s.artist.toLowerCase().includes(normalizedLower) ||
                    (s.fileName || '').toLowerCase().includes(normalizedLower)
                ).map(s => ({ ...s, source: 'local', trackName: s.title, artistName: s.artist, artworkUrl100: '' }))
                : [];
            const localMatches = annotateQueueSearchResults(localMatchesRaw, {
                sourceReason: 'local_library',
                sourceDetail: 'Room media library match.'
            });

            if (preferredAutocompleteSource === 'spotify') {
                setQueueSearchSourceNote('Spotify autocomplete is coming soon. Showing local results only.');
                setQueueSearchNoResultHint('Switch autocomplete source to YouTube or Apple Music for live suggestions.');
                setResults(localMatches);
                return;
            }

            if (preferredAutocompleteSource === 'apple') {
                if (!searchSources.itunes) {
                    setQueueSearchSourceNote('Apple Music autocomplete is disabled in Search Sources. Showing local results only.');
                    setQueueSearchNoResultHint('Enable Apple Music in Search Sources or switch autocomplete to YouTube.');
                    setResults(localMatches);
                    return;
                }
                if (!appleMusicAuthorized) {
                    setQueueSearchSourceNote('Apple Music is not connected. Connect Apple Music or switch autocomplete to YouTube.');
                    setQueueSearchNoResultHint('No Apple Music results while disconnected.');
                    setResults(localMatches);
                    return;
                }
                try {
                    const data = await callFunction('itunesSearch', {
                        term: normalizedQuery,
                        limit: 7,
                        roomCode,
                        usageContext: { source: 'host_queue_search_apple' }
                    });
                    if (cancelled) return;
                    const itunesMatches = annotateQueueSearchResults((data?.results || []).map(r => ({ ...r, source: 'itunes' })), {
                        sourceReason: 'apple_authorized',
                        sourceDetail: 'Apple Music/iTunes search match.'
                    });
                    setQueueSearchSourceNote('Autocomplete source: Apple Music + local library.');
                    setQueueSearchNoResultHint('No Apple Music matches yet. Try song + artist.');
                    setResults(mergeUniqueQueueSearchResults(localMatches, itunesMatches));
                } catch (_error) {
                    if (cancelled) return;
                    setQueueSearchSourceNote('Apple Music lookup is unavailable right now. Showing local results only.');
                    setQueueSearchNoResultHint('Apple lookup failed. Try again or switch autocomplete to YouTube.');
                    setResults(localMatches);
                }
                return;
            }

            if (!searchSources.youtube) {
                setQueueSearchSourceNote('YouTube autocomplete is disabled in Search Sources. Showing local results only.');
                setQueueSearchNoResultHint('Enable YouTube in Search Sources or switch autocomplete to Apple Music.');
                setResults(localMatches);
                return;
            }

            const ytMatchesRaw = ytIndex.filter(s =>
                s.trackName.toLowerCase().includes(normalizedLower) ||
                s.artistName.toLowerCase().includes(normalizedLower)
            );
            const ytMatches = annotateQueueSearchResults(ytMatchesRaw.filter((entry) => (
                hideNonEmbeddableYouTube ? isYouTubeEmbeddable(entry) : true
            )), {
                sourceReason: 'youtube_index',
                sourceDetail: 'Indexed YouTube playlist match.'
            });
            let liveYouTubeMatches = [];
            try { 
                const ytFallbackData = await callFunction('youtubeSearch', {
                    query: `${normalizedQuery} karaoke`,
                    maxResults: 6,
                    playableOnly: hideNonEmbeddableYouTube === true,
                    roomCode,
                    usageContext: { source: 'host_queue_search_youtube_fallback' }
                });
                if (cancelled) return;
                liveYouTubeMatches = normalizeYouTubeSearchItems(ytFallbackData?.items || [], {
                    reason: 'youtube_search',
                    hideNonEmbeddable: hideNonEmbeddableYouTube
                });
            } catch(e) { 
                if (cancelled) return;
                hostLogger.debug('YouTube autocomplete search failed', e);
            } 
            if (cancelled) return;
            setQueueSearchSourceNote(hideNonEmbeddableYouTube
                ? 'Autocomplete source: YouTube embeddable tracks + local library.'
                : 'Autocomplete source: YouTube tracks + local library. Non-embeddable picks are labeled.');
            setQueueSearchNoResultHint(hideNonEmbeddableYouTube
                ? 'No embeddable YouTube tracks found. Try artist + song or use manual YouTube search.'
                : 'No YouTube tracks found. Try artist + song or use manual YouTube search.');
            setResults(mergeUniqueQueueSearchResults(localMatches, ytMatches, liveYouTubeMatches));
        }, 500); 
        return () => {
            cancelled = true;
            clearTimeout(t);
        }; 
    }, [searchQ, autocompleteProvider, localLibrary, ytIndex, searchSources, setResults, appleMusicAuthorized, roomCode, hideNonEmbeddableYouTube]);

    const getResultRowKey = (r, idx = 0) => {
        return `${r?.source || 'song'}_${r?.trackId || r?.videoId || r?.url || r?.trackName || idx}`;
    };

    const handleResultClick = async (r, idx = 0) => {
        const rowKey = getResultRowKey(r, idx);
        if (quickAddOnResultClick) {
            if (quickAddLoadingKey) return;
            setQuickAddLoadingKey(rowKey);
            setResults([]);
            setSearchQ('');
            try {
                const queued = await addSongFromResult(r);
                if (queued?.id) {
                    setQuickAddNotice({
                        id: queued.id,
                        songTitle: queued.songTitle,
                        artist: queued.artist,
                        singerName: queued.singerName,
                        mediaUrl: queued.mediaUrl || '',
                        albumArtUrl: queued.albumArtUrl || '',
                        lyrics: queued.lyrics || '',
                        lyricsTimed: queued.lyricsTimed || null,
                        appleMusicId: queued.appleMusicId || '',
                        duration: queued.duration || 180,
                        lyricsGenerationStatus: queued.lyricsGenerationStatus || '',
                        lyricsGenerationResolution: queued.lyricsGenerationResolution || '',
                        statusText: queued.statusText || 'Queued'
                    });
                }
            } finally {
                setQuickAddLoadingKey('');
            }
            return;
        }
        const audioOnly = r.mediaType === 'audio' || isAudioUrl(r.url);
        const selectedDuration = getTrackDurationSecFromSearchResult(r, manual.duration || 180);
        if (r.source === 'local') {
            setManual({ ...manual, song: r.trackName, artist: r.artistName, url: r.url, art: '', audioOnly, appleMusicId: '', duration: selectedDuration });
        } else if (r.source === 'youtube') {
            setManual({ ...manual, song: r.trackName, artist: r.artistName, url: r.url, art: r.artworkUrl100, audioOnly: false, appleMusicId: '', duration: selectedDuration });
        } else {
            const appleId = r.trackId ? String(r.trackId) : '';
            setManual({ ...manual, song: r.trackName, artist: r.artistName, url: '', art: r.artworkUrl100.replace('100x100','600x600'), audioOnly: true, appleMusicId: appleId, duration: selectedDuration });
        }

        if (r.source === 'local' && r.url) {
            const duration = await resolveDurationForUrl(r.url, audioOnly);
            if (duration) setManual(prev => ({ ...prev, duration }));
        }
        if (r.source === 'youtube' && r.url) {
            const duration = await resolveDurationForUrl(r.url, false);
            if (duration) setManual(prev => ({ ...prev, duration }));
        }
        setResults([]); setSearchQ('');
    };

    const statusPill = "px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest border bg-black/40 text-zinc-200 border-white/10";

    const reviewCollaborationMap = useMemo(
        () => buildCollaborationSuggestionMap({ songs, users }),
        [songs, users]
    );
    const reviewQueueItems = useMemo(
        () => reviewRequired.map((song) => ({
            ...song,
            reviewCandidates: prioritizeQueueReviewCandidates(rankSongRequestCandidates({
                request: song,
                trustedCatalogEntry: trustedCatalog?.[song.songId] || null,
                catalogCandidates: [],
                ytIndex
            })),
            collaborationCandidates: reviewCollaborationMap[song.id] || []
        })),
        [reviewRequired, reviewCollaborationMap, trustedCatalog, ytIndex]
    );
    useEffect(() => {
        if (!reviewQueueOpen || !reviewQueueItems.length) return;
        const candidateEntries = reviewQueueItems
            .slice(0, 6)
            .flatMap((song) => (Array.isArray(song.reviewCandidates) ? song.reviewCandidates.slice(0, 2) : []))
            .map((candidate) => ({
                id: candidate?.id || '',
                mediaUrl: candidate?.mediaUrl || '',
                title: candidate?.title || '',
                artist: candidate?.artist || '',
                source: candidate?.source || 'youtube'
            }))
            .filter((candidate) => {
                const diagnosticsKey = getYtDiagnosticsKey(candidate);
                return diagnosticsKey && !ytDiagnosticsMap[diagnosticsKey]?.loaded;
            });
        if (!candidateEntries.length) return;
        let cancelled = false;
        void Promise.allSettled(
            candidateEntries.map(async (entry) => {
                if (cancelled) return null;
                return fetchYtDiagnostics(entry);
            })
        );
        return () => {
            cancelled = true;
        };
    }, [fetchYtDiagnostics, getYtDiagnosticsKey, reviewQueueItems, reviewQueueOpen, ytDiagnosticsMap]);

    const persistTrustedCatalogChoice = useCallback(async (song, candidate, layer = 'host_favorite') => {
        return persistTrustedCatalogChoiceForRoom({
            roomCode,
            trustedCatalog,
            song,
            candidate,
            layer
        });
    }, [roomCode, trustedCatalog]);
    persistTrustedCatalogChoiceRef.current = persistTrustedCatalogChoice;

    const rateBackingPreference = useCallback(async (songLike, rating = 'up') => {
        const result = await saveHostBackingPreferenceForRoom({
            roomCode,
            trustedCatalog,
            ytIndex,
            songLike,
            rating,
            onUpsertYtIndexEntries: queueTabUpsertYtIndexEntries,
            onPersistTrustedCatalogChoice: persistTrustedCatalogChoice,
            onTrackFeedbackError: (error) => {
                hostLogger.warn('Global track feedback save failed', error);
            }
        });
        if (!result?.handled) {
            toast('Backing feedback is currently only saved for YouTube tracks.');
            return;
        }
        setPostPerformanceBackingPrompt((currentPrompt) => (
            currentPrompt && currentPrompt.videoId === result.videoId ? null : currentPrompt
        ));
        toast(result.preference === 'down' ? 'Saved: skip this track next time.' : 'Saved: use this track again.');
    }, [persistTrustedCatalogChoice, queueTabUpsertYtIndexEntries, roomCode, toast, trustedCatalog, ytIndex]);

    const handlePostPerformanceBackingPromptAction = useCallback(async (action = 'skip') => {
        const normalizedAction = String(action || 'skip').trim().toLowerCase();
        const activePrompt = postPerformanceBackingPrompt;
        if (!activePrompt) return;
        if (normalizedAction === 'skip') {
            setPostPerformanceBackingPrompt(null);
            setPostPerformanceBackingPromptBusy(false);
            return;
        }
        setPostPerformanceBackingPromptBusy(true);
        try {
            await rateBackingPreference(activePrompt.songLike, normalizedAction === 'avoid' ? 'down' : 'up');
            setPostPerformanceBackingPrompt(null);
        } finally {
            setPostPerformanceBackingPromptBusy(false);
        }
    }, [postPerformanceBackingPrompt, rateBackingPreference]);

    const resolveAudienceSelectedBacking = useCallback(async (songLike, action = 'approve') => {
        const safeAction = String(action || 'approve').trim().toLowerCase();
        const songId = String(songLike?.id || '').trim();
        if (!songId) return;
        const actionKey = `${songId}:${safeAction}`;
        if (backingDecisionBusyKey === actionKey) return;
        setBackingDecisionBusyKey(actionKey);
        try {
            const result = await applyAudienceSelectedBackingDecision({
                songLike,
                action: safeAction,
                onRateBackingPreference: rateBackingPreference
            });
            if (result?.outcome === 'returned_to_review') {
                toast('Sent back for host review and marked to skip next time.');
            } else if (result?.outcome === 'saved_down') {
                toast('Saved: skip this track next time.');
            } else if (result?.outcome === 'approved_saved' || result?.outcome === 'saved_up') {
                toast('Queued and saved as a good track.');
            }
        } catch (error) {
            hostLogger.warn('Failed to resolve audience-selected backing', error);
            toast('Could not update that track note right now.');
        } finally {
            setBackingDecisionBusyKey((currentKey) => (currentKey === actionKey ? '' : currentKey));
        }
    }, [backingDecisionBusyKey, rateBackingPreference, toast]);

    useEffect(() => {
        setPostPerformanceBackingPrompt(null);
        setPostPerformanceBackingPromptBusy(false);
        postPerformanceBackingPromptKeyRef.current = '';
    }, [roomCode]);

    useEffect(() => {
        const lastPerformanceTs = getTimestampMs(room?.lastPerformance?.timestamp);
        const lastPerformanceUrl = String(room?.lastPerformance?.mediaUrl || '').trim();
        const videoId = parseYouTubeId(lastPerformanceUrl);
        if (!lastPerformanceTs || !videoId) return;
        const performanceKey = `${videoId}:${lastPerformanceTs}`;
        if (postPerformanceBackingPromptKeyRef.current === performanceKey) return;
        postPerformanceBackingPromptKeyRef.current = performanceKey;
        setPostPerformanceBackingPromptBusy(false);
        setPostPerformanceBackingPrompt({
            performanceKey,
            videoId,
            songTitle: room?.lastPerformance?.songTitle || 'Recent performance',
            artist: room?.lastPerformance?.artist || 'YouTube backing',
            albumArtUrl: room?.lastPerformance?.albumArtUrl || '',
            songLike: {
                ...(room?.lastPerformance || {}),
                mediaUrl: lastPerformanceUrl,
            }
        });
    }, [
        parseYouTubeId,
        room?.lastPerformance,
        room?.lastPerformance?.albumArtUrl,
        room?.lastPerformance?.artist,
        room?.lastPerformance?.mediaUrl,
        room?.lastPerformance?.songTitle,
        room?.lastPerformance?.timestamp
    ]);
    useEffect(() => {
        if (!postPerformanceBackingPrompt || postPerformanceBackingPromptBusy) return () => {};
        const activePerformanceKey = String(postPerformanceBackingPrompt?.performanceKey || '').trim();
        if (!activePerformanceKey) return () => {};
        const timer = setTimeout(() => {
            setPostPerformanceBackingPrompt((currentPrompt) => (
                String(currentPrompt?.performanceKey || '').trim() === activePerformanceKey
                    ? null
                    : currentPrompt
            ));
        }, POST_PERFORMANCE_BACKING_PROMPT_AUTO_CLOSE_MS);
        return () => clearTimeout(timer);
    }, [postPerformanceBackingPrompt, postPerformanceBackingPromptBusy]);

    useEffect(() => {
        if (!roomCode || typeof onUpsertYtIndexEntries !== 'function') return;
        const nextSong = reviewRequired.find((song) => {
            if (!song?.id || song.playbackReady) return false;
            const suggestionState = String(song?.reviewAutoSuggestionState || '').trim().toLowerCase();
            if (['processing', 'review_ready', 'auto_resolved', 'host_reviewed'].includes(suggestionState)) return false;
            return !reviewAutoSuggestingIdsRef.current.has(song.id);
        });
        if (!nextSong) return;

        let cancelled = false;
        reviewAutoSuggestingIdsRef.current.add(nextSong.id);

        const resolveReviewCandidates = (song, extraYtMatches = []) => prioritizeQueueReviewCandidates(rankSongRequestCandidates({
            request: song,
            trustedCatalogEntry: trustedCatalog?.[song.songId] || null,
            catalogCandidates: [],
            ytIndex: [...(ytIndex || []), ...(Array.isArray(extraYtMatches) ? extraYtMatches : [])]
        }));

    const applyAutoSuggestion = async () => {
            const searchQuery = buildQueueReviewSearchQuery(nextSong);
            try {
                await markQueueReviewAutoSuggestionProcessing({
                    songId: nextSong.id,
                    searchQuery
                });
            } catch (stateError) {
                hostLogger.debug('Queue review auto-suggest state write skipped', stateError);
            }

            try {
                let rankedCandidates = resolveReviewCandidates(nextSong);
                let bestCandidate = pickPreferredQueueReviewCandidate(rankedCandidates);
                let liveMatches = [];

                if (searchQuery && (!isStrongQueueReviewCandidate(bestCandidate) || !isYouTubeQueueReviewCandidate(bestCandidate))) {
                    try {
                        const ytData = await callFunction('youtubeSearch', {
                            query: `${searchQuery} karaoke`,
                            maxResults: 5,
                            playableOnly: hideNonEmbeddableYouTube === true,
                            roomCode,
                            usageContext: { source: 'host_queue_review_auto_youtube' }
                        });
                        liveMatches = normalizeYouTubeSearchItems(ytData?.items || [], {
                            reason: 'queue_review_auto',
                            hideNonEmbeddable: hideNonEmbeddableYouTube
                        });
                        if (liveMatches.length && !cancelled) {
                            await onUpsertYtIndexEntries(liveMatches.map((match) => ({
                                videoId: match.videoId,
                                trackName: match.trackName,
                                artistName: match.artistName,
                                artworkUrl100: match.artworkUrl100,
                                url: match.url,
                                playable: match.playable === true,
                                embeddable: match.embeddable === true,
                                uploadStatus: match.uploadStatus || '',
                                privacyStatus: match.privacyStatus || '',
                                youtubePlaybackStatus: match.youtubePlaybackStatus || '',
                                backingAudioOnly: match.backingAudioOnly === true,
                                sourceDetail: 'Auto-suggested from singer queue review.'
                            })));
                            rankedCandidates = resolveReviewCandidates(nextSong, liveMatches);
                            bestCandidate = pickPreferredQueueReviewCandidate(rankedCandidates);
                        }
                    } catch (youtubeError) {
                        hostLogger.debug('Queue review auto-suggest YouTube search failed', youtubeError);
                    }
                }

                if (cancelled) return;

                if (isStrongQueueReviewCandidate(bestCandidate)) {
                    await applyQueueReviewAutoResolvedCandidate({
                        song: nextSong,
                        candidate: {
                            ...bestCandidate,
                            layer: String(bestCandidate?.layer || 'host_auto').trim() || 'host_auto'
                        }
                    });
                } else {
                    await markQueueReviewAutoSuggestionReady({
                        songId: nextSong.id,
                        topScore: Number(bestCandidate?.score || 0),
                        candidateCount: Math.max(0, Number(rankedCandidates.length || 0))
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    hostLogger.debug('Queue review auto-suggest failed', error);
                    try {
                        await markQueueReviewAutoSuggestionFallback({ songId: nextSong.id });
                    } catch (stateError) {
                        hostLogger.debug('Queue review auto-suggest fallback state write skipped', stateError);
                    }
                }
            } finally {
                reviewAutoSuggestingIdsRef.current.delete(nextSong.id);
            }
        };

        void applyAutoSuggestion();
        return () => {
            cancelled = true;
        };
    }, [reviewRequired, roomCode, trustedCatalog, ytIndex, onUpsertYtIndexEntries, hideNonEmbeddableYouTube]);

    const resolveReviewRequest = useCallback(async (song, candidate, options = {}) => {
        if (!song?.id || !candidate) return;
        const actionKey = `${song.id}:${options?.mode || 'resolve'}`;
        if (reviewActionBusyKey === actionKey) return;
        setReviewActionBusyKey(actionKey);
        try {
            await resolveQueueReviewSelectionForHost({
                song,
                candidate,
                hostName,
                resolvedByUid: auth.currentUser?.uid || null,
                saveFavorite: !!options?.saveFavorite,
                submitTrustedReview: !!options?.submitTrustedReview,
                persistTrustedCatalogChoice
            });
            toast(options?.successMessage || (options?.submitTrustedReview ? 'Queued and shared as trusted.' : options?.saveFavorite ? 'Queued and saved for this room.' : 'Queued with this track.'));
        } catch (error) {
            hostLogger.warn('Failed to resolve review request', error);
            toast('Could not resolve that request right now.');
        } finally {
            setReviewActionBusyKey('');
        }
    }, [hostName, persistTrustedCatalogChoice, reviewActionBusyKey, toast]);

    const resolveAppleSingAlongReviewRequest = useCallback(async (song) => {
        const appleMusicId = String(song?.appleMusicId || song?.trackId || '').trim();
        if (!song?.id || !appleMusicId) return;
        await resolveReviewRequest(song, {
            id: `apple_singalong:${appleMusicId}`,
            source: 'apple',
            layer: 'apple_sing_along',
            label: 'Apple Music full song',
            title: song.songTitle || '',
            artist: song.artist || '',
            trackId: appleMusicId,
            appleMusicId,
            mediaUrl: '',
            duration: getAssociatedBackingDurationSec(song) || normalizeDurationSec(song?.duration)
        }, {
            mode: 'apple_singalong',
            successMessage: 'Queued as Apple Music sing-along.'
        });
    }, [resolveReviewRequest]);

    const rejectReviewRequest = useCallback(async (song) => {
        if (!song?.id) return;
        const actionKey = `${song.id}:reject`;
        if (reviewActionBusyKey === actionKey) return;
        setReviewActionBusyKey(actionKey);
        try {
            await applyRejectedQueueReviewSelection({
                songId: song.id,
                resolvedByUid: auth.currentUser?.uid || null
            });
            toast('Request rejected.');
        } catch (error) {
            hostLogger.warn('Failed to reject review request', error);
            toast('Could not reject that request right now.');
        } finally {
            setReviewActionBusyKey('');
        }
    }, [reviewActionBusyKey, toast]);

    const setReviewCollabMode = useCallback(async (song, mode = 'solo') => {
        if (!song?.id) return;
        const normalizedMode = ['duet', 'group', 'solo'].includes(String(mode || '').trim().toLowerCase())
            ? String(mode || '').trim().toLowerCase()
            : 'solo';
        const partnerIds = Array.isArray(reviewCollaborationMap[song.id])
            ? reviewCollaborationMap[song.id].map((entry) => entry.requestId).filter(Boolean).slice(0, normalizedMode === 'duet' ? 1 : 3)
            : [];
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', song.id), {
                collabPlan: normalizedMode === 'solo'
                    ? null
                    : {
                        mode: normalizedMode,
                        partnerRequestIds: partnerIds,
                        updatedAtMs: nowMs()
                    }
            });
            toast(normalizedMode === 'solo' ? 'Keeping this request solo.' : normalizedMode === 'duet' ? 'Marked for duet pairing.' : 'Marked for group pairing.');
        } catch (error) {
            hostLogger.warn('Failed to update collaboration mode', error);
            toast('Could not update collaboration pairing.');
        }
    }, [reviewCollaborationMap, toast]);

    const openReviewRequestEditor = useCallback((song, options = {}) => {
        if (!song) return;
        startEdit(song);
        if (options?.openSearch) {
            const searchQuery = `${song.songTitle || ''} ${song.artist || ''}`.trim();
            setTimeout(() => openYtSearch('edit', searchQuery), 0);
        }
    }, [openYtSearch, startEdit]);


      const applyDurationToEdit = async (url) => {
          const duration = await resolveDurationForUrl(url, false);
          if (duration) setEditForm(prev => ({ ...prev, duration }));
      };
      const applyDurationToManual = async (url) => {
          const duration = await resolveDurationForUrl(url, false);
          if (duration) setManual(prev => ({ ...prev, duration }));
      };

      const selectYouTubeVideo = (video) => {
          const embedStatus = embedCache[video.id] || getYouTubeEmbedCacheStatus(video);
          const playbackState = normalizeYouTubePlaybackState({
              ...video,
              playable: embedStatus === 'ok' ? true : video.playable,
              embeddable: embedStatus === 'fail' ? false : video.embeddable,
              youtubePlaybackStatus: embedStatus === 'ok'
                  ? YOUTUBE_PLAYBACK_STATUSES.embeddable
                  : embedStatus === 'fail'
                      ? YOUTUBE_PLAYBACK_STATUSES.notEmbeddable
                      : video.youtubePlaybackStatus
          });
          const isFailed = playbackState.youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES.notEmbeddable;
          const displayTitle = video.title.replace(' (Karaoke)', '').replace(' Karaoke', '');
          
          if (ytSearchTarget === 'edit') {
              setEditForm(prev => ({
                  ...prev,
                  title: prev.title || displayTitle || '',
                  artist: prev.artist || video.channel || '',
                  url: video.url || prev.url,
                  youtubeEmbeddable: playbackState.embeddable,
                  youtubeUploadStatus: playbackState.uploadStatus,
                  youtubePrivacyStatus: playbackState.privacyStatus,
                  youtubePlaybackStatus: playbackState.youtubePlaybackStatus
              }));
              applyDurationToEdit(video.url || editForm.url);
          } else {
              setManual(prev => ({
                  ...prev,
                  song: prev.song || displayTitle || '',
                  artist: prev.artist || video.channel || '',
                  url: video.url,
                  duration: prev.duration || 180,
                  backingAudioOnly: playbackState.backingAudioOnly,
                  youtubeEmbeddable: playbackState.embeddable,
                  youtubeUploadStatus: playbackState.uploadStatus,
                  youtubePrivacyStatus: playbackState.privacyStatus,
                  youtubePlaybackStatus: playbackState.youtubePlaybackStatus
              }));
              applyDurationToManual(video.url);
          }
          setYtSearchOpen(false);
          setYtSearchQ('');
          setYtResults([]);
          toast(isFailed ? `${EMOJI.radio} Not embeddable - opens in external backing window` : `${EMOJI.check} Embeds on TV`);
      };

    const testEmbedVideo = async (video) => {
        if (!video?.id) return;
        setTestingVideoId(video.id);
        setEmbedCache(prev => ({ ...prev, [video.id]: 'testing' }));
        try {
            const statuses = await fetchEmbedStatuses([video.id]);
            const status = statuses?.[video.id] || '';
            if (status === 'ok') {
                toast(`${EMOJI.check} Embeds on the TV player`);
            } else if (status === 'fail') {
                toast(`${EMOJI.radio} Not embeddable - opens in an external backing window`);
            } else {
                toast(`${EMOJI.cross} Could not confirm embed status`);
            }
        } finally {
            setTestingVideoId(null);
        }
    };

    const _queueBrowseSong = async (song, singerOverride) => {
        if (!song?.title) return;
        const art = await fetchTop100Art(song);
        const songRecord = await ensureSong({
            title: song.title,
            artist: song.artist || 'Unknown',
            artworkUrl: art || song.art || '',
            verifyMeta: art || song.art ? {} : false,
            verifiedBy: hostName || 'host'
        });
        const songId = songRecord?.songId || buildSongKey(song.title, song.artist || 'Unknown');
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
            roomCode,
            songId,
            songTitle: song.title,
            artist: song.artist,
            singerName: singerOverride || room?.hostName || hostName || 'Host',
            mediaUrl: '',
            albumArtUrl: art || song.art || '',
            status: 'requested',
            timestamp: serverTimestamp(),
            priorityScore: nowMs(),
            emoji: EMOJI.mic,
            backingAudioOnly: false,
            audioOnly: false
        });
        toast('Added to queue');
    };

    const triggerHallOfFameMoment = async ({ songId, singerName, songTitle } = {}) => {
        if (!roomCode) return;
        if (hallOfFameTimerRef.current) {
            clearTimeout(hallOfFameTimerRef.current);
        }
        await updateRoom({
            activeMode: 'selfie_cam',
            selfieMoment: {
                type: 'hall_of_fame',
                songId,
                singerName,
                songTitle,
                timestamp: nowMs()
            },
            selfieMomentExpiresAt: nowMs() + 12000
        });
        hallOfFameTimerRef.current = setTimeout(() => {
            updateRoom({ activeMode: 'karaoke', selfieMoment: null });
        }, 12000);
    };
    const logPerformance = async (songEntry) => {
        if (!songEntry?.songTitle) return;
        try {
            const safeTitle = songEntry.songTitle;
            const safeArtist = songEntry.artist || 'Unknown';
            const fallbackSongId = buildSongKey(safeTitle, safeArtist);
            const applauseScore = Math.round(songEntry.applauseScore || 0);
            const hypeScore = Math.round(songEntry.hypeScore || 0);
            const hostBonus = Math.round(songEntry.hostBonus || 0);

            const res = await callFunction('logPerformance', {
                roomCode,
                songId: songEntry.songId || null,
                songTitle: safeTitle,
                artist: safeArtist,
                singerName: songEntry.singerName || '',
                singerUid: songEntry.singerUid || null,
                albumArtUrl: songEntry.albumArtUrl || '',
                mediaUrl: songEntry.mediaUrl || '',
                appleMusicId: songEntry.appleMusicId || '',
                duration: songEntry.duration || null,
                audioOnly: !!songEntry.audioOnly,
                backingAudioOnly: !!songEntry.backingAudioOnly,
                trackId: songEntry.trackId || null,
                trackSource: songEntry.trackSource || null,
                applauseScore,
                hypeScore,
                hostBonus,
                hostName: hostName || 'Host'
            });

            const songId = res?.songId || songEntry.songId || fallbackSongId;
            const trackId = res?.trackId || songEntry.trackId || null;
            if (songId && (songId !== songEntry.songId || trackId !== songEntry.trackId)) {
                await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songEntry.id), {
                    songId,
                    trackId: trackId || null
                });
            }

            const totalScore = Number(res?.totalScore ?? (hypeScore + applauseScore + hostBonus));
            if (res?.isNewAllTime) {
                await logActivity(roomCode, songEntry.singerName || '', `set a new global high score for ${songId}`, EMOJI.star);
                await updateRoom({
                    lastPerformance: {
                        ...songEntry,
                        songId,
                        albumArtUrl: songEntry.albumArtUrl || '',
                        hallOfFame: {
                            newAllTime: true,
                            songId,
                            bestScore: totalScore,
                            applauseScore: Number(res?.applauseScore ?? applauseScore)
                        },
                        timestamp: nowMs()
                    }
                });
                await triggerHallOfFameMoment({
                    songId,
                    singerName: songEntry.singerName || '',
                    songTitle: safeTitle
                });
            }
        } catch (err) {
            hostLogger.error('Failed to log performance', err);
        }
    };

    async function updateStatus(id, status, options = {}) { 
        if(status==='performing') { 
            pushAutoDjEvent(AUTO_DJ_EVENTS.START, { songId: id });
            try {
                await startQueueSongOnStage({
                    songId: id,
                    songs,
                    room,
                    roomCode,
                    allowCurrentId: options?.allowCurrentId || null,
                    resolveDurationForUrl,
                    isAudioUrl,
                    holdAutoBgDuringStageActivation,
                    playAppleMusicTrack,
                    stopAppleMusic,
                    updateRoom,
                    logActivity,
                    emoji: EMOJI
                });
                pushAutoDjEvent(AUTO_DJ_EVENTS.STAGE_READY, { songId: id });
            } catch (error) {
                const errorCode = String(error?.code || '').trim().toLowerCase();
                if (errorCode === 'stage_blocked_existing_performer') {
                    toast('Another singer is already on stage');
                } else if (errorCode === 'queue_item_missing') {
                    toast('Queued item not found');
                } else {
                    hostLogger.warn('Failed to start queue song on stage', error);
                    toast('Could not start this performance right now.');
                }
                pushAutoDjEvent(AUTO_DJ_EVENTS.FAIL, { songId: id, error: error?.code || error?.message || 'stage_start_failed' });
            }
            return;
        }
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', id), { status }); 
        if(status==='performed') { 
            let s = songs.find(x => x.id === id);
            if (!s) {
                try {
                    const songSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', id));
                    if (songSnap.exists()) {
                        s = { id, ...songSnap.data() };
                    }
                } catch (error) {
                    hostLogger.warn('Failed to load queue item for performance recap', error);
                }
            }
            if(s) { 
                pushAutoDjEvent(AUTO_DJ_EVENTS.APPLAUSE_RESULT, { songId: id });
                const rankedFans = (() => {
                    if (!users?.length) return null;
                    const performanceId = s.id || null;
                    return users
                        .filter((u) => !performanceId || u.lastPerformanceId === performanceId)
                        .map((u) => ({
                            name: u.name || 'Guest',
                            avatar: u.avatar || EMOJI.sparkle,
                            pointsGifted: u.performancePointsGifted || 0
                        }))
                        .sort((a, b) => (b.pointsGifted || 0) - (a.pointsGifted || 0));
                })();
                const topFan = (() => {
                    const best = rankedFans?.[0];
                    if (!best || best.pointsGifted <= 0) return null;
                    return best;
                })();
                const crowdGiftedPointsTotal = (rankedFans || []).reduce(
                    (sum, fan) => sum + Math.max(0, Number(fan?.pointsGifted || 0)),
                    0
                );
                const localVibeStats = (() => {
                    const guitarSessionId = room?.guitarSessionId;
                    const strobeSessionId = room?.strobeSessionId;
                    const stats = { guitar: null, strobe: null };
                    if (guitarSessionId) {
                        let totalHits = 0;
                        let top = null;
                        users.forEach((u) => {
                            if (u.guitarSessionId !== guitarSessionId) return;
                            const hits = u.guitarHits || 0;
                            totalHits += hits;
                            if (!top || hits > top.hits) top = { name: u.name || 'Guest', avatar: u.avatar || EMOJI.guitar, hits };
                        });
                        if (totalHits > 0) stats.guitar = { totalHits, top };
                    }
                    if (strobeSessionId) {
                        let totalTaps = 0;
                        let top = null;
                        users.forEach((u) => {
                            if (u.strobeSessionId !== strobeSessionId) return;
                            const taps = u.strobeTaps || 0;
                            totalTaps += taps;
                            if (!top || taps > top.taps) top = { name: u.name || 'Guest', avatar: u.avatar || EMOJI.rocket, taps };
                        });
                        if (totalTaps > 0) stats.strobe = { totalTaps, top };
                    }
                    return (stats.guitar || stats.strobe) ? stats : null;
                })();
                const songRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', id);
                const finalApplauseScore = Math.round(Number(room?.applausePeak || 0));
                await updateDoc(songRef, { applauseScore: finalApplauseScore });
                let latestSong = { ...s, applauseScore: finalApplauseScore };
                try {
                    const latestSongSnap = await getDoc(songRef);
                    if (latestSongSnap.exists()) {
                        latestSong = { id, ...latestSongSnap.data(), applauseScore: finalApplauseScore };
                    }
                } catch (error) {
                    hostLogger.warn('Could not load latest song snapshot for recap; using in-memory fallback', error);
                }
                const latestHypeScore = Math.max(0, Math.round(Number(latestSong?.hypeScore || 0)));
                let resolvedHostBonus = Math.max(0, Math.round(Number(latestSong?.hostBonus || 0)));
                const autoBonusActive = room?.autoBonusEnabled !== false;
                const autoBonusValue = Math.max(0, Math.min(1000, Math.round(Number(room?.autoBonusPoints ?? 25) || 0)));
                if (autoBonusActive && resolvedHostBonus <= 0 && autoBonusValue > 0) {
                    resolvedHostBonus = autoBonusValue;
                    try {
                        await updateDoc(songRef, { hostBonus: resolvedHostBonus });
                    } catch (error) {
                        hostLogger.warn('Auto bonus sync failed; recap will still use auto bonus value', error);
                    }
                }
                const performanceSession = (
                    String(room?.currentPerformanceSession?.songId || '').trim() === id
                        ? room.currentPerformanceSession
                        : null
                );
                const performanceStartedAtMs = Math.max(
                    0,
                    Number(performanceSession?.startedAtMs || 0),
                    getTimestampMs(latestSong?.performingStartedAt),
                    getTimestampMs(s?.performingStartedAt),
                    getTimestampMs(s?.timestamp)
                );
                const performanceEndedAtMs = Math.max(
                    performanceStartedAtMs,
                    Number(performanceSession?.endedAtMs || 0),
                    nowMs()
                );
                const actualPerformanceDurationSec = performanceStartedAtMs > 0
                    ? Math.max(0, Math.round((performanceEndedAtMs - performanceStartedAtMs) / 1000))
                    : 0;
                let reconciled = null;
                try {
                    const reconciledData = await callFunction('reconcilePerformanceRecap', {
                        roomCode,
                        performanceId: id,
                        startedAtMs: performanceStartedAtMs,
                        endedAtMs: performanceEndedAtMs,
                        fallbackHypeScore: latestHypeScore,
                        fallbackApplauseScore: finalApplauseScore,
                        fallbackHostBonus: resolvedHostBonus,
                        singerUid: s?.singerUid || null,
                        singerName: s?.singerName || ''
                    });
                    if (reconciledData?.ok) {
                        reconciled = reconciledData;
                    }
                } catch (error) {
                    hostLogger.warn('Performance recap reconciliation failed; using host-side fallback', error);
                }
                const resolvedHypeScore = Math.max(
                    latestHypeScore,
                    Math.round(crowdGiftedPointsTotal),
                    Math.round(Number(reconciled?.resolved?.hypeScore || 0))
                );
                const resolvedTopFan = reconciled?.topFan
                    ? {
                        name: reconciled.topFan.name || 'Guest',
                        avatar: reconciled.topFan.avatar || EMOJI.sparkle,
                        pointsGifted: Math.max(0, Number(reconciled.topFan.pointsGifted || 0))
                    }
                    : topFan;
                const resolvedVibeStats = reconciled?.vibeStats || localVibeStats;
                if (resolvedHypeScore > latestHypeScore) {
                    try {
                        await updateDoc(songRef, { hypeScore: resolvedHypeScore });
                    } catch {
                        // Ignore score sync failures; recap payload still carries resolved values.
                    }
                }
                let popTriviaSummary = null;
                const popTriviaQuestions = Array.isArray(latestSong?.popTrivia)
                    ? latestSong.popTrivia.filter(Boolean)
                    : [];
                const popTriviaQuestionIds = popTriviaQuestions
                    .map((entry) => String(entry?.id || '').trim())
                    .filter(Boolean)
                    .slice(0, 10);
                if (popTriviaQuestionIds.length) {
                    popTriviaSummary = {
                        questionCount: popTriviaQuestionIds.length,
                        participantCount: 0,
                        answerCount: 0,
                        source: String(latestSong?.popTriviaSource || s?.popTriviaSource || 'ai').trim() || 'ai'
                    };
                    try {
                        const popTriviaVotesSnap = await getDocs(query(
                            collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'),
                            where('roomCode', '==', roomCode),
                            where('type', '==', POP_TRIVIA_VOTE_TYPE),
                            where('questionId', 'in', popTriviaQuestionIds)
                        ));
                        const voteSummary = summarizePopTriviaVotes(popTriviaVotesSnap.docs.map((docSnap) => docSnap.data()));
                        popTriviaSummary.participantCount = voteSummary.participantCount;
                        popTriviaSummary.answerCount = voteSummary.answerCount;
                    } catch (error) {
                        hostLogger.warn('Pop trivia recap summary failed', { songId: id, error });
                    }
                }
                const recapDisplayMeta = getRecapDisplayMeta({ ...s, ...latestSong });
                const recapPayload = {
                    ...s,
                    ...latestSong,
                    id,
                    songTitle: recapDisplayMeta.songTitle,
                    artist: recapDisplayMeta.artist,
                    singerName: recapDisplayMeta.singerName,
                    displaySongTitle: recapDisplayMeta.songTitle,
                    displayArtist: recapDisplayMeta.artist,
                    sourceSongTitle: recapDisplayMeta.sourceSongTitle,
                    hypeScore: resolvedHypeScore,
                    applauseScore: finalApplauseScore,
                    hostBonus: resolvedHostBonus,
                    duration: actualPerformanceDurationSec > 0
                        ? actualPerformanceDurationSec
                        : Math.max(0, Number(latestSong?.duration || s?.duration || 0)),
                    timestamp: performanceEndedAtMs,
                    albumArtUrl: latestSong?.albumArtUrl || s.albumArtUrl || '',
                    topFan: resolvedTopFan,
                    vibeStats: resolvedVibeStats,
                    popTriviaSummary,
                    performanceSessionId: String(performanceSession?.sessionId || '').trim() || null,
                    playbackCompletionReason: String(performanceSession?.completionReason || '').trim() || null,
                    recapLedgerSource: reconciled?.source || null,
                    recapEventCount: Number(reconciled?.eventCount || 0)
                };
                await stopAppleMusic?.();
                await updateRoom({
                    lastPerformance: recapPayload,
                    activeMode: 'karaoke',
                    mediaUrl: '',
                    currentPerformanceMeta: null,
                    currentPerformanceSession: null,
                    singAlongMode: false,
                    videoPlaying: false,
                    showLyricsTv: false,
                    showVisualizerTv: false,
                    showLyricsSinger: false,
                    appleMusicPlayback: null
                });
                await logPerformance(recapPayload);
                pushAutoDjEvent(AUTO_DJ_EVENTS.SCORING_COMPLETE, { songId: id });
                pushAutoDjEvent(AUTO_DJ_EVENTS.TRANSITION_COMPLETE, { songId: id });
                logActivity(roomCode, recapDisplayMeta.singerName, `crushed ${recapDisplayMeta.songTitle}!`, EMOJI.star);
                toast("Performance Finished"); 
            } 
        } 
    }
    updateStatusRef.current = updateStatus;

    const moveSingerNext = useCallback(async (songId = '') => {
        const targetSongId = String(songId || '').trim();
        if (!targetSongId) return;
        const targetSong = (songs || []).find((song) => song.id === targetSongId) || null;
        if (!targetSong) {
            toast('Singer not found in queue.');
            return;
        }
        const base = nowMs();
        const ordered = [
            targetSong,
            ...(queue || []).filter((song) => song.id !== targetSongId)
        ];
        await Promise.all(ordered.map((song, idx) => {
            const patch = { priorityScore: base + idx };
            if (song.id === targetSongId) {
                patch.status = 'requested';
                patch.holdReason = null;
                patch.heldAt = null;
                patch.restoredAt = serverTimestamp();
            }
            return updateDoc(
                doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', song.id),
                patch
            );
        }));
        pushAutoDjEvent(AUTO_DJ_EVENTS.RETRY, { songId: targetSongId, error: 'lineup_moved_next' });
        toast(`${targetSong.singerName || 'Singer'} moved next.`);
    }, [pushAutoDjEvent, queue, songs, toast]);

    const holdSinger = useCallback(async (songId = '', reason = 'not_here') => {
        const targetSongId = String(songId || '').trim();
        if (!targetSongId) return;
        const targetSong = (songs || []).find((song) => song.id === targetSongId) || null;
        if (!targetSong) {
            toast('Singer not found in queue.');
            return;
        }
        const previousStatus = String(targetSong.status || 'requested').trim().toLowerCase() || 'requested';
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', targetSongId), {
            status: 'held',
            previousStatus: previousStatus === 'held' ? (targetSong.previousStatus || 'requested') : previousStatus,
            holdReason: reason,
            heldAt: serverTimestamp(),
            heldBy: hostName || 'Host'
        });
        pushAutoDjEvent(AUTO_DJ_EVENTS.RETRY, { songId: targetSongId, error: 'lineup_held' });
        toast(`${targetSong.singerName || 'Singer'} held.`);
    }, [hostName, pushAutoDjEvent, songs, toast]);

    const restoreHeldSinger = useCallback(async (songId = '') => {
        const targetSongId = String(songId || '').trim();
        if (!targetSongId) return;
        const targetSong = (songs || []).find((song) => song.id === targetSongId) || null;
        if (!targetSong) {
            toast('Held singer not found.');
            return;
        }
        const previousStatus = String(targetSong.previousStatus || '').trim().toLowerCase();
        const nextStatus = ['assigned', 'pending', 'requested'].includes(previousStatus) ? previousStatus : 'requested';
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', targetSongId), {
            status: nextStatus,
            priorityScore: nextStatus === 'requested' ? nowMs() : (targetSong.priorityScore || nowMs()),
            holdReason: null,
            heldAt: null,
            restoredAt: serverTimestamp()
        });
        pushAutoDjEvent(AUTO_DJ_EVENTS.RETRY, { songId: targetSongId, error: 'lineup_restored' });
        toast(`${targetSong.singerName || 'Singer'} restored.`);
    }, [pushAutoDjEvent, songs, toast]);

    const clearAutoDjApplauseFallback = useCallback(() => {
        if (!autoDjApplauseFallbackTimerRef.current) return;
        clearTimeout(autoDjApplauseFallbackTimerRef.current);
        autoDjApplauseFallbackTimerRef.current = null;
    }, []);

    const clearStagePlaybackState = useCallback(async () => {
        await stopAppleMusic?.();
        await updateRoom({
            activeMode: 'karaoke',
            mediaUrl: '',
            currentPerformanceMeta: null,
            currentPerformanceSession: null,
            singAlongMode: false,
            videoPlaying: false,
            videoStartTimestamp: null,
            pausedAt: null,
            showLyricsTv: false,
            showVisualizerTv: false,
            showLyricsSinger: false,
            audienceVideoMode: 'off',
            appleMusicPlayback: null
        });
    }, [stopAppleMusic, updateRoom]);

    const returnCurrentPerformanceToQueue = useCallback(async (songId = '') => {
        const targetSongId = String(songId || '').trim();
        if (!targetSongId) return;
        const targetSong = (songs || []).find((song) => song.id === targetSongId) || null;
        clearAutoDjApplauseFallback();
        autoDjApplausePendingSongRef.current = '';
        await updateDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', targetSongId),
            { status: 'requested' }
        );
        await clearStagePlaybackState();
        pushAutoDjEvent(AUTO_DJ_EVENTS.RETRY, { songId: targetSongId, error: 'returned_to_queue' });
        toast(`${targetSong?.songTitle || 'Current song'} returned to queue.`);
    }, [clearAutoDjApplauseFallback, clearStagePlaybackState, pushAutoDjEvent, songs, toast]);

    const startApplauseSequence = useCallback(async ({ songId = '', autoFinalize = false } = {}) => {
        if (!songId) return;
        pushAutoDjEvent(AUTO_DJ_EVENTS.APPLAUSE_STARTED, { songId });
        if (autoFinalize) {
            autoDjApplausePendingSongRef.current = songId;
            clearAutoDjApplauseFallback();
            autoDjApplauseFallbackTimerRef.current = setTimeout(() => {
                const pendingSongId = autoDjApplausePendingSongRef.current;
                if (!pendingSongId) return;
                autoDjApplausePendingSongRef.current = '';
                pushAutoDjEvent(AUTO_DJ_EVENTS.RETRY, { songId: pendingSongId, error: 'applause_result_timeout' });
                const runUpdateStatus = updateStatusRef.current;
                if (!runUpdateStatus) return;
                runUpdateStatus(pendingSongId, 'performed').catch((error) => {
                    pushAutoDjEvent(AUTO_DJ_EVENTS.FAIL, { songId: pendingSongId, error: error?.message || 'fallback_finalize_failed' });
                    hostLogger.warn('Auto-DJ applause fallback finalization failed', error);
                });
            }, 26000);
        }
        await updateRoom({ activeMode: 'applause_countdown', applausePeak: 0, currentApplauseLevel: 0 });
        if (autoFinalize) toast('Measuring applause now. Auto-DJ will end this performance after results.');
        else toast('Applause countdown started.');
    }, [clearAutoDjApplauseFallback, toast, updateRoom, pushAutoDjEvent]);

    const handleEndPerformance = useCallback(async (songId = '') => {
        const targetSongId = String(songId || '').trim();
        if (!targetSongId) return;
        if (!autoDj) {
            autoDjApplausePendingSongRef.current = '';
            clearAutoDjApplauseFallback();
            const runUpdateStatus = updateStatusRef.current;
            if (!runUpdateStatus) return;
            await runUpdateStatus(targetSongId, 'performed');
            pushAutoDjEvent(AUTO_DJ_EVENTS.SCORING_COMPLETE, { songId: targetSongId });
            pushAutoDjEvent(AUTO_DJ_EVENTS.TRANSITION_COMPLETE, { songId: targetSongId });
            return;
        }
        const applauseMode = String(room?.activeMode || '');
        const applauseRunning = applauseMode === 'applause_countdown' || applauseMode === 'applause';
        if (applauseRunning && autoDjApplausePendingSongRef.current === targetSongId) {
            toast('Applause capture in progress. Auto-DJ will end performance after results.');
            return;
        }
        await startApplauseSequence({ songId: targetSongId, autoFinalize: true });
    }, [autoDj, clearAutoDjApplauseFallback, room?.activeMode, startApplauseSequence, toast, pushAutoDjEvent]);

    useEffect(() => {
        if (!autoDj) return;
        const pendingSongId = autoDjApplausePendingSongRef.current;
        if (!pendingSongId) return;
        if (room?.activeMode !== 'applause_result') return;
        pushAutoDjEvent(AUTO_DJ_EVENTS.APPLAUSE_RESULT, { songId: pendingSongId });
        autoDjApplausePendingSongRef.current = '';
        clearAutoDjApplauseFallback();
        const runUpdateStatus = updateStatusRef.current;
        if (!runUpdateStatus) return;
        runUpdateStatus(pendingSongId, 'performed')
            .then(() => {
                pushAutoDjEvent(AUTO_DJ_EVENTS.SCORING_COMPLETE, { songId: pendingSongId });
                pushAutoDjEvent(AUTO_DJ_EVENTS.TRANSITION_COMPLETE, { songId: pendingSongId });
            })
            .catch((error) => {
                pushAutoDjEvent(AUTO_DJ_EVENTS.FAIL, { songId: pendingSongId, error: error?.message || 'auto_finalize_failed' });
                hostLogger.warn('Auto-DJ applause finalization failed', error);
            });
    }, [autoDj, clearAutoDjApplauseFallback, room?.activeMode, pushAutoDjEvent]);

    useEffect(() => {
        performanceSessionCompletionKeyRef.current = '';
    }, [room?.currentPerformanceSession?.sessionId]);

    useEffect(() => {
        const session = room?.currentPerformanceSession || null;
        const currentSongId = String(current?.id || '').trim();
        const sessionId = String(session?.sessionId || '').trim();
        const sessionSongId = String(session?.songId || '').trim();
        const playbackState = String(session?.playbackState || '').trim().toLowerCase();
        if (!sessionId || !currentSongId || sessionSongId !== currentSongId || playbackState !== 'ended') return;
        const completionKey = `${sessionId}:${String(session?.completionReason || 'player_ended').trim().toLowerCase()}`;
        if (performanceSessionCompletionKeyRef.current === completionKey) return;
        performanceSessionCompletionKeyRef.current = completionKey;
        handleEndPerformance(currentSongId).catch((error) => {
            hostLogger.warn('Performance session completion trigger failed', error);
        });
    }, [
        current?.id,
        handleEndPerformance,
        room?.currentPerformanceSession
    ]);

    useEffect(() => {
        const currentId = String(current?.id || '').trim();
        const activeMode = String(room?.activeMode || '').trim().toLowerCase();
        if (!currentId || activeMode !== 'karaoke') return;
        const stageMediaUrl = resolveStageMediaUrl(current, room);
        const currentPlayback = normalizeBackingChoice({
            mediaUrl: stageMediaUrl,
            appleMusicId: current?.appleMusicId
        });
        if (currentPlayback.usesAppleBacking || !currentPlayback.mediaUrl) return;

        const syncKey = `${currentId}:${currentPlayback.mediaUrl}`;
        if (currentPlaybackDurationSyncKeyRef.current === syncKey) return;
        currentPlaybackDurationSyncKeyRef.current = syncKey;

        let cancelled = false;
        void (async () => {
            try {
                const associatedBackingDurationSec = getAssociatedBackingDurationSec(current);
                const resolvedDuration = await resolveDurationForUrl(
                    currentPlayback.mediaUrl,
                    isAudioUrl(currentPlayback.mediaUrl)
                );
                if (cancelled) return;
                const nextDuration = normalizeDurationSec(resolvedDuration || associatedBackingDurationSec);
                const existingDuration = Math.max(
                    0,
                    normalizeDurationSec(current?.duration),
                    normalizeDurationSec(current?.performanceStartedDurationSec),
                    normalizeDurationSec(room?.currentPerformanceMeta?.durationSec)
                );
                if (nextDuration < 20 || Math.abs(nextDuration - existingDuration) < 3) return;
                await updateDoc(
                    doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', currentId),
                    {
                        duration: nextDuration,
                        performanceStartedDurationSec: nextDuration,
                        backingDurationSec: nextDuration,
                        durationSource: 'backing_media',
                        durationConfidence: 'high',
                        autoEndSafe: true
                    }
                );
                const activeMeta = room?.currentPerformanceMeta || {};
                if (String(activeMeta?.songId || '').trim() === currentId) {
                    await updateRoom({
                        currentPerformanceMeta: {
                            ...activeMeta,
                            durationSec: nextDuration,
                            backingDurationSec: nextDuration,
                            durationSource: 'backing_media',
                            durationConfidence: 'high',
                            autoEndSafe: true
                        }
                    });
                }
            } catch (error) {
                currentPlaybackDurationSyncKeyRef.current = '';
                hostLogger.debug('Current playback duration sync failed', error);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        current,
        current?.id,
        current?.duration,
        current?.performanceStartedDurationSec,
        current?.appleMusicId,
        current?.mediaUrl,
        isAudioUrl,
        room,
        room?.activeMode,
        room?.mediaUrl,
        resolveDurationForUrl,
        updateRoom
    ]);

    useEffect(() => {
        const stageMediaUrl = resolveStageMediaUrl({
            mediaUrl: current?.mediaUrl || room?.currentPerformanceMeta?.mediaUrl || room?.mediaUrl || '',
            appleMusicId: current?.appleMusicId,
            youtubeId: current?.youtubeId
        }, null);
        const schedule = getAutoEndSchedule({
            autoEndEnabled: room?.autoEndOnTrackFinish !== false,
            currentId: current?.id,
            applausePendingSongId: autoDjApplausePendingSongRef.current,
            activeMode: room?.activeMode,
            appleMusicId: current?.appleMusicId,
            appleStatus: room?.appleMusicPlayback?.status,
            appleStartedAt: room?.appleMusicPlayback?.startedAt,
            appleDurationSec: room?.currentPerformanceMeta?.durationSec || room?.appleMusicPlayback?.durationSec,
            mediaUrl: stageMediaUrl,
            videoPlaying: room?.videoPlaying,
            videoStartTimestamp: room?.currentPerformanceMeta?.startedAtMs || room?.videoStartTimestamp,
            pausedAt: room?.pausedAt,
            performanceMetaSongId: room?.currentPerformanceMeta?.songId,
            performanceSessionState: room?.currentPerformanceSession?.playbackState,
            performanceSessionSourceType: room?.currentPerformanceSession?.sourceType,
            performanceSessionLastHeartbeatAtMs: room?.currentPerformanceSession?.lastHeartbeatAtMs,
            performanceSessionEndedAtMs: room?.currentPerformanceSession?.endedAtMs,
            capturedDurationSec: Math.max(
                0,
                Number(room?.currentPerformanceMeta?.durationSec || 0),
                Number(current?.performanceStartedDurationSec || 0)
            ),
            currentDurationSec: Math.max(
                0,
                Number(current?.duration || 0),
                Number(current?.performanceStartedDurationSec || 0),
                Number(room?.currentPerformanceMeta?.durationSec || 0)
            ),
            autoEndSafe: room?.currentPerformanceMeta?.autoEndSafe !== undefined
                ? room.currentPerformanceMeta.autoEndSafe !== false
                : current?.autoEndSafe !== false,
            now: nowMs()
        });
        if (!schedule) return;

        const triggerAutoEnd = () => {
            if (autoDjAutoEndKeyRef.current === schedule.autoEndKey) return;
            autoDjAutoEndKeyRef.current = schedule.autoEndKey;
            handleEndPerformance(String(current?.id || '')).catch((error) => {
                hostLogger.warn('Timed end-performance trigger failed', error);
            });
        };

        if (schedule.delayMs <= 0) {
            triggerAutoEnd();
            return;
        }

        const timer = setTimeout(triggerAutoEnd, schedule.delayMs);
        return () => clearTimeout(timer);
    }, [
        current?.id,
        current?.appleMusicId,
        current?.mediaUrl,
        current?.youtubeId,
        current?.duration,
        current?.performanceStartedDurationSec,
        room?.activeMode,
        room?.autoEndOnTrackFinish,
        room?.currentPerformanceMeta?.durationSec,
        room?.currentPerformanceMeta?.autoEndSafe,
        room?.currentPerformanceMeta?.startedAtMs,
        room?.currentPerformanceMeta?.songId,
        room?.currentPerformanceMeta?.mediaUrl,
        room?.currentPerformanceSession?.playbackState,
        room?.currentPerformanceSession?.sourceType,
        room?.currentPerformanceSession?.lastHeartbeatAtMs,
        room?.currentPerformanceSession?.endedAtMs,
        room?.appleMusicPlayback?.status,
        room?.appleMusicPlayback?.startedAt,
        room?.appleMusicPlayback?.durationSec,
        room?.mediaUrl,
        room?.videoPlaying,
        room?.videoStartTimestamp,
        room?.pausedAt,
        current?.autoEndSafe,
        handleEndPerformance
    ]);

    useEffect(() => {
        const activeMode = String(room?.activeMode || '');
        const applauseFlowActive = activeMode === 'applause_countdown' || activeMode === 'applause' || activeMode === 'applause_result';
        if (applauseFlowActive) return;
        if (!autoDjApplausePendingSongRef.current) return;
        pushAutoDjEvent(AUTO_DJ_EVENTS.FAIL, {
            songId: autoDjApplausePendingSongRef.current,
            error: 'applause_flow_interrupted'
        });
        autoDjApplausePendingSongRef.current = '';
        clearAutoDjApplauseFallback();
    }, [clearAutoDjApplauseFallback, room?.activeMode, pushAutoDjEvent]);

    // Unified play/pause for the current backing source (Apple or media URL).
    async function togglePlay() {
        if (!current) return;
        const stageMediaUrl = resolveStageMediaUrl(current, room);
        const currentPlayback = normalizeBackingChoice({
            mediaUrl: stageMediaUrl,
            appleMusicId: current?.appleMusicId
        });
        const usingApple = currentPlayback.usesAppleBacking;
        if (usingApple) {
            const appleStatus = (room?.appleMusicPlayback?.status || '').toLowerCase();
            if (appleStatus === 'playing' || appleMusicPlaying) {
                await pauseAppleMusic();
            } else if (appleStatus === 'paused') {
                await resumeAppleMusic();
            } else {
                await playAppleMusicTrack(current.appleMusicId, { title: current.songTitle, artist: current.artist, duration: current.duration });
            }
            await updateRoom({ mediaUrl: '', videoPlaying: false, videoStartTimestamp: null, pausedAt: null });
            return;
        }
        await stopAppleMusic?.();
        const now = nowMs();
        if (room?.videoPlaying) {
            await updateRoom({ videoPlaying: false, pausedAt: now, appleMusicPlayback: null });
        } else {
            let newStart = room?.videoStartTimestamp || now;
            if (room?.pausedAt && room?.videoStartTimestamp) {
                const elapsedBeforePause = room.pausedAt - room.videoStartTimestamp;
                newStart = now - elapsedBeforePause;
            } else if (!room?.videoStartTimestamp) {
                newStart = now;
            }
            await updateRoom({ videoPlaying: true, videoStartTimestamp: newStart, pausedAt: null, appleMusicPlayback: null });
        }
    }

    const nextQueueSong = queue[0];
    const progressStageToNext = async () => {
        const currentlyPerforming = current ? songs.find((song) => song.id === current.id) : null;
        if (currentlyPerforming) {
            pushAutoDjEvent(AUTO_DJ_EVENTS.APPLAUSE_RESULT, { songId: currentlyPerforming.id });
            await updateStatus(currentlyPerforming.id, 'performed');
            pushAutoDjEvent(AUTO_DJ_EVENTS.SCORING_COMPLETE, { songId: currentlyPerforming.id });
        }
        if (!nextQueueSong?.id) return;
        pushAutoDjEvent(AUTO_DJ_EVENTS.START, { songId: nextQueueSong.id });
        try {
            await updateStatus(nextQueueSong.id, 'performing', { allowCurrentId: currentlyPerforming?.id || null });
            pushAutoDjEvent(AUTO_DJ_EVENTS.STAGE_READY, { songId: nextQueueSong.id });
        } catch (error) {
            pushAutoDjEvent(AUTO_DJ_EVENTS.FAIL, { songId: nextQueueSong.id, error: error?.message || 'stage_start_failed' });
            throw error;
        }
    };
    const commandPaletteItems = [
            {
                id: 'start-next',
                label: 'Start Next Performer',
                enabled: !!nextQueueSong,
                hint: nextQueueSong ? `${nextQueueSong.singerName || 'Guest'} - ${nextQueueSong.songTitle || 'Song'}` : 'Queue is empty',
                keywords: 'queue start next performer',
                run: async () => {
                    if (!nextQueueSong) return;
                    await updateStatus(nextQueueSong.id, 'performing');
                }
            },
            {
                id: 'toggle-source',
                label: currentSourcePlaying ? 'Pause Current Source' : 'Play Current Source',
                enabled: !!current,
                hint: current ? (current.songTitle || 'Current performance') : 'No current song',
                keywords: 'play pause toggle source backing',
                run: async () => { await togglePlay(); }
            },
            {
                id: 'open-tv',
                label: 'Open Public TV Display',
                enabled: !!roomCode,
                hint: roomCode ? `Room ${roomCode}` : 'No room code',
                keywords: 'tv display public open',
                run: async () => {
                    const url = String(tvLaunchUrl || '').trim() || `${tvBase}?room=${roomCode}&mode=tv`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            },
            {
                id: 'chat-settings',
                label: 'Open Chat Settings',
                enabled: true,
                hint: 'Moderation and TV chat mode',
                keywords: 'chat settings moderation tv mode',
                run: async () => { openChatSettings(); }
            },
            {
                id: 'workspace-performance',
                label: 'Workspace: Performance Mode',
                enabled: true,
                hint: 'Stage + queue focus',
                keywords: 'workspace performance layout stage',
                run: async () => { applyWorkspacePreset('performance'); }
            },
            {
                id: 'workspace-crowd',
                label: 'Workspace: Crowd Mode',
                enabled: true,
                hint: 'Chat + rewards focus',
                keywords: 'workspace crowd audience layout',
                run: async () => { applyWorkspacePreset('crowd'); }
            },
            {
                id: 'workspace-broadcast',
                label: 'Workspace: Broadcast Mode',
                enabled: true,
                hint: 'TV + overlays focus',
                keywords: 'workspace broadcast layout tv overlay',
                run: async () => { applyWorkspacePreset('broadcast'); }
            },
            {
                id: 'ui-feature-check',
                label: 'Run UI Feature Check',
                enabled: true,
                hint: 'Verify critical host controls are present',
                keywords: 'check verify ui features buttons controls',
                run: async () => { runUiFeatureCheck(); }
            }
        ];
    const commandQueryNormalized = (commandQuery || '').trim().toLowerCase();
    const filteredCommands = !commandQueryNormalized
        ? commandPaletteItems
        : commandPaletteItems.filter((item) => {
            const haystack = `${item.label} ${item.hint || ''} ${item.keywords || ''}`.toLowerCase();
            return haystack.includes(commandQueryNormalized);
        });

    // Helper to open youtube search
    const _openYT = (query) => {
        if (!query) return;
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' karaoke')}`, '_blank');
    };
    const isMobileLayout = layoutMode === 'mobile';
    const isTightLayout = layoutMode === 'laptop-tight';
    const activeEditingSong = editingSongId ? songs.find((song) => song.id === editingSongId) || null : null;
    const hasRunOfShowPlan = Array.isArray(runOfShowDirector?.items) && runOfShowDirector.items.length > 0;
    const hasRunOfShowQueueHud = runOfShowEnabled || hasRunOfShowPlan;
    const hasRunOfShowQueueWork = runOfShowEnabled && (reviewQueueItems.length > 0 || pending.length > 0 || queue.length > 0 || assigned.length > 0);
    const autoCollapsedRunOfShowAddFormRef = useRef(false);

    useEffect(() => {
        if (!hasRunOfShowQueueHud && desktopQueueSurfaceTab !== 'queue') {
            setDesktopQueueSurfaceTab('queue');
        }
    }, [desktopQueueSurfaceTab, hasRunOfShowQueueHud]);
    useEffect(() => {
        if (queueSurface.isCompactQueueSurface) {
            autoCollapsedRunOfShowAddFormRef.current = false;
            return;
        }
        if (runOfShowEnabled && hasRunOfShowQueueWork && showAddForm && !autoCollapsedRunOfShowAddFormRef.current) {
            setShowAddForm(false);
            autoCollapsedRunOfShowAddFormRef.current = true;
            return;
        }
        if (!runOfShowEnabled || !hasRunOfShowQueueWork) {
            autoCollapsedRunOfShowAddFormRef.current = false;
        }
    }, [hasRunOfShowQueueWork, queueSurface.isCompactQueueSurface, runOfShowEnabled, setShowAddForm, showAddForm]);
    const handleStopRunOfShowAndRestoreQueueTools = useCallback(async () => {
        const result = await onStopRunOfShow?.();
        autoCollapsedRunOfShowAddFormRef.current = false;
        setShowAddForm(true);
        setShowQueueList(true);
        return result;
    }, [onStopRunOfShow, setShowAddForm, setShowQueueList]);

    const addToQueueSection = (
        <div className="p-3 border-b border-white/10 bg-black/20 relative">
            <SectionHeader
                label="Add to Queue"
                open={showAddForm}
                onToggle={() => setShowAddForm(v => !v)}
                toneClass="text-base font-black text-[#00C4D9]"
                featureId="panel-add-to-queue"
            />
            {showAddForm && (
                <AddToQueueFormBody
                    searchQ={searchQ}
                    setSearchQ={setSearchQ}
                    autocompleteProvider={autocompleteProvider}
                    setAutocompleteProvider={setAutocompleteProvider}
                    styles={STYLES}
                    quickAddOnResultClick={quickAddOnResultClick}
                    setQuickAddOnResultClick={setQuickAddOnResultClick}
                    results={results}
                    queueSearchSourceNote={queueSearchSourceNote}
                    queueSearchNoResultHint={queueSearchNoResultHint}
                    getResultRowKey={getResultRowKey}
                    quickAddLoadingKey={quickAddLoadingKey}
                    handleResultClick={handleResultClick}
                    searchSources={searchSources}
                    itunesBackoffRemaining={itunesBackoffRemaining}
                    quickAddNotice={quickAddNotice}
                    onUndoQuickAdd={undoQuickAdd}
                    onChangeQuickAddBacking={changeQuickAddBacking}
                    manual={manual}
                    setManual={setManual}
                    manualSingerMode={manualSingerMode}
                    setManualSingerMode={setManualSingerMode}
                    hostName={hostName}
                    users={users}
                    statusPill={statusPill}
                    lyricsOpen={lyricsOpen}
                    setLyricsOpen={setLyricsOpen}
                    onGenerateManualLyrics={generateManualLyrics}
                    openYtSearch={openYtSearch}
                    addSong={addSong}
                    appleMusicAuthorized={appleMusicAuthorized}
                />
            )}
        </div>
    );

    const runOfShowQueueHudSection = hasRunOfShowQueueHud ? (
        <div className={`flex-1 overflow-y-auto ${compactViewport ? 'p-2.5' : 'p-3'} custom-scrollbar`}>
            <RunOfShowQueueHud
                enabled={runOfShowEnabled}
                director={runOfShowDirector}
                liveItem={runOfShowLiveItem}
                stagedItem={runOfShowStagedItem}
                nextItem={runOfShowNextItem}
                preflightReport={runOfShowPreflightReport}
                onOpenShowWorkspace={onOpenRunOfShow}
                onOpenIssue={onOpenRunOfShowIssue}
                onStartShow={onStartRunOfShow}
                onAdvance={onAdvanceRunOfShow}
                onRewind={onRewindRunOfShow}
                onStop={handleStopRunOfShowAndRestoreQueueTools}
                onClear={onClearRunOfShow}
                onToggleAutomationPause={onToggleRunOfShowPause}
                styles={STYLES}
            />
        </div>
    ) : null;
    const activeMediaScene = room?.announcement?.active && String(room?.announcement?.type || '').trim().toLowerCase() === 'media_scene'
        ? room.announcement
        : null;
    const scenePresetsSection = (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100">TV Moments</div>
                    <div className="mt-1 text-xs text-zinc-400">Upload image or video scenes, run them now, or slot them into the show conveyor as moments.</div>
                </div>
                {activeMediaScene ? (
                    <button type="button" onClick={onClearScenePreset} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1 text-[10px]`}>
                        End Scene
                    </button>
                ) : null}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_7rem_auto]">
                <input value={scenePresetTitle} onChange={(event) => setScenePresetTitle(event.target.value)} className={STYLES.input} placeholder="Scene title" />
                <input type="number" min="5" max="600" value={scenePresetDurationSec} onChange={(event) => setScenePresetDurationSec(event.target.value)} className={STYLES.input} title="Duration in seconds" />
                <label className={`${STYLES.btnStd} ${STYLES.btnSecondary} cursor-pointer justify-center px-3 py-2 text-[10px] ${scenePresetUploading ? 'pointer-events-none opacity-60' : ''}`}>
                    <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        disabled={scenePresetUploading}
                        onChange={async (event) => {
                            const file = event.target.files?.[0] || null;
                            if (file && typeof onCreateScenePreset === 'function') {
                                const saved = await onCreateScenePreset(file, { title: scenePresetTitle, durationSec: scenePresetDurationSec });
                                if (saved) setScenePresetTitle('');
                            }
                            event.target.value = '';
                        }}
                    />
                    {scenePresetUploading ? `Uploading ${Math.round(scenePresetUploadProgress || 0)}%` : 'Upload Scene'}
                </label>
            </div>
            {activeMediaScene ? (
                <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                    Live on TV: {activeMediaScene.title || activeMediaScene.headline || 'Media scene'}
                </div>
            ) : null}
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {(scenePresets || []).slice(0, 6).map((preset) => (
                    <div key={preset.id || preset.mediaUrl} className="rounded-xl border border-white/10 bg-zinc-950/55 p-3">
                        <div className="flex gap-3">
                            <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/35">
                                {preset.mediaType === 'video'
                                    ? <video src={preset.mediaUrl} className="h-full w-full object-cover" muted playsInline />
                                    : <img src={preset.mediaUrl} alt="" className="h-full w-full object-cover" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-black text-white">{preset.title || 'Media Scene'}</div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                    {preset.mediaType === 'video' ? 'Video' : 'Image'} / {Math.max(5, Number(preset.durationSec || 20))}s
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => onLaunchScenePreset?.(preset)} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-[10px]`}>
                                Run Now
                            </button>
                            <button type="button" onClick={() => onQueueScenePreset?.(preset)} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-3 py-1 text-[10px]`}>
                                Queue Next Moment
                            </button>
                            <button type="button" onClick={() => onAddScenePresetToRunOfShow?.(preset)} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-[10px]`}>
                                Add To Run Of Show
                            </button>
                            <button type="button" onClick={() => onDeleteScenePreset?.(preset)} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1 text-[10px]`}>
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
                {!scenePresets?.length ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950/35 px-3 py-4 text-xs text-zinc-500">No scene presets yet.</div>
                ) : null}
            </div>
        </div>
    );
    const queueListSection = (
        <div className={`flex-1 overflow-y-auto ${compactViewport ? 'p-2.5 space-y-2.5' : 'p-3 space-y-3'} custom-scrollbar`}>
            {queueSurface.isCompactQueueSurface ? runOfShowQueueHudSection : null}
            <SectionHeader
                label="Queue"
                open={showQueueList}
                onToggle={() => setShowQueueList(v => !v)}
                toneClass={`text-base font-black text-[#00C4D9] px-1 sticky top-0 z-20 bg-zinc-950/95 backdrop-blur ${compactViewport ? 'py-2 rounded-lg border border-white/10' : ''}`}
                featureId="panel-queue-list"
            />
            {showQueueList && reviewQueueItems.length > 0 && (
                <div className="rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-500/10 via-black/30 to-pink-500/10 p-3 space-y-3">
                    <button
                        type="button"
                        onClick={() => setReviewQueueOpen((v) => !v)}
                        aria-expanded={!!reviewQueueOpen}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-300/18 bg-black/25 px-3 py-2 text-left transition hover:border-amber-300/35"
                    >
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/80">Track Check</div>
                            <div className="text-lg font-black text-white">Unresolved Requests</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">
                                {reviewQueueItems.length} needs host pick
                            </div>
                            <i className={`fa-solid fa-chevron-down text-xs text-amber-100 transition-transform ${reviewQueueOpen ? 'rotate-180' : ''}`}></i>
                        </div>
                    </button>
                    {reviewQueueOpen ? reviewQueueItems.map((song) => {
                        const topCandidate = song.reviewCandidates?.[0] || null;
                        const busy = reviewActionBusyKey.startsWith(`${song.id}:`);
                        const appleMusicId = String(song?.appleMusicId || song?.trackId || '').trim();
                        const canUseAppleSingAlong = !!appleMusicId;
                        const sourceLabel = String(song?.trackSource || song?.source || '').trim().toLowerCase();
                        const requestLooksApple = canUseAppleSingAlong || sourceLabel.includes('apple') || sourceLabel.includes('itunes');
                        return (
                            <div key={song.id} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xl">{song.emoji || EMOJI.mic}</span>
                                            <div className="text-base font-black text-white truncate">{song.songTitle}</div>
                                            {song.collabOpen && (
                                                <span className="rounded-full border border-pink-300/25 bg-pink-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-pink-100">Duet / group open</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-zinc-400 truncate">{song.artist || 'Unknown'} • {song.singerName || 'Guest'}</div>
                                        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                                            {topCandidate
                                                ? `Best match: ${topCandidate.label || String(topCandidate.layer || 'candidate').replace(/_/g, ' ')}`
                                                : requestLooksApple
                                                    ? 'Choose Apple sing-along or find a karaoke backing.'
                                                    : 'No trusted backing found yet. Use YouTube backing search.'}
                                        </div>
                                    </div>
                                    <div className="text-right text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                        {song.reviewCandidates?.length || 0} ranked option{(song.reviewCandidates?.length || 0) === 1 ? '' : 's'}
                                    </div>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        disabled={busy || !canUseAppleSingAlong || !appleMusicAuthorized}
                                        onClick={() => resolveAppleSingAlongReviewRequest(song)}
                                        title={!canUseAppleSingAlong ? 'This request does not include an Apple Music track id' : !appleMusicAuthorized ? 'Connect Apple Music before approving sing-along playback' : 'Approve this as full-song Apple Music sing-along playback'}
                                        className={`${STYLES.btnStd} ${STYLES.btnPrimary} min-h-[42px] justify-center px-3 py-2 text-[10px] ${(!canUseAppleSingAlong || !appleMusicAuthorized) ? 'cursor-not-allowed opacity-55' : ''}`}
                                    >
                                        <i className="fa-brands fa-apple mr-2"></i>
                                        Apple Sing-Along
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => openReviewRequestEditor(song, { openSearch: true })}
                                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} min-h-[42px] justify-center px-3 py-2 text-[10px]`}
                                    >
                                        <i className="fa-brands fa-youtube mr-2"></i>
                                        Find YouTube Backing
                                    </button>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => openReviewRequestEditor(song)}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1 text-[10px]`}
                                    >
                                        Edit Request
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => rejectReviewRequest(song)}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1 text-[10px]`}
                                    >
                                        Send Back
                                    </button>
                                </div>
                                {song.reviewCandidates?.length > 0 && (
                                    <div className="mt-3 grid min-w-0 gap-2 overflow-hidden">
                                        {song.reviewCandidates.slice(0, 3).map((candidate) => {
                                            const diagnosticsKey = getYtDiagnosticsKey(candidate);
                                            const diagnosticsEntry = diagnosticsKey ? ytDiagnosticsMap[diagnosticsKey] : null;
                                            const diagnostics = diagnosticsEntry?.diagnostics || null;
                                            const diagnosticsTone = getTrackDiagnosticsTone(diagnostics);
                                            const diagnosticsSupport = getTrackDiagnosticsSupport(diagnostics);
                                            return (
                                            <div key={candidate.id} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/55 px-3 py-2">
                                                <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                                                    <div className="min-w-0 overflow-hidden">
                                                        <div className="break-words text-sm font-bold leading-snug text-white">
                                                            {candidate.title || song.songTitle}
                                                            {candidate.artist ? ` • ${candidate.artist}` : ''}
                                                        </div>
                                                        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                                                            {(candidate.label || String(candidate.layer || 'candidate').replace(/_/g, ' '))} • {candidate.source || 'track'}
                                                        </div>
                                                        {candidate.reason && (
                                                            <div className="mt-1 text-xs text-zinc-400">{candidate.reason}</div>
                                                        )}
                                                        {diagnostics ? (
                                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                                {diagnosticsTone ? (
                                                                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${diagnosticsTone.className}`}>
                                                                        {diagnosticsTone.label}
                                                                    </span>
                                                                ) : null}
                                                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                                                                    {Number(diagnostics.successCount || 0)} good shows
                                                                </span>
                                                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                                                                    {Number(diagnostics.failureCount || 0)} bad calls
                                                                </span>
                                                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                                                                    {Number(diagnostics.globalAvoidRoomCount || 0)} rooms skipped
                                                                </span>
                                                            </div>
                                                        ) : diagnosticsEntry?.error ? (
                                                            <div className="mt-2 text-xs text-rose-200">{diagnosticsEntry.error}</div>
                                                        ) : null}
                                                        {diagnosticsSupport ? (
                                                            <div className="mt-2 text-xs text-zinc-400">{diagnosticsSupport}</div>
                                                        ) : null}
                                                    </div>
                                                    <div className="grid min-w-[150px] gap-2 sm:grid-cols-3 xl:grid-cols-1">
                                                        <button
                                                            type="button"
                                                            disabled={busy}
                                                            onClick={() => resolveReviewRequest(song, candidate)}
                                                            className={`${STYLES.btnStd} ${STYLES.btnPrimary} justify-center px-2 py-1.5 text-[10px]`}
                                                        >
                                                            Queue This
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={busy}
                                                            onClick={() => resolveReviewRequest(song, candidate, { saveFavorite: true, mode: 'favorite' })}
                                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} justify-center px-2 py-1.5 text-[10px]`}
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={busy}
                                                            onClick={() => resolveReviewRequest(song, candidate, { submitTrustedReview: true, mode: 'trusted' })}
                                                            className={`${STYLES.btnStd} ${STYLES.btnHighlight} justify-center px-2 py-1.5 text-[10px]`}
                                                        >
                                                            Trust
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {song.collaborationCandidates?.length > 0 && (
                                    <div className="mt-3 rounded-xl border border-pink-300/18 bg-pink-500/8 px-3 py-3">
                                        <div className="text-[10px] uppercase tracking-[0.24em] text-pink-100/80">Collaboration match</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {song.collaborationCandidates.slice(0, 3).map((entry) => (
                                                <span key={entry.requestId} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-zinc-100">
                                                    {(entry.emoji || EMOJI.mic)} {entry.singerName}
                                                    {entry.tight15Overlap ? ' | Tight 15 overlap' : ' | Same song'}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button type="button" onClick={() => setReviewCollabMode(song, 'duet')} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-[10px]`}>Pair as duet</button>
                                            <button type="button" onClick={() => setReviewCollabMode(song, 'group')} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-[10px]`}>Create group slot</button>
                                            <button type="button" onClick={() => setReviewCollabMode(song, 'solo')} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1 text-[10px]`}>Keep solo</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    }) : null}
                </div>
            )}
            <QueueListPanel
                showQueueList={showQueueList}
                showQueueSummaryBar={showQueueSummaryBar}
                onToggleQueueSummaryBar={() => setShowQueueSummaryBar((value) => !value)}
                pending={pending}
                pendingQueueOpen={pendingQueueOpen}
                onTogglePendingQueue={() => setPendingQueueOpen((v) => !v)}
                queue={queue}
                readyQueueOpen={readyQueueOpen}
                onToggleReadyQueue={() => setReadyQueueOpen((v) => !v)}
                assigned={assigned}
                assignedQueueOpen={assignedQueueOpen}
                onToggleAssignedQueue={() => setAssignedQueueOpen((v) => !v)}
                held={held}
                onApprovePending={(songId) => updateStatus(songId, 'requested')}
                onDeletePending={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                onMoveNext={moveSingerNext}
                onHoldSinger={holdSinger}
                onRestoreSinger={restoreHeldSinger}
                dragQueueId={dragQueueId}
                dragOverId={dragOverId}
                setDragQueueId={setDragQueueId}
                setDragOverId={setDragOverId}
                reorderQueue={reorderQueue}
                touchReorderAvailable={touchReorderAvailable}
                touchReorderEnabled={touchReorderEnabled}
                touchReorderMode={queueSurface.touchReorderMode}
                handleTouchStart={handleTouchStart}
                handleTouchMove={handleTouchMove}
                handleTouchEnd={handleTouchEnd}
                updateStatus={updateStatus}
                startEdit={startEdit}
                onRetryLyrics={retryLyricsForSong}
                onFetchTimedLyrics={fetchTimedLyricsForSong}
                onApproveAudienceBacking={(song) => resolveAudienceSelectedBacking(song, 'approve')}
                onAvoidAudienceBacking={(song) => resolveAudienceSelectedBacking(song, 'avoid')}
                backingDecisionBusyKey={backingDecisionBusyKey}
                statusPill={statusPill}
                styles={STYLES}
                compactViewport={compactViewport || queueSurface.isCompactQueueSurface}
                reviewRequiredCount={reviewQueueItems.length}
                reviewRequired={reviewRequired}
                runOfShowAssignableSlots={runOfShowAssignableSlots}
                queueSurfaceCounts={queueSurface.counts}
                onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
            />
            <div className="rounded-2xl border border-white/10 bg-black/20 p-2">
                <SectionHeader
                    label="TV Moments"
                    open={showScenePresets}
                    onToggle={() => setShowScenePresets((value) => !value)}
                    toneClass="text-sm font-black text-cyan-100 px-1"
                    featureId="panel-tv-moments"
                />
                {showScenePresets ? (
                    <div className="mt-2">
                        {scenePresetsSection}
                    </div>
                ) : null}
            </div>
        </div>
    );
    const desktopQueueSurfacePanel = !queueSurface.isCompactQueueSurface ? (
        <div className={`${STYLES.panel} min-h-0 flex flex-col overflow-hidden min-w-0`}>
            {hasRunOfShowQueueHud ? (
                <div className="border-b border-white/10 bg-black/20 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em]">
                        <button
                            type="button"
                            onClick={() => setDesktopQueueSurfaceTab('queue')}
                            data-feature-id="queue-surface-tab-queue-desktop"
                            className={`min-h-[36px] rounded-lg px-3 text-[11px] font-black uppercase tracking-[0.16em] transition ${
                                desktopQueueSurfaceTab === 'queue'
                                    ? 'bg-cyan-500/15 text-cyan-100'
                                    : 'text-zinc-300 hover:text-white'
                            }`}
                        >
                            Queue
                        </button>
                        <button
                            type="button"
                            onClick={() => setDesktopQueueSurfaceTab('show')}
                            data-feature-id="queue-surface-tab-show-desktop"
                            className={`min-h-[36px] rounded-lg px-3 text-[11px] font-black uppercase tracking-[0.16em] transition ${
                                desktopQueueSurfaceTab === 'show'
                                    ? 'bg-cyan-500/15 text-cyan-100'
                                    : 'text-zinc-300 hover:text-white'
                            }`}
                        >
                            Run Of Show
                        </button>
                    </div>
                </div>
            ) : null}
            {desktopQueueSurfaceTab === 'show' && hasRunOfShowQueueHud ? runOfShowQueueHudSection : queueListSection}
        </div>
    ) : null;
    const compactQueueStatusChips = [
        queueSurface.counts.needsAttention > 0
            ? {
                key: 'needsAttention',
                className: 'rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-1 text-amber-100',
                label: `Needs Attention ${queueSurface.counts.needsAttention}`
            }
            : null,
        {
            key: 'ready',
            className: 'rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-100',
            label: `Ready ${queueSurface.counts.ready}`
        },
        queueSurface.counts.assigned > 0
            ? {
                key: 'assigned',
                className: 'rounded-full border border-violet-300/30 bg-violet-500/10 px-2.5 py-1 text-violet-100',
                label: `Assigned ${queueSurface.counts.assigned}`
            }
            : null
    ].filter(Boolean);
    const showCompactQueueStatusChips = compactQueueStatusChips.length > 1 || compactQueueStatusChips.some((chip) => chip.key !== 'ready');
    const compactQueueSurfaceControls = queueSurface.isCompactQueueSurface ? (
        <div className="border-b border-white/10 bg-black/20 px-3 py-3">
            {showCompactQueueStatusChips ? (
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em]">
                    {compactQueueStatusChips.map((chip) => (
                        <span key={chip.key} className={chip.className}>
                            {chip.label}
                        </span>
                    ))}
                </div>
            ) : null}
            <div className={`${showCompactQueueStatusChips ? 'mt-3 ' : ''}flex flex-wrap items-center gap-2`}>
                <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
                    <button
                        type="button"
                        onClick={() => queueSurface.activateCompactTab('queue')}
                        data-feature-id="queue-surface-tab-queue"
                        className={`min-h-[36px] rounded-lg px-3 text-[11px] font-black uppercase tracking-[0.16em] transition ${
                            queueSurface.activeCompactTab === 'queue'
                                ? 'bg-cyan-500/15 text-cyan-100'
                                : 'text-zinc-300 hover:text-white'
                        }`}
                    >
                        Queue
                    </button>
                    <button
                        type="button"
                        onClick={() => queueSurface.activateCompactTab('add')}
                        data-feature-id="queue-surface-tab-add"
                        className={`min-h-[36px] rounded-lg px-3 text-[11px] font-black uppercase tracking-[0.16em] transition ${
                            queueSurface.activeCompactTab === 'add'
                                ? 'bg-cyan-500/15 text-cyan-100'
                                : 'text-zinc-300 hover:text-white'
                        }`}
                    >
                        Add
                    </button>
                </div>
                {touchReorderAvailable && queueSurface.activeCompactTab === 'queue' ? (
                    <button
                        type="button"
                        onClick={queueSurface.toggleTouchReorderMode}
                        data-feature-id="queue-surface-reorder-toggle"
                        className={`inline-flex min-h-[36px] items-center justify-center rounded-lg border px-3 text-[11px] font-black uppercase tracking-[0.16em] transition ${
                            queueSurface.touchReorderMode
                                ? 'border-cyan-300/35 bg-cyan-500/15 text-cyan-100'
                                : 'border-white/10 bg-black/25 text-zinc-200 hover:border-cyan-300/30 hover:text-white'
                        }`}
                    >
                        {queueSurface.touchReorderMode ? 'Done Reordering' : 'Reorder Queue'}
                    </button>
                ) : null}
            </div>
        </div>
    ) : null;
    const compactQueueSurfacePanel = queueSurface.isCompactQueueSurface ? (
        <div className={`flex-1 ${STYLES.panel} flex flex-col overflow-hidden min-w-0 order-1 min-h-0`}>
            {compactQueueSurfaceControls}
            {queueSurface.activeCompactTab === 'add' ? (
                <div className="min-h-0 overflow-y-auto custom-scrollbar">
                    {addToQueueSection}
                </div>
            ) : queueListSection}
        </div>
    ) : null;

    return (
        <div className={`h-full flex flex-col ${compactViewport ? 'gap-2' : 'gap-3'} overflow-hidden relative`}>
            {ytSearchOpen ? (
                <React.Suspense fallback={null}>
                    <QueueYouTubeSearchModal
                        open={ytSearchOpen}
                        styles={STYLES}
                        ytSearchQ={ytSearchQ}
                        setYtSearchQ={setYtSearchQ}
                        ytEditingQuery={ytEditingQuery}
                        setYtEditingQuery={setYtEditingQuery}
                        ytLoading={ytLoading}
                        ytSearchError={ytSearchError}
                        ytResults={ytResults}
                        embedCache={embedCache}
                        searchYouTube={searchYouTube}
                        testEmbedVideo={testEmbedVideo}
                        selectYouTubeVideo={selectYouTubeVideo}
                        onClose={() => setYtSearchOpen(false)}
                        emoji={EMOJI}
                    />
                </React.Suspense>
            ) : null}

            {editingSongId ? (
                <React.Suspense fallback={null}>
                    <QueueEditSongModal
                        open={Boolean(editingSongId)}
                        song={activeEditingSong}
                        styles={STYLES}
                        editForm={editForm}
                        setEditForm={setEditForm}
                        openYtSearch={openYtSearch}
                        syncEditDuration={syncEditDuration}
                        generateLyrics={generateLyrics}
                        onRetryLyrics={retryLyricsForSong}
                        onFetchTimedLyrics={fetchTimedLyricsForSong}
                        onCancel={() => setEditingSongId(null)}
                        onSave={saveEdit}
                        emoji={EMOJI}
                    />
                </React.Suspense>
            ) : null}
            {commandOpen && (
                <div
                    className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm p-4 flex items-start justify-center"
                    onClick={() => setCommandOpen(false)}
                >
                    <div
                        className={`${STYLES.panel} mt-20 w-full max-w-2xl border-white/20`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                            <div className="text-xs uppercase tracking-[0.35em] text-[#00C4D9]">Command Palette</div>
                            <div className="text-[11px] text-zinc-500">Ctrl/Cmd + K</div>
                        </div>
                        <div className="p-3 border-b border-white/10">
                            <input
                                ref={commandInputRef}
                                value={commandQuery}
                                onChange={(event) => setCommandQuery(event.target.value)}
                                className={STYLES.input}
                                placeholder="Type a command..."
                            />
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredCommands.length > 0 ? filteredCommands.map((command) => (
                                <button
                                    key={command.id}
                                    onClick={() => runPaletteCommand(command)}
                                    disabled={!command.enabled}
                                    className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                                        command.enabled
                                            ? 'border-zinc-700 bg-zinc-900/80 hover:border-[#00C4D9]/60'
                                            : 'border-zinc-800 bg-zinc-900/40 opacity-55 cursor-not-allowed'
                                    }`}
                                >
                                    <div className="text-sm font-bold text-white">{command.label}</div>
                                    <div className="text-xs text-zinc-500 mt-1">{command.hint}</div>
                                </button>
                            )) : (
                                <div className="text-sm text-zinc-500 px-2 py-3">No commands match your search.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {postPerformanceBackingPrompt && (
                <div className="fixed right-3 top-24 z-[190] w-[min(88vw,22rem)]">
                    <div className="rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-[#12182a]/95 via-[#111827]/95 to-[#1a1025]/95 p-3 shadow-[0_20px_56px_rgba(0,0,0,0.42)] backdrop-blur-sm">
                        <div className="flex items-start gap-2.5">
                            {postPerformanceBackingPrompt.albumArtUrl ? (
                                <img
                                    src={postPerformanceBackingPrompt.albumArtUrl}
                                    alt="Backing art"
                                    className="h-11 w-11 rounded-xl border border-white/10 object-cover"
                                />
                            ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-lg text-cyan-200">
                                    <i className="fa-brands fa-youtube"></i>
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-300">Track check</div>
                                <div className="mt-0.5 text-base font-semibold text-white truncate">{postPerformanceBackingPrompt.songTitle || 'Recent performance'}</div>
                                <div className="text-[13px] text-zinc-300 truncate">{postPerformanceBackingPrompt.artist || 'YouTube track'}</div>
                                <div className="mt-1.5 text-[13px] text-zinc-400">Would you use this track again?</div>
                                <div className="mt-0.5 text-[10px] text-zinc-500">Closes automatically after a few seconds.</div>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={() => void handlePostPerformanceBackingPromptAction('prefer')}
                                disabled={postPerformanceBackingPromptBusy}
                                className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-2.5 py-1.5 text-[11px] ${postPerformanceBackingPromptBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <i className="fa-solid fa-thumbs-up"></i>
                                Use Again
                            </button>
                            <button
                                type="button"
                                onClick={() => void handlePostPerformanceBackingPromptAction('avoid')}
                                disabled={postPerformanceBackingPromptBusy}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} border-rose-300/40 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-100 hover:border-rose-200/60 ${postPerformanceBackingPromptBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <i className="fa-solid fa-thumbs-down"></i>
                                Bad Track
                            </button>
                            <button
                                type="button"
                                onClick={() => void handlePostPerformanceBackingPromptAction('skip')}
                                disabled={postPerformanceBackingPromptBusy}
                                className={`${STYLES.btnStd} ${STYLES.btnNeutral} ml-auto px-2.5 py-1.5 text-[11px] ${postPerformanceBackingPromptBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Skip
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className={`flex-1 min-h-0 ${
                isMobileLayout
                    ? 'flex flex-col gap-3'
                    : isTightLayout
                        ? 'grid grid-cols-[minmax(280px,1.02fr)_minmax(360px,1fr)] gap-5'
                        : 'grid grid-cols-[minmax(280px,0.9fr)_minmax(360px,1fr)_minmax(360px,1fr)] gap-5'
            } overflow-hidden`}>
            {/* LEFT CONTROLS */}
            <div className={`w-full flex flex-col ${
                isMobileLayout
                    ? 'order-2 min-h-0 max-h-[38vh] pr-1.5'
                    : isTightLayout
                        ? 'order-2 min-h-0 pr-1'
                        : 'min-h-0 pr-1'
            }`}>
                <div className={`${STYLES.panel} h-full min-h-0 flex flex-col overflow-hidden`}>
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                        <HostLiveOpsPanel
                            current={current}
                            nextQueueSong={nextQueueSong}
                            nextQueueText={queueSurface.stageSummary.nextQueueText}
                            queueCount={queueSurface.stageSummary.queueCount}
                            readyQueueCount={queueSurface.counts.ready}
                            assignedQueueCount={queueSurface.counts.assigned}
                            needsAttentionCount={queueSurface.counts.needsAttention}
                            currentSourcePlaying={currentSourcePlaying}
                            runOfShowEnabled={runOfShowEnabled}
                            runOfShowLiveItem={runOfShowLiveItem}
                            runOfShowFlightedItem={runOfShowStagedItem}
                            runOfShowOnDeckItem={runOfShowNextItem}
                            crowdPulse={crowdPulse}
                            onTogglePlay={togglePlay}
                            onEndPerformance={handleEndPerformance}
                            onReturnCurrentToQueue={onReturnCurrentToQueue || returnCurrentPerformanceToQueue}
                            onEditCurrent={startEdit}
                            onProgressStageToNext={progressStageToNext}
                            onOpenRunOfShow={onOpenRunOfShow}
                            styles={STYLES}
                        />
                        <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Stage"
                            open={stagePanelOpen}
                            onToggle={() => setStagePanelOpen(v => !v)}
                            featureId="panel-now-playing"
                        />
                        {stagePanelOpen && (
                            <StageNowPlayingPanel
                                room={room}
                                current={current}
                                lastPerformance={room?.lastPerformance || null}
                                hasLyrics={hasLyrics}
                                lobbyCount={lobbyCount}
                                queueCount={queueSurface.stageSummary.queueCount}
                                needsAttentionCount={queueSurface.counts.needsAttention}
                                readyQueueCount={queueSurface.counts.ready}
                                assignedQueueCount={queueSurface.counts.assigned}
                                waitTimeSec={waitTimeSec}
                                formatWaitTime={formatWaitTime}
                                nextQueueSong={nextQueueSong}
                                nextQueueText={queueSurface.stageSummary.nextQueueText}
                                roomCode={roomCode}
                                currentSourcePlaying={currentSourcePlaying}
                                currentUsesAppleBacking={currentUsesAppleBacking}
                                currentMediaUrl={currentMediaUrl}
                                currentSourceLabel={currentSourceLabel}
                                currentSourceToneClass={currentSourceToneClass}
                                appleMusicStatus={appleMusicStatus}
                                autoDj={autoDj}
                                autoDjSequenceSummary={autoDjSequenceSummary}
                                autoDjStepItems={autoDjStepItems}
                                togglePlay={togglePlay}
                                playAppleMusicTrack={playAppleMusicTrack}
                                stopAppleMusic={stopAppleMusic}
                                updateRoom={updateRoom}
                                startEdit={startEdit}
                                customBonus={customBonus}
                                setCustomBonus={setCustomBonus}
                                addBonusToCurrent={addBonusToCurrent}
                                onRateBacking={rateBackingPreference}
                                onResolveAudienceBacking={resolveAudienceSelectedBacking}
                                backingDecisionBusyKey={backingDecisionBusyKey}
                                updateStatus={updateStatus}
                                onMeasureApplause={() => current && startApplauseSequence({ songId: current.id, autoFinalize: false })}
                                onEndPerformance={(songId) => handleEndPerformance(songId)}
                                onReturnCurrentToQueue={onReturnCurrentToQueue || returnCurrentPerformanceToQueue}
                                progressStageToNext={progressStageToNext}
                                showStageSummaryHeader={false}
                                styles={STYLES}
                                emoji={EMOJI}
                            />
                        )}
                        </section>
                        {!essentialsMode && showLegacyLiveEffects && (
                            <section className="px-4 py-4 border-b border-white/10">
                            <SectionHeader
                                label="Soundboard"
                                open={soundboardOpen}
                                onToggle={() => setSoundboardOpen(v => !v)}
                                featureId="panel-soundboard"
                            />
                            <SoundboardControls
                                soundboardOpen={soundboardOpen}
                                sfxMuted={sfxMuted}
                                setSfxMuted={setSfxMuted}
                                silenceAll={silenceAll}
                                styles={STYLES}
                                sfxLevel={sfxLevel}
                                sfxVolume={sfxVolume}
                                setSfxVolume={setSfxVolume}
                                sounds={SOUNDS}
                                playSfxSafe={playSfxSafe}
                                smallWaveform={SmallWaveform}
                            />
                            </section>
                        )}

                        {!essentialsMode && (
                            <>
                                <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.25em] text-[#00C4D9]/80">
                                    Audience Controls
                                </div>
                                <section className="px-4 py-4 border-b border-white/10">
                                <SectionHeader
                                    label="Chat"
                                    open={chatOpen}
                                    onToggle={() => setChatOpen(v => !v)}
                                    featureId="panel-chat"
                                />
                                <HostChatPanel
                                    chatOpen={chatOpen}
                                    chatUnread={chatUnread}
                                    openChatSettings={openChatSettings}
                                    styles={STYLES}
                                    appBase={hostBase}
                                    hostBase={hostBase}
                                    roomCode={roomCode}
                                    chatEnabled={chatEnabled}
                                    setChatEnabled={setChatEnabled}
                                    updateRoom={updateRoom}
                                    chatShowOnTv={chatShowOnTv}
                                    setChatShowOnTv={setChatShowOnTv}
                                    chatAudienceMode={chatAudienceMode}
                                    setChatAudienceMode={setChatAudienceMode}
                                    handleChatViewMode={handleChatViewMode}
                                    chatViewMode={chatViewMode}
                                    dmUnread={dmUnread}
                                    dmTargetUid={dmTargetUid}
                                    setDmTargetUid={setDmTargetUid}
                                    users={users}
                                    dmDraft={dmDraft}
                                    setDmDraft={setDmDraft}
                                    sendHostDmMessage={sendHostDmMessage}
                                    roomChatMessages={roomChatMessages}
                                    hostDmMessages={hostDmMessages}
                                    pinnedChatIds={pinnedChatIds}
                                    setPinnedChatIds={setPinnedChatIds}
                                    emoji={EMOJI}
                                    chatDraft={chatDraft}
                                    setChatDraft={setChatDraft}
                                    sendHostChat={sendHostChat}
                                />
                                </section>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {queueSurface.isCompactQueueSurface ? (
                compactQueueSurfacePanel
            ) : (
                <>
                    <div className={`${STYLES.panel} min-h-0 overflow-y-auto custom-scrollbar`}>
                        {addToQueueSection}
                    </div>
                    {desktopQueueSurfacePanel}
                </>
            )}
            </div>
        </div>
    );
};

// --- MAIN HOST APP COMPONENT ---
export default HostQueueTab;
