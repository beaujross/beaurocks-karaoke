import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { HOST_LIVE_OPS_LANGUAGE, getHostLineupStateLabel } from '../hostLiveOpsLanguage';
import AddToQueueFormBody from './AddToQueueFormBody';
import SoundboardControls from './SoundboardControls';
import HostInboxPanel from './HostInboxPanel';
import HostNightPilotPrototype from './HostNightPilotPrototype';
import HostStageConsoleExperimental from './HostStageConsoleExperimental';
import QueueListPanel from './QueueListPanel';
import ContentSourceBadge from '../../../components/ContentSourceBadge';
import {
  PLAYBACK_SELECTION_MODES,
  getContentSourceMeta,
  getQueuePlaybackSelection,
} from '../../../lib/playbackSelection';
import HostLiveOpsPanel from './HostLiveOpsPanel';
import StageNowPlayingPanel from './StageNowPlayingPanel';
import useQueueTabState from '../hooks/useQueueTabState';
import useQueueDerivedState from '../hooks/useQueueDerivedState';
import useQueueSurfaceController from '../hooks/useQueueSurfaceController';
import useQueueReorder from '../hooks/useQueueReorder';
import useQueueMediaTools from '../hooks/useQueueMediaTools';
import useQueueSongActions from '../hooks/useQueueSongActions';
import {
  buildCuratedYouTubeAutocompleteEntries,
  buildIndexedYouTubeAutocompleteEntries,
  buildLocalLibraryAutocompleteEntries,
} from '../queueAutocomplete';
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
  syncSelfServeAuctionState,
} from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import { buildBrowseCuratedYouTubeIndex } from '../../../lib/curatedKaraokeIndex';
import { enrichCatalogResultsWithCanonicalIdentity, groupUnifiedCatalogResults } from '../../../lib/unifiedCatalogResults';
import { buildBackgroundAudioQaSnapshot, deriveBackgroundAudioState, getBackgroundAudioCapability } from '../../../lib/backgroundAudioState';
import {
  searchYouTubeCatalog,
} from '../../../lib/youtubeSearchClient';
import { searchAppleCatalog } from '../../../lib/appleSearchClient';
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
import { buildSongKey, ensureSong, resolveCanonicalTrackIdentityBatch, resolveSongCatalog } from '../../../lib/songCatalog';
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
import { startQueueSongOnStage } from '../startQueueSongOnStage';
import {
  AUTO_DJ_EVENTS,
  createAutoDjSequenceState,
  transitionAutoDjSequenceState,
  deriveAutoDjStepItems,
  describeAutoDjSequenceState,
} from '../autoDjStateMachine';
import { getAutoEndSchedule, getTrackDurationSecFromSearchResult } from '../hostPlaybackAutomation';
import {
  getRunOfShowReleaseWindowRemainingMs,
  getRunOfShowReleaseWindowTally,
  normalizeRunOfShowDirector,
} from '../../../lib/runOfShowDirector';
import {
  AUDIENCE_DECISION_TYPES,
  buildContinueOrRotateDecision,
} from '../../../lib/audienceDecision';
import { buildSelfServeQueueExplanation } from '../../../lib/selfServeQueueExplanation';
import { getSelfServeAuctionState } from '../../../lib/selfServeAuction';
import {
  buildSelfServeModePresentation,
  buildSelfServeQueueFaceOffWindow,
  consumeSelfServeAuctionSlot,
  getSelfServeAuctionWindow,
  isSelfServeAuctionWindowLive,
  SELF_SERVE_FORMATS,
} from '../../../lib/selfServeKaraoke';
import { BG_TRACK_OPTIONS } from '../../../lib/bgTrackOptions';
import {
  HOST_AUDIO_LIBRARY_CATEGORY_OPTIONS,
  HOST_AUDIO_MOMENT_CUE_OPTIONS,
  normalizeHostAudioLibraryCategory,
  normalizeHostAudioLibraryItemMetadata,
} from '../../../lib/hostAudioLibrary';
import {
  getMediaSceneAllowedReactionTypes,
  getMediaSceneAudienceReactionMeta,
  getMediaSceneSoundtrackPrimaryValue,
  hasMediaSceneConfiguredSoundtrack,
  MEDIA_SCENE_AUDIENCE_REACTION_OPTIONS,
  MEDIA_SCENE_SOUNDTRACK_SOURCE_OPTIONS,
  normalizeMediaSceneSoundtrackConfig,
  normalizeMediaSceneAudienceReactionMode,
} from '../../../lib/mediaSceneConfig';
import buildHostRuntimeShellModel from '../lib/hostRuntimeShellModel';
import {
  getHostRuntimeShellMode,
  isPostPerformanceBackingPromptEnabled,
} from '../lib/hostUiPrefs';

const QueueYouTubeSearchModal = React.lazy(() => import('./QueueYouTubeSearchModal'));
const QueueEditSongModal = React.lazy(() => import('./QueueEditSongModal'));
const hostLogger = createLogger('HostQueueTab');
const nowMs = () => Date.now();
const DEFAULT_APPLAUSE_WARMUP_SEC = 0;
const DEFAULT_APPLAUSE_COUNTDOWN_SEC = 0;
const DEFAULT_APPLAUSE_MEASURE_SEC = 5;
const APPLAUSE_RESULT_DISPLAY_SEC = 5;
const APPLAUSE_HOST_FALLBACK_GRACE_MS = 2500;

const stripKaraokeDecorators = (value = '') =>
  String(value || '')
    .replace(/\s*-\s*Karaoke Version(?:\s+from\s+.*)?$/i, '')
    .replace(/\s*\((?:official\s+)?(?:karaoke|instrumental)(?:\s+version|\s+track|\s+video)?\)\s*$/i, '')
    .replace(/\s*\[(?:official\s+)?(?:karaoke|instrumental).*?\]\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const buildQueueFaceOffSongLabel = (song = {}) =>
  String(song?.songTitle || song?.title || '').trim() || 'Song';

const buildQueueFaceOffSongDetail = (song = {}) =>
  String(song?.singerName || song?.artist || '').trim() || 'Queued pick';

const buildQueueFaceOffSongArtwork = (song = {}) =>
  String(song?.albumArtUrl || song?.artworkUrl100 || song?.artworkUrl || song?.art || '').trim();

const buildVoteCountLabel = (count = 0) => `${count} vote${count === 1 ? '' : 's'}`;

const buildScenePresetFallbackTitle = (value = '', mediaType = 'image') => {
    const cleaned = String(value || '')
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    if (cleaned) return cleaned;
    return mediaType === 'video' ? 'Video Scene' : 'Image Scene';
};

const buildAudioLibraryDraft = (item = {}) => {
    const metadata = normalizeHostAudioLibraryItemMetadata(item);
    return {
        title: String(item?.title || '').trim(),
        audioLibraryCategory: metadata.audioLibraryCategory,
        soundboardLabel: metadata.soundboardLabel,
        includeOnSoundboard: metadata.includeOnSoundboard,
        hostMomentCueId: metadata.hostMomentCueId,
        bgAutoEligible: metadata.bgAutoEligible,
    };
};

const SCENE_LIBRARY_TEMPLATE_QUICK_PADS = Object.freeze([
    { id: 'host_update', label: 'Host Update', group: 'Announcements', icon: 'fa-bullhorn', detail: 'Fast host message' },
    { id: 'how_to_join', label: 'How To Join', group: 'Announcements', icon: 'fa-qrcode', detail: 'Scan and join cue' },
    { id: 'sponsor_spotlight', label: 'Sponsor', group: 'Announcements', icon: 'fa-handshake', detail: 'Branded thank-you' },
    { id: 'support_the_show', label: 'Support', group: 'Support', icon: 'fa-heart', detail: 'Donation beat' },
    { id: 'leaderboard_flash', label: 'Leaderboard', group: 'Audience', icon: 'fa-ranking-star', detail: 'Room status flash' },
    { id: 'selfie_cam', label: 'Selfie Cam', group: 'Audience', icon: 'fa-camera', detail: 'Crowd spotlight' },
    { id: 'would_you_rather', label: 'WYR Vote', group: 'Interactive', icon: 'fa-scale-balanced', detail: 'Quick A/B room vote' },
    { id: 'trivia_break', label: 'Trivia', group: 'Interactive', icon: 'fa-circle-question', detail: 'One-question break' },
    { id: 'applause_meter', label: 'Applause', group: 'Interactive', icon: 'fa-volume-high', detail: 'Measure the room' },
    { id: 'winner_declaration', label: 'Winner', group: 'Announcements', icon: 'fa-trophy', detail: 'Declare the result' },
]);
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

const buildApplauseSubject = (song = null) => {
  if (!song || typeof song !== 'object') return null;
  const recapDisplayMeta = getRecapDisplayMeta(song);
  const subjectId = String(song?.id || song?.songDocId || song?.songId || '').trim();
  if (!subjectId) return null;
  return {
    id: subjectId,
    songDocId: subjectId,
    singerUid: song?.singerUid || null,
    singerName: recapDisplayMeta.singerName,
    performerName: recapDisplayMeta.singerName,
    displayName: recapDisplayMeta.singerName,
    songTitle: recapDisplayMeta.songTitle,
    title: recapDisplayMeta.songTitle,
    artist: recapDisplayMeta.artist,
    albumArtUrl: song?.albumArtUrl || '',
    mediaUrl: song?.mediaUrl || '',
    timestamp: Number(song?.performingStartedAt || song?.timestamp || 0) || 0,
    performingStartedAt: song?.performingStartedAt || null,
  };
};

const normalizeDurationSec = (value = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
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

const formatReviewCandidateDuration = (durationSec = 0) => {
  const safeSec = normalizeDurationSec(durationSec);
  if (!safeSec) return '';
  const minutes = Math.floor(safeSec / 60);
  const seconds = safeSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getReviewCandidateDurationSec = (candidate = {}) => {
  const values = [
    candidate?.durationSec,
    candidate?.duration,
    candidate?.trackDurationSec,
    candidate?.backingDurationSec,
    candidate?.mediaDurationSec,
  ];
  for (const value of values) {
    const durationSec = normalizeDurationSec(value);
    if (durationSec > 0) return durationSec;
  }
  return 0;
};

const getReviewCandidateArtworkUrl = (candidate = {}) => {
  const explicit = String(candidate?.artworkUrl100 || candidate?.artworkUrl || candidate?.albumArtUrl || '').trim();
  if (explicit) return explicit;
  const videoId = parseYouTubeVideoId(candidate?.mediaUrl || candidate?.url || candidate?.trackId || '');
  return videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '';
};

const getReviewCandidateSourceMeta = (candidate = {}) => {
  const source = String(candidate?.source || '').trim().toLowerCase();
  const inferredSource = source || (parseYouTubeVideoId(candidate?.mediaUrl || candidate?.url || '') ? 'youtube' : 'local');
  const sourceMeta = getContentSourceMeta(inferredSource);
  return inferredSource === 'local' ? { ...sourceMeta, label: 'Known' } : sourceMeta;
};

const getReviewCandidateBeauScore = (candidate = {}) => {
  const rawScore = Number(candidate?.score || candidate?.rankingScore || candidate?.qualityScore || 0);
  if (!Number.isFinite(rawScore) || rawScore <= 0) return 0;
  return Math.max(1, Math.min(99, Math.round((rawScore / 360) * 100)));
};
const buildQueueReviewSearchQuery = (song = {}) => (
  [song?.songTitle, song?.artist].map((value) => String(value || '').trim()).filter(Boolean).join(' ')
);

const getReviewCanonicalResolutionKey = (song = {}) => {
  const requestId = String(song?.id || '').trim();
  const songId = String(song?.songId || buildSongKey(song?.songTitle || song?.title || '', song?.artist || 'Unknown')).trim();
  return [requestId, songId].filter(Boolean).join(':');
};

const normalizeResolvedReviewCandidates = (resolved = null, song = {}) => {
  const rawCandidates = [];
  if (resolved?.track) rawCandidates.push(resolved.track);
  if (Array.isArray(resolved?.candidates)) rawCandidates.push(...resolved.candidates);
  const seen = new Set();
  return rawCandidates
    .map((candidate, index) => {
      const source = String(candidate?.source || '').trim().toLowerCase() || 'youtube';
      const mediaUrl = String(candidate?.mediaUrl || '').trim();
      const appleMusicId = String(candidate?.appleMusicId || '').trim();
      if (!mediaUrl && !appleMusicId) return null;
      const layer = String(candidate?.resolutionLayer || candidate?.layer || 'canonical_backing').trim().toLowerCase() || 'canonical_backing';
      const backingCandidateId = String(candidate?.backingCandidateId || '').trim();
      const candidateId = String(candidate?.id || backingCandidateId || mediaUrl || appleMusicId || `resolved:${index}`).trim();
      const key = [source, mediaUrl, appleMusicId, backingCandidateId, candidateId].filter(Boolean).join('|');
      if (!key || seen.has(key)) return null;
      seen.add(key);
      return {
        id: candidateId,
        trackId: candidateId.startsWith('yt_index:') || candidateId.startsWith('canonical_backing:') ? '' : candidateId,
        mediaUrl,
        appleMusicId,
        source,
        title: String(candidate?.title || song?.songTitle || song?.title || '').trim(),
        artist: String(candidate?.artist || song?.artist || 'Unknown').trim() || 'Unknown',
        label: String(candidate?.label || (layer === 'canonical_backing' ? 'Known backing' : 'Resolved backing')).trim(),
        layer,
        qualityScore: Number(candidate?.qualityScore || 0),
        rankingScore: Number(candidate?.rankingScore || 0),
        backingCandidateId,
        canonicalSongId: String(candidate?.canonicalSongId || resolved?.songId || song?.songId || '').trim(),
        backingTelemetry: candidate?.backingTelemetry && typeof candidate.backingTelemetry === 'object' ? candidate.backingTelemetry : null,
        successCount: Number(candidate?.successCount || 0),
        usageCount: Number(candidate?.usageCount || 0),
        failureCount: Number(candidate?.failureCount || 0),
        artworkUrl100: String(candidate?.artworkUrl100 || candidate?.artworkUrl || '').trim(),
        artworkUrl: String(candidate?.artworkUrl || candidate?.artworkUrl100 || '').trim(),
        durationSec: normalizeDurationSec(candidate?.durationSec || candidate?.duration),
        duration: normalizeDurationSec(candidate?.duration || candidate?.durationSec),
        approvalState: String(candidate?.approvalState || 'approved').trim().toLowerCase(),
        reason: layer === 'canonical_backing'
          ? 'Ranked from host feedback for this song.'
          : 'Resolved from the song catalog before live YouTube search.'
      };
    })
    .filter(Boolean);
};

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
            ? 'No Apple song match yet. This YouTube track cannot play inside BeauRocks.'
            : 'No Apple song match yet. Showing verified embeddable YouTube tracks.')
          : (playbackState.backingAudioOnly
            ? 'YouTube track is not embeddable inside BeauRocks.'
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

const getTrackCheckIdentity = (value = {}) => ({
  performanceKey: String(value?.performanceKey || '').trim(),
  videoId: String(value?.videoId || '').trim(),
});

const trackChecksMatch = (left = null, right = null) => {
  if (!left || !right) return false;
  const leftIdentity = getTrackCheckIdentity(left);
  const rightIdentity = getTrackCheckIdentity(right);
  if (leftIdentity.performanceKey && rightIdentity.performanceKey) {
    return leftIdentity.performanceKey === rightIdentity.performanceKey;
  }
  return !!leftIdentity.videoId && leftIdentity.videoId === rightIdentity.videoId;
};

const buildTrackCheckPromptFromPerformance = (performance = null) => {
  const mediaUrl = String(performance?.mediaUrl || '').trim();
  const videoId = parseYouTubeVideoId(mediaUrl);
  const stablePerformanceId = String(
    performance?.songDocId
    || performance?.id
    || performance?.songId
    || ''
  ).trim();
  const performanceStartedAtMs = getTimestampMs(performance?.performingStartedAt);
  const timestampMs = getTimestampMs(performance?.timestamp);
  const performanceKeySuffix = stablePerformanceId || performanceStartedAtMs || timestampMs;
  if (!videoId || !performanceKeySuffix) return null;
  return {
    performanceKey: `${videoId}:${performanceKeySuffix}`,
    videoId,
    timestamp: performanceStartedAtMs || timestampMs,
    songTitle: String(performance?.songTitle || 'Recent performance').trim() || 'Recent performance',
    artist: String(performance?.artist || 'YouTube backing').trim() || 'YouTube backing',
    albumArtUrl: String(performance?.albumArtUrl || '').trim(),
    songLike: {
      ...(performance || {}),
      mediaUrl,
    },
  };
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

const momentDraftInputClass = 'mt-1.5 w-full rounded-xl border border-violet-300/20 bg-zinc-950/85 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-300/50 focus:ring-2 focus:ring-violet-300/15';
const getMomentDraftOptions = (item = {}, minimum = 0) => {
  const launchConfig = item?.modeLaunchPlan?.launchConfig || {};
  const options = Array.isArray(launchConfig.options)
    ? launchConfig.options.map((entry) => String(entry || ''))
    : String(launchConfig.optionsCsv || '').split(',').map((entry) => entry.trim()).filter(Boolean);
  while (options.length < minimum) options.push('');
  return options;
};

const InlineMomentDraftEditor = ({
  item: itemProp = {},
  onUpdateItem,
  onOpenAdvanced,
}) => {
  const item = itemProp || {};
  const itemType = String(item.type || '').trim().toLowerCase();
  const modeKey = String(item?.modeLaunchPlan?.modeKey || '').trim().toLowerCase();
  const launchConfig = item?.modeLaunchPlan?.launchConfig || {};
  const isWouldYouRather = itemType === 'would_you_rather_break' || modeKey === 'wyr';
  const isTrivia = itemType === 'trivia_break' || modeKey === 'trivia_pop';
  const isInteractive = Boolean(modeKey) || ['would_you_rather_break', 'trivia_break', 'game_break'].includes(itemType);
  const options = getMomentDraftOptions(item, isWouldYouRather ? 2 : 0);
  const [draft, setDraft] = useState(() => ({
    title: String(item.title || ''),
    plannedDurationSec: Math.max(5, Number(item.plannedDurationSec || launchConfig.durationSec || 30)),
    question: String(launchConfig.question || ''),
    options,
    points: Math.max(0, Number(launchConfig.points ?? (isTrivia ? 100 : 50))),
    autoReveal: launchConfig.autoReveal !== false,
    headline: String(item?.presentationPlan?.headline || ''),
    subhead: String(item?.presentationPlan?.subhead || ''),
  }));
  const [saveState, setSaveState] = useState('idle');
  if (!item.id || typeof onUpdateItem !== 'function') return null;
  const updateDraft = (patch = {}) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSaveState('idle');
  };
  const saveDraft = async ({ openAdvanced = false } = {}) => {
    setSaveState('saving');
    try {
      const plannedDurationSec = Math.min(3600, Math.max(5, Number(draft.plannedDurationSec || 0) || 5));
      const patch = {
        title: draft.title,
        plannedDurationSec,
        plannedDurationSource: 'manual',
      };
      if (isInteractive) {
        const nextOptions = (Array.isArray(draft.options) ? draft.options : [])
          .map((entry) => String(entry || '').trim());
        patch.modeLaunchPlan = {
          ...(item.modeLaunchPlan || {}),
          modeKey: modeKey || (isWouldYouRather ? 'wyr' : isTrivia ? 'trivia_pop' : ''),
          launchConfig: {
            ...launchConfig,
            question: draft.question,
            durationSec: plannedDurationSec,
            ...((isWouldYouRather || isTrivia || itemType === 'game_break') ? {
              options: nextOptions,
              optionsCsv: nextOptions.filter(Boolean).join(', '),
            } : {}),
            ...((isWouldYouRather || isTrivia) ? {
              points: Math.min(500, Math.max(0, Number(draft.points || 0))),
              autoReveal: draft.autoReveal === true,
            } : {}),
          },
        };
      } else {
        patch.presentationPlan = {
          ...(item.presentationPlan || {}),
          headline: draft.headline,
          subhead: draft.subhead,
        };
      }
      await onUpdateItem(item.id, patch);
      setSaveState('saved');
      if (openAdvanced) onOpenAdvanced?.(item.id);
    } catch {
      setSaveState('error');
    }
  };

  return (
    <details data-feature-id="moment-draft-inline-editor" className="group mt-3 overflow-hidden rounded-xl border border-violet-300/18 bg-violet-500/[0.055]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-violet-100 transition hover:bg-violet-500/10">
        <span className="inline-flex items-center gap-2"><i className="fa-solid fa-pen-to-square"></i>Edit draft here</span>
        <i className="fa-solid fa-chevron-down text-[9px] transition group-open:rotate-180"></i>
      </summary>
      <div className="space-y-3 border-t border-violet-300/15 p-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
          <label className="text-xs font-bold text-zinc-300">
            Moment title
            <input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} className={momentDraftInputClass} placeholder="Name this moment" />
          </label>
          <label className="text-xs font-bold text-zinc-300">
            Length (seconds)
            <input type="number" min="5" max="3600" step="1" value={draft.plannedDurationSec} onChange={(event) => updateDraft({ plannedDurationSec: event.target.value })} className={momentDraftInputClass} />
          </label>
        </div>
        {isInteractive ? (
          <>
            <label className="block text-xs font-bold text-zinc-300">
              {isWouldYouRather ? 'Question for the Room' : isTrivia ? 'Trivia question' : 'Prompt or instruction'}
              <textarea value={draft.question} onChange={(event) => updateDraft({ question: event.target.value })} className={`${momentDraftInputClass} min-h-[82px] resize-y`} placeholder={isWouldYouRather ? 'Would you rather…?' : 'What should guests see?'} />
            </label>
            {isWouldYouRather ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {['Choice A', 'Choice B'].map((label, optionIndex) => (
                  <label key={label} className="text-xs font-bold text-zinc-300">
                    {label}
                    <input
                      value={draft.options[optionIndex] || ''}
                      onChange={(event) => {
                        const nextOptions = [...draft.options];
                        nextOptions[optionIndex] = event.target.value;
                        updateDraft({ options: nextOptions });
                      }}
                      className={momentDraftInputClass}
                      placeholder={label}
                    />
                  </label>
                ))}
              </div>
            ) : (isTrivia || itemType === 'game_break') ? (
              <label className="block text-xs font-bold text-zinc-300">
                Answer or choice options
                <input value={draft.options.join(', ')} onChange={(event) => updateDraft({ options: event.target.value.split(',') })} className={momentDraftInputClass} placeholder="Option one, Option two" />
              </label>
            ) : null}
            {(isWouldYouRather || isTrivia) ? (
              <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-end">
                <label className="text-xs font-bold text-zinc-300">
                  Reward Points
                  <input type="number" min="0" max="500" step="1" value={draft.points} onChange={(event) => updateDraft({ points: event.target.value })} className={momentDraftInputClass} />
                </label>
                <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200">
                  <input type="checkbox" checked={draft.autoReveal} onChange={(event) => updateDraft({ autoReveal: event.target.checked })} />
                  <span>Reveal automatically when the timer ends</span>
                </label>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid gap-3">
            <label className="block text-xs font-bold text-zinc-300">
              On-screen headline
              <input value={draft.headline} onChange={(event) => updateDraft({ headline: event.target.value })} className={momentDraftInputClass} placeholder="What should Public TV show?" />
            </label>
            <label className="block text-xs font-bold text-zinc-300">
              Supporting message
              <textarea value={draft.subhead} onChange={(event) => updateDraft({ subhead: event.target.value })} className={`${momentDraftInputClass} min-h-[72px] resize-y`} placeholder="Add the detail guests need." />
            </label>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
          <span className={`text-xs ${saveState === 'error' ? 'text-rose-200' : saveState === 'saved' ? 'text-emerald-200' : 'text-violet-100/58'}`}>
            {saveState === 'error' ? 'Could not save. Try again.' : saveState === 'saved' ? 'Draft saved.' : 'Save changes before adding this draft to the lineup.'}
          </span>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saveState === 'saving'} onClick={() => saveDraft()} className="rounded-lg border border-violet-300/30 bg-violet-500/14 px-3 py-2 text-[10px] font-black uppercase tracking-[0.13em] text-violet-50 disabled:opacity-50">
              {saveState === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
            {typeof onOpenAdvanced === 'function' ? (
              <button type="button" disabled={saveState === 'saving'} onClick={() => saveDraft({ openAdvanced: true })} className="rounded-lg border border-cyan-300/22 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.13em] text-cyan-200 hover:text-white disabled:opacity-50">
                More settings
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </details>
  );
};

const POST_PERFORMANCE_BACKING_PROMPT_AUTO_CLOSE_MS = 12000;
const MAX_DEFERRED_TRACK_CHECKS = 6;
const EARLY_END_DECISION_THRESHOLD_SEC = 35;
const EARLY_END_DECISION_AUTO_CONTINUE_MS = 6500;
const HostQueueTab = ({ songs, room, roomCode, hostBase, tvBase, tvLaunchUrl = '', catalogPanel = null, youtubePlaylistUrl = '', setYoutubePlaylistUrl = () => {}, youtubePlaylistLoading = false, youtubePlaylistStatus = '', onQueueYouTubePlaylist = async () => {}, updateRoom, logActivity, localLibrary, playSfxSafe, users, sfxMuted, setSfxMuted, sfxLevel, sfxVolume, setSfxVolume, searchSources, ytIndex, accountYtIndex = [], globalYtIndex = [], setYtIndex, persistYtIndex, hideNonEmbeddableYouTube = false, autoDj, autoBgMusic = false, setAutoBgMusic = () => {}, holdAutoBgDuringStageActivation, chatUnread, dmUnread, chatMessages, handleChatViewMode = () => {}, sendHostDmMessage, itunesBackoffRemaining, appleMusicAuthorized = false, appleMusicPlaying, appleMusicStatus, appleMusicPickerModes = [], appleMusicPickerMode = 'library', setAppleMusicPickerMode = () => {}, appleMusicPickerQuery = '', setAppleMusicPickerQuery = () => {}, appleMusicPickerItems = [], appleMusicPickerLoading = false, appleMusicPickerError = '', appleMusicBgPendingId = '', loadAppleMusicPicker = async () => {}, applyAppleMusicPlaylistForBg = async () => {}, appleMusicAutoPlaylistId = '', appleMusicAutoPlaylistTitle = '', connectAppleMusic = async () => {}, disconnectAppleMusic = async () => {}, playAppleMusicTrack, pauseAppleMusic, resumeAppleMusic, stopAppleMusic, hostName, fetchTop100Art, openChatSettings, dmTargetUid, setDmTargetUid, dmDraft, setDmDraft, getAppleMusicUserToken, silenceAll, compactViewport, mediumViewport = false, layoutMode = 'desktop', showLegacyLiveEffects = true, commandPaletteRequestToken = 0, mediaLibraryOpenRequest = null, onUpsertYtIndexEntries, runOfShowEnabled = false, runOfShowDirector = null, runOfShowLiveItem = null, runOfShowStagedItem = null, runOfShowNextItem = null, runOfShowPreflightReport = null, onOpenRunOfShow, onFocusRunOfShowItem, onPreviewRunOfShowItem, onUpdateRunOfShowItem, onAddQuickRunOfShowMoment, onPromotePreparedRunOfShowItems, runOfShowDirectorPanel = null, onStartRunOfShow, onAdvanceRunOfShow, onToggleRunOfShowPause, onReturnCurrentToQueue, runOfShowAssignableSlots = [], runOfShowOpenSlots = [], onAssignQueueSongToRunOfShowItem, onAssignQueueSongToNextOpenRunOfShowSlot, onFillRunOfShowOpenSlotsFromQueue, scenePresets = [], scenePresetUploading = false, scenePresetUploadProgress = 0, onCreateScenePreset, onUpdateScenePreset, onLaunchScenePreset, onQueueScenePreset, onClearScenePreset, onDeleteScenePreset, onSeedScenePresetLibrary, onSceneLibraryModalChange, sceneLibrarySeedPack = null, scenePresetSeedPending = false, audioLibraryItems = [], customSoundboardSounds = [], onUploadAudioLibraryFiles = async () => ({ uploadedCount: 0 }), onUpdateAudioLibraryItem = async () => null, onDeleteAudioLibraryItem = async () => {}, onStartBgTrack = async () => null, setBgMusicState = async () => {}, currentBgTrackUploadId = '', coHostSignals = [], moderationQueueItems = [], moderationCounts = {}, moderationActions = {}, moderationBusyAction = '', moderationNeedsAttention = false, onOpenModerationInbox = null, ytDiagnosticsMap = {}, fetchYtDiagnostics = async () => null, getYtDiagnosticsKey = () => '', getTrackDiagnosticsTone = () => null, getTrackDiagnosticsSupport = () => '', runtimeVisible = true, fullscreenPrototype = false, prototypeExitHref = '', styles, emoji, smallWaveform }) => {
    const STYLES = styles;
    const EMOJI = emoji;
    const SmallWaveform = smallWaveform;
    const {
        stagePanelOpen,
        setStagePanelOpen,
        soundboardOpen,
        setSoundboardOpen,
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
        youtubeSearchMode,
        setYoutubeSearchMode,
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
    const [sceneLibraryOpen, setSceneLibraryOpen] = useState(false);
    const closeSceneLibrary = useCallback(() => setSceneLibraryOpen(false), []);
    const [mediaLibraryTab, setMediaLibraryTab] = useState('scenes');
    const [mediaLibraryFolderFilter, setMediaLibraryFolderFilter] = useState('all');
    const [sceneLibraryView, setSceneLibraryView] = useState('grid');
    const [scenePresetDrafts, setScenePresetDrafts] = useState({});
    const [scenePresetSavingId, setScenePresetSavingId] = useState('');
    const [audioLibraryDrafts, setAudioLibraryDrafts] = useState({});
    const [audioLibrarySavingId, setAudioLibrarySavingId] = useState('');
    const sceneLibraryScrollRef = useRef(null);
    const sceneLibraryViewportInsetTop = 'max(env(safe-area-inset-top), 0px)';
    const sceneLibraryViewportInsetBottom = 'max(env(safe-area-inset-bottom), 0px)';
    const sceneLibraryViewportHeight = `calc(100dvh - ${sceneLibraryViewportInsetTop} - ${sceneLibraryViewportInsetBottom})`;
    useEffect(() => {
        onSceneLibraryModalChange?.(sceneLibraryOpen);
        return () => {
            onSceneLibraryModalChange?.(false);
        };
    }, [onSceneLibraryModalChange, sceneLibraryOpen]);
    useEffect(() => {
        if (!sceneLibraryOpen || typeof window === 'undefined') return undefined;
        const scrollResetFrame = window.requestAnimationFrame(() => {
            sceneLibraryScrollRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
        });
        return () => {
            window.cancelAnimationFrame(scrollResetFrame);
        };
    }, [sceneLibraryOpen]);
    useEffect(() => {
        if (!sceneLibraryOpen || typeof window === 'undefined') return undefined;
        const handleMediaLibraryKeyDown = (event) => {
            if (event.key === 'Escape') closeSceneLibrary();
        };
        window.addEventListener('keydown', handleMediaLibraryKeyDown);
        return () => window.removeEventListener('keydown', handleMediaLibraryKeyDown);
    }, [closeSceneLibrary, sceneLibraryOpen]);

    useEffect(() => {
        if (!mediaLibraryOpenRequest?.token) return;
        const requestedTab = String(mediaLibraryOpenRequest?.tab || 'scenes').trim().toLowerCase();
        setMediaLibraryTab(['scenes', 'sfx', 'bg', 'apple'].includes(requestedTab) ? requestedTab : 'scenes');
        setSceneLibraryOpen(true);
    }, [mediaLibraryOpenRequest?.tab, mediaLibraryOpenRequest?.token]);
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
    useEffect(() => {
        setScenePresetDrafts((prev) => {
            const next = {};
            (Array.isArray(scenePresets) ? scenePresets : []).forEach((preset) => {
                const existing = prev[preset.id];
                const soundtrackSourceType = existing?.soundtrackSourceType ?? String(preset?.soundtrackSourceType || '').trim().toLowerCase();
                next[preset.id] = {
                    title: existing?.title ?? String(preset?.title || '').trim(),
                    durationSec: existing?.durationSec ?? Math.max(5, Math.min(600, Number(preset?.durationSec || 20) || 20)),
                    sceneAudienceReactionMode: existing?.sceneAudienceReactionMode ?? normalizeMediaSceneAudienceReactionMode(
                        preset?.sceneAudienceReactionMode || preset?.audienceReactionMode
                    ),
                    soundtrackSourceType,
                    soundtrackInputValue: existing?.soundtrackInputValue ?? getMediaSceneSoundtrackPrimaryValue(soundtrackSourceType, preset),
                    soundtrackLabel: existing?.soundtrackLabel ?? String(preset?.soundtrackLabel || '').trim(),
                };
            });
            return next;
        });
    }, [scenePresets]);
    useEffect(() => {
        setAudioLibraryDrafts((prev) => {
            const next = {};
            (Array.isArray(audioLibraryItems) ? audioLibraryItems : []).forEach((item) => {
                next[item.id] = {
                    ...buildAudioLibraryDraft(item),
                    ...prev[item.id],
                };
            });
            return next;
        });
    }, [audioLibraryItems]);
    const hallOfFameTimerRef = useRef(null);
    const autoDjApplausePendingSongRef = useRef('');
    const autoDjApplauseFallbackTimerRef = useRef(null);
    const autoDjApplauseDeadlineTimerRef = useRef(null);
    const autoDjApplauseFallbackKeyRef = useRef('');
    const autoDjAutoEndKeyRef = useRef('');
    const performanceSessionCompletionKeyRef = useRef('');
    const currentPlaybackDurationSyncKeyRef = useRef('');
    const updateStatusRef = useRef(null);
    const mediaOverrideStopRef = useRef('');
    const commandInputRef = useRef(null);
    const autoDjObservedSongRef = useRef('');
    const autoDjObservedPerfTsRef = useRef(0);
    const reviewAutoSuggestingIdsRef = useRef(new Set());
    const canonicalReviewResolutionKeysRef = useRef(new Set());
    const postPerformanceBackingPromptKeyRef = useRef('');
    const oneMinuteMicDecisionOpenKeyRef = useRef('');
    const oneMinuteMicDecisionResolveKeyRef = useRef('');
    const audienceAutomationCommandKeyRef = useRef('');
    const [commandOpen, setCommandOpen] = useState(false);
    const [commandQuery, setCommandQuery] = useState('');
    const [autoDjSequenceState, setAutoDjSequenceState] = useState(() => createAutoDjSequenceState());
    const [queueSearchSourceNote, setQueueSearchSourceNote] = useState('');
    const [queueSearchNoResultHint, setQueueSearchNoResultHint] = useState('');
    const [trustedCatalog, setTrustedCatalog] = useState({});
    const [canonicalReviewCandidateMap, setCanonicalReviewCandidateMap] = useState({});
    const [reviewActionBusyKey, setReviewActionBusyKey] = useState('');
    const [backingDecisionBusyKey, setBackingDecisionBusyKey] = useState('');
    const [postPerformanceBackingPrompt, setPostPerformanceBackingPrompt] = useState(null);
    const [postPerformanceBackingPromptBusy, setPostPerformanceBackingPromptBusy] = useState(false);
    const [pendingEarlyEndDecision, setPendingEarlyEndDecision] = useState(null);
    const [pendingEarlyEndDecisionBusy, setPendingEarlyEndDecisionBusy] = useState(false);
    const [deferredTrackChecks, setDeferredTrackChecks] = useState([]);
    const [dismissedTrackCheckKeys, setDismissedTrackCheckKeys] = useState([]);
    const [desktopQueueSurfaceTab, setDesktopQueueSurfaceTab] = useState('queue');
    const [desktopQueueReorderMode, setDesktopQueueReorderMode] = useState(false);
    const runtimeShellMode = getHostRuntimeShellMode(room);
    const useExperimentalRuntimeShell = runtimeVisible && runtimeShellMode === 'social_game_night_experiment';
    const postPerformanceBackingPromptEnabled = isPostPerformanceBackingPromptEnabled(room);
    const essentialsMode = false;
    const roomChatMessages = chatMessages.filter((msg) => isLoungeChatMessage(msg));
    const hostDmMessages = chatMessages.filter((msg) => isDirectChatMessage(msg));
    const inboxNeedsHostCount = (
        (Array.isArray(coHostSignals) ? coHostSignals.length : 0)
        + Math.max(
            Array.isArray(moderationQueueItems) ? moderationQueueItems.length : 0,
            Number(moderationCounts?.totalPending || 0),
        )
        + (Array.isArray(deferredTrackChecks) ? deferredTrackChecks.length : 0)
        + Math.max(0, Number(dmUnread || 0))
    );
    const inboxFeedCount = Math.max(0, Number(chatUnread || 0));
    const inboxTotalCount = inboxNeedsHostCount + inboxFeedCount;
    const inboxBadgeToneClass = inboxNeedsHostCount > 0
        ? 'border-pink-100/70 bg-[linear-gradient(135deg,rgba(236,72,153,0.96),rgba(190,24,93,0.92))] text-white shadow-[0_0_18px_rgba(236,72,153,0.42)]'
        : 'border-pink-300/35 bg-[linear-gradient(135deg,rgba(236,72,153,0.18),rgba(190,24,93,0.24))] text-pink-50 shadow-[0_0_14px_rgba(236,72,153,0.24)]';
    const scenePresetCount = Array.isArray(scenePresets) ? scenePresets.length : 0;
    const hasSceneLibrarySeedPack = !!sceneLibrarySeedPack?.label && Number(sceneLibrarySeedPack?.assetCount || 0) > 0;
    const mediaLibraryTabs = [
        { id: 'scenes', label: 'Scenes', icon: 'fa-images', helper: `${scenePresetCount} saved` },
        {
            id: 'sfx',
            label: 'Sound Effects',
            icon: 'fa-drum',
            helper: `${(Array.isArray(audioLibraryItems) ? audioLibraryItems : []).filter((item) => normalizeHostAudioLibraryCategory(item?.audioLibraryCategory) === 'sfx').length} ready`
        },
        {
            id: 'bg',
            label: 'Background',
            icon: 'fa-wave-square',
            helper: `${(Array.isArray(audioLibraryItems) ? audioLibraryItems : []).filter((item) => normalizeHostAudioLibraryCategory(item?.audioLibraryCategory) === 'bg').length} tracks`
        },
        {
            id: 'apple',
            label: 'Apple Music',
            icon: 'fa-music',
            helper: appleMusicAuthorized ? (appleMusicAutoPlaylistTitle || appleMusicAutoPlaylistId || 'Connected') : 'Connect'
        },
    ];
    const getMediaLibraryFolderKey = useCallback((item = {}) => {
        const folderId = String(item?.folderId || '').trim();
        const folderName = String(item?.folderName || '').trim();
        if (!folderId && !folderName) return 'unfiled';
        return `folder:${folderId || folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
    }, []);
    const mediaLibraryFolderOptions = useMemo(() => {
        const folders = new Map();
        const addFolder = (item = {}) => {
            const folderName = String(item?.folderName || '').trim();
            const folderId = String(item?.folderId || '').trim();
            if (!folderName && !folderId) return;
            const key = getMediaLibraryFolderKey(item);
            const existing = folders.get(key) || { key, folderId, folderName: folderName || folderId, count: 0 };
            folders.set(key, {
                ...existing,
                folderId: existing.folderId || folderId,
                folderName: existing.folderName || folderName || folderId,
                count: existing.count + 1,
            });
        };
        (Array.isArray(scenePresets) ? scenePresets : []).forEach(addFolder);
        (Array.isArray(audioLibraryItems) ? audioLibraryItems : []).forEach(addFolder);
        return Array.from(folders.values()).sort((a, b) => String(a.folderName).localeCompare(String(b.folderName)));
    }, [audioLibraryItems, getMediaLibraryFolderKey, scenePresets]);
    const activeMediaLibraryFolder = mediaLibraryFolderOptions.find((folder) => folder.key === mediaLibraryFolderFilter) || null;
    const mediaLibraryUploadFolder = useMemo(() => {
        if (activeMediaLibraryFolder) {
            return { folderId: activeMediaLibraryFolder.folderId, folderName: activeMediaLibraryFolder.folderName };
        }
        return { folderId: '', folderName: '' };
    }, [activeMediaLibraryFolder]);
    const mediaLibraryUploadDestinationLabel = mediaLibraryUploadFolder.folderName || 'Unfiled';
    const mediaLibraryFolderMatches = useCallback((item = {}) => {
        if (mediaLibraryFolderFilter === 'all') return true;
        return getMediaLibraryFolderKey(item) === mediaLibraryFolderFilter;
    }, [getMediaLibraryFolderKey, mediaLibraryFolderFilter]);
    const visibleScenePresets = useMemo(() => (
        (Array.isArray(scenePresets) ? scenePresets : []).filter(mediaLibraryFolderMatches)
    ), [mediaLibraryFolderMatches, scenePresets]);
    const visibleAudioLibraryItems = useMemo(() => (
        (Array.isArray(audioLibraryItems) ? audioLibraryItems : []).filter(mediaLibraryFolderMatches)
    ), [audioLibraryItems, mediaLibraryFolderMatches]);
    const sceneLibraryGridClass = sceneLibraryView === 'list'
        ? 'grid gap-3'
        : 'grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(168px,1fr))]';
    const activeAudioLane = mediaLibraryTab === 'bg' ? 'bg' : 'sfx';
    const activeAudioLaneItems = visibleAudioLibraryItems.filter((item) => (
        normalizeHostAudioLibraryCategory(item?.audioLibraryCategory) === activeAudioLane
    ));
    const inactiveAudioLaneItems = visibleAudioLibraryItems.filter((item) => (
        normalizeHostAudioLibraryCategory(item?.audioLibraryCategory) !== activeAudioLane
    ));
    const customSoundboardSoundIdSet = new Set(
        (Array.isArray(customSoundboardSounds) ? customSoundboardSounds : []).map((sound) => String(sound?.id || '').trim())
    );
    const setScenePresetDraftField = useCallback((presetId, field, value) => {
        setScenePresetDrafts((prev) => ({
            ...prev,
            [presetId]: {
                title: prev[presetId]?.title ?? '',
                durationSec: prev[presetId]?.durationSec ?? 20,
                sceneAudienceReactionMode: prev[presetId]?.sceneAudienceReactionMode ?? normalizeMediaSceneAudienceReactionMode(''),
                soundtrackSourceType: prev[presetId]?.soundtrackSourceType ?? '',
                soundtrackInputValue: prev[presetId]?.soundtrackInputValue ?? '',
                soundtrackLabel: prev[presetId]?.soundtrackLabel ?? '',
                [field]: value,
            },
        }));
    }, []);
    const setAudioLibraryDraftField = useCallback((itemId, field, value) => {
        setAudioLibraryDrafts((prev) => ({
            ...prev,
            [itemId]: {
                title: prev[itemId]?.title ?? '',
                audioLibraryCategory: prev[itemId]?.audioLibraryCategory ?? '',
                soundboardLabel: prev[itemId]?.soundboardLabel ?? '',
                includeOnSoundboard: prev[itemId]?.includeOnSoundboard ?? true,
                hostMomentCueId: prev[itemId]?.hostMomentCueId ?? '',
                bgAutoEligible: prev[itemId]?.bgAutoEligible ?? true,
                [field]: value,
            },
        }));
    }, []);
    const handleScenePresetFileSelection = useCallback(async (fileList) => {
        const files = Array.from(fileList || []).filter(Boolean);
        if (!files.length || typeof onCreateScenePreset !== 'function') return;
        const safeDurationSec = Math.max(5, Math.min(600, Number(scenePresetDurationSec || 20) || 20));
        let successCount = 0;
        for (const file of files) {
            const mediaType = String(file?.type || '').trim().startsWith('video/') ? 'video' : 'image';
            const title = files.length === 1
                ? String(scenePresetTitle || '').trim()
                : buildScenePresetFallbackTitle(file?.name || '', mediaType);
            const saved = await onCreateScenePreset(file, {
                title,
                durationSec: safeDurationSec,
                folderId: mediaLibraryUploadFolder.folderId,
                folderName: mediaLibraryUploadFolder.folderName,
            });
            if (saved) successCount += 1;
        }
        if (successCount > 0) {
            setScenePresetTitle('');
            if (files.length > 1) {
                toast(`${successCount} TV scene${successCount === 1 ? '' : 's'} added to the library.`);
            }
        }
    }, [mediaLibraryUploadFolder.folderId, mediaLibraryUploadFolder.folderName, onCreateScenePreset, scenePresetDurationSec, scenePresetTitle, toast]);
    const handleAudioLibraryFileSelection = useCallback(async (fileList, audioLibraryCategory = '') => {
        const files = Array.from(fileList || []).filter(Boolean);
        if (!files.length) return;
        await onUploadAudioLibraryFiles?.(files, {
            audioLibraryCategory: normalizeHostAudioLibraryCategory(audioLibraryCategory),
            folderId: mediaLibraryUploadFolder.folderId,
            folderName: mediaLibraryUploadFolder.folderName,
        });
    }, [mediaLibraryUploadFolder.folderId, mediaLibraryUploadFolder.folderName, onUploadAudioLibraryFiles]);
    const saveScenePresetDraft = useCallback(async (preset = {}) => {
        if (!preset?.id || typeof onUpdateScenePreset !== 'function') return;
        const draft = scenePresetDrafts[preset.id] || {};
        setScenePresetSavingId(preset.id);
        try {
            await onUpdateScenePreset(preset, {
                title: String(draft.title ?? preset?.title ?? '').trim(),
                durationSec: Math.max(5, Math.min(600, Number(draft.durationSec ?? preset?.durationSec ?? 20) || 20)),
                sceneAudienceReactionMode: normalizeMediaSceneAudienceReactionMode(draft.sceneAudienceReactionMode),
                soundtrackSourceType: String(draft.soundtrackSourceType || '').trim().toLowerCase(),
                soundtrackInputValue: String(draft.soundtrackInputValue || '').trim(),
                soundtrackLabel: String(draft.soundtrackLabel || '').trim(),
            });
        } finally {
            setScenePresetSavingId('');
        }
    }, [onUpdateScenePreset, scenePresetDrafts]);
    const saveAudioLibraryDraft = useCallback(async (item = {}) => {
        if (!item?.id) return;
        const draft = audioLibraryDrafts[item.id] || buildAudioLibraryDraft(item);
        setAudioLibrarySavingId(item.id);
        try {
            await onUpdateAudioLibraryItem?.(item, {
                title: String(draft.title || '').trim(),
                audioLibraryCategory: normalizeHostAudioLibraryCategory(draft.audioLibraryCategory),
                soundboardLabel: String(draft.soundboardLabel || '').trim(),
                includeOnSoundboard: draft.includeOnSoundboard !== false,
                hostMomentCueId: String(draft.hostMomentCueId || '').trim().toLowerCase(),
                bgAutoEligible: draft.bgAutoEligible !== false,
            });
        } finally {
            setAudioLibrarySavingId('');
        }
    }, [audioLibraryDrafts, onUpdateAudioLibraryItem]);
    const {
        current,
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
    const buildNextUpSnapshot = useCallback((excludeSongId = '') => {
        const excludedId = String(excludeSongId || '').trim();
        const seen = new Set();
        return [
            ...(Array.isArray(assigned) ? assigned : []),
            ...(Array.isArray(queue) ? queue : [])
        ]
            .filter((song) => {
                const songId = String(song?.id || '').trim();
                if (!songId || songId === excludedId || seen.has(songId)) return false;
                seen.add(songId);
                return song?.playbackReady !== false;
            })
            .slice(0, 3)
            .map((song, index) => ({
                id: String(song?.id || '').trim(),
                songId: String(song?.songId || '').trim() || null,
                songTitle: String(song?.songTitle || song?.title || '').trim() || 'Song loading',
                artist: String(song?.artist || '').trim(),
                singerName: String(song?.singerName || song?.name || '').trim() || 'Next singer',
                singerUid: String(song?.singerUid || '').trim() || null,
                singerAvatar: String(song?.singerAvatar || song?.avatar || song?.emoji || '').trim(),
                albumArtUrl: String(song?.albumArtUrl || song?.artworkUrl100 || song?.artworkUrl || '').trim(),
                status: String(song?.status || '').trim().toLowerCase() || 'requested',
                priorityScore: Number(song?.priorityScore || 0) || 0,
                isVip: song?.isVip === true,
                vipLevel: Math.max(0, Number(song?.vipLevel || 0) || 0),
                lineupPosition: index + 1
            }));
    }, [assigned, queue]);
    const normalizedDecisionDirector = useMemo(
        () => normalizeRunOfShowDirector(runOfShowDirector || room?.runOfShowDirector || {}),
        [room?.runOfShowDirector, runOfShowDirector]
    );
    const activeReleaseWindow = normalizedDecisionDirector?.releaseWindow?.active
        ? normalizedDecisionDirector.releaseWindow
        : null;
    const activeQueueFaceOffWindow = activeReleaseWindow?.subjectType === 'queue_faceoff'
        ? activeReleaseWindow
        : null;
    const activeSlotFillWindow = activeReleaseWindow?.subjectType === 'slot_fill_choice'
        ? activeReleaseWindow
        : null;
    const activeNonQueueDecisionWindow = activeReleaseWindow && !['queue_faceoff', 'slot_fill_choice'].includes(String(activeReleaseWindow?.subjectType || '').trim().toLowerCase())
        ? activeReleaseWindow
        : null;
    const selfServeMode = room?.selfServeMode?.enabled ? room.selfServeMode : null;
    const selfServeFormat = String(selfServeMode?.format || '').trim().toLowerCase();
    const selfServeOpenStageEnabled = selfServeFormat === SELF_SERVE_FORMATS.openStage;
    const selfServeSpotlightAuctionEnabled = selfServeFormat === SELF_SERVE_FORMATS.spotlightAuction;
    const selfServePresentation = useMemo(
        () => (selfServeMode ? buildSelfServeModePresentation(selfServeMode) : null),
        [selfServeMode]
    );
    const selfServeAuctionWindow = useMemo(() => getSelfServeAuctionWindow(selfServeMode), [selfServeMode]);
    const selfServeAuctionPriorityLive = useMemo(
        () => isSelfServeAuctionWindowLive(selfServeMode),
        [selfServeMode]
    );
    const activeSelfServeQueueFaceOffWindow = activeQueueFaceOffWindow?.origin === 'self_serve_open_stage_auto'
        || activeQueueFaceOffWindow?.origin === 'self_serve_spotlight_auction_auto'
        ? activeQueueFaceOffWindow
        : null;
    const [selfServeDecisionNowMs, setSelfServeDecisionNowMs] = useState(() => Date.now());
    useEffect(() => {
        if (!activeSelfServeQueueFaceOffWindow?.active) return undefined;
        setSelfServeDecisionNowMs(Date.now());
        const timer = setInterval(() => setSelfServeDecisionNowMs(Date.now()), 250);
        return () => clearInterval(timer);
    }, [activeSelfServeQueueFaceOffWindow?.active, activeSelfServeQueueFaceOffWindow?.closesAtMs, activeSelfServeQueueFaceOffWindow?.resolvedAtMs]);
    const activeSelfServeQueueFaceOffRemainingMs = useMemo(
        () => getRunOfShowReleaseWindowRemainingMs(activeSelfServeQueueFaceOffWindow || {}, selfServeDecisionNowMs),
        [activeSelfServeQueueFaceOffWindow, selfServeDecisionNowMs]
    );
    const isCoHostQueueFaceOff = String(activeQueueFaceOffWindow?.governanceMode || '').trim().toLowerCase() === 'cohost_vote';
    const queueFaceOffTone = isCoHostQueueFaceOff
        ? {
            panelClass: 'border-amber-300/22 bg-[linear-gradient(145deg,rgba(35,20,10,0.98),rgba(24,16,12,0.92))]',
            eyebrowClass: 'text-amber-200',
            winnerClass: 'border-amber-300/40 bg-amber-500/10',
            choiceLabelClass: 'text-amber-100',
            badgeClass: 'border-amber-300/20 bg-black/30 text-amber-50'
        }
        : {
            panelClass: 'border-cyan-300/20 bg-[linear-gradient(145deg,rgba(16,24,39,0.98),rgba(14,30,46,0.92))]',
            eyebrowClass: 'text-cyan-300',
            winnerClass: 'border-cyan-300/40 bg-cyan-500/10',
            choiceLabelClass: 'text-cyan-200',
            badgeClass: 'border-white/10 bg-black/30 text-zinc-100'
        };
    const spotlightAuctionState = useMemo(
        () => getSelfServeAuctionState(selfServeMode),
        [selfServeMode]
    );
    const spotlightAuctionLeaderboard = spotlightAuctionState.leaderboard;
    const spotlightAuctionCandidateSongs = useMemo(
        () => spotlightAuctionLeaderboard
            .slice(0, 2)
            .map((entry) => (songs || []).find((song) => song.id === entry.songId) || null)
            .filter(Boolean),
        [songs, spotlightAuctionLeaderboard]
    );
    const spotlightAuctionSyncSignature = useMemo(() => JSON.stringify({
        roomCode,
        currentId: String(current?.id || '').trim(),
        paidPriorityEnabled: selfServeAuctionPriorityLive,
        startedAtMs: Number(selfServeMode?.startedAtMs || 0) || 0,
        auctionRemainingSlots: Number(selfServeAuctionWindow?.remainingSlots || 0) || 0,
        auctionClosed: selfServeAuctionWindow?.closed === true,
        queueIds: (Array.isArray(queue) ? queue : []).map((song) => ({
            id: String(song?.id || '').trim(),
            singerUid: String(song?.singerUid || '').trim(),
            priorityScore: Number(song?.priorityScore || 0) || 0,
        })),
    }), [current?.id, queue, roomCode, selfServeAuctionPriorityLive, selfServeAuctionWindow?.closed, selfServeAuctionWindow?.remainingSlots, selfServeMode?.startedAtMs]);
    const queueFaceOffCandidates = useMemo(() => {
        if (selfServeAuctionPriorityLive && spotlightAuctionCandidateSongs.length >= 2) {
            return spotlightAuctionCandidateSongs;
        }
        return Array.isArray(queue) ? queue.slice(0, 2) : [];
    }, [queue, selfServeAuctionPriorityLive, spotlightAuctionCandidateSongs]);
    const slotFillCandidates = useMemo(
        () => (Array.isArray(queue) ? queue.slice(0, 2) : []),
        [queue]
    );
    const slotFillTarget = useMemo(() => {
        const activeSlotId = String(activeSlotFillWindow?.itemId || '').trim();
        if (activeSlotId) {
            return (Array.isArray(runOfShowAssignableSlots) ? runOfShowAssignableSlots : []).find((slot) => slot.id === activeSlotId) || null;
        }
        return (Array.isArray(runOfShowAssignableSlots) ? runOfShowAssignableSlots : [])[0] || null;
    }, [activeSlotFillWindow?.itemId, runOfShowAssignableSlots]);
    const queueFaceOffTally = useMemo(
        () => getRunOfShowReleaseWindowTally(activeQueueFaceOffWindow || {}, room?.runOfShowRoles || {}),
        [activeQueueFaceOffWindow, room?.runOfShowRoles]
    );
    const slotFillTally = useMemo(
        () => getRunOfShowReleaseWindowTally(activeSlotFillWindow || {}, room?.runOfShowRoles || {}),
        [activeSlotFillWindow, room?.runOfShowRoles]
    );
    const queueFaceOffWinnerChoice = String(queueFaceOffTally?.leadingChoice || '').trim().toLowerCase();
    const queueFaceOffWinnerSongId = queueFaceOffWinnerChoice
        ? String(activeQueueFaceOffWindow?.choiceSongIds?.[queueFaceOffWinnerChoice] || '').trim()
        : '';
    const queueFaceOffWinnerSong = queueFaceOffWinnerSongId
        ? (songs || []).find((song) => song.id === queueFaceOffWinnerSongId) || null
        : null;
    const slotFillWinnerChoice = String(slotFillTally?.leadingChoice || '').trim().toLowerCase();
    const slotFillWinnerSongId = slotFillWinnerChoice
        ? String(activeSlotFillWindow?.choiceSongIds?.[slotFillWinnerChoice] || '').trim()
        : '';
    const slotFillWinnerSong = slotFillWinnerSongId
        ? (songs || []).find((song) => song.id === slotFillWinnerSongId) || null
        : null;
    const persistQueueDecisionWindow = useCallback(async (nextWindow = null) => {
        const safeDirector = normalizeRunOfShowDirector(runOfShowDirector || room?.runOfShowDirector || {});
        const nextDirector = normalizeRunOfShowDirector({
            ...safeDirector,
            releaseWindow: nextWindow || {}
        });
        await updateRoom({ runOfShowDirector: nextDirector });
        return nextDirector;
    }, [room?.runOfShowDirector, runOfShowDirector, updateRoom]);
    const openQueueFaceOffVote = useCallback(async (governanceMode = 'cohost_vote', options = {}) => {
        if (activeReleaseWindow?.active) {
            toast('Another live decision is already open. Close it before starting a song face-off.');
            return;
        }
        if (queueFaceOffCandidates.length < 2) {
            toast('Need at least two ready queue songs for a face-off.');
            return;
        }
        const [firstSong, secondSong] = queueFaceOffCandidates;
        const safeGovernanceMode = ['cohost_vote', 'crowd_vote'].includes(String(governanceMode || '').trim().toLowerCase())
            ? String(governanceMode || '').trim().toLowerCase()
            : 'cohost_vote';
        const safeOptions = options && typeof options === 'object' ? options : {};
        const openedAtMs = nowMs();
        const nextWindow = String(safeOptions.origin || '').startsWith('self_serve_')
            ? buildSelfServeQueueFaceOffWindow({
                firstSong,
                secondSong,
                openedAtMs,
                durationSec: safeOptions.durationSec,
            })
            : {
                active: true,
                itemId: `queue_faceoff:${firstSong.id}:${secondSong.id}`,
                itemTitle: 'Next Song Face-Off',
                subjectType: 'queue_faceoff',
                governanceMode: safeGovernanceMode,
                releasePolicy: 'suggest_then_host_confirm',
                prompt: safeGovernanceMode === 'cohost_vote'
                    ? 'Co-hosts: which queued song should go next?'
                    : 'Audience: which queued song should go next?',
                openedAtMs,
                closesAtMs: openedAtMs + ((Math.max(10, Number(safeOptions.durationSec || 20) || 20)) * 1000),
                choiceLabels: {
                    slot_scene: buildQueueFaceOffSongLabel(firstSong),
                    keep_queue_moving: buildQueueFaceOffSongLabel(secondSong),
                },
                choiceDetails: {
                    slot_scene: buildQueueFaceOffSongDetail(firstSong),
                    keep_queue_moving: buildQueueFaceOffSongDetail(secondSong),
                },
                choiceSongIds: {
                    slot_scene: firstSong.id,
                    keep_queue_moving: secondSong.id,
                },
                votesByUid: {},
                resultChoice: '',
                resolvedAtMs: 0
            };
        await persistQueueDecisionWindow({
            ...(nextWindow || {}),
            governanceMode: safeGovernanceMode,
            ...(safeOptions.prompt ? { prompt: String(safeOptions.prompt).trim() } : {}),
            ...(safeOptions.itemTitle ? { itemTitle: String(safeOptions.itemTitle).trim() } : {}),
            ...(safeOptions.origin ? { origin: String(safeOptions.origin).trim() } : {}),
            ...(safeOptions.selfServeFormat ? { selfServeFormat: String(safeOptions.selfServeFormat).trim() } : {}),
            ...(safeOptions.releasePolicy ? { releasePolicy: String(safeOptions.releasePolicy).trim() } : {}),
            ...(safeOptions.promptDetail ? { promptDetail: String(safeOptions.promptDetail).trim() } : {}),
        });
        toast(safeGovernanceMode === 'cohost_vote' ? 'Co-host song face-off is live.' : 'Audience song face-off is live.');
    }, [activeReleaseWindow?.active, persistQueueDecisionWindow, queueFaceOffCandidates, toast]);
    const closeQueueFaceOffVote = useCallback(async (resultChoice = '') => {
        if (!activeQueueFaceOffWindow) return;
        await persistQueueDecisionWindow({
            ...(activeQueueFaceOffWindow || {}),
            active: false,
            resultChoice: String(resultChoice || '').trim().toLowerCase(),
            resolvedAtMs: nowMs()
        });
    }, [activeQueueFaceOffWindow, persistQueueDecisionWindow]);
    const openSlotFillVote = useCallback(async (governanceMode = 'cohost_vote') => {
        if (activeReleaseWindow?.active) {
            toast('Another live decision is already open. Close it before starting a slot-fill vote.');
            return;
        }
        if (!slotFillTarget?.id) {
            toast('Need an open performance slot before co-hosts can help fill it.');
            return;
        }
        if (slotFillCandidates.length < 2) {
            toast('Need at least two ready queue songs to compare for the next slot.');
            return;
        }
        const [firstSong, secondSong] = slotFillCandidates;
        const safeGovernanceMode = ['cohost_vote', 'crowd_vote'].includes(String(governanceMode || '').trim().toLowerCase())
            ? String(governanceMode || '').trim().toLowerCase()
            : 'cohost_vote';
        const safeSlotLabel = String(slotFillTarget.label || slotFillTarget.songTitle || slotFillTarget.id || 'the next open slot').trim();
        const openedAtMs = nowMs();
        await persistQueueDecisionWindow({
            active: true,
            itemId: slotFillTarget.id,
            itemTitle: safeSlotLabel,
            subjectType: 'slot_fill_choice',
            governanceMode: safeGovernanceMode,
            releasePolicy: 'suggest_then_host_confirm',
            prompt: safeGovernanceMode === 'cohost_vote'
                ? `Co-hosts: who should fill ${safeSlotLabel}?`
                : `Audience: who should fill ${safeSlotLabel}?`,
            openedAtMs,
            closesAtMs: openedAtMs + (20 * 1000),
            choiceLabels: {
                slot_scene: buildQueueFaceOffSongLabel(firstSong),
                keep_queue_moving: buildQueueFaceOffSongLabel(secondSong),
            },
            choiceDetails: {
                slot_scene: buildQueueFaceOffSongDetail(firstSong),
                keep_queue_moving: buildQueueFaceOffSongDetail(secondSong),
            },
            choiceSongIds: {
                slot_scene: firstSong.id,
                keep_queue_moving: secondSong.id,
            },
            votesByUid: {},
            resultChoice: '',
            resolvedAtMs: 0
        });
        toast(safeGovernanceMode === 'cohost_vote' ? 'Co-host slot-fill vote is live.' : 'Audience slot-fill vote is live.');
    }, [activeReleaseWindow?.active, persistQueueDecisionWindow, slotFillCandidates, slotFillTarget, toast]);
    const closeSlotFillVote = useCallback(async (resultChoice = '') => {
        if (!activeSlotFillWindow) return;
        await persistQueueDecisionWindow({
            ...(activeSlotFillWindow || {}),
            active: false,
            resultChoice: String(resultChoice || '').trim().toLowerCase(),
            resolvedAtMs: nowMs()
        });
    }, [activeSlotFillWindow, persistQueueDecisionWindow]);
    const applySlotFillWinner = useCallback(async () => {
        if (!slotFillWinnerSong?.id || !slotFillTarget?.id || typeof onAssignQueueSongToRunOfShowItem !== 'function') return;
        await onAssignQueueSongToRunOfShowItem(slotFillWinnerSong.id, slotFillTarget.id);
        await closeSlotFillVote(slotFillWinnerChoice);
    }, [closeSlotFillVote, onAssignQueueSongToRunOfShowItem, slotFillTarget?.id, slotFillWinnerChoice, slotFillWinnerSong?.id]);
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
        const applePlaybackType = String(room?.appleMusicPlayback?.type || '').trim().toLowerCase();
        const appleBackgroundSourceActive = ['playlist', 'station'].includes(applePlaybackType);
        const appleStatus = (room?.appleMusicPlayback?.status || '').toLowerCase();
        const shouldPauseApple = !!effectiveBacking.mediaUrl && (appleStatus === 'playing' || appleMusicPlaying);
        if (!shouldPauseApple) {
            mediaOverrideStopRef.current = '';
            return;
        }
        const key = `${current.id || 'current'}|${effectiveBacking.mediaUrl}|${appleStatus}|${appleMusicPlaying ? '1' : '0'}`;
        if (mediaOverrideStopRef.current === key) return;
        mediaOverrideStopRef.current = key;
        let cancelled = false;
        (async () => {
            try {
                if (appleBackgroundSourceActive) {
                    await pauseAppleMusic?.();
                } else {
                    await stopAppleMusic?.();
                }
                if (!cancelled && !appleBackgroundSourceActive) {
                    await updateRoom({ appleMusicPlayback: null });
                }
            } catch (err) {
                hostLogger.debug('Failed to stop Apple Music during media override', err);
            }
        })();
        return () => { cancelled = true; };
    }, [current?.id, current?.mediaUrl, current?.appleMusicId, room?.mediaUrl, room?.appleMusicPlayback?.status, appleMusicPlaying, pauseAppleMusic, stopAppleMusic, updateRoom, current, room]);
    useEffect(() => () => {
        if (hallOfFameTimerRef.current) clearTimeout(hallOfFameTimerRef.current);
        if (autoDjApplauseFallbackTimerRef.current) {
            clearTimeout(autoDjApplauseFallbackTimerRef.current);
            autoDjApplauseFallbackTimerRef.current = null;
        }
        if (autoDjApplauseDeadlineTimerRef.current) {
            clearTimeout(autoDjApplauseDeadlineTimerRef.current);
            autoDjApplauseDeadlineTimerRef.current = null;
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
    const handleQueuedSongNotice = useCallback((queued = null) => {
        if (!queued?.id) return;
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
    }, []);
    const queuePerformanceToSlot = useCallback(async ({
        queued = null,
        slotId = '',
        slotLabel = '',
    } = {}) => {
        if (!queued?.id || !slotId || typeof onAssignQueueSongToRunOfShowItem !== 'function') {
            return queued;
        }
        await onAssignQueueSongToRunOfShowItem(queued.id, slotId);
        return {
            ...queued,
            statusText: `${queued.statusText || 'Queued'} - linked to ${slotLabel || 'planned slot'}`
        };
    }, [onAssignQueueSongToRunOfShowItem]);
    const {
        dragQueueId,
        setDragQueueId,
        dragOverId,
        setDragOverId,
        reorderQueue,
        touchReorderEnabled,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd
    } = useQueueReorder({
        queue,
        toast,
        touchReorderActive: queueSurface.touchReorderActive,
        protectedCount: Math.max(0, Math.min(queue.length, current?.id ? 2 : 3)),
        protectedLabel: current?.id ? 'next two performers' : 'next three performers',
        onPersist: async (list) => {
            const base = nowMs();
            await Promise.all(list.map((item, idx) =>
                updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', item.id), { priorityScore: base + idx })
            ));
        }
    });
    const isAudioUrl = useCallback((url) => /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(url || ''), []);
    const {
        parseYouTubeId: _parseYouTubeId,
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
        youtubeSearchMode,
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
        syncEditDuration,
        addBonusToCurrent,
        retryLyricsForSong,
        fetchTimedLyricsForSong
    } = useQueueSongActions({
        roomCode,
        room,
        songs,
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
        getAppleMusicUserToken,
        onPersistTrustedCatalogChoice: (...args) => persistTrustedCatalogChoiceRef.current?.(...args),
        onUpsertYtIndexEntries: (...args) => upsertYtIndexEntriesRef.current?.(...args),
        toast
    });
    const queuePerformanceResultWithPlacement = useCallback(async (result, options = {}) => {
        if (quickAddLoadingKey) return null;
        const rowKey = `${result?.source || 'song'}_${result?.trackId || result?.videoId || result?.url || result?.trackName || 'result'}`;
        setQuickAddLoadingKey(rowKey);
        try {
            const queued = await addSongFromResult(result);
            if (!queued?.id) return queued;
            let nextQueued = queued;
            if (options?.slotId) {
                try {
                    nextQueued = await queuePerformanceToSlot({
                        queued,
                        slotId: options.slotId,
                        slotLabel: options.slotLabel || '',
                    });
                } catch (error) {
                    hostLogger.warn('Queued performance could not link to planned slot', error);
                    toast(`Queued ${queued.songTitle || 'performance'}, but link to ${options.slotLabel || 'the planned slot'} failed.`);
                    nextQueued = {
                        ...queued,
                        statusText: `${queued.statusText || 'Queued'} - slot link failed`
                    };
                }
            }
            setResults([]);
            setSearchQ('');
            handleQueuedSongNotice(nextQueued);
            return nextQueued;
        } finally {
            setQuickAddLoadingKey('');
        }
    }, [addSongFromResult, handleQueuedSongNotice, queuePerformanceToSlot, quickAddLoadingKey, setQuickAddLoadingKey, setResults, setSearchQ, toast]);
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
            const preferredAutocompleteSource = String(autocompleteProvider || 'youtube').toLowerCase();
            const publishCanonicalResults = async (nextResults = []) => {
                let resolvedResults = nextResults;
                try {
                    resolvedResults = await enrichCatalogResultsWithCanonicalIdentity(nextResults, resolveCanonicalTrackIdentityBatch);
                } catch (error) {
                    hostLogger.debug('Canonical search enrichment unavailable', error);
                }
                if (!cancelled) setResults(resolvedResults);
            };

            // 1. Local Search
            const localMatchesRaw = searchSources.local
                ? buildLocalLibraryAutocompleteEntries(localLibrary, normalizedQuery)
                : [];
            const localMatches = annotateQueueSearchResults(localMatchesRaw, {
                sourceReason: 'local_library',
                sourceDetail: 'Room media library match.'
            });

            if (preferredAutocompleteSource === 'spotify') {
                setQueueSearchSourceNote('Spotify autocomplete is coming soon. Showing local results only.');
                setQueueSearchNoResultHint('Switch autocomplete source to YouTube or Apple Music for live suggestions.');
                await publishCanonicalResults(localMatches);
                return;
            }

            if (preferredAutocompleteSource === 'apple') {
                if (!searchSources.itunes) {
                    setQueueSearchSourceNote('Apple Music autocomplete is disabled in Search Sources. Showing local results only.');
                    setQueueSearchNoResultHint('Enable Apple Music in Search Sources or switch autocomplete to YouTube.');
                    await publishCanonicalResults(localMatches);
                    return;
                }
                if (!appleMusicAuthorized) {
                    setQueueSearchSourceNote('Apple Music is not connected. Connect Apple Music or switch autocomplete to YouTube.');
                    setQueueSearchNoResultHint('No Apple Music results while disconnected.');
                    await publishCanonicalResults(localMatches);
                    return;
                }
                try {
                    const data = await searchAppleCatalog({
                        term: normalizedQuery,
                        limit: 7,
                        roomCode,
                        usageSource: 'host_queue_search_apple'
                    });
                    if (cancelled) return;
                    const itunesMatches = annotateQueueSearchResults((data?.results || []).map(r => ({ ...r, source: 'itunes' })), {
                        sourceReason: 'apple_authorized',
                        sourceDetail: 'Apple Music song match. Pick a YouTube backing or approve Apple sing-along.'
                    });
                    setQueueSearchSourceNote('Autocomplete source: Apple Music song intent + local library.');
                    setQueueSearchNoResultHint('No Apple Music song matches yet. Try song + artist.');
                    await publishCanonicalResults(mergeUniqueQueueSearchResults(localMatches, itunesMatches));
                } catch (_error) {
                    if (cancelled) return;
                    setQueueSearchSourceNote('Apple Music lookup is unavailable right now. Showing local results only.');
                    setQueueSearchNoResultHint('Apple lookup failed. Try again or switch autocomplete to YouTube.');
                    await publishCanonicalResults(localMatches);
                }
                return;
            }

            if (!searchSources.youtube) {
                setQueueSearchSourceNote('YouTube autocomplete is disabled in Search Sources. Showing local results only.');
                setQueueSearchNoResultHint('Enable YouTube in Search Sources or switch autocomplete to Apple Music.');
                await publishCanonicalResults(localMatches);
                return;
            }

            const ytMatchesRaw = buildIndexedYouTubeAutocompleteEntries(ytIndex, normalizedQuery);
            const ytMatches = annotateQueueSearchResults(ytMatchesRaw.filter((entry) => isYouTubeEmbeddable(entry)), {
                sourceReason: 'youtube_index',
                sourceDetail: 'Indexed YouTube playlist match.'
            });
            const curatedMatches = annotateQueueSearchResults(
                buildCuratedYouTubeAutocompleteEntries([...accountYtIndex, ...globalYtIndex, ...buildBrowseCuratedYouTubeIndex()], normalizedQuery)
                    .filter((entry) => isYouTubeEmbeddable(entry)),
                {
                    sourceReason: 'curated_browse',
                    sourceDetail: 'Known playable Browse catalogue backing. No live YouTube search needed.'
                }
            );
            const knownYouTubeMatches = mergeUniqueQueueSearchResults(ytMatches, curatedMatches);
            let liveYouTubeMatches = [];
            if (knownYouTubeMatches.length < 4) {
                try {
                    const ytSearchMode = String(youtubeSearchMode || 'karaoke').toLowerCase() === 'any' ? 'any' : 'karaoke';
                    const ytFallbackData = await searchYouTubeCatalog({
                        query: ytSearchMode === 'karaoke' ? `${normalizedQuery} karaoke` : normalizedQuery,
                        maxResults: 6,
                        playableOnly: true,
                        roomCode,
                        usageSource: ytSearchMode === 'karaoke' ? 'host_queue_search_youtube_fallback_karaoke' : 'host_queue_search_youtube_fallback_any',
                        usageSurface: 'host',
                    });
                    if (cancelled) return;
                    liveYouTubeMatches = normalizeYouTubeSearchItems(ytFallbackData?.items || [], {
                        reason: 'youtube_search',
                        hideNonEmbeddable: true
                    });
                } catch(e) {
                    if (cancelled) return;
                    hostLogger.debug('YouTube autocomplete search failed', e);
                }
            }
            if (cancelled) return;
            setQueueSearchSourceNote(youtubeSearchMode === 'any'
                ? 'Autocomplete source: indexed + curated embeddable YouTube tracks, then live exact YouTube search if needed.'
                : 'Autocomplete source: indexed + curated embeddable YouTube tracks, then live karaoke YouTube search if needed.');
            setQueueSearchNoResultHint('No embeddable YouTube tracks found. Try artist + song, switch YouTube mode, or paste a URL in manual YouTube search.');
            await publishCanonicalResults(mergeUniqueQueueSearchResults(localMatches, knownYouTubeMatches, liveYouTubeMatches));
        }, 500); 
        return () => {
            cancelled = true;
            clearTimeout(t);
        }; 
    }, [searchQ, autocompleteProvider, localLibrary, ytIndex, accountYtIndex, globalYtIndex, searchSources, setResults, appleMusicAuthorized, roomCode, youtubeSearchMode]);

    const getResultRowKey = (r, idx = 0) => {
        return `${r?.source || 'song'}_${r?.trackId || r?.videoId || r?.url || r?.trackName || idx}`;
    };

    const handleResultClick = async (r, idx = 0, options = {}) => {
        const rowKey = getResultRowKey(r, idx);
        const queueOnClick = options?.queueOnClick !== undefined
            ? options.queueOnClick === true
            : quickAddOnResultClick;
        if (queueOnClick) {
            if (quickAddLoadingKey) return;
            setQuickAddLoadingKey(rowKey);
            setResults([]);
            setSearchQ('');
            try {
                const queued = await addSongFromResult(r);
                if (queued?.id) {
                    handleQueuedSongNotice(queued);
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
    useEffect(() => {
        const reviewSongs = Array.isArray(reviewRequired) ? reviewRequired : [];
        if (!roomCode || !reviewSongs.length) {
            canonicalReviewResolutionKeysRef.current.clear();
            setCanonicalReviewCandidateMap((current) => (Object.keys(current || {}).length ? {} : current));
            return () => {};
        }

        const desiredKeys = new Set(reviewSongs.map(getReviewCanonicalResolutionKey).filter(Boolean));
        canonicalReviewResolutionKeysRef.current.forEach((key) => {
            if (!desiredKeys.has(key)) canonicalReviewResolutionKeysRef.current.delete(key);
        });
        setCanonicalReviewCandidateMap((current) => {
            const next = {};
            let changed = false;
            Object.entries(current || {}).forEach(([key, value]) => {
                if (desiredKeys.has(key)) next[key] = value;
                else changed = true;
            });
            return changed ? next : current;
        });

        const pending = reviewSongs
            .map((song) => ({ song, key: getReviewCanonicalResolutionKey(song) }))
            .filter(({ key }) => key && !canonicalReviewResolutionKeysRef.current.has(key))
            .slice(0, 4);
        if (!pending.length) return () => {};

        pending.forEach(({ key }) => canonicalReviewResolutionKeysRef.current.add(key));
        setCanonicalReviewCandidateMap((current) => {
            const next = { ...(current || {}) };
            pending.forEach(({ key }) => {
                next[key] = { ...(next[key] || {}), loading: true, loaded: false };
            });
            return next;
        });

        let cancelled = false;
        pending.forEach(async ({ song, key }) => {
            try {
                const resolved = await resolveSongCatalog({
                    songId: song?.songId || '',
                    title: song?.songTitle || song?.title || '',
                    artist: song?.artist || 'Unknown',
                    roomCode
                });
                if (cancelled) return;
                const candidates = normalizeResolvedReviewCandidates(resolved, song);
                setCanonicalReviewCandidateMap((current) => ({
                    ...(current || {}),
                    [key]: { loading: false, loaded: true, candidates }
                }));
            } catch (error) {
                hostLogger.debug('Queue review canonical backing lookup failed', error);
                if (cancelled) return;
                setCanonicalReviewCandidateMap((current) => ({
                    ...(current || {}),
                    [key]: { loading: false, loaded: true, candidates: [], error: true }
                }));
            }
        });

        return () => {
            cancelled = true;
        };
    }, [reviewRequired, roomCode]);
    const reviewQueueItems = useMemo(
        () => reviewRequired.map((song) => {
            const canonicalReviewKey = getReviewCanonicalResolutionKey(song);
            const canonicalReviewEntry = canonicalReviewCandidateMap[canonicalReviewKey] || {};
            const canonicalReviewCandidates = Array.isArray(canonicalReviewEntry.candidates) ? canonicalReviewEntry.candidates : [];
            return {
                ...song,
                canonicalBackingLookupLoading: canonicalReviewEntry.loading === true,
                reviewCandidates: prioritizeQueueReviewCandidates(rankSongRequestCandidates({
                    request: song,
                    trustedCatalogEntry: trustedCatalog?.[song.songId] || null,
                    catalogCandidates: canonicalReviewCandidates,
                    ytIndex
                })),
                collaborationCandidates: reviewCollaborationMap[song.id] || []
            };
        }),
        [canonicalReviewCandidateMap, reviewRequired, reviewCollaborationMap, trustedCatalog, ytIndex]
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

    const removeDeferredTrackCheck = useCallback((trackCheck = null) => {
        const resolvedTrackCheck = trackCheck?.performanceKey
            ? trackCheck
            : buildTrackCheckPromptFromPerformance(trackCheck);
        if (!resolvedTrackCheck) return;
        setDeferredTrackChecks((currentItems) => (Array.isArray(currentItems) ? currentItems : []).filter((item) => !trackChecksMatch(item, resolvedTrackCheck)));
    }, []);
    const dismissTrackCheck = useCallback((trackCheck = null) => {
        const resolvedTrackCheck = trackCheck?.performanceKey
            ? trackCheck
            : buildTrackCheckPromptFromPerformance(trackCheck);
        if (resolvedTrackCheck?.performanceKey) {
            setDismissedTrackCheckKeys((currentKeys) => [
                resolvedTrackCheck.performanceKey,
                ...(Array.isArray(currentKeys) ? currentKeys : []).filter((key) => key !== resolvedTrackCheck.performanceKey),
            ].slice(0, MAX_DEFERRED_TRACK_CHECKS * 2));
        }
        removeDeferredTrackCheck(resolvedTrackCheck);
        setPostPerformanceBackingPrompt((currentPrompt) => (
            trackChecksMatch(currentPrompt, resolvedTrackCheck) ? null : currentPrompt
        ));
        setPostPerformanceBackingPromptBusy(false);
    }, [removeDeferredTrackCheck]);
    const focusInboxWorkspace = useCallback(() => {
        setDesktopQueueSurfaceTab('inbox');
        queueSurface.activateCompactTab('inbox');
        if (typeof window === 'undefined') return;
        window.requestAnimationFrame(() => {
            const node = document.querySelector('[data-feature-id="panel-inbox"]');
            node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [queueSurface]);
    const openQueueWorkspace = useCallback(() => {
        setDesktopQueueSurfaceTab('queue');
        queueSurface.activateCompactTab('queue');
        setShowQueueList(true);
    }, [queueSurface, setShowQueueList]);
    const openAddWorkspace = useCallback(() => {
        setDesktopQueueSurfaceTab('add');
        queueSurface.activateCompactTab('add');
        setShowAddForm(true);
    }, [queueSurface, setShowAddForm]);
    const deferTrackCheckToInbox = useCallback((trackCheck = null, { focusInbox = false } = {}) => {
        const resolvedTrackCheck = trackCheck?.performanceKey
            ? trackCheck
            : buildTrackCheckPromptFromPerformance(trackCheck);
        if (!resolvedTrackCheck) return;
        setDeferredTrackChecks((currentItems) => [
            resolvedTrackCheck,
            ...(Array.isArray(currentItems) ? currentItems : []).filter((item) => !trackChecksMatch(item, resolvedTrackCheck)),
        ].slice(0, MAX_DEFERRED_TRACK_CHECKS));
        setPostPerformanceBackingPrompt((currentPrompt) => (
            trackChecksMatch(currentPrompt, resolvedTrackCheck) ? null : currentPrompt
        ));
        setPostPerformanceBackingPromptBusy(false);
        if (focusInbox) focusInboxWorkspace();
    }, [focusInboxWorkspace]);
    const showPostPerformanceBackingPrompt = useCallback((trackCheck = null) => {
        if (!postPerformanceBackingPromptEnabled) return;
        const resolvedTrackCheck = trackCheck?.performanceKey
            ? trackCheck
            : buildTrackCheckPromptFromPerformance(trackCheck);
        if (!resolvedTrackCheck?.performanceKey) return;
        if ((Array.isArray(dismissedTrackCheckKeys) ? dismissedTrackCheckKeys : []).includes(resolvedTrackCheck.performanceKey)) return;
        if ((Array.isArray(deferredTrackChecks) ? deferredTrackChecks : []).some((item) => trackChecksMatch(item, resolvedTrackCheck))) return;
        postPerformanceBackingPromptKeyRef.current = resolvedTrackCheck.performanceKey;
        setPostPerformanceBackingPromptBusy(false);
        setPostPerformanceBackingPrompt(resolvedTrackCheck);
    }, [deferredTrackChecks, dismissedTrackCheckKeys, postPerformanceBackingPromptEnabled]);

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
        dismissTrackCheck(songLike);
        setPostPerformanceBackingPrompt((currentPrompt) => (
            currentPrompt && currentPrompt.videoId === result.videoId ? null : currentPrompt
        ));
        toast(result.preference === 'down' ? 'Saved: skip this track next time.' : 'Saved: use this track again.');
    }, [dismissTrackCheck, persistTrustedCatalogChoice, queueTabUpsertYtIndexEntries, roomCode, toast, trustedCatalog, ytIndex]);

    const handlePostPerformanceBackingPromptAction = useCallback(async (trackCheck = null, action = 'skip') => {
        const normalizedAction = String(action || 'skip').trim().toLowerCase();
        const activePrompt = trackCheck?.performanceKey
            ? trackCheck
            : postPerformanceBackingPrompt;
        if (!activePrompt) return;
        if (normalizedAction === 'inbox') {
            deferTrackCheckToInbox(activePrompt, { focusInbox: true });
            toast('Saved to Inbox for later.');
            return;
        }
        if (normalizedAction === 'later' || normalizedAction === 'defer') {
            deferTrackCheckToInbox(activePrompt, { focusInbox: false });
            toast('Saved to Inbox for later.');
            return;
        }
        if (normalizedAction === 'skip' || normalizedAction === 'dismiss') {
            dismissTrackCheck(activePrompt);
            return;
        }
        setPostPerformanceBackingPromptBusy(true);
        try {
            await rateBackingPreference(activePrompt.songLike, normalizedAction === 'avoid' ? 'down' : 'up');
            dismissTrackCheck(activePrompt);
        } finally {
            setPostPerformanceBackingPromptBusy(false);
        }
    }, [deferTrackCheckToInbox, dismissTrackCheck, postPerformanceBackingPrompt, rateBackingPreference, toast]);

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
        setPendingEarlyEndDecision(null);
        setPendingEarlyEndDecisionBusy(false);
        setDeferredTrackChecks([]);
        setDismissedTrackCheckKeys([]);
        postPerformanceBackingPromptKeyRef.current = '';
    }, [roomCode]);

    useEffect(() => {
        if (postPerformanceBackingPromptEnabled) return;
        const currentPerformancePrompt = buildTrackCheckPromptFromPerformance(room?.lastPerformance || null);
        if (currentPerformancePrompt?.performanceKey) {
            postPerformanceBackingPromptKeyRef.current = currentPerformancePrompt.performanceKey;
        }
        setPostPerformanceBackingPrompt(null);
        setPostPerformanceBackingPromptBusy(false);
    }, [postPerformanceBackingPromptEnabled, room?.lastPerformance]);

    useEffect(() => {
        if (!postPerformanceBackingPromptEnabled) return;
        const nextPrompt = buildTrackCheckPromptFromPerformance(room?.lastPerformance || null);
        if (!nextPrompt?.performanceKey) return;
        if ((Array.isArray(dismissedTrackCheckKeys) ? dismissedTrackCheckKeys : []).includes(nextPrompt.performanceKey)) return;
        if ((Array.isArray(deferredTrackChecks) ? deferredTrackChecks : []).some((item) => trackChecksMatch(item, nextPrompt))) return;
        if (postPerformanceBackingPromptKeyRef.current === nextPrompt.performanceKey) return;
        postPerformanceBackingPromptKeyRef.current = nextPrompt.performanceKey;
        setPostPerformanceBackingPromptBusy(false);
        setPostPerformanceBackingPrompt(nextPrompt);
    }, [
        deferredTrackChecks,
        dismissedTrackCheckKeys,
        postPerformanceBackingPromptEnabled,
        room?.lastPerformance,
        room?.lastPerformance?.albumArtUrl,
        room?.lastPerformance?.artist,
        room?.lastPerformance?.mediaUrl,
        room?.lastPerformance?.songTitle,
        room?.lastPerformance?.timestamp
    ]);
    useEffect(() => {
        if (!postPerformanceBackingPromptEnabled || !postPerformanceBackingPrompt || postPerformanceBackingPromptBusy) return () => {};
        const activePerformanceKey = String(postPerformanceBackingPrompt?.performanceKey || '').trim();
        if (!activePerformanceKey) return () => {};
        const timer = setTimeout(() => {
            if (String(postPerformanceBackingPrompt?.performanceKey || '').trim() !== activePerformanceKey) return;
            deferTrackCheckToInbox(postPerformanceBackingPrompt);
        }, POST_PERFORMANCE_BACKING_PROMPT_AUTO_CLOSE_MS);
        return () => clearTimeout(timer);
    }, [deferTrackCheckToInbox, postPerformanceBackingPrompt, postPerformanceBackingPromptBusy, postPerformanceBackingPromptEnabled]);

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

        const resolveReviewCandidates = (song, extraYtMatches = []) => {
            const canonicalReviewEntry = canonicalReviewCandidateMap[getReviewCanonicalResolutionKey(song)] || {};
            const canonicalReviewCandidates = Array.isArray(canonicalReviewEntry.candidates) ? canonicalReviewEntry.candidates : [];
            return prioritizeQueueReviewCandidates(rankSongRequestCandidates({
                request: song,
                trustedCatalogEntry: trustedCatalog?.[song.songId] || null,
                catalogCandidates: canonicalReviewCandidates,
                ytIndex: [...(ytIndex || []), ...(Array.isArray(extraYtMatches) ? extraYtMatches : [])]
            }));
        };
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
                        const ytData = await searchYouTubeCatalog({
                            query: `${searchQuery} karaoke`,
                            maxResults: 5,
                            playableOnly: true,
                            roomCode,
                            usageSource: 'host_queue_review_auto_youtube',
                            usageSurface: 'host',
                        });
                        liveMatches = normalizeYouTubeSearchItems(ytData?.items || [], {
                            reason: 'queue_review_auto',
                            hideNonEmbeddable: true
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
    }, [canonicalReviewCandidateMap, reviewRequired, roomCode, trustedCatalog, ytIndex, onUpsertYtIndexEntries, hideNonEmbeddableYouTube]);

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
            setTimeout(() => openYtSearch('review_apply', searchQuery), 0);
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

      const selectYouTubeVideo = async (video) => {
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
          if (playbackState.youtubePlaybackStatus !== YOUTUBE_PLAYBACK_STATUSES.embeddable) {
              toast('That YouTube video cannot play inside BeauRocks. Try another link.');
              return;
          }
          const displayTitle = video.title.replace(' (Karaoke)', '').replace(' Karaoke', '');
          const nextEditForm = {
              ...editForm,
              title: editForm.title || displayTitle || '',
              artist: editForm.artist || video.channel || '',
              url: video.url || editForm.url,
              playbackContentKind: /karaoke|instrumental/i.test(String(video.title || ''))
                  ? 'karaoke_backing'
                  : 'unknown',
              youtubeEmbeddable: playbackState.embeddable,
              youtubeUploadStatus: playbackState.uploadStatus,
              youtubePrivacyStatus: playbackState.privacyStatus,
              youtubePlaybackStatus: playbackState.youtubePlaybackStatus
          };
          
          if (ytSearchTarget === 'edit' || ytSearchTarget === 'review_apply') {
              setEditForm(nextEditForm);
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
          if (ytSearchTarget === 'review_apply' && editingSongId) {
              const resolvedDuration = await resolveDurationForUrl(video.url || editForm.url, false).catch(() => null);
              await saveEdit({
                  songId: editingSongId,
                  formOverrides: {
                      ...nextEditForm,
                      duration: resolvedDuration || nextEditForm.duration || 180,
                  },
                  closeEditor: true,
                  successToast: 'Backing attached and request resolved.',
              });
              setYtSearchOpen(false);
              setYtSearchQ('');
              setYtResults([]);
              return;
          }
          setYtSearchOpen(false);
          setYtSearchQ('');
          setYtResults([]);
          toast(`${EMOJI.check} Embeds on TV`);
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
                toast('That YouTube video cannot play inside BeauRocks. Try another link.');
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
        const selfieMomentStartedAtMs = nowMs();
        await updateRoom({
            activeMode: 'selfie_cam',
            selfieMoment: {
                type: 'hall_of_fame',
                songId,
                singerName,
                songTitle,
                timestamp: selfieMomentStartedAtMs
            },
            selfieMomentExpiresAt: selfieMomentStartedAtMs + 12000
        });
        hallOfFameTimerRef.current = setTimeout(() => {
            updateRoom({ activeMode: 'karaoke', selfieMoment: null, selfieMomentExpiresAt: null });
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
                performanceId: songEntry.id || null,
                songId: songEntry.songId || null,
                canonicalSongId: songEntry.canonicalSongId || songEntry.songId || null,
                backingCandidateId: songEntry.backingCandidateId || null,
                backingProvider: songEntry.backingProvider || songEntry.trackSource || null,
                providerTrackId: songEntry.providerTrackId || songEntry.videoId || songEntry.appleMusicId || null,
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
                        totalPoints: Number(songEntry?.totalPoints || totalScore),
                        recapScoreFinalized: songEntry?.recapScoreFinalized === true,
                        timestamp: songEntry?.timestamp || nowMs()
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
                    pauseAppleMusic,
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
                const nextUpSnapshot = buildNextUpSnapshot(id);
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
                    totalPoints: resolvedHypeScore + finalApplauseScore + resolvedHostBonus,
                    nextUpSnapshot,
                    nextUpSnapshotCreatedAtMs: performanceEndedAtMs,
                    recapScoreFinalized: true,
                    performanceSessionId: String(performanceSession?.sessionId || '').trim() || null,
                    playbackCompletionReason: String(performanceSession?.completionReason || '').trim() || null,
                    recapLedgerSource: reconciled?.source || null,
                    recapEventCount: Number(reconciled?.eventCount || 0)
                };
                const activeApplePlayback = room?.appleMusicPlayback || null;
                const preservedAppleBackgroundPlayback = ['playlist', 'station'].includes(String(activeApplePlayback?.type || '').trim().toLowerCase())
                    ? { ...activeApplePlayback, status: 'paused' }
                    : null;
                if (!preservedAppleBackgroundPlayback) await stopAppleMusic?.();
                await updateRoom({
                    lastPerformance: recapPayload,
                    activeMode: 'karaoke',
                    bonusDrop: null,
                    selfieMoment: null,
                    selfieMomentExpiresAt: null,
                    selfieChallenge: null,
                    photoOverlay: null,
                    applauseSubject: null,
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
                    appleMusicPlayback: preservedAppleBackgroundPlayback
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

    const moveSingerNext = useCallback(async (songId = '', options = {}) => {
        const targetSongId = String(songId || '').trim();
        if (!targetSongId) return;
        const forceWithinProtected = options?.forceWithinProtected === true;
        const targetSong = (songs || []).find((song) => song.id === targetSongId) || null;
        if (!targetSong) {
            toast('Singer not found in queue.');
            return;
        }
        const protectedReadyQueueCount = Math.max(0, Math.min(queue.length, current?.id ? 2 : 3));
        const targetIndex = (queue || []).findIndex((song) => song.id === targetSongId);
        if (!forceWithinProtected && targetIndex >= 0 && targetIndex < protectedReadyQueueCount) {
            toast('That singer is already in the protected live lineup.');
            return;
        }
        if (!forceWithinProtected && protectedReadyQueueCount > 0) {
            toast(current?.id
                ? 'The next two performers are locked. Let the room advance before changing them.'
                : 'The next three performers are locked. Let the room advance before changing them.');
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
    }, [current?.id, pushAutoDjEvent, queue, songs, toast]);
    const applyQueueFaceOffWinner = useCallback(async () => {
        if (!activeQueueFaceOffWindow) return;
        if (!queueFaceOffWinnerChoice) {
            toast('No winner yet. Break the tie or close the vote.');
            return;
        }
        if (!queueFaceOffWinnerSongId) {
            toast('Winning song is no longer available in the queue.');
            return;
        }
        await moveSingerNext(queueFaceOffWinnerSongId, {
            forceWithinProtected: String(activeQueueFaceOffWindow?.origin || '').startsWith('self_serve_'),
        });
        await closeQueueFaceOffVote(queueFaceOffWinnerChoice);
    }, [
        activeQueueFaceOffWindow,
        closeQueueFaceOffVote,
        moveSingerNext,
        queueFaceOffWinnerChoice,
        queueFaceOffWinnerSongId,
        toast
    ]);
    const spotlightAuctionSyncSignatureRef = useRef('');
    useEffect(() => {
        if (!selfServeSpotlightAuctionEnabled || !selfServeMode?.enabled || !selfServeAuctionPriorityLive || !roomCode) return;
        if (spotlightAuctionSyncSignatureRef.current === spotlightAuctionSyncSignature) return;
        spotlightAuctionSyncSignatureRef.current = spotlightAuctionSyncSignature;
        let cancelled = false;
        const syncAuctionState = async () => {
            await syncSelfServeAuctionState({ roomCode });
        };
        void syncAuctionState().catch((error) => {
            hostLogger.warn('Support Surge sync failed', error);
            if (!cancelled) spotlightAuctionSyncSignatureRef.current = '';
        });
        return () => {
            cancelled = true;
        };
    }, [
        roomCode,
        selfServeAuctionPriorityLive,
        selfServeMode?.enabled,
        selfServeSpotlightAuctionEnabled,
        spotlightAuctionSyncSignature,
    ]);
    const selfServeQueueFaceOffResolutionRef = useRef('');
    useEffect(() => {
        if (!selfServeOpenStageEnabled || !selfServeMode?.enabled) return;
        if (!current?.id) return;
        if (activeReleaseWindow?.active) return;
        if (queueFaceOffCandidates.length < 2) return;
        if (String(selfServeMode?.lastAutoFaceOffForCurrentId || '').trim() === String(current.id || '').trim()) return;
        let cancelled = false;
        const launchFaceOff = async () => {
            await openQueueFaceOffVote('crowd_vote', {
                origin: 'self_serve_open_stage_auto',
                selfServeFormat: SELF_SERVE_FORMATS.openStage,
                durationSec: 18,
            });
            if (cancelled) return;
            await updateRoom({
                selfServeMode: {
                    ...(room?.selfServeMode || {}),
                    phase: 'crowd_vote',
                    lastAutoFaceOffForCurrentId: current.id,
                }
            });
        };
        void launchFaceOff().catch((error) => {
            hostLogger.warn('Self-serve queue face-off failed to launch', error);
        });
        return () => {
            cancelled = true;
        };
    }, [
        activeReleaseWindow?.active,
        current?.id,
        openQueueFaceOffVote,
        queueFaceOffCandidates,
        room?.selfServeMode,
        selfServeMode?.enabled,
        selfServeMode?.lastAutoFaceOffForCurrentId,
        selfServeOpenStageEnabled,
        updateRoom
    ]);
    useEffect(() => {
        if (!selfServeSpotlightAuctionEnabled || !selfServeMode?.enabled || !selfServeAuctionPriorityLive) return;
        if (!current?.id) return;
        if (activeReleaseWindow?.active) return;
        if (String(selfServeMode?.lastAutoFaceOffForCurrentId || '').trim() === String(current.id || '').trim()) return;
        if (spotlightAuctionLeaderboard.length >= 2) {
            let cancelled = false;
            const launchAuctionFaceOff = async () => {
                await openQueueFaceOffVote('crowd_vote', {
                    origin: 'self_serve_spotlight_auction_auto',
                    selfServeFormat: SELF_SERVE_FORMATS.spotlightAuction,
                    itemTitle: 'BeauRocks Support Surge',
                    prompt: 'Top verified supporters choose the next showcase face-off.',
                    promptDetail: 'Phones vote between the top backed singers.',
                    durationSec: 18,
                    releasePolicy: 'auto_flight_winner',
                });
                if (cancelled) return;
                await updateRoom({
                    selfServeMode: {
                        ...(room?.selfServeMode || {}),
                        phase: 'auction_vote',
                        lastAutoFaceOffForCurrentId: current.id,
                    }
                });
            };
            void launchAuctionFaceOff().catch((error) => {
                hostLogger.warn('Support Surge face-off failed to launch', error);
            });
            return () => {
                cancelled = true;
            };
        }
        if (spotlightAuctionLeaderboard.length === 1) {
            const leaderSongId = String(spotlightAuctionLeaderboard[0]?.songId || '').trim();
            if (!leaderSongId) return undefined;
            if (String(selfServeMode?.lastAutoPriorityWinnerForCurrentId || '').trim() === String(current.id || '').trim()) return undefined;
            let cancelled = false;
            const autoLockPriorityWinner = async () => {
                const resolvedAtMs = nowMs();
                await moveSingerNext(leaderSongId, { forceWithinProtected: true });
                if (cancelled) return;
                const nextSelfServeMode = consumeSelfServeAuctionSlot(room?.selfServeMode || {}, {
                    songId: leaderSongId,
                    nowMs: resolvedAtMs,
                });
                await updateRoom({
                    selfServeMode: {
                        ...nextSelfServeMode,
                        lastAutoPriorityWinnerForCurrentId: current.id,
                        lastCrowdWinnerSongId: leaderSongId,
                        lastCrowdVoteResolvedAtMs: resolvedAtMs,
                    }
                });
            };
            void autoLockPriorityWinner().catch((error) => {
                hostLogger.warn('Support Surge priority lock failed', error);
            });
            return () => {
                cancelled = true;
            };
        }
        return undefined;
    }, [
        activeReleaseWindow?.active,
        current?.id,
        moveSingerNext,
        openQueueFaceOffVote,
        room?.selfServeMode,
        selfServeAuctionPriorityLive,
        selfServeMode?.enabled,
        selfServeMode?.lastAutoFaceOffForCurrentId,
        selfServeMode?.lastAutoPriorityWinnerForCurrentId,
        selfServeSpotlightAuctionEnabled,
        spotlightAuctionLeaderboard,
        updateRoom
    ]);
    useEffect(() => {
        if (!activeSelfServeQueueFaceOffWindow?.active) return;
        if (activeSelfServeQueueFaceOffRemainingMs > 0) return;
        if (selfServeQueueFaceOffResolutionRef.current === activeSelfServeQueueFaceOffWindow.itemId) return;
        selfServeQueueFaceOffResolutionRef.current = activeSelfServeQueueFaceOffWindow.itemId;
        const resolveFaceOff = async () => {
            if (queueFaceOffWinnerChoice && queueFaceOffWinnerSongId) {
                const resolvedAtMs = nowMs();
                await applyQueueFaceOffWinner();
                const nextSelfServeMode = selfServeSpotlightAuctionEnabled
                    ? consumeSelfServeAuctionSlot(room?.selfServeMode || {}, {
                        songId: queueFaceOffWinnerSongId,
                        nowMs: resolvedAtMs,
                    })
                    : (room?.selfServeMode || {});
                await updateRoom({
                    selfServeMode: {
                        ...nextSelfServeMode,
                        phase: selfServeSpotlightAuctionEnabled ? nextSelfServeMode.phase || 'auction_locked' : 'winner_locked',
                        lastCrowdWinnerSongId: queueFaceOffWinnerSongId,
                        lastCrowdVoteResolvedAtMs: resolvedAtMs,
                    }
                });
                return;
            }
            await closeQueueFaceOffVote();
            await updateRoom({
                selfServeMode: {
                    ...(room?.selfServeMode || {}),
                    phase: 'live',
                    lastCrowdWinnerSongId: '',
                    lastCrowdVoteResolvedAtMs: nowMs(),
                }
            });
        };
        void resolveFaceOff()
            .catch((error) => {
                hostLogger.warn('Self-serve queue face-off failed to resolve', error);
                selfServeQueueFaceOffResolutionRef.current = '';
            });
    }, [
        activeSelfServeQueueFaceOffRemainingMs,
        activeSelfServeQueueFaceOffWindow,
        applyQueueFaceOffWinner,
        closeQueueFaceOffVote,
        queueFaceOffWinnerChoice,
        queueFaceOffWinnerSongId,
        room?.selfServeMode,
        selfServeSpotlightAuctionEnabled,
        updateRoom
    ]);

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
    const clearAutoDjApplauseDeadline = useCallback(() => {
        if (!autoDjApplauseDeadlineTimerRef.current) return;
        clearTimeout(autoDjApplauseDeadlineTimerRef.current);
        autoDjApplauseDeadlineTimerRef.current = null;
    }, []);
    const getApplauseAutoFinalizeDelayMs = useCallback(() => {
        const warmupSec = Math.max(0, Math.min(8, Math.round(Number(room?.applauseWarmupSec ?? DEFAULT_APPLAUSE_WARMUP_SEC) || 0)));
        const countdownSec = Math.max(0, Math.min(8, Math.round(Number(room?.applauseCountdownSec ?? DEFAULT_APPLAUSE_COUNTDOWN_SEC) || 0)));
        const measureSec = Math.max(2, Math.min(10, Math.round(Number(room?.applauseMeasureSec ?? DEFAULT_APPLAUSE_MEASURE_SEC) || DEFAULT_APPLAUSE_MEASURE_SEC)));
        return ((warmupSec + countdownSec + measureSec + APPLAUSE_RESULT_DISPLAY_SEC) * 1000) + APPLAUSE_HOST_FALLBACK_GRACE_MS;
    }, [room?.applauseCountdownSec, room?.applauseMeasureSec, room?.applauseWarmupSec]);
    const clearPendingEarlyEndDecision = useCallback(() => {
        setPendingEarlyEndDecision(null);
        setPendingEarlyEndDecisionBusy(false);
    }, []);

    const clearStagePlaybackState = useCallback(async () => {
        await stopAppleMusic?.();
        await updateRoom({
            activeMode: 'karaoke',
            bonusDrop: null,
            selfieMoment: null,
            selfieMomentExpiresAt: null,
            selfieChallenge: null,
            photoOverlay: null,
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
        clearAutoDjApplauseDeadline();
        autoDjApplausePendingSongRef.current = '';
        await updateDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', targetSongId),
            { status: 'requested' }
        );
        await clearStagePlaybackState();
        pushAutoDjEvent(AUTO_DJ_EVENTS.RETRY, { songId: targetSongId, error: 'returned_to_queue' });
        toast(`${targetSong?.songTitle || 'Current song'} returned to queue.`);
    }, [clearAutoDjApplauseDeadline, clearAutoDjApplauseFallback, clearStagePlaybackState, pushAutoDjEvent, songs, toast]);

    const startApplauseSequence = useCallback(async ({ songId = '', autoFinalize = false } = {}) => {
        if (!songId) return;
        const targetSong = (songs || []).find((song) => song.id === songId) || null;
        const baseApplauseSubject = buildApplauseSubject(targetSong || null);
        const autoFinalizeDelayMs = autoFinalize ? getApplauseAutoFinalizeDelayMs() : 0;
        const autoFinalizeStartedAtMs = autoFinalize ? nowMs() : 0;
        const autoFinalizeDeadlineMs = autoFinalize ? autoFinalizeStartedAtMs + autoFinalizeDelayMs : 0;
        const applauseSubject = autoFinalize
            ? {
                ...baseApplauseSubject,
                autoFinalize: true,
                autoFinalizeSongId: songId,
                autoFinalizeStartedAtMs,
                autoFinalizeDeadlineMs
            }
            : baseApplauseSubject;
        pushAutoDjEvent(AUTO_DJ_EVENTS.APPLAUSE_STARTED, { songId });
        if (autoFinalize && targetSong) {
            showPostPerformanceBackingPrompt(targetSong);
        }
        if (autoFinalize) {
            autoDjApplausePendingSongRef.current = songId;
            autoDjApplauseFallbackKeyRef.current = '';
            clearAutoDjApplauseFallback();
            clearAutoDjApplauseDeadline();
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
            }, autoFinalizeDelayMs);
        }
        await updateRoom({
            activeMode: 'applause_countdown',
            activeScreen: 'stage',
            applausePeak: 0,
            currentApplauseLevel: 0,
            applauseSubject,
            announcement: null,
            tvPreviewOverlay: null,
            roundWinnersMoment: null,
            bonusDrop: null,
            selfieMoment: null,
            selfieMomentExpiresAt: null,
            selfieChallenge: null,
            photoOverlay: null,
            howToPlay: { active: false, id: nowMs() },
            'readyCheck.active': false
        });
        if (autoFinalize) toast('Measuring applause now. Auto-DJ will end this performance after results.');
        else toast('Applause countdown started.');
    }, [clearAutoDjApplauseDeadline, clearAutoDjApplauseFallback, getApplauseAutoFinalizeDelayMs, showPostPerformanceBackingPrompt, toast, updateRoom, pushAutoDjEvent, songs]);

    const getPerformanceElapsedSec = useCallback((songId = '') => {
        const targetSongId = String(songId || '').trim();
        if (!targetSongId) return 0;
        const targetSong = (songs || []).find((song) => String(song?.id || '').trim() === targetSongId) || null;
        const sessionSongId = String(room?.currentPerformanceSession?.songId || '').trim();
        const metaSongId = String(room?.currentPerformanceMeta?.songId || '').trim();
        const startedAtMs = Math.max(
            sessionSongId === targetSongId ? Number(room?.currentPerformanceSession?.startedAtMs || 0) || 0 : 0,
            metaSongId === targetSongId ? Number(room?.currentPerformanceMeta?.startedAtMs || 0) || 0 : 0,
            getTimestampMs(targetSong?.performingStartedAt),
            getTimestampMs(targetSong?.timestamp),
        );
        if (!startedAtMs) return 0;
        return Math.max(0, Math.round((nowMs() - startedAtMs) / 1000));
    }, [room?.currentPerformanceMeta?.songId, room?.currentPerformanceMeta?.startedAtMs, room?.currentPerformanceSession?.songId, room?.currentPerformanceSession?.startedAtMs, songs]);

    const handleFinishPerformance = useCallback(async (songId = '') => {
        const targetSongId = String(songId || '').trim();
        if (!targetSongId) return;
        clearPendingEarlyEndDecision();
        await startApplauseSequence({ songId: targetSongId, autoFinalize: true });
    }, [clearPendingEarlyEndDecision, startApplauseSequence]);
    useEffect(() => {
        const command = room?.audienceAutomationCommand && typeof room.audienceAutomationCommand === 'object'
            ? room.audienceAutomationCommand
            : null;
        if (!command) return undefined;
        if (String(command?.status || '').trim().toLowerCase() !== 'pending') return undefined;
        if (String(command?.action || '').trim().toLowerCase() !== 'finish_performance') return undefined;
        const targetSongId = String(command?.songId || '').trim();
        if (!targetSongId) return undefined;
        const activeSongId = String(room?.currentPerformanceSession?.songId || room?.currentPerformanceMeta?.songId || current?.id || '').trim();
        if (activeSongId !== targetSongId) return undefined;
        if (String(room?.activeMode || '').trim().toLowerCase() !== 'karaoke') return undefined;
        const commandKey = String(command?.id || `${command?.source || 'audience'}_${targetSongId}_${command?.createdAtMs || ''}`).trim();
        if (!commandKey || audienceAutomationCommandKeyRef.current === commandKey) return undefined;
        audienceAutomationCommandKeyRef.current = commandKey;
        handleFinishPerformance(targetSongId)
            .then(() => updateRoom({
                audienceAutomationCommand: {
                    ...command,
                    status: 'consumed',
                    consumedAtMs: nowMs(),
                    consumedBy: 'host_runtime',
                }
            }))
            .catch((error) => {
                audienceAutomationCommandKeyRef.current = '';
                hostLogger.warn('Audience automation command failed', error);
                updateRoom({
                    audienceAutomationCommand: {
                        ...command,
                        status: 'failed',
                        failedAtMs: nowMs(),
                        lastError: String(error?.message || 'Host runtime could not consume command.').slice(0, 240),
                    }
                }).catch(() => {});
            });
        return undefined;
    }, [current?.id, handleFinishPerformance, room?.activeMode, room?.audienceAutomationCommand, room?.currentPerformanceMeta?.songId, room?.currentPerformanceSession?.songId, updateRoom]);

    const handleChangeBackingForCurrentPerformance = useCallback(async (songId = '') => {
        const targetSongId = String(songId || '').trim();
        if (!targetSongId) return;
        const targetSong = (songs || []).find((song) => String(song?.id || '').trim() === targetSongId) || null;
        setPendingEarlyEndDecisionBusy(true);
        try {
            clearPendingEarlyEndDecision();
            if (targetSong) {
                const trackCheck = buildTrackCheckPromptFromPerformance(targetSong);
                if (trackCheck) dismissTrackCheck(trackCheck);
                startEdit(targetSong);
            }
            await returnCurrentPerformanceToQueue(targetSongId);
        } finally {
            setPendingEarlyEndDecisionBusy(false);
        }
    }, [clearPendingEarlyEndDecision, dismissTrackCheck, returnCurrentPerformanceToQueue, songs, startEdit]);

    useEffect(() => {
        if (!pendingEarlyEndDecision?.songId || pendingEarlyEndDecisionBusy) return () => {};
        const activeSongId = String(pendingEarlyEndDecision.songId || '').trim();
        if (!activeSongId) return () => {};
        const timer = globalThis.setTimeout(() => {
            if (String(pendingEarlyEndDecision?.songId || '').trim() !== activeSongId) return;
            handleFinishPerformance(activeSongId).catch((error) => {
                hostLogger.warn('Early-end decision auto-continue failed', error);
            });
        }, EARLY_END_DECISION_AUTO_CONTINUE_MS);
        return () => clearTimeout(timer);
    }, [handleFinishPerformance, pendingEarlyEndDecision, pendingEarlyEndDecisionBusy]);

    const oneMinuteMicEnabled = room?.oneMinuteMicEnabled === true
        || String(room?.performanceProgressionMode || '').trim().toLowerCase() === 'one_minute_mic';
    const oneMinuteMicOpeningWindowSec = Math.max(15, Math.min(180, Math.round(Number(room?.oneMinuteMicOpeningWindowSec || 60) || 60)));
    const oneMinuteMicVoteWindowSec = Math.max(5, Math.min(45, Math.round(Number(room?.oneMinuteMicVoteWindowSec || 12) || 12)));

    useEffect(() => {
        if (!oneMinuteMicEnabled) return undefined;
        const currentSongId = String(current?.id || '').trim();
        const activeMode = String(room?.activeMode || '').trim().toLowerCase();
        if (!currentSongId || activeMode !== 'karaoke') return undefined;
        const existingDecision = room?.audienceDecision && typeof room.audienceDecision === 'object' ? room.audienceDecision : null;
        const existingDecisionType = String(existingDecision?.type || '').trim().toLowerCase();
        const existingDecisionSongId = String(existingDecision?.subjectSongId || existingDecision?.songId || '').trim();
        if (existingDecisionType === AUDIENCE_DECISION_TYPES.continueOrRotate && existingDecisionSongId === currentSongId) return undefined;
        const sessionId = String(room?.currentPerformanceSession?.sessionId || '').trim();
        const sessionSongId = String(room?.currentPerformanceSession?.songId || '').trim();
        const metaSongId = String(room?.currentPerformanceMeta?.songId || '').trim();
        const startedAtMs = Math.max(
            sessionSongId === currentSongId ? Number(room?.currentPerformanceSession?.startedAtMs || 0) || 0 : 0,
            metaSongId === currentSongId ? Number(room?.currentPerformanceMeta?.startedAtMs || 0) || 0 : 0,
            getTimestampMs(current?.performingStartedAt),
            getTimestampMs(current?.timestamp)
        );
        if (!startedAtMs) return undefined;
        const openAtMs = startedAtMs + (oneMinuteMicOpeningWindowSec * 1000);
        const decisionKey = `${currentSongId}:${sessionId || startedAtMs}:${openAtMs}`;
        const openDecision = () => {
            if (oneMinuteMicDecisionOpenKeyRef.current === decisionKey) return;
            oneMinuteMicDecisionOpenKeyRef.current = decisionKey;
            updateRoom({
                audienceDecision: buildContinueOrRotateDecision({
                    songId: currentSongId,
                    songTitle: current?.songTitle || current?.title || 'Current song',
                    singerName: current?.singerName || current?.name || 'Singer',
                    artistName: current?.artist || current?.artistName || '',
                    performanceSessionId: sessionId,
                    openedAtMs: nowMs(),
                    voteWindowSec: oneMinuteMicVoteWindowSec,
                    openingWindowSec: oneMinuteMicOpeningWindowSec,
                })
            }).catch((error) => {
                oneMinuteMicDecisionOpenKeyRef.current = '';
                hostLogger.warn('One-Minute Mic decision failed to open', error);
            });
        };
        const delayMs = Math.max(0, openAtMs - nowMs());
        if (delayMs <= 0) {
            openDecision();
            return undefined;
        }
        const timer = setTimeout(openDecision, delayMs);
        return () => clearTimeout(timer);
    }, [
        current,
        current?.id,
        oneMinuteMicEnabled,
        oneMinuteMicOpeningWindowSec,
        oneMinuteMicVoteWindowSec,
        room?.activeMode,
        room?.audienceDecision,
        room?.currentPerformanceMeta?.songId,
        room?.currentPerformanceMeta?.startedAtMs,
        room?.currentPerformanceSession?.sessionId,
        room?.currentPerformanceSession?.songId,
        room?.currentPerformanceSession?.startedAtMs,
        updateRoom
    ]);
    const handleEndPerformance = useCallback(async (songId = '', options = {}) => {
        const targetSongId = String(songId || '').trim();
        if (!targetSongId) return;
        const source = String(options?.source || 'host').trim().toLowerCase() || 'host';
        const applauseMode = String(room?.activeMode || '');
        const applauseRunning = applauseMode === 'applause_countdown' || applauseMode === 'applause' || applauseMode === 'applause_result';
        if (applauseRunning && autoDjApplausePendingSongRef.current === targetSongId) {
            toast('Applause capture in progress. This performance will end after results.');
            return;
        }
        const performanceElapsedSec = getPerformanceElapsedSec(targetSongId);
        const targetSong = (songs || []).find((song) => String(song?.id || '').trim() === targetSongId) || null;
        if (
            source === 'host'
            && !applauseRunning
            && performanceElapsedSec > 0
            && performanceElapsedSec < EARLY_END_DECISION_THRESHOLD_SEC
            && targetSong
        ) {
            setPendingEarlyEndDecision({
                songId: targetSongId,
                songTitle: targetSong.songTitle || 'Current performance',
                artist: targetSong.artist || 'Backing track',
                performanceElapsedSec,
            });
            return;
        }
        await handleFinishPerformance(targetSongId);
    }, [getPerformanceElapsedSec, handleFinishPerformance, room?.activeMode, songs, toast]);

    useEffect(() => {
        const decision = room?.audienceDecision && typeof room.audienceDecision === 'object' ? room.audienceDecision : null;
        if (!decision || String(decision?.type || '').trim().toLowerCase() !== AUDIENCE_DECISION_TYPES.continueOrRotate) return undefined;
        if (String(decision?.status || '').trim().toLowerCase() !== 'open') return undefined;
        const subjectSongId = String(decision?.subjectSongId || decision?.songId || current?.id || '').trim();
        if (!subjectSongId) return undefined;
        const closesAtMs = Math.max(0, Number(decision?.closesAtMs || 0) || 0);
        if (!closesAtMs) return undefined;
        const resolveDecision = () => {
            const resolveKey = `${decision.id || subjectSongId}:${closesAtMs}`;
            if (oneMinuteMicDecisionResolveKeyRef.current === resolveKey) return;
            oneMinuteMicDecisionResolveKeyRef.current = resolveKey;
            callFunction('syncOneMinuteMicRoom', { roomCode })
                .then((result) => {
                    if (String(result?.command || '').trim().toLowerCase() === 'finish_performance') {
                        toast('Crowd picked the next singer. Wrapping with a quick fade.');
                    } else if (result?.resolved) {
                        toast('Crowd unlocked the rest of the song.');
                    }
                    return null;
                })
                .catch((error) => {
                    oneMinuteMicDecisionResolveKeyRef.current = '';
                    hostLogger.warn('One-Minute Mic decision resolution failed', error);
                });
        };
        const delayMs = Math.max(0, closesAtMs - nowMs());
        if (delayMs <= 0) {
            resolveDecision();
            return undefined;
        }
        const timer = setTimeout(resolveDecision, delayMs);
        return () => clearTimeout(timer);
    }, [current?.id, room?.audienceDecision, roomCode, toast]);
    useEffect(() => {
        const pendingSongId = autoDjApplausePendingSongRef.current;
        if (!pendingSongId) return;
        if (room?.activeMode !== 'applause_result') return;
        pushAutoDjEvent(AUTO_DJ_EVENTS.APPLAUSE_RESULT, { songId: pendingSongId });
        autoDjApplausePendingSongRef.current = '';
        clearAutoDjApplauseFallback();
        clearAutoDjApplauseDeadline();
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
    }, [clearAutoDjApplauseDeadline, clearAutoDjApplauseFallback, room?.activeMode, pushAutoDjEvent]);


    useEffect(() => {
        const activeMode = String(room?.activeMode || '').trim();
        const applauseActive = activeMode === 'applause_countdown' || activeMode === 'applause' || activeMode === 'applause_result';
        if (!applauseActive) {
            clearAutoDjApplauseDeadline();
            autoDjApplauseFallbackKeyRef.current = '';
            return undefined;
        }
        if (activeMode === 'applause_result') return undefined;
        const subject = room?.applauseSubject || {};
        if (subject?.autoFinalize !== true) return undefined;
        const pendingSongId = String(autoDjApplausePendingSongRef.current || subject?.autoFinalizeSongId || subject?.id || '').trim();
        const deadlineMs = Math.max(0, Number(subject?.autoFinalizeDeadlineMs || 0));
        if (!pendingSongId || !deadlineMs) return undefined;
        const deadlineKey = `${pendingSongId}:${deadlineMs}`;
        const finalizeFromDeadline = () => {
            if (autoDjApplauseFallbackKeyRef.current === deadlineKey) return;
            autoDjApplauseFallbackKeyRef.current = deadlineKey;
            autoDjApplausePendingSongRef.current = '';
            clearAutoDjApplauseFallback();
            clearAutoDjApplauseDeadline();
            pushAutoDjEvent(AUTO_DJ_EVENTS.RETRY, { songId: pendingSongId, error: 'applause_deadline_elapsed' });
            const runUpdateStatus = updateStatusRef.current;
            if (!runUpdateStatus) return;
            runUpdateStatus(pendingSongId, 'performed').catch((error) => {
                autoDjApplauseFallbackKeyRef.current = '';
                pushAutoDjEvent(AUTO_DJ_EVENTS.FAIL, { songId: pendingSongId, error: error?.message || 'deadline_finalize_failed' });
                hostLogger.warn('Auto-DJ applause deadline finalization failed', error);
            });
        };
        clearAutoDjApplauseDeadline();
        const delayMs = Math.max(0, deadlineMs - nowMs());
        autoDjApplauseDeadlineTimerRef.current = setTimeout(finalizeFromDeadline, delayMs);
        return () => {
            if (autoDjApplauseDeadlineTimerRef.current) {
                clearTimeout(autoDjApplauseDeadlineTimerRef.current);
                autoDjApplauseDeadlineTimerRef.current = null;
            }
        };
    }, [clearAutoDjApplauseDeadline, clearAutoDjApplauseFallback, pushAutoDjEvent, room?.activeMode, room?.applauseSubject]);
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
        handleEndPerformance(currentSongId, { source: 'session' }).catch((error) => {
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
            performanceSessionSongId: room?.currentPerformanceSession?.songId,
            performanceSessionState: room?.currentPerformanceSession?.playbackState,
            performanceSessionSourceType: room?.currentPerformanceSession?.sourceType,
            performanceSessionLastHeartbeatAtMs: room?.currentPerformanceSession?.lastHeartbeatAtMs,
            performanceSessionEndedAtMs: room?.currentPerformanceSession?.endedAtMs,
            performanceSessionPlayerReportedDurationSec: room?.currentPerformanceSession?.playerReportedDurationSec,
            performanceSessionPlayerPositionSec: room?.currentPerformanceSession?.playerPositionSec,
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
            handleEndPerformance(String(current?.id || ''), { source: 'auto' }).catch((error) => {
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
        room?.currentPerformanceSession?.songId,
        room?.currentPerformanceSession?.sourceType,
        room?.currentPerformanceSession?.lastHeartbeatAtMs,
        room?.currentPerformanceSession?.endedAtMs,
        room?.currentPerformanceSession?.playerReportedDurationSec,
        room?.currentPerformanceSession?.playerPositionSec,
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
        clearAutoDjApplauseDeadline();
    }, [clearAutoDjApplauseDeadline, clearAutoDjApplauseFallback, room?.activeMode, pushAutoDjEvent]);

    const getCurrentPlaybackPositionSec = useCallback(() => {
        const session = room?.currentPerformanceSession || {};
        const reportedPositionSec = Math.max(0, Number(session?.playerPositionSec || 0));
        const lastReportedAtMs = Math.max(0, Number(session?.lastReportedAtMs || 0));
        const playbackState = String(session?.playbackState || '').trim().toLowerCase();
        if (playbackState === 'paused' || playbackState === 'ended') return reportedPositionSec;
        if (reportedPositionSec > 0 && lastReportedAtMs > 0) {
            return reportedPositionSec + Math.max(0, (nowMs() - lastReportedAtMs) / 1000);
        }
        const startedAtMs = Math.max(0, Number(room?.currentPerformanceMeta?.startedAtMs || room?.videoStartTimestamp || 0));
        return startedAtMs > 0 ? Math.max(0, (nowMs() - startedAtMs) / 1000) : 0;
    }, [room?.currentPerformanceMeta?.startedAtMs, room?.currentPerformanceSession, room?.videoStartTimestamp]);

    const issuePlaybackControlCommand = useCallback(async (type, options = {}) => {
        if (!current) return null;
        const now = nowMs();
        const session = room?.currentPerformanceSession || null;
        const commandId = `playback_${type}_${now}_${Math.random().toString(36).slice(2, 8)}`;
        const rawSeekToSec = Number(options.seekToSec);
        const rawDeltaSec = Number(options.deltaSec);
        const currentPositionSec = getCurrentPlaybackPositionSec();
        const hasSeekTo = Number.isFinite(rawSeekToSec) && rawSeekToSec >= 0;
        const hasDelta = Number.isFinite(rawDeltaSec) && rawDeltaSec !== 0;
        const seekToSec = hasSeekTo ? rawSeekToSec : hasDelta ? Math.max(0, currentPositionSec + rawDeltaSec) : null;
        const command = {
            commandId,
            type,
            performanceSessionId: String(session?.sessionId || '').trim() || null,
            songId: String(current?.id || '').trim() || null,
            issuedAtMs: now,
            source: 'host_transport',
            ...(seekToSec !== null ? { seekToSec } : {}),
            ...(hasDelta ? { deltaSec: rawDeltaSec } : {})
        };
        const nextPlaybackState = type === 'pause' ? 'paused' : ['resume', 'restart', 'seek', 'jump'].includes(type) ? 'playing' : String(session?.playbackState || 'playing');
        const updates = { playbackControlCommand: command };
        if (session?.sessionId) {
            updates.currentPerformanceSession = {
                ...session,
                playbackState: nextPlaybackState,
                lastControlCommandId: commandId,
                lastControlCommandAtMs: now,
                ...(seekToSec !== null ? { playerPositionSec: seekToSec, lastReportedAtMs: now } : {}),
                ...(type === 'pause' ? { pausedAtMs: now, playerPositionSec: currentPositionSec, lastReportedAtMs: now } : {}),
                ...(type === 'resume' ? { pausedAtMs: null, lastHeartbeatAtMs: now } : {})
            };
        }
        if (type === 'pause') {
            updates.videoPlaying = true;
            updates.pausedAt = now;
        } else if (type === 'resume') {
            let newStart = room?.videoStartTimestamp || now;
            if (room?.pausedAt && room?.videoStartTimestamp) {
                const elapsedBeforePause = room.pausedAt - room.videoStartTimestamp;
                newStart = now - elapsedBeforePause;
            }
            updates.videoPlaying = true;
            updates.videoStartTimestamp = newStart;
            updates.pausedAt = null;
            updates.appleMusicPlayback = null;
        } else if (type === 'restart') {
            updates.videoPlaying = true;
            updates.videoStartTimestamp = now;
            updates.pausedAt = null;
            updates.appleMusicPlayback = null;
        } else if ((type === 'seek' || type === 'jump') && seekToSec !== null) {
            updates.videoPlaying = true;
            updates.videoStartTimestamp = now - (seekToSec * 1000);
            updates.pausedAt = null;
            updates.appleMusicPlayback = null;
        }
        await updateRoom(updates);
        return command;
    }, [current, getCurrentPlaybackPositionSec, room?.currentPerformanceMeta?.startedAtMs, room?.currentPerformanceSession, room?.pausedAt, room?.videoStartTimestamp, updateRoom]);
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
        await issuePlaybackControlCommand(currentSourcePlaying ? 'pause' : 'resume');
    }

    const nextQueueSong = queue[0];
    const nextQueueReason = useMemo(() => {
        if (selfServeSpotlightAuctionEnabled && selfServeAuctionPriorityLive) {
            const auctionLeader = spotlightAuctionLeaderboard.find((entry) => entry?.songId === nextQueueSong?.id) || null;
            if (auctionLeader) {
                return {
                    shortLabel: 'Verified support lead',
                    detail: spotlightAuctionState.summary || `${auctionLeader.singerName} is holding a verified $${(auctionLeader.amountCents / 100).toFixed(2)} priority bid inside Support Surge.`,
                };
            }
        }
        return buildSelfServeQueueExplanation({
            room,
            songs,
            queue,
            nextQueueSong,
        });
    }, [nextQueueSong, queue, room, selfServeAuctionPriorityLive, selfServeSpotlightAuctionEnabled, songs, spotlightAuctionLeaderboard, spotlightAuctionState.summary]);
    const experimentalRuntimeModel = useMemo(() => buildHostRuntimeShellModel({
        room,
        current,
        nextQueueSong,
        queue,
        reviewRequired,
        assigned,
        held,
        scenePresets,
        deferredTrackChecks,
        postPerformanceBackingPrompt,
        queueNeedsAttention: queueSurface.counts.needsAttention,
        inboxTotalCount,
        moderationPendingCount: Math.max(
            Array.isArray(moderationQueueItems) ? moderationQueueItems.length : 0,
            Number(moderationCounts?.totalPending || 0),
        ),
        runOfShowEnabled,
        runOfShowStagedItem,
        runOfShowNextItem,
        runOfShowNeedsAttentionCount: Math.max(
            0,
            Number(runOfShowPreflightReport?.criticalCount || 0) + Number(runOfShowPreflightReport?.riskyCount || 0),
        ),
        currentSourceLabel,
        currentSourcePlaying,
        activeReleaseWindow,
        autoDj,
        nowMs: Date.now(),
    }), [
        activeReleaseWindow,
        assigned,
        autoDj,
        current,
        currentSourceLabel,
        currentSourcePlaying,
        deferredTrackChecks,
        held,
        inboxTotalCount,
        moderationCounts?.totalPending,
        moderationQueueItems,
        nextQueueSong,
        postPerformanceBackingPrompt,
        queue,
        queueSurface.counts.needsAttention,
        reviewRequired,
        room,
        runOfShowEnabled,
        runOfShowNextItem,
        runOfShowPreflightReport?.criticalCount,
        runOfShowPreflightReport?.riskyCount,
        runOfShowStagedItem,
        scenePresets,
        room?.videoStartTimestamp,
        room?.pausedAt,
        room?.currentPerformanceMeta?.startedAtMs,
        room?.currentPerformanceMeta?.durationSec,
        room?.appleMusicPlayback?.startedAt,
        room?.appleMusicPlayback?.pausedAt,
        room?.appleMusicPlayback?.durationSec,
    ]);
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
    const restartCurrentPlayback = useCallback(async () => {
        if (!current) return;
        if (currentUsesAppleBacking) {
            await playAppleMusicTrack(current.appleMusicId, { title: current.songTitle, artist: current.artist });
            await updateRoom({ mediaUrl: '', videoPlaying: false, videoStartTimestamp: null, pausedAt: null });
            return;
        }
        await stopAppleMusic?.();
        await issuePlaybackControlCommand('restart', { seekToSec: 0 });
    }, [current, currentUsesAppleBacking, issuePlaybackControlCommand, playAppleMusicTrack, stopAppleMusic, updateRoom]);
    const jumpCurrentPlayback = useCallback(async (deltaSec = 0) => {
        if (!current || currentUsesAppleBacking) return;
        await stopAppleMusic?.();
        await issuePlaybackControlCommand('jump', { deltaSec });
    }, [current, currentUsesAppleBacking, issuePlaybackControlCommand, stopAppleMusic]);

    const seekCurrentPlayback = useCallback(async (seekToSec = 0) => {
        if (!current || currentUsesAppleBacking) return;
        await stopAppleMusic?.();
        await issuePlaybackControlCommand('seek', { seekToSec });
    }, [current, currentUsesAppleBacking, issuePlaybackControlCommand, stopAppleMusic]);
    const openCurrentBackingWindow = useCallback(() => {
        if (!currentMediaUrl) {
            toast('Backing link is unavailable right now.');
            return false;
        }
        if (typeof window === 'undefined') return false;
        const popup = window.open(currentMediaUrl, '_blank', 'noopener,noreferrer');
        if (!popup) {
            toast('Could not open backing window. Check pop-up blocking and retry.');
            return false;
        }
        return true;
    }, [currentMediaUrl, toast]);
    const toggleAudienceSync = useCallback(async () => {
        await updateRoom({ audienceVideoMode: room?.audienceVideoMode === 'force' ? 'off' : 'force' });
    }, [room?.audienceVideoMode, updateRoom]);
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
    const isDenseLayout = mediumViewport || isTightLayout;
    const catalogWorkspaceActive = queueSurface.isCompactQueueSurface
        ? queueSurface.activeCompactTab === 'catalog'
        : desktopQueueSurfaceTab === 'catalog';
    const allowHostPanelPageScroll = !catalogWorkspaceActive && (isMobileLayout || compactViewport || mediumViewport);
    const sectionPaddingClass = isDenseLayout ? 'px-3 py-3' : 'px-4 py-4';
    const activeEditingSong = editingSongId ? songs.find((song) => song.id === editingSongId) || null : null;
    const preparedMoments = useMemo(
        () => (Array.isArray(runOfShowDirector?.items) ? runOfShowDirector.items : [])
            .filter((item) => (
                item?.destination === 'planner'
                && item?.type !== 'performance'
                && !['complete', 'skipped'].includes(String(item?.status || '').trim().toLowerCase())
            ))
            .sort((a, b) => Number(a?.sequence || 0) - Number(b?.sequence || 0)),
        [runOfShowDirector?.items]
    );
    const preparedMomentCount = preparedMoments.length;
    const momentPrepTimelineItems = useMemo(
        () => (Array.isArray(runOfShowDirector?.items) ? runOfShowDirector.items : [])
            .filter((item) => (
                item?.destination !== 'planner'
                && String(item?.status || '').trim().toLowerCase() !== 'prepared'
                && !['complete', 'skipped'].includes(String(item?.status || '').trim().toLowerCase())
            ))
            .sort((a, b) => Number(a?.sequence || 0) - Number(b?.sequence || 0)),
        [runOfShowDirector?.items]
    );
    const hasRunOfShowQueueWork = runOfShowEnabled && (reviewQueueItems.length > 0 || pending.length > 0 || queue.length > 0 || assigned.length > 0);
    const runOfShowNeedsAttentionCount = Math.max(
        0,
        Number(runOfShowPreflightReport?.criticalCount || 0) + Number(runOfShowPreflightReport?.riskyCount || 0),
    );
    const openPlannerWorkspace = useCallback(() => {
        setDesktopQueueSurfaceTab('show');
        queueSurface.activateCompactTab('show');
        onOpenRunOfShow?.();
    }, [onOpenRunOfShow, queueSurface]);
    const autoCollapsedRunOfShowAddFormRef = useRef(false);
    const addToQueueWorkspaceActive = queueSurface.isCompactQueueSurface
        ? queueSurface.activeCompactTab === 'add'
        : desktopQueueSurfaceTab === 'add';
    const momentPrepWorkspaceActive = queueSurface.isCompactQueueSurface
        ? queueSurface.activeCompactTab === 'show'
        : desktopQueueSurfaceTab === 'show';
    const addToQueueSectionOpen = addToQueueWorkspaceActive || showAddForm;
    const [momentPrepDirectorOpen, setMomentPrepDirectorOpen] = useState(false);
    const openDetailedMomentPlanner = () => {
        setMomentPrepDirectorOpen(true);
        if (typeof window === 'undefined') return;
        window.requestAnimationFrame(() => {
            document.querySelector('[data-feature-id="moment-prep-full-director"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const focusQueueControls = () => {
            setDesktopQueueSurfaceTab('queue');
            queueSurface.activateCompactTab('queue');
        };
        const focusInbox = () => {
            focusInboxWorkspace();
        };
        const focusMomentPrep = () => {
            setDesktopQueueSurfaceTab('show');
            queueSurface.activateCompactTab('show');
        };
        const focusCurrentPerformance = () => {
            setDesktopQueueSurfaceTab('queue');
            queueSurface.activateCompactTab('queue');
            window.requestAnimationFrame(() => {
                const transport = document.querySelector('[data-feature-id="host-unified-stage-transport"]');
                transport?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const focusTarget = transport?.querySelector('button, [tabindex]:not([tabindex="-1"])');
                focusTarget?.focus?.({ preventScroll: true });
            });
        };
        window.addEventListener('beaurocks:focus-queue-live-controls', focusQueueControls);
        window.addEventListener('beaurocks:focus-host-inbox', focusInbox);
        window.addEventListener('beaurocks:focus-moment-prep', focusMomentPrep);
        window.addEventListener('beaurocks:focus-current-performance', focusCurrentPerformance);
        return () => {
            window.removeEventListener('beaurocks:focus-queue-live-controls', focusQueueControls);
            window.removeEventListener('beaurocks:focus-host-inbox', focusInbox);
            window.removeEventListener('beaurocks:focus-moment-prep', focusMomentPrep);
            window.removeEventListener('beaurocks:focus-current-performance', focusCurrentPerformance);
        };
    }, [focusInboxWorkspace, queueSurface]);
    const deferredTrackCheckInboxItems = useMemo(() => (
        (Array.isArray(deferredTrackChecks) ? deferredTrackChecks : []).map((trackCheck) => ({
            id: `track-check-${trackCheck.performanceKey}`,
            type: 'track_check',
            source: 'System',
            title: trackCheck.songTitle || 'Track check',
            body: 'Deferred from stage. Review when you have a beat and decide whether to use this backing again.',
            context: trackCheck.artist || 'YouTube backing',
            ageLabel: 'Later',
            trackCheck,
            busy: postPerformanceBackingPromptBusy,
            onApprove: () => void handlePostPerformanceBackingPromptAction(trackCheck, 'prefer'),
            onReject: () => void handlePostPerformanceBackingPromptAction(trackCheck, 'avoid'),
            onDismiss: () => void handlePostPerformanceBackingPromptAction(trackCheck, 'skip'),
        }))
    ), [deferredTrackChecks, handlePostPerformanceBackingPromptAction, postPerformanceBackingPromptBusy]);
    const visibleLastTrackCheck = useMemo(() => {
        if (postPerformanceBackingPrompt) {
            return {
                ...postPerformanceBackingPrompt,
                pendingNow: true,
            };
        }
        return Array.isArray(deferredTrackChecks) && deferredTrackChecks.length > 0
            ? deferredTrackChecks[0]
            : null;
    }, [deferredTrackChecks, postPerformanceBackingPrompt]);
    const queueCollaborationInboxItem = useMemo(() => {
        if (activeReleaseWindow?.active || queueFaceOffCandidates.length < 2) return null;
        const first = queueFaceOffCandidates[0];
        const second = queueFaceOffCandidates[1];
        return {
            id: `queue-collaboration-${first?.id || 'first'}-${second?.id || 'second'}`,
            type: 'queue_collaboration',
            source: 'Optional',
            title: 'Ask the room what should go next',
            body: 'Compare the next two ready performances with co-hosts or the audience. The host still confirms the result.',
            context: `${buildQueueFaceOffSongLabel(first)} or ${buildQueueFaceOffSongLabel(second)}`,
            ageLabel: 'When useful',
            onApprove: () => void openQueueFaceOffVote('cohost_vote'),
            onReject: () => void openQueueFaceOffVote('crowd_vote')
        };
    }, [activeReleaseWindow?.active, openQueueFaceOffVote, queueFaceOffCandidates]);
    const systemInboxItems = useMemo(
        () => [...deferredTrackCheckInboxItems, ...(queueCollaborationInboxItem ? [queueCollaborationInboxItem] : [])],
        [deferredTrackCheckInboxItems, queueCollaborationInboxItem]
    );
    const queueWorkspaceToneMap = {
        queue: {
            activeToneClass: 'border-cyan-300/30 bg-[linear-gradient(180deg,rgba(13,35,46,0.98),rgba(8,18,28,0.98))] text-cyan-100 shadow-[0_-10px_30px_rgba(6,182,212,0.14)]',
            shellClass: 'border-cyan-300/16 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(8,18,28,0.82),rgba(9,11,18,0.98))]',
            headerClass: 'border-cyan-300/14 bg-[linear-gradient(180deg,rgba(12,26,38,0.82),rgba(8,13,20,0.82))]',
            sectionToneClass: 'text-cyan-100',
        },
        add: {
            activeToneClass: 'border-fuchsia-300/30 bg-[linear-gradient(180deg,rgba(43,16,39,0.98),rgba(23,10,24,0.98))] text-fuchsia-100 shadow-[0_-10px_30px_rgba(217,70,239,0.14)]',
            shellClass: 'border-fuchsia-300/16 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.08),transparent_34%),linear-gradient(180deg,rgba(24,10,23,0.82),rgba(12,10,18,0.98))]',
            headerClass: 'border-fuchsia-300/14 bg-[linear-gradient(180deg,rgba(33,15,32,0.82),rgba(17,10,20,0.82))]',
            sectionToneClass: 'text-fuchsia-100',
        },
        catalog: {
            activeToneClass: 'border-violet-300/30 bg-[linear-gradient(180deg,rgba(37,22,61,0.98),rgba(20,13,33,0.98))] text-violet-100 shadow-[0_-10px_30px_rgba(139,92,246,0.14)]',
            shellClass: 'border-violet-300/16 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.08),transparent_34%),linear-gradient(180deg,rgba(24,18,38,0.82),rgba(12,10,20,0.98))]',
            headerClass: 'border-violet-300/14 bg-[linear-gradient(180deg,rgba(30,22,46,0.82),rgba(17,12,27,0.82))]',
            sectionToneClass: 'text-violet-100',
        },
        inbox: {
            activeToneClass: 'border-amber-300/30 bg-[linear-gradient(180deg,rgba(44,28,12,0.98),rgba(24,16,9,0.98))] text-amber-100 shadow-[0_-10px_30px_rgba(245,158,11,0.14)]',
            shellClass: 'border-amber-300/16 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.08),transparent_34%),linear-gradient(180deg,rgba(28,19,12,0.82),rgba(14,12,10,0.98))]',
            headerClass: 'border-amber-300/14 bg-[linear-gradient(180deg,rgba(37,24,13,0.82),rgba(19,13,9,0.82))]',
            sectionToneClass: 'text-amber-100',
        },
        show: {
            activeToneClass: 'border-emerald-300/30 bg-[linear-gradient(180deg,rgba(13,41,33,0.98),rgba(8,23,18,0.98))] text-emerald-100 shadow-[0_-10px_30px_rgba(16,185,129,0.14)]',
            shellClass: 'border-emerald-300/16 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_34%),linear-gradient(180deg,rgba(11,24,20,0.82),rgba(9,14,12,0.98))]',
            headerClass: 'border-emerald-300/14 bg-[linear-gradient(180deg,rgba(15,31,26,0.82),rgba(10,17,14,0.82))]',
            sectionToneClass: 'text-emerald-100',
        },
    };
    const activeQueueWorkspaceToneKey = queueSurface.isCompactQueueSurface
        ? (queueSurface.activeCompactTab === 'show' ? 'show' : queueSurface.activeCompactTab === 'catalog' ? 'catalog' : queueSurface.activeCompactTab === 'inbox' ? 'inbox' : queueSurface.activeCompactTab === 'add' ? 'add' : 'queue')
        : (desktopQueueSurfaceTab === 'show' ? 'show' : desktopQueueSurfaceTab === 'catalog' ? 'catalog' : desktopQueueSurfaceTab === 'inbox' ? 'inbox' : desktopQueueSurfaceTab === 'add' ? 'add' : 'queue');
    const activeQueueWorkspaceTone = queueWorkspaceToneMap[activeQueueWorkspaceToneKey] || queueWorkspaceToneMap.queue;
    const queueWorkspaceTabListClass = `host-brand-tabs host-brand-tabs--workspace ${isDenseLayout ? 'mx-3 mt-3' : 'mx-4 mt-4'}`;
    const getQueueWorkspaceTabButtonClass = (active = false) => (
        `host-brand-tab inline-flex min-h-[42px] items-center gap-2 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.16em] ${
            active ? 'is-active' : ''
        }`
    );
    const renderQueueWorkspaceTabButton = ({
        id = '',
        label = '',
        icon = '',
        badge = 0,
        active = false,
        onClick = null,
        featureId = '',
        badgeToneClass = 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100',
        activeToneClass = queueWorkspaceToneMap.queue.activeToneClass,
    } = {}) => (
        <button
            key={id}
            type="button"
            onClick={onClick}
            data-feature-id={featureId || undefined}
            aria-pressed={active}
            className={getQueueWorkspaceTabButtonClass(active, activeToneClass)}
        >
            {icon ? <i className={`fa-solid ${icon} text-[10px]`}></i> : null}
            <span>{label}</span>
            {badge > 0 ? (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${badgeToneClass}`}>
                    {badge}
                </span>
            ) : null}
        </button>
    );
    const inboxWorkspaceSection = (
        <div data-feature-id="panel-inbox" className={`flex-1 overflow-y-auto custom-scrollbar px-4 py-4 ${activeQueueWorkspaceToneKey === 'inbox' ? 'bg-amber-500/[0.03]' : ''}`}>
            <HostInboxPanel
                roomCode={roomCode}
                hostBase={hostBase}
                coHostSignals={coHostSignals}
                roomChatMessages={roomChatMessages}
                hostDmMessages={hostDmMessages}
                moderationQueueItems={moderationQueueItems}
                moderationCounts={moderationCounts}
                moderationActions={moderationActions}
                moderationBusyAction={moderationBusyAction}
                moderationNeedsAttention={moderationNeedsAttention}
                systemInboxItems={systemInboxItems}
                chatUnread={chatUnread}
                dmUnread={dmUnread}
                users={users}
                handleChatViewMode={handleChatViewMode}
                openChatSettings={openChatSettings}
                onOpenModerationInbox={onOpenModerationInbox}
                dmTargetUid={dmTargetUid}
                setDmTargetUid={setDmTargetUid}
                dmDraft={dmDraft}
                setDmDraft={setDmDraft}
                sendHostDmMessage={sendHostDmMessage}
                styles={STYLES}
                emoji={EMOJI}
            />
        </div>
    );
    const catalogWorkspaceSection = (
        <div data-feature-id="panel-catalog" className={`flex h-full flex-1 min-h-0 flex-col overflow-hidden p-2 sm:p-3 ${activeQueueWorkspaceToneKey === 'catalog' ? 'bg-violet-500/[0.03]' : ''}`}>
            {catalogPanel || (
                <div className="rounded-2xl border border-dashed border-violet-300/20 bg-black/20 px-4 py-5 text-sm text-zinc-400">
                    Catalog is not available in this host session yet.
                </div>
            )}
        </div>
    );
    useEffect(() => {
        if (queueSurface.isCompactQueueSurface) {
            autoCollapsedRunOfShowAddFormRef.current = false;
            return;
        }
        if (runOfShowEnabled && hasRunOfShowQueueWork && showAddForm && !addToQueueWorkspaceActive && !autoCollapsedRunOfShowAddFormRef.current) {
            setShowAddForm(false);
            autoCollapsedRunOfShowAddFormRef.current = true;
            return;
        }
        if (!runOfShowEnabled || !hasRunOfShowQueueWork) {
            autoCollapsedRunOfShowAddFormRef.current = false;
        }
    }, [addToQueueWorkspaceActive, hasRunOfShowQueueWork, queueSurface.isCompactQueueSurface, runOfShowEnabled, setShowAddForm, showAddForm]);

    const startNextPerformanceFromShell = useCallback(async () => {
        if (current?.id) {
            await handleEndPerformance(current.id);
            return;
        }
        if (!nextQueueSong?.id) return;
        await updateStatus(nextQueueSong.id, 'performing');
    }, [current?.id, handleEndPerformance, nextQueueSong, updateStatus]);

    const addToQueueSection = (
        <div className={`border-b border-white/10 relative ${addToQueueWorkspaceActive ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3' : 'p-3'} ${addToQueueWorkspaceActive ? 'bg-fuchsia-500/[0.04]' : 'bg-black/20'}`}>
            {!addToQueueWorkspaceActive ? (
                <SectionHeader
                    label="Prep a Performance or Moment"
                    open={addToQueueSectionOpen}
                    onToggle={() => {
                        if (addToQueueWorkspaceActive) {
                            setShowAddForm(true);
                            return;
                        }
                        setShowAddForm(v => !v);
                    }}
                    toneClass={`text-base font-black ${addToQueueWorkspaceActive ? activeQueueWorkspaceTone.sectionToneClass : 'text-[#00C4D9]'}`}
                    featureId="panel-add-to-queue"
                />
            ) : null}
            {addToQueueSectionOpen && (
                <AddToQueueFormBody
                    searchQ={searchQ}
                    setSearchQ={setSearchQ}
                    autocompleteProvider={autocompleteProvider}
                    setAutocompleteProvider={setAutocompleteProvider}
                    youtubeSearchMode={youtubeSearchMode}
                    setYoutubeSearchMode={setYoutubeSearchMode}
                    styles={STYLES}
                    results={groupUnifiedCatalogResults(results)}
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
                    openYtSearch={openYtSearch}
                    addSong={addSong}
                    appleMusicAuthorized={appleMusicAuthorized}
                    dockResults={addToQueueWorkspaceActive}
                    onOpenTvLibrary={() => setSceneLibraryOpen(true)}
                    scenePresets={scenePresets}
                    onQueueScenePreset={onQueueScenePreset}
                    onAddQuickRunOfShowMoment={onAddQuickRunOfShowMoment}
                    onManualQueueResult={handleQueuedSongNotice}
                    onQueuePerformanceResult={queuePerformanceResultWithPlacement}
                    youtubePlaylistUrl={youtubePlaylistUrl}
                    setYoutubePlaylistUrl={setYoutubePlaylistUrl}
                    youtubePlaylistLoading={youtubePlaylistLoading}
                    youtubePlaylistStatus={youtubePlaylistStatus}
                    onQueueYouTubePlaylist={onQueueYouTubePlaylist}
                />
            )}
        </div>
    );

    const momentPrepTemplates = [
        { id: 'host_update', label: 'Host Update', detail: 'A quick room announcement', duration: '30 sec', icon: 'fa-bullhorn', tone: 'cyan' },
        { id: 'how_to_join', label: 'How To Join', detail: 'Bring new guests into the app', duration: '30 sec', icon: 'fa-qrcode', tone: 'cyan' },
        { id: 'trivia_break', label: 'Trivia', detail: 'One full-screen question', duration: '55 sec', icon: 'fa-circle-question', tone: 'violet' },
        { id: 'would_you_rather', label: 'Would You Rather', detail: 'A fast audience vote', duration: '65 sec', icon: 'fa-scale-balanced', tone: 'emerald' },
        { id: 'applause_meter', label: 'Applause Meter', detail: 'Measure the room together', duration: '35 sec', icon: 'fa-volume-high', tone: 'amber' },
        { id: 'selfie_cam', label: 'Selfie Cam', detail: 'Hand the screen to the crowd', duration: '45 sec', icon: 'fa-camera-retro', tone: 'rose' },
        { id: 'leaderboard_flash', label: 'Leaderboard', detail: 'Flash the room standings', duration: '30 sec', icon: 'fa-ranking-star', tone: 'cyan' },
        { id: 'support_the_show', label: 'Support The Show', detail: 'A sponsor or support beat', duration: '35 sec', icon: 'fa-heart', tone: 'pink' },
    ];
    const getPreparedMomentTypeLabel = (item = {}) => String(item?.type || 'moment')
        .trim()
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    const plannerWorkspaceSection = (
        <div data-feature-id="host-moment-prep-workbench" data-moment-prep-scroll-owner="true" className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3 custom-scrollbar sm:p-4">
            <div data-feature-id="host-moment-prep-header" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300/18 bg-emerald-500/8 px-4 py-3">
                <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">{HOST_LIVE_OPS_LANGUAGE.showPlan}</div>
                    <div className="mt-1 text-base font-black text-white">Build moments and arrange tonight&apos;s lineup</div>
                    <div className="mt-1 text-sm text-zinc-300">Save drafts, preview moments, and decide exactly when they join the lineup.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-violet-300/25 bg-violet-500/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-100">
                        {preparedMomentCount} draft{preparedMomentCount === 1 ? '' : 's'}
                    </span>

                </div>
            </div>

            <div data-feature-id="moment-prep-live-handoff" className="mb-3 grid gap-3 rounded-2xl border border-amber-300/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.11),rgba(9,9,11,0.78)_48%,rgba(16,185,129,0.08))] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/25 bg-amber-500/10 text-amber-100">
                        <i className="fa-solid fa-tv"></i>
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Lineup controls</div>
                        <div className="mt-1 text-sm font-black text-white">
                            {runOfShowLiveItem?.title || runOfShowLiveItem?.type
                                ? `Live now: ${runOfShowLiveItem?.title || getPreparedMomentTypeLabel(runOfShowLiveItem)}`
                                : runOfShowStagedItem?.title || runOfShowNextItem?.title
                                    ? `Next: ${runOfShowStagedItem?.title || runOfShowNextItem?.title}`
                                    : 'Nothing is waiting to go live'}
                        </div>
                        <div className="mt-1 max-w-3xl text-xs leading-5 text-zinc-300">
                            {runOfShowEnabled
                                ? `${HOST_LIVE_OPS_LANGUAGE.autoAdvance} runs the full lineup and sends each moment's scene or media to Public TV. ${runOfShowDirector?.automationPaused ? HOST_LIVE_OPS_LANGUAGE.autoAdvancePaused + '; use the controls here.' : HOST_LIVE_OPS_LANGUAGE.autoAdvanceOn + '.'}`
                                : autoDj
                                    ? `${HOST_LIVE_OPS_LANGUAGE.autoDj} runs performances only. Turn on ${HOST_LIVE_OPS_LANGUAGE.autoAdvance} to include moments, or use ${HOST_LIVE_OPS_LANGUAGE.startNext} manually.`
                                    : `The lineup is manual. Use ${HOST_LIVE_OPS_LANGUAGE.startNext}, or turn on ${HOST_LIVE_OPS_LANGUAGE.autoAdvance} for the full lineup.`}
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:max-w-[360px] sm:justify-end">
                    {runOfShowLiveItem?.id ? (
                        <button type="button" onClick={onAdvanceRunOfShow} disabled={typeof onAdvanceRunOfShow !== 'function'} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-2 text-[10px] disabled:opacity-50`}>
                            {HOST_LIVE_OPS_LANGUAGE.finishAndStartNext}
                        </button>
                    ) : (runOfShowStagedItem?.id || runOfShowNextItem?.id) ? (
                        <button type="button" data-moment-live-action="start-next" onClick={onAdvanceRunOfShow} disabled={typeof onAdvanceRunOfShow !== 'function'} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-2 text-[10px] disabled:opacity-50`}>
                            <i className="fa-solid fa-tower-broadcast mr-1.5"></i>{HOST_LIVE_OPS_LANGUAGE.startNext}
                        </button>
                    ) : momentPrepTimelineItems.length ? (
                        <button type="button" data-moment-live-action="start-next" onClick={onAdvanceRunOfShow} disabled={typeof onAdvanceRunOfShow !== 'function'} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-2 text-[10px] disabled:opacity-50`}>
                            <i className="fa-solid fa-tower-broadcast mr-1.5"></i>{HOST_LIVE_OPS_LANGUAGE.startNext}
                        </button>
                    ) : null}
                    {!runOfShowEnabled && momentPrepTimelineItems.length ? (
                        <button type="button" data-moment-live-action="enable-auto-advance" onClick={onStartRunOfShow} disabled={typeof onStartRunOfShow !== 'function'} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-2 text-[10px] disabled:opacity-50`}>
                            {HOST_LIVE_OPS_LANGUAGE.turnOnAutoAdvance}
                        </button>
                    ) : null}
                    {runOfShowEnabled ? (
                        <button type="button" onClick={() => onToggleRunOfShowPause?.(runOfShowDirector?.automationPaused !== true)} disabled={typeof onToggleRunOfShowPause !== 'function'} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-2 text-[10px] disabled:opacity-50`}>
                            {runOfShowDirector?.automationPaused ? HOST_LIVE_OPS_LANGUAGE.resumeAutoAdvance : HOST_LIVE_OPS_LANGUAGE.pauseAutoAdvance}
                        </button>
                    ) : null}
                </div>
            </div>

            <section
                data-feature-id="moment-prep-timeline"
                aria-label={HOST_LIVE_OPS_LANGUAGE.lineup}
                className="mb-3 overflow-hidden rounded-2xl border border-cyan-300/18 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_36%),linear-gradient(145deg,rgba(10,20,32,0.94),rgba(18,13,30,0.94))] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.22)] sm:p-4"
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Lineup overview</div>
                        <div className="mt-1 text-base font-black text-white">{HOST_LIVE_OPS_LANGUAGE.lineup}</div>
                        <div className="mt-1 max-w-2xl text-xs leading-5 text-zinc-400">Committed performances and moments appear here. Drafts stay in the editable tray below until you add them.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${runOfShowEnabled ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-black/25 text-zinc-400'}`}>
                            {runOfShowEnabled ? HOST_LIVE_OPS_LANGUAGE.autoAdvanceOn : 'Manual'}
                        </span>
                        <button type="button" onClick={openDetailedMomentPlanner} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1.5 text-[10px]`}>
                            {HOST_LIVE_OPS_LANGUAGE.advancedShowControls}
                        </button>
                    </div>
                </div>
                {momentPrepTimelineItems.length ? (
                    <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1 custom-scrollbar" data-feature-id="moment-prep-timeline-track">
                        {momentPrepTimelineItems.slice(0, 6).map((item, index) => {
                            const status = String(item?.status || 'planned').trim().toLowerCase();
                            const live = status === 'live' || item?.id === runOfShowLiveItem?.id;
                            const staged = status === 'staged' || item?.id === runOfShowStagedItem?.id;
                            const statusLabel = getHostLineupStateLabel({ status: live ? 'live' : staged ? 'staged' : status, isDraft: false });
                            const statusClass = live
                                ? 'border-rose-300/35 bg-rose-500/12 text-rose-100'
                                : staged
                                    ? 'border-amber-300/30 bg-amber-500/10 text-amber-100'
                                    : 'border-cyan-300/22 bg-cyan-500/[0.07] text-cyan-100';
                            const durationSec = Math.max(0, Math.round(Number(item?.plannedDurationSec || 0) || 0));
                            return (
                                <button
                                    key={item.id || `moment-prep-timeline-${index}`}
                                    type="button"
                                    onClick={() => onFocusRunOfShowItem?.(item.id)}
                                    disabled={!item?.id || typeof onFocusRunOfShowItem !== 'function'}
                                    className={`min-w-[210px] snap-start rounded-xl border p-3 text-left transition hover:border-cyan-200/40 disabled:cursor-default ${statusClass}`}
                                    aria-label={`Open ${item?.title || getPreparedMomentTypeLabel(item)} in Timeline Builder`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[9px] font-black uppercase tracking-[0.16em] opacity-75">{index + 1} · {getPreparedMomentTypeLabel(item)}</span>
                                        <span className="rounded-full border border-current/20 bg-black/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em]">{statusLabel}</span>
                                    </div>
                                    <div className="mt-2 truncate text-sm font-black text-white">{item?.title || getPreparedMomentTypeLabel(item)}</div>
                                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] opacity-65">{durationSec ? `${durationSec} sec` : 'Timing open'}</div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-cyan-300/18 bg-black/20 px-4 py-4 text-sm text-zinc-400">
                        Nothing is committed to {HOST_LIVE_OPS_LANGUAGE.lineup} yet. Create or edit a draft below, then choose {HOST_LIVE_OPS_LANGUAGE.addToLineup}.
                    </div>
                )}
                {momentPrepTimelineItems.length > 6 ? (
                    <button type="button" onClick={onOpenRunOfShow} className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200 hover:text-white">
                        View all {momentPrepTimelineItems.length} timeline items
                    </button>
                ) : null}
            </section>
            <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
                <section data-feature-id="moment-prep-builder" className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <div className="text-sm font-black text-white">Quick Moment Builder</div>
                            <div className="mt-1 text-xs text-zinc-400">Save a draft, or add a ready-made moment directly to {HOST_LIVE_OPS_LANGUAGE.lineup}.</div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">8 starting points</span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {momentPrepTemplates.map((template) => (
                            <div key={template.id} data-moment-prep-template={template.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-3 transition hover:border-emerald-300/25">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-500/10 text-emerald-100">
                                        <i className={`fa-solid ${template.icon}`}></i>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="font-black text-white">{template.label}</div>
                                            <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">{template.duration}</span>
                                        </div>
                                        <div className="mt-0.5 text-xs text-zinc-400">{template.detail}</div>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        data-moment-prep-action="save-draft"
                                        disabled={typeof onAddQuickRunOfShowMoment !== 'function'}
                                        onClick={() => onAddQuickRunOfShowMoment?.(template.id, { destination: 'planner' })}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2 py-1.5 text-[10px] disabled:opacity-50`}
                                    >
                                        {HOST_LIVE_OPS_LANGUAGE.saveDraft}
                                    </button>
                                    <button
                                        type="button"
                                        data-moment-prep-action="add-to-lineup"
                                        disabled={typeof onAddQuickRunOfShowMoment !== 'function'}
                                        onClick={() => onAddQuickRunOfShowMoment?.(template.id, { destination: 'queue' })}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-2 py-1.5 text-[10px] disabled:opacity-50`}
                                    >
                                        {HOST_LIVE_OPS_LANGUAGE.addToLineup}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section data-feature-id="moment-prep-prepared-hopper" className="rounded-2xl border border-violet-300/16 bg-violet-500/[0.05] p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <div className="text-sm font-black text-white">{HOST_LIVE_OPS_LANGUAGE.momentDrafts}</div>
                            <div className="mt-1 text-xs text-zinc-400">Edit drafts here. They stay off the live screen until you place them.</div>
                        </div>
                        <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-2 py-1 text-[10px] font-black text-violet-100">{preparedMomentCount}</span>
                    </div>
                    {preparedMoments.length ? (
                        <div className="mt-3 space-y-2">
                            {preparedMoments.slice(0, 8).map((item) => (
                                <div key={item.id} data-moment-draft-id={item.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-black text-white">{item?.title || getPreparedMomentTypeLabel(item)}</div>
                                            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200">
                                                {getPreparedMomentTypeLabel(item)} · {Math.max(0, Math.round(Number(item?.plannedDurationSec || 0) || 0)) || 'TBD'}{Number(item?.plannedDurationSec || 0) ? ' sec' : ''}
                                            </div>
                                        </div>
                                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">Draft</span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            data-moment-draft-action="add-to-lineup"
                                            disabled={typeof onPromotePreparedRunOfShowItems !== 'function'}
                                            onClick={() => onPromotePreparedRunOfShowItems?.([item.id])}
                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-2.5 py-1.5 text-[10px] disabled:opacity-50`}
                                        >
                                            {HOST_LIVE_OPS_LANGUAGE.addToLineup}
                                        </button>
                                        {typeof onPreviewRunOfShowItem === 'function' ? (
                                            <button type="button" onClick={() => onPreviewRunOfShowItem(item.id)} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2.5 py-1.5 text-[10px]`}>
                                                Preview
                                            </button>
                                        ) : null}
                                    </div>
                                    <InlineMomentDraftEditor
                                        item={item}
                                        onUpdateItem={onUpdateRunOfShowItem}
                                        onOpenAdvanced={onFocusRunOfShowItem}
                                    />
                                </div>
                            ))}
                            {preparedMoments.length > 8 ? (
                                <button type="button" onClick={onOpenRunOfShow} className="w-full py-2 text-[10px] font-black uppercase tracking-[0.14em] text-violet-200 hover:text-white">
                                    View all {preparedMoments.length} in {HOST_LIVE_OPS_LANGUAGE.showPlan}
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <div className="mt-3 rounded-xl border border-dashed border-violet-300/18 bg-black/20 px-4 py-5 text-center">
                            <i className="fa-solid fa-layer-group text-violet-200"></i>
                            <div className="mt-2 text-sm font-black text-white">No moment drafts yet</div>
                            <div className="mt-1 text-xs leading-5 text-zinc-400">Choose {HOST_LIVE_OPS_LANGUAGE.saveDraft} on a builder card. Drafts stay private until you choose {HOST_LIVE_OPS_LANGUAGE.addToLineup}.</div>
                        </div>
                    )}
                </section>
            </div>
            <details
                data-feature-id="moment-prep-full-director"
                open={momentPrepDirectorOpen}
                onToggle={(event) => setMomentPrepDirectorOpen(event.currentTarget.open)}
                className="mt-3 overflow-hidden rounded-2xl border border-cyan-300/18 bg-black/20"
            >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.04]">
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Detailed planning</div>
                        <div className="mt-1 text-sm font-black text-white">{HOST_LIVE_OPS_LANGUAGE.advancedShowControls}</div>
                        <div className="mt-1 text-xs text-zinc-400">Edit timing, approvals, media, co-host roles, policies, and lineup progression without leaving {HOST_LIVE_OPS_LANGUAGE.showPlan}.</div>
                    </div>
                    <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                        {momentPrepDirectorOpen ? 'Collapse' : 'Open builder'}
                    </span>
                </summary>
                <div className="border-t border-white/10 p-2 sm:p-3">
                    {runOfShowDirectorPanel || (
                        <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-400">
                            Create or reopen a room to use the full timeline builder.
                        </div>
                    )}
                </div>
            </details>
        </div>
    );    const activeMediaScene = room?.announcement?.active && String(room?.announcement?.type || '').trim().toLowerCase() === 'media_scene'
        ? room.announcement
        : null;
    const [backgroundAudioObservedAtMs, setBackgroundAudioObservedAtMs] = useState(() => Date.now());
    useEffect(() => {
        const playback = room?.appleMusicPlayback || {};
        const applePlaylistPlaying = ['playlist', 'station'].includes(String(playback?.type || '').trim().toLowerCase())
            && String(playback?.status || '').trim().toLowerCase() === 'playing';
        if (!applePlaylistPlaying) return undefined;
        setBackgroundAudioObservedAtMs(Date.now());
        const timer = window.setInterval(() => setBackgroundAudioObservedAtMs(Date.now()), 15000);
        return () => window.clearInterval(timer);
    }, [room?.appleMusicPlayback?.id, room?.appleMusicPlayback?.status, room?.appleMusicPlayback?.type]);
    const backgroundAudioState = deriveBackgroundAudioState({
        room,
        performanceActive: (Array.isArray(songs) ? songs : []).some((song) => song?.status === 'performing'),
        appleAuthorized: appleMusicAuthorized,
        applePendingId: appleMusicBgPendingId,
        applePlaylistId: appleMusicAutoPlaylistId,
        applePlaylistTitle: appleMusicAutoPlaylistTitle,
        localTrackId: currentBgTrackUploadId,
        localTrackTitle: (Array.isArray(audioLibraryItems) ? audioLibraryItems : []).find((item) => String(item?.id || '').trim() === String(currentBgTrackUploadId || '').trim())?.name || '',
        statusMessage: appleMusicStatus,
        nowMs: backgroundAudioObservedAtMs,
    });
    const backgroundAudioCapability = getBackgroundAudioCapability({
        sourceType: backgroundAudioState.sourceType,
        appleAuthorized: appleMusicAuthorized,
    });
    const backgroundAudioObservationRef = useRef('');
    useEffect(() => {
        const snapshot = buildBackgroundAudioQaSnapshot(backgroundAudioState);
        const fingerprint = JSON.stringify(snapshot);
        if (backgroundAudioObservationRef.current === fingerprint) return;
        backgroundAudioObservationRef.current = fingerprint;
        hostLogger.debug('Background audio state changed', snapshot);
        if (typeof window !== 'undefined') window.__qaBackgroundAudioState = snapshot;
    }, [backgroundAudioState.actionKey, backgroundAudioState.heartbeatAgeMs, backgroundAudioState.key, backgroundAudioState.label, backgroundAudioState.sourceLabel, backgroundAudioState.sourceType, backgroundAudioState.tone]);
    const selectedBackgroundUpload = (Array.isArray(audioLibraryItems) ? audioLibraryItems : []).find((item) => String(item?.id || '').trim() === String(currentBgTrackUploadId || '').trim()) || null;
    const recoverBackgroundAudio = async () => {
        if (backgroundAudioState.actionKey === 'connect_apple') {
            void connectAppleMusic?.();
            return;
        }
        if (backgroundAudioState.actionKey === 'resume_apple') {
            void resumeAppleMusic?.();
            return;
        }
        if (backgroundAudioState.actionKey === 'retry_apple' && appleMusicAutoPlaylistId) {
            void applyAppleMusicPlaylistForBg?.({ id: appleMusicAutoPlaylistId, title: appleMusicAutoPlaylistTitle });
            return;
        }
        if (backgroundAudioState.actionKey === 'pause_apple' || backgroundAudioState.actionKey === 'pause_local') {
            if (autoBgMusic) {
                setAutoBgMusic?.(false);
                await updateRoom?.({ autoBgMusic: false });
            }
            if (backgroundAudioState.actionKey === 'pause_apple') {
                await pauseAppleMusic?.();
            } else {
                await setBgMusicState?.(false);
            }
            return;
        }
        if (backgroundAudioState.actionKey === 'start_local' && selectedBackgroundUpload) {
            void onStartBgTrack?.(selectedBackgroundUpload, { shouldPlay: true, syncRoom: true });
        }
    };
    const backgroundAudioStatusCard = (
        <div data-feature-id="background-audio-truth-state" className={`rounded-2xl border px-4 py-3 ${backgroundAudioState.tone === 'ready' ? 'border-emerald-300/25 bg-emerald-500/10' : backgroundAudioState.tone === 'error' ? 'border-rose-300/25 bg-rose-500/10' : backgroundAudioState.tone === 'working' || backgroundAudioState.tone === 'deferred' ? 'border-amber-300/25 bg-amber-500/10' : 'border-white/10 bg-black/25'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">Background Audio</div>
                    <div className="mt-1 font-black text-white">{backgroundAudioState.label}</div>
                </div>
                {backgroundAudioState.sourceLabel ? <div className="max-w-xs truncate rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-zinc-200">{backgroundAudioState.sourceLabel}</div> : null}
            </div>
            <div className="mt-1 text-xs leading-5 text-zinc-300">{backgroundAudioState.detail}</div>
            <div data-feature-id="background-audio-source-capability" className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">{backgroundAudioCapability.label}</div>
                <div className="mt-1 text-[11px] leading-4 text-zinc-400">{backgroundAudioCapability.detail}</div>
            </div>
            {backgroundAudioState.actionKey && backgroundAudioState.actionLabel ? <button type="button" onClick={recoverBackgroundAudio} className={`${STYLES.btnStd} ${backgroundAudioState.tone === 'error' ? STYLES.btnHighlight : STYLES.btnSecondary} mt-3 px-3 py-2 text-[10px]`}>
                {backgroundAudioState.actionLabel}
            </button> : null}
        </div>
    );
    const bgLoopExcludedTrackIdSet = new Set(
        (Array.isArray(room?.bgLoopExcludedTrackIds) ? room.bgLoopExcludedTrackIds : [])
            .map((trackId) => String(trackId || '').trim().toLowerCase())
            .filter(Boolean)
    );
    const toggleBuiltInBgLoopTrack = async (trackId = '') => {
        const safeTrackId = String(trackId || '').trim().toLowerCase();
        if (!safeTrackId) return;
        const nextExcludedIds = new Set(bgLoopExcludedTrackIdSet);
        if (nextExcludedIds.has(safeTrackId)) nextExcludedIds.delete(safeTrackId);
        else nextExcludedIds.add(safeTrackId);
        await updateRoom?.({ bgLoopExcludedTrackIds: Array.from(nextExcludedIds) });
    };
    const backgroundLoopManagerCard = (
        <section data-feature-id="host-background-loop-manager" className="rounded-[24px] border border-cyan-300/18 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_34%),linear-gradient(145deg,rgba(17,29,48,0.96),rgba(34,25,51,0.94))] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">Background Loop</div>
                    <div className="mt-1 text-lg font-black text-white">Choose what can play between performances</div>
                    <div className="mt-1 max-w-2xl text-xs leading-5 text-zinc-300">Checked sources stay available to Auto BG. Turning a track off removes it from rotation without deleting it.</div>
                </div>
                <button
                    type="button"
                    aria-pressed={autoBgMusic}
                    onClick={async () => {
                        const previous = !!autoBgMusic;
                        const next = !autoBgMusic;
                        setAutoBgMusic?.(next);
                        try {
                            await updateRoom?.({ autoBgMusic: next });
                            await setBgMusicState?.(next);
                        } catch (error) {
                            setAutoBgMusic?.(previous);
                            await updateRoom?.({ autoBgMusic: previous }).catch(() => {});
                            hostLogger.warn('Background loop toggle failed', error);
                        }
                    }}
                    className={`${STYLES.btnStd} ${autoBgMusic ? STYLES.btnHighlight : STYLES.btnNeutral} px-3 py-2 text-[10px]`}
                >
                    <i className={`fa-solid ${autoBgMusic ? 'fa-rotate' : 'fa-pause'}`}></i>
                    Auto BG {autoBgMusic ? 'On' : 'Off'}
                </button>
            </div>
            <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/80">Included with BeauRocks</div>
                    <div className="text-[10px] text-zinc-400">{BG_TRACK_OPTIONS.length - bgLoopExcludedTrackIdSet.size} of {BG_TRACK_OPTIONS.length} in rotation</div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {BG_TRACK_OPTIONS.map((track) => {
                        const included = !bgLoopExcludedTrackIdSet.has(track.id);
                        return (
                            <button
                                key={`bg-loop-${track.id}`}
                                type="button"
                                aria-pressed={included}
                                onClick={() => void toggleBuiltInBgLoopTrack(track.id)}
                                className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${included ? 'border-emerald-300/28 bg-emerald-500/10 text-white' : 'border-white/10 bg-black/20 text-zinc-400'}`}
                            >
                                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${included ? 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100' : 'border-white/10 bg-black/25 text-zinc-500'}`}><i className={`fa-solid ${included ? 'fa-check' : 'fa-plus'} text-[10px]`}></i></span>
                                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{track.name}</span><span className="block text-[10px] uppercase tracking-[0.14em] opacity-65">{included ? 'In loop' : 'Not in loop'}</span></span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-fuchsia-300/18 bg-fuchsia-500/8 px-3 py-3"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-100">Your uploads</div><div className="mt-1 text-sm font-black text-white">{(Array.isArray(audioLibraryItems) ? audioLibraryItems : []).filter((item) => normalizeHostAudioLibraryCategory(item?.audioLibraryCategory) === 'bg' && item?.bgAutoEligible !== false).length} checked</div><div className="mt-1 text-[11px] text-zinc-400">Use each track&apos;s checkbox below.</div></div>
                <button type="button" onClick={() => setMediaLibraryTab('apple')} className="rounded-xl border border-rose-300/18 bg-rose-500/8 px-3 py-3 text-left"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-100">Apple Music</div><div className="mt-1 truncate text-sm font-black text-white">{appleMusicAutoPlaylistTitle || (appleMusicAuthorized ? 'Choose a soundtrack' : 'Connect account')}</div><div className="mt-1 text-[11px] text-zinc-400">Use one playlist or recent station between performances.</div></button>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">Spotify</div><div className="mt-1 text-sm font-black text-zinc-300">Provider not connected</div><div className="mt-1 text-[11px] text-zinc-500">Playlist controls appear here when integration is available.</div></div>
            </div>
        </section>
    );
    const appleMusicMediaLibrarySection = (
        <div data-feature-id="host-media-library-apple-music" className="grid gap-4">
            {backgroundAudioStatusCard}
            <div className="rounded-[24px] border border-cyan-300/16 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_30%),linear-gradient(180deg,rgba(10,16,26,0.92),rgba(12,12,20,0.82))] px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
                            <i className="fa-brands fa-apple text-lg"></i>
                        </div>
                        <div className="mt-4 text-xl font-black text-white">Apple Music room soundtrack</div>
                        <div className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                            Pick a playlist or recent station here and it becomes the room background source immediately. It pauses for performances and returns afterward while Auto BG is on.
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${appleMusicAuthorized ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-black/25 text-zinc-300'}`}>
                            {appleMusicAuthorized ? 'Connected' : 'Not Connected'}
                        </span>
                        {appleMusicAuthorized ? (
                            <button type="button" onClick={() => { void disconnectAppleMusic?.(); }} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-2 text-[10px]`}>
                                Disconnect
                            </button>
                        ) : (
                            <button type="button" onClick={() => { void connectAppleMusic?.(); }} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-2 text-[10px]`}>
                                Connect Apple Music
                            </button>
                        )}
                    </div>
                </div>
                {appleMusicStatus ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300">{appleMusicStatus}</div>
                ) : null}
                {appleMusicAutoPlaylistId ? (
                    <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">Current Room Soundtrack</div>
                        <div className="mt-1 truncate text-base font-black text-white">{appleMusicAutoPlaylistTitle || appleMusicAutoPlaylistId}</div>
                    </div>
                ) : null}
            </div>
            {appleMusicAuthorized ? (
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                            {(Array.isArray(appleMusicPickerModes) ? appleMusicPickerModes : []).map((option) => (
                                <button
                                    key={`media_apple_${option.id}`}
                                    type="button"
                                    onClick={() => {
                                        setAppleMusicPickerMode?.(option.id);
                                        if (option.id !== 'search') void loadAppleMusicPicker?.(option.id);
                                    }}
                                    className={`${STYLES.btnStd} ${appleMusicPickerMode === option.id ? STYLES.btnInfo : STYLES.btnNeutral} px-3 py-2 text-[10px]`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        {appleMusicPickerMode !== 'search' ? (
                            <button type="button" disabled={appleMusicPickerLoading} onClick={() => { void loadAppleMusicPicker?.(appleMusicPickerMode); }} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-2 text-[10px] ${appleMusicPickerLoading ? 'cursor-not-allowed opacity-60' : ''}`}>
                                {appleMusicPickerLoading ? 'Loading...' : 'Refresh'}
                            </button>
                        ) : null}
                    </div>
                    {appleMusicPickerMode === 'search' ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <input
                                value={appleMusicPickerQuery}
                                onChange={(event) => setAppleMusicPickerQuery?.(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') void loadAppleMusicPicker?.('search');
                                }}
                                className={`${STYLES.input} h-11 px-3 text-base`}
                                placeholder="Search Apple Music playlists"
                            />
                            <button type="button" disabled={appleMusicPickerLoading} onClick={() => { void loadAppleMusicPicker?.('search'); }} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-4 py-2 text-[10px] ${appleMusicPickerLoading ? 'cursor-not-allowed opacity-60' : ''}`}>
                                {appleMusicPickerLoading ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                    ) : null}
                    {appleMusicPickerError ? (
                        <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">{appleMusicPickerError}</div>
                    ) : null}
                    {appleMusicPickerItems.length ? (
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            {appleMusicPickerItems.map((choice) => {
                                const choicePlaylistId = String(choice.id || '').trim();
                                const choiceIsPending = !!choicePlaylistId && appleMusicBgPendingId === choicePlaylistId;
                                const choiceIsActive = !!choicePlaylistId && !choiceIsPending && choicePlaylistId === String(appleMusicAutoPlaylistId || room?.appleMusicAutoPlaylistId || '').trim();
                                return (
                                <div key={`media_apple_choice_${choice.sourceType}_${choice.id}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/55 p-3">
                                    {choice.artworkUrl ? (
                                        <img src={choice.artworkUrl} alt="" className="h-14 w-14 flex-none rounded-xl border border-white/10 object-cover" />
                                    ) : (
                                        <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
                                            <i className="fa-solid fa-music"></i>
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-base font-black text-white">{choice.title}</div>
                                        <div className="truncate text-sm text-zinc-400">{choice.subtitle}</div>
                                    </div>
                                    <button type="button" onClick={() => { void applyAppleMusicPlaylistForBg?.(choice); }} disabled={choiceIsPending || choiceIsActive} className={`${STYLES.btnStd} ${choiceIsActive ? STYLES.btnSecondary : STYLES.btnHighlight} flex-none px-3 py-2 text-[10px] ${choiceIsPending || choiceIsActive ? 'cursor-not-allowed opacity-75' : ''}`}>
                                        {choiceIsPending ? 'Starting...' : (choiceIsActive ? 'Active' : 'Use Soundtrack')}
                                    </button>
                                </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-950/35 px-4 py-5 text-sm text-zinc-500">
                            Browse playlists, use For You, open Recent Stations, or search Apple Music playlists.
                        </div>
                    )}
                </div>
            ) : (
                <div className="rounded-[24px] border border-dashed border-cyan-300/16 bg-zinc-950/35 px-5 py-8">
                    <div className="max-w-2xl">
                        <div className="text-xl font-black text-white">Connect Apple Music to choose the room soundtrack</div>
                        <div className="mt-2 text-sm leading-6 text-zinc-400">After connecting, choose a saved playlist, recommendation, recent station, or playlist search result as the room background source.</div>
                    </div>
                </div>
            )}
        </div>
    );
    const mediaLibraryCategoryMeta = ({
        scenes: {
            label: 'Scenes',
            icon: 'fa-images',
            detail: `Visual moments for Public TV and ${HOST_LIVE_OPS_LANGUAGE.showPlan}.`,
            accepts: 'Images + video',
            route: `Scene library - ${mediaLibraryUploadDestinationLabel}`,
            playback: `Public TV + ${HOST_LIVE_OPS_LANGUAGE.showPlan}`,
            status: `${visibleScenePresets.length} visible`,
        },
        sfx: {
            label: 'Sound Effects',
            icon: 'fa-drum',
            detail: 'Short audio drops for live pads and automatic moment cues.',
            accepts: 'Audio files',
            route: `Sound Effects - ${mediaLibraryUploadDestinationLabel}`,
            playback: 'Host soundboard + cues',
            status: `${activeAudioLaneItems.length} ready`,
        },
        bg: {
            label: 'Background',
            icon: 'fa-wave-square',
            detail: 'Music beds that can play between performances.',
            accepts: 'Audio files',
            route: `Background - ${mediaLibraryUploadDestinationLabel}`,
            playback: 'Background player + Auto BG',
            status: `${activeAudioLaneItems.length} tracks`,
        },
        apple: {
            label: 'Apple Music',
            icon: 'fa-music',
            detail: 'A connected playlist source for room background music.',
            accepts: 'Connected playlists',
            route: appleMusicAuthorized ? 'Selected Apple Music playlist' : 'Connect Apple Music',
            playback: 'Background player + Auto BG',
            status: appleMusicAuthorized ? 'Connected' : 'Not connected',
        },
    })[mediaLibraryTab] || {};
    const mediaLibraryCategoryWorkbench = (
        <section
            data-feature-id="host-media-library-category-workbench"
            className="mb-4 rounded-[24px] border border-cyan-300/16 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.09),transparent_32%),linear-gradient(145deg,rgba(17,29,48,0.96),rgba(28,20,43,0.94))] p-4"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/22 bg-cyan-500/12 text-cyan-100">
                        <i className={`fa-solid ${mediaLibraryCategoryMeta.icon}`}></i>
                    </span>
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">Library category</div>
                        <div className="mt-1 text-xl font-black text-white">{mediaLibraryCategoryMeta.label}</div>
                        <div className="mt-1 max-w-2xl text-sm text-zinc-300">{mediaLibraryCategoryMeta.detail}</div>
                    </div>
                </div>
                <span className="rounded-full border border-white/12 bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                    {mediaLibraryCategoryMeta.status}
                </span>
            </div>

            <div data-feature-id="host-media-library-playback-map" className="mt-4 grid gap-2 md:grid-cols-3">
                {[
                    { step: '1 - Add from', value: mediaLibraryCategoryMeta.accepts, icon: 'fa-file-arrow-up' },
                    { step: '2 - Saved to', value: mediaLibraryCategoryMeta.route, icon: 'fa-folder-tree' },
                    { step: '3 - Plays through', value: mediaLibraryCategoryMeta.playback, icon: 'fa-circle-play' },
                ].map((step) => (
                    <div key={`${mediaLibraryTab}_${step.step}`} className="rounded-2xl border border-white/10 bg-black/22 px-3 py-3">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                            <i className={`fa-solid ${step.icon} text-cyan-200`}></i>
                            {step.step}
                        </div>
                        <div className="mt-1 text-sm font-black text-white">{step.value}</div>
                    </div>
                ))}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/45 p-3">
                {mediaLibraryTab === 'scenes' ? (
                    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                            value={scenePresetTitle}
                            onChange={(event) => setScenePresetTitle(event.target.value)}
                            className={`${STYLES.input} h-11 px-3 text-sm`}
                            placeholder="Optional title for a single scene"
                        />
                        <label className={`${STYLES.btnStd} ${STYLES.btnSecondary} min-h-11 cursor-pointer justify-center px-4 py-2 text-[10px] ${scenePresetUploading ? 'pointer-events-none opacity-60' : ''}`}>
                            <input
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                className="hidden"
                                disabled={scenePresetUploading}
                                onChange={async (event) => {
                                    await handleScenePresetFileSelection(event.target.files);
                                    event.target.value = '';
                                }}
                            />
                            <i className="fa-solid fa-upload mr-2"></i>
                            {scenePresetUploading ? `Uploading ${Math.round(scenePresetUploadProgress || 0)}%` : 'Upload Scenes'}
                        </label>
                    </div>
                ) : mediaLibraryTab === 'sfx' || mediaLibraryTab === 'bg' ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 text-sm text-zinc-300">
                            New files are mapped directly to <span className="font-black text-white">{mediaLibraryTab === 'sfx' ? 'Sound Effects' : 'Background'}</span>. You can change their destination later.
                        </div>
                        <label className={`${STYLES.btnStd} ${STYLES.btnSecondary} min-h-11 cursor-pointer justify-center px-4 py-2 text-[10px]`}>
                            <input
                                type="file"
                                accept="audio/*"
                                multiple
                                className="hidden"
                                onChange={async (event) => {
                                    await handleAudioLibraryFileSelection(event.target.files, activeAudioLane);
                                    event.target.value = '';
                                }}
                            />
                            <i className="fa-solid fa-upload mr-2"></i>
                            {mediaLibraryTab === 'sfx' ? 'Upload to Sound Effects' : 'Upload to Background'}
                        </label>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-zinc-300">
                            {appleMusicAuthorized
                                ? 'Choose a playlist below. It becomes the room background source - no file upload required.'
                                : 'Connect the host browser to browse playlists and map one to Background.'}
                        </div>
                        <button
                            type="button"
                            disabled={appleMusicPickerLoading}
                            onClick={() => {
                                if (appleMusicAuthorized) void loadAppleMusicPicker?.(appleMusicPickerMode);
                                else void connectAppleMusic?.();
                            }}
                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} min-h-11 px-4 py-2 text-[10px] ${appleMusicPickerLoading ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                            {appleMusicAuthorized ? (appleMusicPickerLoading ? 'Loading...' : 'Browse Playlists') : 'Connect Apple Music'}
                        </button>
                    </div>
                )}
            </div>

            {mediaLibraryTab === 'scenes' ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
                            Default
                            <input type="number" min="5" max="600" value={scenePresetDurationSec} onChange={(event) => setScenePresetDurationSec(event.target.value)} className={`${STYLES.input} h-9 w-24 px-2 text-sm font-black`} />
                            seconds
                        </label>
                        {hasSceneLibrarySeedPack ? (
                            <button type="button" disabled={scenePresetSeedPending} onClick={() => onSeedScenePresetLibrary?.({ silent: false })} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-2 text-[10px] ${scenePresetSeedPending ? 'cursor-not-allowed opacity-60' : ''}`}>
                                {scenePresetSeedPending ? 'Syncing Pack...' : `Sync ${sceneLibrarySeedPack.label}`}
                            </button>
                        ) : null}
                    </div>
                    <div className="inline-flex rounded-full border border-white/10 bg-black/25 p-1 text-[10px] font-black uppercase tracking-[0.14em]">
                        <button type="button" onClick={() => setSceneLibraryView('grid')} className={`rounded-full px-3 py-1.5 transition ${sceneLibraryView === 'grid' ? 'bg-cyan-500/18 text-cyan-100' : 'text-zinc-400'}`}>Pads</button>
                        <button type="button" onClick={() => setSceneLibraryView('list')} className={`rounded-full px-3 py-1.5 transition ${sceneLibraryView === 'list' ? 'bg-cyan-500/18 text-cyan-100' : 'text-zinc-400'}`}>List</button>
                    </div>
                </div>
            ) : null}
        </section>
    );
    const scenePresetLibrarySection = (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(145deg,rgba(9,16,28,0.98),rgba(18,12,27,0.96))]">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(145deg,rgba(9,16,28,0.985),rgba(18,12,27,0.985))] px-4 py-3 backdrop-blur sm:px-5 sm:py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                        <button
                            type="button"
                            onClick={closeSceneLibrary}
                            className={`${STYLES.btnStd} ${STYLES.btnPrimary} min-h-[42px] flex-none px-3 py-2 text-[10px] sm:text-xs`}
                            data-feature-id="host-media-library-back-to-host"
                        >
                            <i className="fa-solid fa-arrow-left mr-2"></i>
                            Back to Host
                        </button>
                        <div className="min-w-0">
                            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100">Account Media Library</div>
                            <div className="mt-1 max-w-2xl text-xs text-zinc-300 sm:text-sm">Reusable host media for every night: Public TV scenes, soundboard drops, and background beds.</div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
                        <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-cyan-100">{scenePresetCount} saved</span>
                        <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-zinc-200">{Math.max(5, Math.min(600, Number(scenePresetDurationSec || 20) || 20))}s default</span>
                        {activeMediaScene ? (
                            <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">Live on TV</span>
                        ) : null}
                        {hasSceneLibrarySeedPack ? (
                            <span className="rounded-full border border-fuchsia-300/25 bg-fuchsia-500/10 px-2.5 py-1 text-fuchsia-100">{sceneLibrarySeedPack.assetCount} in {sceneLibrarySeedPack.label}</span>
                        ) : null}
                        <button
                            type="button"
                            onClick={closeSceneLibrary}
                            className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-2 text-[10px]`}
                        >
                            Close Media Library
                        </button>
                    </div>
                </div>
                <div
                    role="tablist"
                    aria-label="Account media library sections"
                    className="host-brand-tabs host-brand-tabs--workspace mt-3 min-h-[46px] custom-scrollbar"
                    data-feature-id="host-media-library-tabs"
                >
                    {mediaLibraryTabs.map((tabItem) => {
                        const active = mediaLibraryTab === tabItem.id;
                        return (
                            <button
                                key={tabItem.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setMediaLibraryTab(tabItem.id)}
                                className={`host-brand-tab inline-flex min-h-[38px] min-w-max items-center gap-2 px-3 py-2 text-sm font-black ${active ? 'is-active' : ''}`}
                            >
                                <i className={`fa-solid ${tabItem.icon}`}></i>
                                <span>{tabItem.label}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${active ? 'bg-zinc-950/12 text-zinc-900' : 'bg-white/8 text-zinc-400'}`}>{tabItem.helper}</span>
                            </button>
                        );
                    })}
                </div>
                {mediaLibraryTab !== 'apple' ? (
                <div data-feature-id="host-media-library-folder-bar" className="mt-3 rounded-2xl border border-white/10 bg-black/18 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setMediaLibraryFolderFilter('all')}
                                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${mediaLibraryFolderFilter === 'all' ? 'border-cyan-300/35 bg-cyan-500/14 text-cyan-100' : 'border-white/10 bg-black/20 text-zinc-300 hover:border-cyan-300/20'}`}
                            >
                                All Account Media
                            </button>
                            <button
                                type="button"
                                onClick={() => setMediaLibraryFolderFilter('unfiled')}
                                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${mediaLibraryFolderFilter === 'unfiled' ? 'border-cyan-300/35 bg-cyan-500/14 text-cyan-100' : 'border-white/10 bg-black/20 text-zinc-300 hover:border-cyan-300/20'}`}
                            >
                                Unfiled
                            </button>
                            {mediaLibraryFolderOptions.map((folder) => (
                                <button
                                    key={folder.key}
                                    type="button"
                                    onClick={() => setMediaLibraryFolderFilter(folder.key)}
                                    className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${mediaLibraryFolderFilter === folder.key ? 'border-cyan-300/35 bg-cyan-500/14 text-cyan-100' : 'border-white/10 bg-black/20 text-zinc-300 hover:border-cyan-300/20'}`}
                                >
                                    {folder.folderName} <span className="text-zinc-500">{folder.count}</span>
                                </button>
                            ))}
                        </div>
                        <div className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-white/10 bg-zinc-950/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                            <i className="fa-solid fa-upload text-cyan-200"></i>
                            New uploads: <span className="text-white">{mediaLibraryUploadDestinationLabel}</span>
                        </div>
                    </div>
                </div>
                ) : (
                <div data-feature-id="host-media-library-provider-bar" className="mt-3 flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-rose-300/16 bg-rose-500/7 px-3 py-2.5">
                    <span className="text-xs font-bold text-zinc-300">Provider library - playlists stay in Apple Music and map into the room background player.</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${appleMusicAuthorized ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-black/25 text-zinc-300'}`}>
                        {appleMusicAuthorized ? 'Connected' : 'Not connected'}
                    </span>
                </div>
                )}
                {activeMediaScene ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                        <span>Live on TV: {activeMediaScene.title || activeMediaScene.headline || 'Media scene'}</span>
                        <button type="button" onClick={onClearScenePreset} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1 text-[10px]`}>
                            End Scene
                        </button>
                    </div>
                ) : null}
            </div>
            <div ref={sceneLibraryScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-4 custom-scrollbar scroll-pt-20 sm:px-5">
                {mediaLibraryCategoryWorkbench}
                {mediaLibraryTab === 'scenes' ? (
                <>
                    <div data-feature-id="host-scene-template-quick-pads" className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">Template Scenes</div>
                                <div className="mt-1 text-xs text-zinc-500">Common announcement, audience, support, and interactive beats live next to saved media scenes.</div>
                            </div>
                            <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                                {SCENE_LIBRARY_TEMPLATE_QUICK_PADS.length} templates
                            </div>
                        </div>
                        <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(136px,1fr))]">
                            {SCENE_LIBRARY_TEMPLATE_QUICK_PADS.map((template) => (
                                <button
                                    key={template.id}
                                    type="button"
                                    disabled={typeof onAddQuickRunOfShowMoment !== 'function'}
                                    onClick={() => onAddQuickRunOfShowMoment?.(template.id)}
                                    className={`min-h-[104px] rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-500/10 ${typeof onAddQuickRunOfShowMoment !== 'function' ? 'cursor-not-allowed opacity-55' : 'active:scale-[0.98]'}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
                                            <i className={`fa-solid ${template.icon}`}></i>
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">
                                            {template.group}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-sm font-black leading-tight text-white">{template.label}</div>
                                    <div className="mt-1 text-[11px] leading-snug text-zinc-500">{template.detail}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className={sceneLibraryGridClass}>
                    {(visibleScenePresets || []).map((preset) => {
                        const draft = scenePresetDrafts[preset.id] || {
                            title: String(preset?.title || '').trim(),
                            durationSec: Math.max(5, Math.min(600, Number(preset?.durationSec || 20) || 20)),
                            sceneAudienceReactionMode: normalizeMediaSceneAudienceReactionMode(
                                preset?.sceneAudienceReactionMode || preset?.audienceReactionMode
                            ),
                            soundtrackSourceType: String(preset?.soundtrackSourceType || '').trim().toLowerCase(),
                            soundtrackInputValue: getMediaSceneSoundtrackPrimaryValue(preset?.soundtrackSourceType || '', preset),
                            soundtrackLabel: String(preset?.soundtrackLabel || '').trim(),
                        };
                        const saveDisabled = scenePresetSavingId === preset.id;
                        const isGridPad = sceneLibraryView === 'grid';
                        const isVideoScene = String(preset?.mediaType || '').trim().toLowerCase() === 'video';
                        const isLiveScene = activeMediaScene && (
                            String(activeMediaScene?.id || '').trim() === String(preset?.id || '').trim()
                            || String(activeMediaScene?.mediaUrl || '').trim() === String(preset?.mediaUrl || '').trim()
                        );
                        const reactionMeta = getMediaSceneAudienceReactionMeta(draft.sceneAudienceReactionMode);
                        const allowedReactionTypes = getMediaSceneAllowedReactionTypes(draft.sceneAudienceReactionMode);
                        const soundtrackSourceType = String(draft.soundtrackSourceType || '').trim().toLowerCase();
                        const draftSoundtrackConfig = normalizeMediaSceneSoundtrackConfig({
                            soundtrackSourceType,
                            soundtrackInputValue: draft.soundtrackInputValue,
                            soundtrackLabel: draft.soundtrackLabel,
                            soundtrackMediaUrl: '',
                            soundtrackYoutubeId: '',
                            soundtrackAppleMusicId: '',
                            soundtrackBgTrackId: '',
                        });
                        const soundtrackConfigured = hasMediaSceneConfiguredSoundtrack(draftSoundtrackConfig);
                        const reactionChipLabel = draft.sceneAudienceReactionMode === 'off'
                            ? 'Audience Off'
                            : 'Free Clap';
                        return (
                            <div
                                key={preset.id || preset.mediaUrl}
                                className={`rounded-2xl border bg-zinc-950/55 p-3 shadow-[0_14px_32px_rgba(0,0,0,0.22)] ${isGridPad ? 'border-cyan-300/18 bg-[linear-gradient(180deg,rgba(14,20,31,0.96),rgba(8,8,14,0.98))]' : 'border-white/10'} ${sceneLibraryView === 'list' ? 'lg:flex lg:items-start lg:gap-4' : ''}`}
                            >
                                <div className={`${isGridPad ? '' : `flex gap-3 ${sceneLibraryView === 'list' ? 'lg:min-w-0 lg:flex-1' : ''}`}`}>
                                    <button
                                        type="button"
                                        data-feature-id="host-scene-thumbnail-launch"
                                        onClick={() => onLaunchScenePreset?.(preset)}
                                        className={`group relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/35 text-left transition hover:border-cyan-300/45 ${sceneLibraryView === 'list' ? 'h-24 w-36' : 'aspect-[4/3] w-full'}`}
                                        aria-label={`Run scene ${draft.title || preset?.title || 'Media scene'} live`}
                                    >
                                        {isVideoScene
                                            ? <video src={preset.mediaUrl} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]" muted playsInline />
                                            : <img src={preset.mediaUrl} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]" />}
                                        <span className="absolute inset-x-2 bottom-2 rounded-full border border-cyan-200/35 bg-black/70 px-2 py-1 text-center text-[10px] font-black uppercase tracking-[0.14em] text-cyan-50 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                                            Run Live
                                        </span>
                                    </button>
                                    <div className={`min-w-0 flex-1 ${isGridPad ? 'mt-3' : ''}`}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${isVideoScene ? 'border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100' : 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100'}`}>
                                                {isVideoScene ? 'Video scene' : 'Still scene'}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                                                {Math.max(5, Math.min(600, Number(draft.durationSec || 20) || 20))}s
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                                                {reactionChipLabel}
                                            </span>
                                            {soundtrackConfigured ? (
                                                <span className="rounded-full border border-fuchsia-300/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-100">
                                                    Audio Paired
                                                </span>
                                            ) : null}
                                            {isLiveScene ? (
                                                <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                                                    Live
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="mt-2 min-h-[42px]">
                                            <div className="line-clamp-2 text-sm font-black leading-tight text-white">{draft.title || (isVideoScene ? 'Video Scene' : 'Image Scene')}</div>
                                            <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Tap thumbnail to run live</div>
                                        </div>
                                        {!isGridPad ? (
                                            <>
                                                <input
                                            value={draft.title}
                                            onChange={(event) => setScenePresetDraftField(preset.id, 'title', event.target.value)}
                                            className={`${STYLES.input} mt-2 h-10 px-3 text-sm font-black`}
                                            placeholder="Scene title"
                                        />
                                        <div className={`mt-2 flex items-center gap-2 ${isGridPad ? 'justify-between' : ''}`}>
                                            <input
                                                type="number"
                                                min="5"
                                                max="600"
                                                value={draft.durationSec}
                                                onChange={(event) => setScenePresetDraftField(preset.id, 'durationSec', event.target.value)}
                                                className={`${STYLES.input} h-10 w-24 px-3 text-sm font-black`}
                                                title="Duration in seconds"
                                            />
                                            <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">seconds</span>
                                            <button type="button" disabled={saveDisabled} onClick={() => saveScenePresetDraft(preset)} className={`${STYLES.btnStd} ${STYLES.btnNeutral} ml-auto px-3 py-1 text-[10px] ${saveDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                                {saveDisabled ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                        <div className="mt-3 grid gap-3">
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <label className="min-w-0">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Audience Interaction</div>
                                                    <select
                                                        value={draft.sceneAudienceReactionMode}
                                                        onChange={(event) => setScenePresetDraftField(preset.id, 'sceneAudienceReactionMode', event.target.value)}
                                                        className={`${STYLES.input} mt-1 h-10 px-3 text-sm`}
                                                    >
                                                        {MEDIA_SCENE_AUDIENCE_REACTION_OPTIONS.map((option) => (
                                                            <option key={`${preset.id}_${option.value}`} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                    <div className="mt-1 text-[11px] text-zinc-500">{reactionMeta.detail}</div>
                                                </label>
                                                <label className="min-w-0">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Scene Soundtrack</div>
                                                    <select
                                                        value={soundtrackSourceType}
                                                        onChange={(event) => {
                                                            const nextValue = event.target.value;
                                                            setScenePresetDraftField(preset.id, 'soundtrackSourceType', nextValue);
                                                            setScenePresetDraftField(
                                                                preset.id,
                                                                'soundtrackInputValue',
                                                                nextValue === 'bg_track'
                                                                    ? ''
                                                                    : getMediaSceneSoundtrackPrimaryValue(nextValue, preset)
                                                            );
                                                        }}
                                                        className={`${STYLES.input} mt-1 h-10 px-3 text-sm`}
                                                    >
                                                        {MEDIA_SCENE_SOUNDTRACK_SOURCE_OPTIONS.map((option) => (
                                                            <option key={`${preset.id}_soundtrack_${option.value || 'none'}`} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                    <div className="mt-1 text-[11px] text-zinc-500">
                                                        {soundtrackSourceType === 'youtube'
                                                            ? 'Accepts a YouTube URL or video ID.'
                                                            : soundtrackSourceType === 'apple_music'
                                                                ? 'Accepts an Apple Music song URL or track ID.'
                                                                : soundtrackSourceType === 'bg_track'
                                                                    ? 'Use one of the built-in BeauRocks background beds.'
                                                                    : soundtrackSourceType === 'manual_external'
                                                                        ? 'Use a direct mp3, wav, mp4, or similar media URL.'
                                                                        : 'Optional. Pair a track when the scene needs underscoring.'}
                                                    </div>
                                                </label>
                                            </div>
                                            {soundtrackSourceType ? (
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <label className="min-w-0">
                                                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                                                            {soundtrackSourceType === 'bg_track' ? 'Built-In Track' : 'Source Value'}
                                                        </div>
                                                        {soundtrackSourceType === 'bg_track' ? (
                                                            <select
                                                                value={String(draft.soundtrackInputValue || '').trim()}
                                                                onChange={(event) => setScenePresetDraftField(preset.id, 'soundtrackInputValue', event.target.value)}
                                                                className={`${STYLES.input} mt-1 h-10 px-3 text-sm`}
                                                            >
                                                                <option value="">Choose a background track</option>
                                                                {BG_TRACK_OPTIONS.map((track) => (
                                                                    <option key={`${preset.id}_bg_${track.id}`} value={track.id}>{track.name}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                value={String(draft.soundtrackInputValue || '').trim()}
                                                                onChange={(event) => setScenePresetDraftField(preset.id, 'soundtrackInputValue', event.target.value)}
                                                                className={`${STYLES.input} mt-1 h-10 px-3 text-sm`}
                                                                placeholder={
                                                                    soundtrackSourceType === 'youtube'
                                                                        ? 'YouTube URL or video ID'
                                                                        : soundtrackSourceType === 'apple_music'
                                                                            ? 'Apple Music song URL or track ID'
                                                                            : 'Direct media URL'
                                                                }
                                                            />
                                                        )}
                                                    </label>
                                                    <label className="min-w-0">
                                                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Now Playing Label</div>
                                                        <input
                                                            value={String(draft.soundtrackLabel || '').trim()}
                                                            onChange={(event) => setScenePresetDraftField(preset.id, 'soundtrackLabel', event.target.value)}
                                                            className={`${STYLES.input} mt-1 h-10 px-3 text-sm`}
                                                            placeholder="Optional TV / host label"
                                                        />
                                                    </label>
                                                </div>
                                            ) : null}
                                            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-zinc-400">
                                                {allowedReactionTypes.length
                                                    ? 'Free clap voting wakes up on the audience app while this scene runs.'
                                                    : 'This scene stays visual-only on the audience app.'}
                                            </div>
                                        </div>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                                <div className={`mt-3 ${isGridPad ? 'grid grid-cols-2 gap-2' : `flex flex-wrap gap-2 ${sceneLibraryView === 'list' ? 'lg:mt-0 lg:w-[17rem] lg:shrink-0 lg:justify-end' : ''}`}`}>
                                    <button type="button" onClick={() => onLaunchScenePreset?.(preset)} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-2 text-[10px]`}>
                                        Run Live
                                    </button>
                                    <button type="button" onClick={() => onQueueScenePreset?.(preset)} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-3 py-2 text-[10px]`}>
                                        Queue Next In Show
                                    </button>
                                    <button type="button" onClick={() => setSceneLibraryView('list')} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-2 text-[10px]`}>
                                        Edit
                                    </button>
                                    <button type="button" onClick={() => onDeleteScenePreset?.(preset)} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-2 text-[10px]`}>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {!visibleScenePresets?.length ? (
                        <div className="rounded-[24px] border border-dashed border-cyan-300/16 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_30%),linear-gradient(180deg,rgba(10,16,26,0.92),rgba(12,12,20,0.82))] px-5 py-8">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                                <div className="max-w-xl">
                                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
                                        <i className="fa-solid fa-photo-film text-lg"></i>
                                    </div>
                                    <div className="mt-4 text-xl font-black text-white">Build the first scene bank</div>
                                    <div className="mt-2 text-sm leading-6 text-zinc-400">Upload or sync a batch once, set the timing, then reuse those scene pads all night instead of rebuilding flyers, donation prompts, and transition art on the fly.</div>
                                </div>
                                <div className="grid gap-2 text-sm text-zinc-300 lg:w-[22rem]">
                                    <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Sponsor + House Scenes</div>
                                        <div className="mt-1 text-xs text-zinc-500">Poster art, thank-you cards, branded interstitials, and room reset graphics.</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Donation + Support Beats</div>
                                        <div className="mt-1 text-xs text-zinc-500">Givebutter prompts, cause slides, and quick moments you can fire between performances.</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Next-Up Boards</div>
                                        <div className="mt-1 text-xs text-zinc-500">Static next-up or leaderboard cards that can slot into the conveyor when the room needs a beat.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    </div>
                </>
                ) : mediaLibraryTab === 'apple' ? (
                    appleMusicMediaLibrarySection
                ) : (
                    <div className="grid gap-4">
                        {mediaLibraryTab === 'bg' ? backgroundAudioStatusCard : null}
                        {mediaLibraryTab === 'bg' ? backgroundLoopManagerCard : null}
                        <div data-feature-id="host-media-library-routing-status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/22 px-4 py-3">
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Playback mapping</div>
                                <div className="mt-1 text-xs leading-5 text-zinc-400">
                                    {mediaLibraryTab === 'sfx'
                                        ? 'Sound Effects can appear on the live soundboard and optionally fire from a mapped moment cue.'
                                        : 'Background tracks use the room player; Auto BG only rotates tracks marked eligible.'}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                                <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-cyan-100">{activeAudioLaneItems.length} here</span>
                                <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-zinc-300">{inactiveAudioLaneItems.length} elsewhere</span>
                                {mediaLibraryTab === 'sfx' ? (
                                    <span className="rounded-full border border-fuchsia-300/25 bg-fuchsia-500/10 px-2.5 py-1 text-fuchsia-100">
                                        {(Array.isArray(customSoundboardSounds) ? customSoundboardSounds : []).length} on soundboard
                                    </span>
                                ) : (
                                    <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
                                        {(Array.isArray(audioLibraryItems) ? audioLibraryItems : []).filter((item) => normalizeHostAudioLibraryCategory(item?.audioLibraryCategory) === 'bg' && item?.bgAutoEligible !== false).length} auto-ready
                                    </span>
                                )}
                            </div>
                        </div>
                        {!visibleAudioLibraryItems.length ? (
                            <div className="rounded-[24px] border border-dashed border-cyan-300/16 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_30%),linear-gradient(180deg,rgba(10,16,26,0.92),rgba(12,12,20,0.82))] px-5 py-8">
                                <div className="max-w-2xl">
                                    <div className="text-xl font-black text-white">No account audio uploads in this view yet</div>
                                    <div className="mt-2 text-sm leading-6 text-zinc-400">
                                        Add audio here to build a reusable account SFX and background-music bank that can travel across nights and rooms.
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="rounded-[24px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(11,17,27,0.94),rgba(9,9,15,0.98))] p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">
                                                {mediaLibraryTab === 'sfx' ? 'Sound Effects' : 'Background Tracks'}
                                            </div>
                                            <div className="mt-1 text-xs text-zinc-500">
                                                {mediaLibraryTab === 'sfx'
                                                    ? 'Preview, label, and route sounds into the host soundboard.'
                                                    : 'Start tracks, mark Auto BG eligibility, and keep reusable room music organized.'}
                                            </div>
                                        </div>
                                    </div>
                                    {activeAudioLaneItems.length ? (
                                        <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                            {activeAudioLaneItems.map((item) => {
                                                const draft = audioLibraryDrafts[item.id] || buildAudioLibraryDraft(item);
                                                const lane = normalizeHostAudioLibraryCategory(draft.audioLibraryCategory);
                                                const isSaving = audioLibrarySavingId === item.id;
                                                const isCurrentBgTrack = mediaLibraryTab === 'bg' && String(currentBgTrackUploadId || '').trim() === String(item?.id || '').trim();
                                                const onSoundboard = customSoundboardSoundIdSet.has(String(item?.id || '').trim());
                                                return (
                                                    <div key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-3 shadow-[0_14px_32px_rgba(0,0,0,0.2)]">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                                                                {lane === 'bg' ? 'BG Music' : 'SFX'}
                                                            </span>
                                                            {mediaLibraryTab === 'sfx' && onSoundboard ? (
                                                                <span className="rounded-full border border-fuchsia-300/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-100">
                                                                    Live Pad
                                                                </span>
                                                            ) : null}
                                                            {isCurrentBgTrack ? (
                                                                <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                                                                    Current Bed
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <input
                                                            value={draft.title}
                                                            onChange={(event) => setAudioLibraryDraftField(item.id, 'title', event.target.value)}
                                                            className={`${STYLES.input} mt-3 h-10 px-3 text-sm font-black`}
                                                            placeholder="Audio title"
                                                        />
                                                        {item.url || item.mediaUrl ? (
                                                            <div data-feature-id="host-media-library-inline-audio-preview" className="mt-3 rounded-xl border border-white/10 bg-zinc-950/65 px-2 py-2">
                                                                <audio
                                                                    controls
                                                                    controlsList="nodownload"
                                                                    preload="none"
                                                                    src={item.url || item.mediaUrl}
                                                                    className="h-10 w-full accent-cyan-400"
                                                                    aria-label={`Preview ${draft.title || item.fileName || 'audio upload'}`}
                                                                />
                                                            </div>
                                                        ) : null}
                                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                            <label className="min-w-0">
                                                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Library Lane</div>
                                                                <select
                                                                    value={draft.audioLibraryCategory}
                                                                    onChange={(event) => setAudioLibraryDraftField(item.id, 'audioLibraryCategory', event.target.value)}
                                                                    className={`${STYLES.input} mt-1 h-10 px-3 text-sm`}
                                                                >
                                                                    {HOST_AUDIO_LIBRARY_CATEGORY_OPTIONS.map((option) => (
                                                                        <option key={`${item.id}_lane_${option.value || 'general'}`} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                            <label className="min-w-0">
                                                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">File</div>
                                                                <div className="mt-1 truncate rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-300">
                                                                    {item.fileName || item.title || 'Audio Upload'}
                                                                </div>
                                                            </label>
                                                        </div>
                                                        {lane === 'sfx' ? (
                                                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                                <label className="min-w-0">
                                                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Pad Label</div>
                                                                    <input
                                                                        value={draft.soundboardLabel}
                                                                        onChange={(event) => setAudioLibraryDraftField(item.id, 'soundboardLabel', event.target.value)}
                                                                        className={`${STYLES.input} mt-1 h-10 px-3 text-sm`}
                                                                        placeholder="Optional short pad label"
                                                                    />
                                                                </label>
                                                                <label className="min-w-0">
                                                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Auto Cue</div>
                                                                    <select
                                                                        value={draft.hostMomentCueId}
                                                                        onChange={(event) => setAudioLibraryDraftField(item.id, 'hostMomentCueId', event.target.value)}
                                                                        className={`${STYLES.input} mt-1 h-10 px-3 text-sm`}
                                                                    >
                                                                        {HOST_AUDIO_MOMENT_CUE_OPTIONS.map((option) => (
                                                                            <option key={`${item.id}_cue_${option.value || 'none'}`} value={option.value}>{option.label}</option>
                                                                        ))}
                                                                    </select>
                                                                </label>
                                                                <label className="md:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                                                                    <span>Show on host soundboard</span>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={draft.includeOnSoundboard !== false}
                                                                        onChange={(event) => setAudioLibraryDraftField(item.id, 'includeOnSoundboard', event.target.checked)}
                                                                        className="h-4 w-4 accent-cyan-400"
                                                                    />
                                                                </label>
                                                            </div>
                                                        ) : lane === 'bg' ? (
                                                            <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                                                                <span>Eligible for Auto BG rotation</span>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={draft.bgAutoEligible !== false}
                                                                    onChange={(event) => setAudioLibraryDraftField(item.id, 'bgAutoEligible', event.target.checked)}
                                                                    className="h-4 w-4 accent-cyan-400"
                                                                />
                                                            </label>
                                                        ) : (
                                                            <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/15 px-3 py-2 text-xs text-zinc-500">
                                                                Leave this as General Audio if you are not ready to route it into the soundboard or BG playlist yet.
                                                            </div>
                                                        )}
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {mediaLibraryTab === 'bg' ? (
                                                                <button type="button" onClick={() => onStartBgTrack?.(item)} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-2 text-[10px]`}>
                                                                    Start Now
                                                                </button>
                                                            ) : null}
                                                            <button type="button" disabled={isSaving} onClick={() => saveAudioLibraryDraft(item)} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-2 text-[10px] ${isSaving ? 'cursor-not-allowed opacity-60' : ''}`}>
                                                                {isSaving ? 'Saving...' : 'Save'}
                                                            </button>
                                                            <button type="button" onClick={() => onDeleteAudioLibraryItem?.(item)} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-2 text-[10px]`}>
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-950/35 px-4 py-5 text-sm text-zinc-500">
                                            {mediaLibraryTab === 'sfx'
                                                ? 'No sound effects in this view yet. Upload audio above or move an existing upload into Sound Effects below.'
                                                : 'No background tracks in this view yet. Upload audio above or move an existing upload into Background below.'}
                                        </div>
                                    )}
                                </div>
                                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Unassigned Audio</div>
                                    <div className="mt-1 text-xs text-zinc-500">Move general audio into Sound Effects or Background when you know where it belongs.</div>
                                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                        {inactiveAudioLaneItems.map((item) => {
                                            const draft = audioLibraryDrafts[item.id] || buildAudioLibraryDraft(item);
                                            const lane = normalizeHostAudioLibraryCategory(draft.audioLibraryCategory);
                                            const isSaving = audioLibrarySavingId === item.id;
                                            return (
                                                <div key={`other_${item.id}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                                                            {lane === 'bg' ? 'BG Music' : lane === 'sfx' ? 'SFX' : 'General Audio'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 text-sm font-black text-white">{item.title || item.fileName || 'Audio Upload'}</div>
                                                    <div className="mt-1 truncate text-xs text-zinc-500">{item.fileName || item.url}</div>
                                                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                                                        <select
                                                            value={draft.audioLibraryCategory}
                                                            onChange={(event) => setAudioLibraryDraftField(item.id, 'audioLibraryCategory', event.target.value)}
                                                            className={`${STYLES.input} h-10 px-3 text-sm`}
                                                        >
                                                            {HOST_AUDIO_LIBRARY_CATEGORY_OPTIONS.map((option) => (
                                                                <option key={`other_${item.id}_${option.value || 'general'}`} value={option.value}>{option.label}</option>
                                                            ))}
                                                        </select>
                                                        <button type="button" onClick={() => playSfxSafe(item.url || item.mediaUrl)} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-2 text-[10px]`}>
                                                            Preview
                                                        </button>
                                                        <button type="button" disabled={isSaving} onClick={() => saveAudioLibraryDraft(item)} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-2 text-[10px] ${isSaving ? 'cursor-not-allowed opacity-60' : ''}`}>
                                                            {isSaving ? 'Saving...' : 'Route'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {!inactiveAudioLaneItems.length ? (
                                        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-zinc-950/35 px-4 py-5 text-sm text-zinc-500">
                                            Everything in this view is already assigned.
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
    const queueListSection = (
        <div className={`flex-1 min-h-0 overflow-y-auto ${compactViewport ? 'p-2.5 space-y-2.5' : 'p-3 space-y-3'} custom-scrollbar`}>
            <SectionHeader
                label={HOST_LIVE_OPS_LANGUAGE.lineup}
                open={showQueueList}
                onToggle={() => setShowQueueList(v => !v)}
                toneClass={`text-base font-black ${activeQueueWorkspaceToneKey === 'queue' ? activeQueueWorkspaceTone.sectionToneClass : 'text-[#00C4D9]'} px-1 sticky top-0 z-20 ${activeQueueWorkspaceToneKey === 'queue' ? 'bg-cyan-950/80' : 'bg-zinc-950/95'} backdrop-blur ${compactViewport ? 'py-2 rounded-lg border border-white/10' : ''}`}
                featureId="panel-queue-list"
            />
            <QueueListPanel
                showQueueList={showQueueList}
                showQueueSummaryBar={showQueueSummaryBar}
                onToggleQueueSummaryBar={() => setShowQueueSummaryBar((value) => !value)}
                pending={pending}
                queue={queue}
                assigned={assigned}
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
                touchReorderEnabled={touchReorderEnabled}
                touchReorderMode={queueSurface.isCompactQueueSurface
                    ? queueSurface.touchReorderMode
                    : desktopQueueReorderMode}
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
                runOfShowOpenSlots={runOfShowOpenSlots}
                queueSurfaceCounts={queueSurface.counts}
                protectedReadyQueueCount={Math.max(0, Math.min(queue.length, current?.id ? 2 : 3))}
                protectedReadyQueueTarget={current?.id ? 2 : 3}
                lineupHasCurrentPerformer={!!current?.id}
                onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                onAssignQueueSongToNextOpenRunOfShowSlot={onAssignQueueSongToNextOpenRunOfShowSlot}
                onFillRunOfShowOpenSlotsFromQueue={onFillRunOfShowOpenSlotsFromQueue}
                onAddQuickRunOfShowMoment={onAddQuickRunOfShowMoment}
                renderSummaryBarInline={false}
                selfServeMode={selfServeMode}
                selfServeAuctionLeaderboard={spotlightAuctionLeaderboard}
                nextQueueReasonLabel={nextQueueReason.shortLabel}
                nextQueueReasonDetail={nextQueueReason.detail}
                performanceMode={room?.performanceMode || room?.missionControl?.setupDraft?.performanceMode || 'karaoke'}
                appleMusicEnabled={appleMusicAuthorized}
                autoDjEnabled={autoDj}
            />
            {showQueueList ? (
                activeQueueFaceOffWindow ? (
                    <div className={`rounded-2xl border p-3 shadow-[0_16px_36px_rgba(0,0,0,0.22)] ${queueFaceOffTone.panelClass}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className={`text-[10px] uppercase tracking-[0.24em] ${queueFaceOffTone.eyebrowClass}`}>
                                    {String(activeQueueFaceOffWindow.governanceMode || '').trim().toLowerCase() === 'cohost_vote'
                                        ? 'Co-Host Song Face-Off'
                                        : 'Audience Song Face-Off'}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                    {String(activeQueueFaceOffWindow.prompt || 'Which queued song should go next?').trim()}
                                </div>
                                <div className="mt-1 text-xs text-zinc-400">
                                    One vote per joined user. Host confirms the winning song before the queue changes.
                                </div>
                            </div>
                            <div className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${queueFaceOffTone.badgeClass}`}>
                                {buildVoteCountLabel(queueFaceOffTally.totalVotes || 0)}
                            </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {[
                                {
                                    key: 'slot_scene',
                                    label: String(activeQueueFaceOffWindow.choiceLabels?.slot_scene || 'Song A').trim() || 'Song A',
                                    detail: String(activeQueueFaceOffWindow.choiceDetails?.slot_scene || '').trim(),
                                    count: queueFaceOffTally.slotSceneCount,
                                    song: (songs || []).find((song) => song.id === String(activeQueueFaceOffWindow.choiceSongIds?.slot_scene || '').trim()) || null
                                },
                                {
                                    key: 'keep_queue_moving',
                                    label: String(activeQueueFaceOffWindow.choiceLabels?.keep_queue_moving || 'Song B').trim() || 'Song B',
                                    detail: String(activeQueueFaceOffWindow.choiceDetails?.keep_queue_moving || '').trim(),
                                    count: queueFaceOffTally.keepQueueMovingCount,
                                    song: (songs || []).find((song) => song.id === String(activeQueueFaceOffWindow.choiceSongIds?.keep_queue_moving || '').trim()) || null
                                }
                            ].map((choice) => (
                                <div key={choice.key} className={`rounded-2xl border px-3 py-3 ${queueFaceOffWinnerChoice === choice.key ? queueFaceOffTone.winnerClass : 'border-white/10 bg-black/25'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                            {buildQueueFaceOffSongArtwork(choice.song) ? (
                                                <img src={buildQueueFaceOffSongArtwork(choice.song)} alt={choice.label} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-lg text-zinc-500">
                                                    <i className="fa-solid fa-music"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className={`text-[10px] uppercase tracking-[0.18em] ${queueFaceOffTone.choiceLabelClass}`}>{choice.label}</div>
                                            {choice.detail ? (
                                                <div className="mt-1 truncate text-sm font-semibold text-white">{choice.detail}</div>
                                            ) : null}
                                            <div className="truncate text-xs text-zinc-400">
                                                {String(choice.song?.artist || choice.song?.artistName || '').trim() || 'Ready queue pick'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-lg font-black text-white">{choice.count}</div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs text-zinc-400">
                                {queueFaceOffTally.summary}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => void closeQueueFaceOffVote()}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1.5 text-[11px]`}
                                >
                                    Close Vote
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void applyQueueFaceOffWinner()}
                                    disabled={!queueFaceOffWinnerSong || !queueFaceOffWinnerChoice}
                                    className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1.5 text-[11px] ${(!queueFaceOffWinnerSong || !queueFaceOffWinnerChoice) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    {queueFaceOffWinnerSong
                                        ? `Make ${(queueFaceOffWinnerSong.singerName || 'Winner')} - ${buildQueueFaceOffSongLabel(queueFaceOffWinnerSong)} Next`
                                        : 'Apply Winner'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : activeSlotFillWindow ? (
                    <div className="rounded-2xl border border-amber-300/22 bg-[linear-gradient(145deg,rgba(35,20,10,0.98),rgba(24,16,12,0.92))] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200">
                                    {String(activeSlotFillWindow.governanceMode || '').trim().toLowerCase() === 'cohost_vote'
                                        ? 'Co-Host Slot Fill'
                                        : 'Audience Slot Fill'}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                    {String(activeSlotFillWindow.prompt || 'Who should fill the next open slot?').trim()}
                                </div>
                                <div className="mt-1 text-xs text-zinc-400">
                                    One vote per joined user. Host confirms the winning singer before assigning the slot.
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {slotFillTarget?.label ? (
                                    <div className="rounded-full border border-amber-300/22 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-50">
                                        {slotFillTarget.label}
                                    </div>
                                ) : null}
                                <div className="rounded-full border border-amber-300/20 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-50">
                                    {buildVoteCountLabel(slotFillTally.totalVotes || 0)}
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {[
                                {
                                    key: 'slot_scene',
                                    label: String(activeSlotFillWindow.choiceLabels?.slot_scene || 'Singer A').trim() || 'Singer A',
                                    detail: String(activeSlotFillWindow.choiceDetails?.slot_scene || '').trim(),
                                    count: slotFillTally.slotSceneCount,
                                    song: (songs || []).find((song) => song.id === String(activeSlotFillWindow.choiceSongIds?.slot_scene || '').trim()) || null
                                },
                                {
                                    key: 'keep_queue_moving',
                                    label: String(activeSlotFillWindow.choiceLabels?.keep_queue_moving || 'Singer B').trim() || 'Singer B',
                                    detail: String(activeSlotFillWindow.choiceDetails?.keep_queue_moving || '').trim(),
                                    count: slotFillTally.keepQueueMovingCount,
                                    song: (songs || []).find((song) => song.id === String(activeSlotFillWindow.choiceSongIds?.keep_queue_moving || '').trim()) || null
                                }
                            ].map((choice) => (
                                <div key={choice.key} className={`rounded-2xl border px-3 py-3 ${slotFillWinnerChoice === choice.key ? 'border-amber-300/40 bg-amber-500/10' : 'border-white/10 bg-black/25'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                            {buildQueueFaceOffSongArtwork(choice.song) ? (
                                                <img src={buildQueueFaceOffSongArtwork(choice.song)} alt={choice.label} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-lg text-zinc-500">
                                                    <i className="fa-solid fa-music"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-amber-100">{choice.label}</div>
                                            {choice.detail ? (
                                                <div className="mt-1 truncate text-sm font-semibold text-white">{choice.detail}</div>
                                            ) : null}
                                            <div className="truncate text-xs text-zinc-400">
                                                {String(choice.song?.artist || choice.song?.artistName || '').trim() || 'Ready queue pick'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-lg font-black text-white">{choice.count}</div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs text-zinc-400">
                                {slotFillTally.summary}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => void closeSlotFillVote()}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1.5 text-[11px]`}
                                >
                                    Close Vote
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void applySlotFillWinner()}
                                    disabled={!slotFillWinnerSong || !slotFillWinnerChoice || !slotFillTarget?.id}
                                    className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1.5 text-[11px] ${(!slotFillWinnerSong || !slotFillWinnerChoice || !slotFillTarget?.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    {slotFillWinnerSong && slotFillTarget?.label
                                        ? `Assign ${(slotFillWinnerSong.singerName || 'Winner')} - ${buildQueueFaceOffSongLabel(slotFillWinnerSong)} To ${slotFillTarget.label}`
                                        : 'Assign Winner To Slot'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : activeNonQueueDecisionWindow ? (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200">Live Decision In Progress</div>
                        <div className="mt-1 text-sm font-semibold text-white">
                            {String(activeNonQueueDecisionWindow.prompt || activeNonQueueDecisionWindow.itemTitle || 'Another room decision is active.').trim()}
                        </div>
                        <div className="mt-1 text-xs text-zinc-300">
                            Finish or close the current room vote before starting another co-host planning moment.
                        </div>
                        {typeof onOpenRunOfShow === 'function' ? (
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={onOpenRunOfShow}
                                    className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1.5 text-[11px]`}
                                >
                                    Open {HOST_LIVE_OPS_LANGUAGE.showPlan}
                                </button>
                            </div>
                        ) : null}
                    </div>
                ) : queueFaceOffCandidates.length >= 2 && desktopQueueSurfaceTab === 'inbox' ? (
                    <div className="space-y-3">
                        {slotFillTarget?.id && slotFillCandidates.length >= 2 ? (
                            <div className="rounded-2xl border border-amber-300/18 bg-[linear-gradient(145deg,rgba(68,33,12,0.56),rgba(10,16,30,0.96))] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.18)]">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200">Co-Host Planning</div>
                                        <div className="mt-1 text-sm font-semibold text-white">Let trusted voters help fill the next open slot</div>
                                        <div className="mt-1 text-xs text-zinc-400">
                                            Keep long-range planning lightweight. Compare two queued singers before the host assigns {slotFillTarget.label || 'the open slot'}.
                                        </div>
                                    </div>
                                    <div className="rounded-full border border-amber-300/20 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-50">
                                        {slotFillTarget.label || 'Open Slot'}
                                    </div>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {slotFillCandidates.map((song, index) => (
                                        <div key={song.id || index} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                                    {buildQueueFaceOffSongArtwork(song) ? (
                                                        <img src={buildQueueFaceOffSongArtwork(song)} alt={buildQueueFaceOffSongLabel(song)} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-lg text-zinc-500">
                                                            <i className="fa-solid fa-music"></i>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[10px] uppercase tracking-[0.18em] text-amber-100">Candidate {index + 1}</div>
                                                    <div className="mt-1 text-sm font-semibold text-white">{buildQueueFaceOffSongLabel(song)}</div>
                                                    <div className="mt-1 text-xs text-zinc-400">{buildQueueFaceOffSongDetail(song)}</div>
                                                    <div className="truncate text-xs text-zinc-500">{String(song?.artist || song?.artistName || '').trim() || 'Ready queue pick'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void openSlotFillVote('cohost_vote')}
                                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1.5 text-[11px]`}
                                    >
                                        Start Slot-Fill Vote
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void openSlotFillVote('crowd_vote')}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1.5 text-[11px]`}
                                    >
                                        Open Slot Fill To Audience
                                    </button>
                                </div>
                            </div>
                        ) : null}
                        <div className="rounded-2xl border border-fuchsia-300/18 bg-[linear-gradient(145deg,rgba(43,19,48,0.55),rgba(10,16,30,0.96))] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.18)]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-[0.24em] text-fuchsia-200">
                                    {selfServeAuctionPriorityLive ? 'Support Surge' : (selfServePresentation?.badgeLabel || 'Co-Host Moment')}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                    {selfServeAuctionPriorityLive
                                        ? (selfServePresentation?.hostSummary || 'Let verified supporters steer the opening showcase block')
                                        : 'Let trusted voters help pick the next song'}
                                </div>
                                <div className="mt-1 text-xs text-zinc-400">
                                    {selfServeAuctionPriorityLive
                                        ? `The vote compares the top backed ready singers. ${selfServeAuctionWindow.remainingSlots} priority slot${selfServeAuctionWindow.remainingSlots === 1 ? '' : 's'} remain in the opening block.`
                                        : 'The vote compares the next two ready queue songs. Host confirmation is still required before the queue changes.'}
                                </div>
                            </div>
                            <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-100">
                                {selfServeAuctionPriorityLive ? 'Top 2 Verified Supporters' : 'Top 2 Ready Songs'}
                            </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {queueFaceOffCandidates.map((song, index) => (
                                <div key={song.id || index} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                            {buildQueueFaceOffSongArtwork(song) ? (
                                                <img src={buildQueueFaceOffSongArtwork(song)} alt={buildQueueFaceOffSongLabel(song)} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-lg text-zinc-500">
                                                    <i className="fa-solid fa-music"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                                                    {selfServeAuctionPriorityLive ? 'Auction Leader' : `Candidate ${index + 1}`}
                                                </div>
                                                {selfServeAuctionPriorityLive ? (
                                                    <span className="rounded-full border border-amber-300/25 bg-amber-500/12 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-100">
                                                        ${((spotlightAuctionLeaderboard[index]?.amountCents || 0) / 100).toFixed(2)}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="mt-1 text-sm font-semibold text-white">{buildQueueFaceOffSongLabel(song)}</div>
                                            <div className="mt-1 text-xs text-zinc-400">{buildQueueFaceOffSongDetail(song)}</div>
                                            <div className="truncate text-xs text-zinc-500">
                                                {selfServeAuctionPriorityLive
                                                    ? `${String(song?.artist || song?.artistName || '').trim() || 'Ready queue pick'} | verified support priority`
                                                    : (String(song?.artist || song?.artistName || '').trim() || 'Ready queue pick')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => void openQueueFaceOffVote('cohost_vote')}
                                className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1.5 text-[11px]`}
                            >
                                Start Co-Host Vote
                            </button>
                            <button
                                type="button"
                                onClick={() => void openQueueFaceOffVote('crowd_vote')}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1.5 text-[11px]`}
                            >
                                Open To Audience
                            </button>
                        </div>
                    </div>
                    </div>
                ) : null
            ) : null}
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
                        const playbackSelection = getQueuePlaybackSelection(song);
                        const topCandidate = song.reviewCandidates?.[0] || null;
                        const busy = reviewActionBusyKey.startsWith(`${song.id}:`);
                        const appleMusicId = String(song?.appleMusicId || song?.trackId || '').trim();
                        const canUseAppleSingAlong = !!appleMusicId;
                        const youtubeTrackCheckEnabled = searchSources?.youtube !== false;
                        const appleTrackCheckEnabled = searchSources?.itunes !== false;
                        const prioritizeYouTubeReview = youtubeTrackCheckEnabled || !appleTrackCheckEnabled;
                        const sourceLabel = String(song?.trackSource || song?.source || '').trim().toLowerCase();
                        const requestLooksApple = canUseAppleSingAlong || sourceLabel.includes('apple') || sourceLabel.includes('itunes');
                        const reviewPrompt = playbackSelection.mode === PLAYBACK_SELECTION_MODES.specificVersion
                            ? `${playbackSelection.detail} Approve it or choose another version.`
                            : topCandidate
                            ? `Best match: ${topCandidate.label || String(topCandidate.layer || 'candidate').replace(/_/g, ' ')}`
                            : prioritizeYouTubeReview
                                ? requestLooksApple && appleTrackCheckEnabled
                                    ? 'Find a YouTube backing first. Apple sing-along stays available as fallback.'
                                    : 'No trusted backing found yet. Use YouTube backing search.'
                                : requestLooksApple
                                    ? 'Approve Apple sing-along or open the request editor for another backing.'
                                    : 'Use the enabled backing tools to resolve this request.';
                        const reviewActionButtons = [
                            youtubeTrackCheckEnabled ? {
                                key: 'youtube',
                                label: 'Find YouTube Backing',
                                iconClass: 'fa-brands fa-youtube',
                                onClick: () => openReviewRequestEditor(song, { openSearch: true }),
                                className: prioritizeYouTubeReview ? STYLES.btnPrimary : STYLES.btnHighlight,
                                disabled: busy,
                            } : null,
                            appleTrackCheckEnabled ? {
                                key: 'apple',
                                label: 'Apple Sing-Along',
                                iconClass: 'fa-brands fa-apple',
                                onClick: () => resolveAppleSingAlongReviewRequest(song),
                                className: prioritizeYouTubeReview ? STYLES.btnSecondary : STYLES.btnPrimary,
                                disabled: busy || !canUseAppleSingAlong || !appleMusicAuthorized,
                                title: !canUseAppleSingAlong
                                    ? 'This request does not include an Apple Music track id'
                                    : !appleMusicAuthorized
                                        ? 'Connect Apple Music before approving sing-along playback'
                                        : 'Approve this as full-song Apple Music sing-along playback',
                            } : null,
                        ].filter(Boolean);
                        return (
                            <div key={song.id} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xl">{song.emoji || EMOJI.mic}</span>
                                            <div className="text-base font-black text-white truncate">{song.songTitle}</div>
                                            {playbackSelection.showSource ? (
                                                <ContentSourceBadge
                                                    source={playbackSelection.source}
                                                    label={playbackSelection.label}
                                                    title={playbackSelection.detail}
                                                    compact
                                                />
                                            ) : (
                                                <span className="inline-flex min-h-[20px] items-center rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-amber-100">
                                                    <i className="fa-solid fa-layer-group mr-1"></i>
                                                    Song only · choose version
                                                </span>
                                            )}
                                            {song.collabOpen && (
                                                <span className="rounded-full border border-pink-300/25 bg-pink-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-pink-100">Duet / group open</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-zinc-400 truncate">{song.artist || 'Unknown'} • {song.singerName || 'Guest'}</div>
                                        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">{reviewPrompt}</div>
                                    </div>
                                    <div className="text-right text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                        {song.reviewCandidates?.length || 0} ranked option{(song.reviewCandidates?.length || 0) === 1 ? '' : 's'}
                                    </div>
                                </div>
                                <div className={`mt-3 grid gap-2 ${reviewActionButtons.length > 1 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
                                    {reviewActionButtons.map((action) => (
                                        <button
                                            key={action.key}
                                            type="button"
                                            disabled={action.disabled}
                                            onClick={action.onClick}
                                            title={action.title || ''}
                                            className={`${STYLES.btnStd} ${action.className} min-h-[42px] justify-center px-3 py-2 text-[10px] ${action.disabled ? 'cursor-not-allowed opacity-55' : ''}`}
                                        >
                                            <i className={`${action.iconClass} mr-2`}></i>
                                            {action.label}
                                        </button>
                                    ))}
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
                                            const candidateSourceMeta = getReviewCandidateSourceMeta(candidate);
                                            const candidateArtworkUrl = getReviewCandidateArtworkUrl(candidate);
                                            const candidateDurationLabel = formatReviewCandidateDuration(getReviewCandidateDurationSec(candidate));
                                            const candidateBeauScore = getReviewCandidateBeauScore(candidate);
                                            const candidateLayerLabel = String(candidate.label || candidate.layer || 'candidate').replace(/_/g, ' ');
                                            const successCount = Number(diagnostics?.successCount ?? candidate.successCount ?? 0) || 0;
                                            const failureCount = Number(diagnostics?.failureCount ?? candidate.failureCount ?? 0) || 0;
                                            return (
                                            <div key={candidate.id} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/55 p-2.5">
                                                <div className="grid min-w-0 gap-3 sm:grid-cols-[92px_minmax(0,1fr)] xl:grid-cols-[96px_minmax(0,1fr)_150px]">
                                                    <div className="relative h-[86px] overflow-hidden rounded-xl border border-white/10 bg-black/45 sm:h-full sm:min-h-[92px]">
                                                        {candidateArtworkUrl ? (
                                                            <img src={candidateArtworkUrl} alt="" className="h-full w-full object-cover" />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),transparent_55%),linear-gradient(180deg,rgba(12,17,31,1),rgba(8,12,24,1))] text-xl text-cyan-200">
                                                                <i className={candidateSourceMeta.iconClass}></i>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-2 py-1.5">
                                                            <div className="flex items-end justify-between gap-2">
                                                                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/85">BeauScore</span>
                                                                <span className="text-lg font-black leading-none text-white">{candidateBeauScore || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 overflow-hidden">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${candidateSourceMeta.className}`}>
                                                                <i className={`${candidateSourceMeta.iconClass} mr-1`}></i>
                                                                {candidateSourceMeta.label}
                                                            </span>
                                                            {candidateDurationLabel ? (
                                                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-200">
                                                                    {candidateDurationLabel}
                                                                </span>
                                                            ) : null}
                                                            <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-100">
                                                                {candidateLayerLabel}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1.5 line-clamp-2 text-sm font-black leading-snug text-white">
                                                            {candidate.title || song.songTitle}
                                                        </div>
                                                        <div className="mt-0.5 truncate text-xs text-zinc-400">{candidate.artist || song.artist || 'Unknown artist'}</div>
                                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                            {diagnosticsTone ? (
                                                                <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${diagnosticsTone.className}`}>
                                                                    {diagnosticsTone.label}
                                                                </span>
                                                            ) : null}
                                                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                                                                {successCount} good
                                                            </span>
                                                            {failureCount > 0 ? (
                                                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                                                                    {failureCount} bad
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        {diagnosticsEntry?.error ? (
                                                            <div className="mt-2 text-xs text-rose-200">{diagnosticsEntry.error}</div>
                                                        ) : diagnosticsSupport ? (
                                                            <div className="mt-2 line-clamp-2 text-xs text-zinc-400">{diagnosticsSupport}</div>
                                                        ) : candidate.reason ? (
                                                            <div className="mt-2 line-clamp-2 text-xs text-zinc-500">{candidate.reason}</div>
                                                        ) : null}
                                                    </div>
                                                    <div className="grid min-w-[140px] gap-2 sm:col-span-2 sm:grid-cols-3 xl:col-span-1 xl:grid-cols-1">
                                                        <button
                                                            type="button"
                                                            disabled={busy}
                                                            onClick={() => resolveReviewRequest(song, candidate)}
                                                            className={`${STYLES.btnStd} ${STYLES.btnPrimary} justify-center px-2 py-1.5 text-[10px]`}
                                                        >
                                                            Use Track
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
        </div>
    );
    const showQueueWorkspaceHeader = false;
    const queueWorkspaceHeader = showQueueWorkspaceHeader ? (
        <div data-feature-id="queue-workspace-top-chrome" className={`border-b border-white/10 px-3 py-3 ${activeQueueWorkspaceTone.headerClass}`}>
            <HostLiveOpsPanel
                current={current}
                nextQueueSong={nextQueueSong}
                nextQueueText={queueSurface.stageSummary.nextQueueText}
                nextQueueReasonLabel={nextQueueReason.shortLabel}
                nextQueueReasonDetail={nextQueueReason.detail}
                selfServeMode={selfServeMode}
                queueCount={queueSurface.stageSummary.queueCount}
                readyQueueCount={queueSurface.counts.ready}
                assignedQueueCount={queueSurface.counts.assigned}
                needsAttentionCount={queueSurface.counts.needsAttention}
                currentSourcePlaying={currentSourcePlaying}
                runOfShowEnabled={runOfShowEnabled}
                runOfShowLiveItem={runOfShowLiveItem}
                runOfShowFlightedItem={runOfShowStagedItem}
                runOfShowOnDeckItem={runOfShowNextItem}
                onOpenRunOfShow={onOpenRunOfShow}
                styles={STYLES}
                showTitle
                compact
                inline
            />
        </div>
    ) : null;
    const desktopQueueSurfacePanel = !queueSurface.isCompactQueueSurface ? (
        <div className={`${STYLES.panel} ${activeQueueWorkspaceTone.shellClass} min-h-0 flex flex-1 flex-col overflow-hidden min-w-0`}>
            <div className={queueWorkspaceTabListClass}>
                {renderQueueWorkspaceTabButton({
                    id: 'queue',
                    label: HOST_LIVE_OPS_LANGUAGE.lineup,
                    icon: 'fa-list-ol',
                    active: desktopQueueSurfaceTab === 'queue',
                    onClick: () => setDesktopQueueSurfaceTab('queue'),
                    featureId: 'queue-surface-tab-queue-desktop',
                    badge: queueSurface.counts.ready,
                    activeToneClass: queueWorkspaceToneMap.queue.activeToneClass,
                })}
                {renderQueueWorkspaceTabButton({
                    id: 'add',
                    label: HOST_LIVE_OPS_LANGUAGE.addPerformance,
                    icon: 'fa-plus',
                    active: desktopQueueSurfaceTab === 'add',
                    onClick: () => setDesktopQueueSurfaceTab('add'),
                    featureId: 'queue-surface-tab-add-desktop',
                    activeToneClass: queueWorkspaceToneMap.add.activeToneClass,
                })}
                {renderQueueWorkspaceTabButton({
                    id: 'catalog',
                    label: 'Catalog',
                    icon: 'fa-book-open',
                    active: desktopQueueSurfaceTab === 'catalog',
                    onClick: () => setDesktopQueueSurfaceTab('catalog'),
                    featureId: 'queue-surface-tab-catalog-desktop',
                    activeToneClass: queueWorkspaceToneMap.catalog.activeToneClass,
                })}
                {renderQueueWorkspaceTabButton({
                    id: 'inbox',
                    label: 'Inbox',
                    icon: 'fa-inbox',
                    active: desktopQueueSurfaceTab === 'inbox',
                    onClick: () => setDesktopQueueSurfaceTab('inbox'),
                    featureId: 'queue-surface-tab-inbox-desktop',
                    badge: inboxTotalCount,
                    activeToneClass: queueWorkspaceToneMap.inbox.activeToneClass,
                    badgeToneClass: inboxBadgeToneClass,
                })}
                {renderQueueWorkspaceTabButton({
                    id: 'show',
                    label: HOST_LIVE_OPS_LANGUAGE.showPlan,
                    icon: 'fa-clapperboard',
                    active: desktopQueueSurfaceTab === 'show',
                    onClick: () => setDesktopQueueSurfaceTab('show'),
                    featureId: 'queue-surface-tab-show-desktop',
                    badge: runOfShowNeedsAttentionCount,
                    activeToneClass: queueWorkspaceToneMap.show.activeToneClass,
                    badgeToneClass: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
                })}
                {desktopQueueSurfaceTab === 'queue' ? (
                    <button
                        type="button"
                        onClick={() => setDesktopQueueReorderMode((current) => !current)}
                        data-feature-id="queue-surface-reorder-toggle-desktop"
                        aria-pressed={desktopQueueReorderMode}
                        className={`ml-auto inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 text-[11px] font-black uppercase tracking-[0.14em] transition ${
                            desktopQueueReorderMode
                                ? 'border-cyan-300/40 bg-cyan-500/15 text-cyan-100'
                                : 'border-white/10 bg-black/25 text-zinc-200 hover:border-cyan-300/30 hover:text-white'
                        }`}
                    >
                        <i className={`fa-solid ${desktopQueueReorderMode ? 'fa-check' : 'fa-arrow-down-up-across-line'}`}></i>
                        {desktopQueueReorderMode ? 'Done' : 'Reorder'}
                    </button>
                ) : null}
            </div>
            {queueWorkspaceHeader}
            {desktopQueueSurfaceTab === 'show'
                ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-emerald-500/[0.03]">{plannerWorkspaceSection}</div>
                : desktopQueueSurfaceTab === 'inbox'
                    ? inboxWorkspaceSection
                : desktopQueueSurfaceTab === 'catalog'
                    ? catalogWorkspaceSection
                : desktopQueueSurfaceTab === 'add'
                    ? <div className="flex-1 min-h-0 overflow-hidden bg-fuchsia-500/[0.03]">{addToQueueSection}</div>
                    : queueListSection}
        </div>
    ) : null;
    const compactQueueSurfaceControls = queueSurface.isCompactQueueSurface ? (
        <div className={`border-b border-white/10 px-3 py-3 ${activeQueueWorkspaceTone.headerClass}`}>
            <div className="flex flex-wrap items-center gap-2">
                <div className="host-brand-tabs host-brand-tabs--workspace max-w-full">
                    {renderQueueWorkspaceTabButton({
                        id: 'queue-mobile',
                        label: 'Queue',
                        icon: 'fa-list-ol',
                        active: queueSurface.activeCompactTab === 'queue',
                        onClick: () => queueSurface.activateCompactTab('queue'),
                        featureId: 'queue-surface-tab-queue',
                        badge: queueSurface.counts.ready,
                        activeToneClass: queueWorkspaceToneMap.queue.activeToneClass,
                    })}
                    {renderQueueWorkspaceTabButton({
                        id: 'add-mobile',
                        label: HOST_LIVE_OPS_LANGUAGE.addPerformance,
                        icon: 'fa-plus',
                        active: queueSurface.activeCompactTab === 'add',
                        onClick: () => queueSurface.activateCompactTab('add'),
                        featureId: 'queue-surface-tab-add',
                        activeToneClass: queueWorkspaceToneMap.add.activeToneClass,
                    })}
                    {renderQueueWorkspaceTabButton({
                        id: 'catalog-mobile',
                        label: 'Catalog',
                        icon: 'fa-book-open',
                        active: queueSurface.activeCompactTab === 'catalog',
                        onClick: () => queueSurface.activateCompactTab('catalog'),
                        featureId: 'queue-surface-tab-catalog',
                        activeToneClass: queueWorkspaceToneMap.catalog.activeToneClass,
                    })}
                    {renderQueueWorkspaceTabButton({
                        id: 'inbox-mobile',
                        label: 'Inbox',
                        icon: 'fa-inbox',
                        active: queueSurface.activeCompactTab === 'inbox',
                        onClick: () => queueSurface.activateCompactTab('inbox'),
                        featureId: 'queue-surface-tab-inbox',
                        badge: inboxTotalCount,
                        activeToneClass: queueWorkspaceToneMap.inbox.activeToneClass,
                        badgeToneClass: inboxBadgeToneClass,
                    })}
                    {renderQueueWorkspaceTabButton({
                        id: 'show-mobile',
                        label: HOST_LIVE_OPS_LANGUAGE.showPlan,
                        icon: 'fa-clapperboard',
                        active: queueSurface.activeCompactTab === 'show',
                        onClick: () => queueSurface.activateCompactTab('show'),
                        featureId: 'queue-surface-tab-show',
                        badge: runOfShowNeedsAttentionCount,
                        activeToneClass: queueWorkspaceToneMap.show.activeToneClass,
                        badgeToneClass: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
                    })}
                </div>
                {queueSurface.activeCompactTab === 'queue' ? (
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
        <div className={`flex-1 ${STYLES.panel} ${activeQueueWorkspaceTone.shellClass} flex flex-col overflow-hidden min-w-0 min-h-0`}>
            {compactQueueSurfaceControls}
            {queueWorkspaceHeader}
            {queueSurface.activeCompactTab === 'inbox' ? (
                inboxWorkspaceSection
            ) : queueSurface.activeCompactTab === 'catalog' ? (
                catalogWorkspaceSection
            ) : queueSurface.activeCompactTab === 'show' ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-emerald-500/[0.03]">{plannerWorkspaceSection}</div>
            ) : queueSurface.activeCompactTab === 'add' ? (
                <div className="min-h-0 flex-1 overflow-hidden bg-fuchsia-500/[0.03]">
                    {addToQueueSection}
                </div>
            ) : queueListSection}
        </div>
    ) : null;
    const queueWorkspacePanel = queueSurface.isCompactQueueSurface
        ? compactQueueSurfacePanel
        : desktopQueueSurfacePanel;
    const legacySoundboardSection = !essentialsMode && showLegacyLiveEffects ? (
        <section className={`${sectionPaddingClass} border-b border-white/10`}>
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
                customSounds={customSoundboardSounds}
                playSfxSafe={playSfxSafe}
                smallWaveform={SmallWaveform}
            />
        </section>
    ) : null;

    return (
        <div className={`${momentPrepWorkspaceActive || !allowHostPanelPageScroll ? 'h-full min-h-0 overflow-hidden' : 'min-h-full overflow-visible'} flex flex-col ${compactViewport ? 'gap-2' : 'gap-3'} relative`}>
            {ytSearchOpen ? (
                <React.Suspense fallback={null}>
                    <QueueYouTubeSearchModal
                        open={ytSearchOpen}
                        styles={STYLES}
                        ytSearchQ={ytSearchQ}
                        setYtSearchQ={setYtSearchQ}
                        youtubeSearchMode={youtubeSearchMode}
                        setYoutubeSearchMode={setYoutubeSearchMode}
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
                        performanceMode={room?.performanceMode || room?.missionControl?.setupDraft?.performanceMode || 'karaoke'}
                        openYtSearch={openYtSearch}
                        syncEditDuration={syncEditDuration}
                        onRetryLyrics={retryLyricsForSong}
                        onFetchTimedLyrics={fetchTimedLyricsForSong}
                        onCancel={() => setEditingSongId(null)}
                        onSave={saveEdit}
                    />
                </React.Suspense>
            ) : null}
            {sceneLibraryOpen ? (
                <div
                    data-feature-id="tv-moments-library-modal"
                    className="fixed inset-0 z-[360] flex items-stretch justify-stretch overflow-hidden overscroll-contain bg-black/88 p-0 backdrop-blur-sm"
                    style={{
                        paddingTop: sceneLibraryViewportInsetTop,
                        paddingBottom: sceneLibraryViewportInsetBottom,
                    }}
                    onClick={closeSceneLibrary}
                >
                    <button
                        type="button"
                        aria-label="Close Media Library"
                        onClick={closeSceneLibrary}
                        className="fixed right-3 z-[365] inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-cyan-300/35 bg-black/75 px-3 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.38)] backdrop-blur-sm transition hover:border-cyan-300/60 hover:text-cyan-100 sm:right-4"
                        style={{ top: `calc(${sceneLibraryViewportInsetTop} + 0.75rem)` }}
                    >
                        <i className="fa-solid fa-xmark text-sm"></i><span>Close</span>
                    </button>
                    <button
                        type="button"
                        onClick={closeSceneLibrary}
                        className={`${STYLES.btnStd} ${STYLES.btnPrimary} fixed bottom-3 left-3 right-3 z-[365] min-h-[46px] justify-center px-4 py-2 text-xs shadow-[0_14px_34px_rgba(0,0,0,0.42)] sm:left-auto sm:right-4 sm:w-auto`}
                        data-feature-id="host-media-library-bottom-close"
                    >
                        <i className="fa-solid fa-arrow-left mr-2"></i>
                        Back to Host
                    </button>
                    <div
                        className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden"
                        style={{
                            height: sceneLibraryViewportHeight,
                            maxHeight: sceneLibraryViewportHeight,
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        {scenePresetLibrarySection}
                    </div>
                </div>
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
            {pendingEarlyEndDecision && (
                <div className="fixed right-4 top-24 z-[195] w-[min(92vw,24rem)]">
                    <div className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-[#1a1621]/95 via-[#171420]/95 to-[#141827]/95 p-3 shadow-[0_20px_56px_rgba(0,0,0,0.42)] backdrop-blur-sm">
                        <div className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Quick check</div>
                        <div className="mt-1 text-base font-semibold text-white">Was that a backing issue?</div>
                        <div className="mt-1 text-[13px] text-zinc-300 truncate">{pendingEarlyEndDecision.songTitle || 'Current performance'}</div>
                        <div className="text-[12px] text-zinc-500">
                            Ended around {Math.max(1, Number(pendingEarlyEndDecision.performanceElapsedSec || 0))}s in. We will continue normally if you do nothing.
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={() => void handleFinishPerformance(pendingEarlyEndDecision.songId)}
                                disabled={pendingEarlyEndDecisionBusy}
                                className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-2.5 py-1.5 text-[11px] ${pendingEarlyEndDecisionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Finish Song
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleChangeBackingForCurrentPerformance(pendingEarlyEndDecision.songId)}
                                disabled={pendingEarlyEndDecisionBusy}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} border-amber-300/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-100 hover:border-amber-200/60 ${pendingEarlyEndDecisionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Change Backing
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {fullscreenPrototype ? (
                <HostNightPilotPrototype
                    runtimeModel={experimentalRuntimeModel}
                    room={room}
                    roomCode={roomCode}
                    queueItems={[
                        ...queue,
                        ...pending,
                        ...reviewRequired,
                        ...assigned,
                        ...held,
                    ]}
                    queueSections={[
                        { key: 'ready', items: queue },
                        { key: 'review', items: reviewRequired },
                        { key: 'pending', items: pending },
                        { key: 'assigned', items: assigned },
                        { key: 'held', items: held },
                    ]}
                    styles={STYLES}
                    customBonus={customBonus}
                    onCustomBonusChange={setCustomBonus}
                    onTogglePlay={togglePlay}
                    onRestartPlayback={restartCurrentPlayback}
                    onJumpPlayback={jumpCurrentPlayback}
                    onSeekPlayback={seekCurrentPlayback}
                    onOpenBackingWindow={openCurrentBackingWindow}
                    onEndPerformance={handleEndPerformance}
                    onStartApplause={() => current && startApplauseSequence({ songId: current.id, autoFinalize: false })}
                    onReturnCurrentToQueue={onReturnCurrentToQueue || returnCurrentPerformanceToQueue}
                    onAddBonusToCurrent={addBonusToCurrent}
                    onEditCurrentPerformance={() => current && startEdit(current)}
                    onToggleAudienceSync={toggleAudienceSync}
                    audienceSyncActive={room?.audienceVideoMode === 'force'}
                    audienceSyncDisabled={currentUsesAppleBacking}
                    onApproveCurrentAudienceBacking={() => current && resolveAudienceSelectedBacking(current, 'approve')}
                    onAvoidCurrentAudienceBacking={() => current && resolveAudienceSelectedBacking(current, 'avoid')}
                    onRateCurrentBackingUp={() => current && rateBackingPreference(current, 'up')}
                    onRateCurrentBackingDown={() => current && rateBackingPreference(current, 'down')}
                    onOpenQueue={openQueueWorkspace}
                    onOpenAdd={openAddWorkspace}
                    onOpenInbox={focusInboxWorkspace}
                    onOpenPlanner={openPlannerWorkspace}
                    onOpenSceneLibrary={() => setSceneLibraryOpen(true)}
                    onStartNextPerformance={startNextPerformanceFromShell}
                    onExitPrototype={() => {
                        if (typeof window !== 'undefined') {
                            window.location.href = prototypeExitHref || `${hostBase}?mode=host${roomCode ? `&room=${encodeURIComponent(roomCode)}` : ''}`;
                        }
                    }}
                />
            ) : useExperimentalRuntimeShell ? (
                <HostStageConsoleExperimental
                    runtimeModel={experimentalRuntimeModel}
                    room={room}
                    styles={STYLES}
                    customBonus={customBonus}
                    onCustomBonusChange={setCustomBonus}
                    onTogglePlay={togglePlay}
                    onRestartPlayback={restartCurrentPlayback}
                    onJumpPlayback={jumpCurrentPlayback}
                    onSeekPlayback={seekCurrentPlayback}
                    onOpenBackingWindow={openCurrentBackingWindow}
                    onEndPerformance={handleEndPerformance}
                    onStartApplause={() => current && startApplauseSequence({ songId: current.id, autoFinalize: false })}
                    onReturnCurrentToQueue={onReturnCurrentToQueue || returnCurrentPerformanceToQueue}
                    onAddBonusToCurrent={addBonusToCurrent}
                    onEditCurrentPerformance={() => current && startEdit(current)}
                    onAdvanceToNext={progressStageToNext}
                    canAdvanceToNext={!!nextQueueSong}
                    onApproveCurrentAudienceBacking={() => current && resolveAudienceSelectedBacking(current, 'approve')}
                    onAvoidCurrentAudienceBacking={() => current && resolveAudienceSelectedBacking(current, 'avoid')}
                    onRateCurrentBackingUp={() => current && rateBackingPreference(current, 'up')}
                    onRateCurrentBackingDown={() => current && rateBackingPreference(current, 'down')}
                    onToggleAudienceSync={toggleAudienceSync}
                    audienceSyncActive={room?.audienceVideoMode === 'force'}
                    audienceSyncDisabled={currentUsesAppleBacking}
                    onOpenQueue={openQueueWorkspace}
                    onOpenAdd={openAddWorkspace}
                    onOpenInbox={focusInboxWorkspace}
                    onOpenPlanner={openPlannerWorkspace}
                    onOpenSceneLibrary={() => setSceneLibraryOpen(true)}
                    onStartNextPerformance={startNextPerformanceFromShell}
                    workspacePanel={queueWorkspacePanel}
                    utilityPanel={legacySoundboardSection}
                />
            ) : (
                <div className={`flex-1 ${allowHostPanelPageScroll ? 'min-h-full' : 'min-h-0'} ${
                    isMobileLayout
                        ? 'flex flex-col gap-3'
                        : isTightLayout
                            ? 'grid grid-cols-[minmax(280px,0.72fr)_minmax(0,1.42fr)] gap-4'
                            : 'grid grid-cols-[minmax(260px,0.82fr)_minmax(780px,1.9fr)] gap-5'
                } ${allowHostPanelPageScroll ? 'overflow-visible' : 'overflow-hidden'}`}>
                {/* LEFT CONTROLS */}
                <div className={`w-full flex flex-col ${isMobileLayout
                        ? (allowHostPanelPageScroll ? 'min-h-0' : 'min-h-0 max-h-[38vh] pr-1.5')
                        : isTightLayout
                            ? 'min-h-0 pr-1'
                            : 'min-h-0 pr-1'
                }`}>
                    <div className={`${STYLES.panel} ${allowHostPanelPageScroll ? 'min-h-0 overflow-visible' : 'h-full min-h-0 overflow-hidden'} flex flex-col`}>
                        <div className={allowHostPanelPageScroll ? '' : 'flex-1 min-h-0 overflow-y-auto custom-scrollbar'}>
                            <>
                                <section className={`${sectionPaddingClass} border-b border-white/10`}>
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
                                        lobbyCount={lobbyCount}
                                        queueCount={queueSurface.stageSummary.queueCount}
                                        needsAttentionCount={queueSurface.counts.needsAttention}
                                        readyQueueCount={queueSurface.counts.ready}
                                        assignedQueueCount={queueSurface.counts.assigned}
                                        waitTimeSec={waitTimeSec}
                                        formatWaitTime={formatWaitTime}
                                        nextQueueSong={nextQueueSong}
                                        nextQueueText={queueSurface.stageSummary.nextQueueText}
                                        nextQueueReasonDetail={nextQueueReason.detail}
                                        selfServeMode={selfServeMode}
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
                                        onRateBacking={rateBackingPreference}
                                        lastTrackCheckItem={visibleLastTrackCheck}
                                        onTrackCheckAction={handlePostPerformanceBackingPromptAction}
                                        onResolveAudienceBacking={resolveAudienceSelectedBacking}
                                        backingDecisionBusyKey={backingDecisionBusyKey}
                                        updateStatus={updateStatus}
                                        onMeasureApplause={() => current && startApplauseSequence({ songId: current.id, autoFinalize: false })}
                                        onEndPerformance={(songId) => handleEndPerformance(songId)}
                                        onOpenBackingWindow={openCurrentBackingWindow}
                                        onReturnCurrentToQueue={onReturnCurrentToQueue || returnCurrentPerformanceToQueue}
                                        progressStageToNext={progressStageToNext}
                                        onRestartPlayback={restartCurrentPlayback}
                                        onJumpPlayback={jumpCurrentPlayback}
                                        onSeekPlayback={seekCurrentPlayback}
                                        showStageSummaryHeader={false}
                                        styles={STYLES}
                                        emoji={EMOJI}
                                    />
                                )}
                                </section>
                            </>
                            {legacySoundboardSection}
                        </div>
                    </div>
                </div>

                {queueSurface.isCompactQueueSurface ? (
                    compactQueueSurfacePanel
                ) : (
                    desktopQueueSurfacePanel
                )}
                </div>
            )}
        </div>
    );
};

// --- MAIN HOST APP COMPONENT ---
export default HostQueueTab;
