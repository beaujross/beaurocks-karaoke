import { PLAYBACK_CONTENT_KINDS } from './playbackSource.js';

export const NIGHT_PLAN_VERSION = 1;

export const NIGHT_EXPERIENCE_IDS = Object.freeze({
  karaoke: 'karaoke',
  originalTracks: 'original_tracks',
  trivia: 'trivia',
  wouldYouRather: 'would_you_rather',
});

export const HOSTING_LEVEL_IDS = Object.freeze({
  hostLed: 'host_led',
  assisted: 'assisted',
  selfServe: 'self_serve',
});

export const ORIGINAL_TRACK_LYRICS_POLICIES = Object.freeze({
  whenAvailable: 'when_available',
  required: 'required',
  off: 'off',
});

export const NIGHT_EXPERIENCES = Object.freeze([
  Object.freeze({
    id: NIGHT_EXPERIENCE_IDS.karaoke,
    label: 'Karaoke',
    shortLabel: 'Karaoke',
    icon: 'fa-microphone-lines',
    summary: 'Instrumental and karaoke backings with a singer lineup.',
  }),
  Object.freeze({
    id: NIGHT_EXPERIENCE_IDS.originalTracks,
    label: 'Original Track Party',
    shortLabel: 'Original Tracks',
    icon: 'fa-record-vinyl',
    summary: 'Sing along or lip sync to full original recordings, with lyrics when available.',
  }),
  Object.freeze({
    id: NIGHT_EXPERIENCE_IDS.trivia,
    label: 'Trivia Night',
    shortLabel: 'Trivia',
    icon: 'fa-lightbulb',
    summary: 'Run an ordered question session with answers, reveals, and scoring.',
  }),
  Object.freeze({
    id: NIGHT_EXPERIENCE_IDS.wouldYouRather,
    label: 'Would You Rather',
    shortLabel: 'WYR',
    icon: 'fa-code-compare',
    summary: 'Run an ordered prompt session with voting and live room results.',
  }),
]);

export const HOSTING_LEVELS = Object.freeze([
  Object.freeze({
    id: HOSTING_LEVEL_IDS.hostLed,
    label: 'Host-Led',
    icon: 'fa-headset',
    summary: 'You decide when the night moves forward.',
  }),
  Object.freeze({
    id: HOSTING_LEVEL_IDS.assisted,
    label: 'Host Assist',
    icon: 'fa-wand-magic-sparkles',
    summary: 'BeauRocks handles routine timing while you can step in anytime.',
  }),
  Object.freeze({
    id: HOSTING_LEVEL_IDS.selfServe,
    label: 'Self-Serve',
    icon: 'fa-people-group',
    summary: 'Guests drive supported parts of the experience while you supervise.',
  }),
]);

const clean = (value = '') => String(value || '').trim().toLowerCase();
const asObject = (value = null) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

export const normalizeNightExperienceId = (value = '') => {
  const token = clean(value);
  if (['original_track', 'original_tracks', 'original_track_party', 'sing_along', 'lip_sync'].includes(token)) {
    return NIGHT_EXPERIENCE_IDS.originalTracks;
  }
  if (['trivia', 'trivia_night'].includes(token)) return NIGHT_EXPERIENCE_IDS.trivia;
  if (['wyr', 'would_you_rather', 'would_you_rather_night'].includes(token)) {
    return NIGHT_EXPERIENCE_IDS.wouldYouRather;
  }
  return NIGHT_EXPERIENCE_IDS.karaoke;
};

export const normalizeHostingLevel = (value = '') => {
  const token = clean(value);
  if (['assisted', 'assisted_host', 'host_assist'].includes(token)) return HOSTING_LEVEL_IDS.assisted;
  if (['self_serve', 'self-service', 'self_service', 'crowd_driven'].includes(token)) return HOSTING_LEVEL_IDS.selfServe;
  return HOSTING_LEVEL_IDS.hostLed;
};

export const normalizeOriginalTrackLyricsPolicy = (value = '') => {
  const token = clean(value);
  if (['required', 'require', 'lyrics_required'].includes(token)) return ORIGINAL_TRACK_LYRICS_POLICIES.required;
  if (['off', 'none', 'disabled'].includes(token)) return ORIGINAL_TRACK_LYRICS_POLICIES.off;
  return ORIGINAL_TRACK_LYRICS_POLICIES.whenAvailable;
};

export const deriveNightExperienceId = (room = {}) => {
  const explicit = room?.nightPlan?.experienceId || room?.nightExperienceId || '';
  if (clean(explicit)) return normalizeNightExperienceId(explicit);
  const performanceMode = clean(room?.performanceMode || room?.missionControl?.setupDraft?.performanceMode);
  if (performanceMode === 'sing_along' || performanceMode === 'lip_sync') {
    return NIGHT_EXPERIENCE_IDS.originalTracks;
  }
  const preset = clean(room?.hostNightPreset);
  if (preset === 'trivia') return NIGHT_EXPERIENCE_IDS.trivia;
  return NIGHT_EXPERIENCE_IDS.karaoke;
};

export const deriveHostingLevel = (room = {}) => {
  const explicit = room?.nightPlan?.hostingLevel || room?.hostingLevel || '';
  if (clean(explicit)) return normalizeHostingLevel(explicit);
  if (
    room?.selfServeMode?.enabled === true
    || room?.oneMinuteMicEnabled === true
    || clean(room?.performanceProgressionMode) === 'one_minute_mic'
  ) {
    return HOSTING_LEVEL_IDS.selfServe;
  }
  return room?.autoDj === true ? HOSTING_LEVEL_IDS.assisted : HOSTING_LEVEL_IDS.hostLed;
};

export const normalizeNightPlan = (value = {}, roomFallback = {}) => {
  const source = asObject(value);
  const fallbackExperience = deriveNightExperienceId(roomFallback);
  const fallbackHostingLevel = deriveHostingLevel(roomFallback);
  const originalTracks = asObject(source?.experienceConfig?.originalTracks);
  return {
    version: NIGHT_PLAN_VERSION,
    experienceId: normalizeNightExperienceId(source.experienceId || fallbackExperience),
    hostingLevel: normalizeHostingLevel(source.hostingLevel || fallbackHostingLevel),
    experienceConfig: {
      originalTracks: {
        lyricsPolicy: normalizeOriginalTrackLyricsPolicy(
          originalTracks.lyricsPolicy
          || roomFallback?.originalTrackLyricsPolicy
          || (clean(roomFallback?.performanceMode) === 'lip_sync' ? 'off' : 'when_available')
        ),
      },
    },
    source: clean(source.source || 'current_room') || 'current_room',
    updatedAtMs: Math.max(0, Number(source.updatedAtMs || 0) || 0),
  };
};

export const deriveNightPlan = (room = {}) => normalizeNightPlan(room?.nightPlan || {}, room);

export const getNightExperience = (value = '') => {
  const id = normalizeNightExperienceId(value);
  return NIGHT_EXPERIENCES.find((entry) => entry.id === id) || NIGHT_EXPERIENCES[0];
};

export const getHostingLevel = (value = '') => {
  const id = normalizeHostingLevel(value);
  return HOSTING_LEVELS.find((entry) => entry.id === id) || HOSTING_LEVELS[0];
};

const hasTimedLyrics = (song = {}) => Array.isArray(song?.lyricsTimed) && song.lyricsTimed.length > 0;
const hasStaticLyrics = (song = {}) => !!String(song?.lyrics || '').trim();
const isOriginalRecording = (song = {}) => (
  clean(song?.playbackContentKind) === PLAYBACK_CONTENT_KINDS.originalRecording
  || !!String(song?.appleMusicId || '').trim()
);
const isRelevantLineupSong = (song = {}) => ['requested', 'assigned', 'performing', 'held', 'pending'].includes(clean(song?.status));

export const buildNightReadiness = ({
  room = {},
  songs = [],
  appleMusicAuthorized = false,
  promptCount = null,
  publicTvConnected = null,
} = {}) => {
  const plan = deriveNightPlan(room);
  const lineup = (Array.isArray(songs) ? songs : []).filter(isRelevantLineupSong);
  const originalReadyCount = lineup.filter(isOriginalRecording).length;
  const timedLyricsCount = lineup.filter(hasTimedLyrics).length;
  const staticLyricsCount = lineup.filter((song) => !hasTimedLyrics(song) && hasStaticLyrics(song)).length;
  const lyricsReadyCount = timedLyricsCount + staticLyricsCount;
  const needsReviewCount = lineup.filter((song) => {
    const resolution = clean(song?.resolutionStatus || song?.mediaResolutionStatus);
    const lyricsStatus = clean(song?.lyricsGenerationStatus);
    return resolution.includes('review')
      || resolution.includes('pending')
      || ['error', 'permission_denied', 'needs_user_token'].includes(lyricsStatus);
  }).length;
  const blockers = [];
  const warnings = [];

  if (plan.experienceId === NIGHT_EXPERIENCE_IDS.originalTracks) {
    if (lineup.length > 0 && originalReadyCount < lineup.length) {
      blockers.push(`${lineup.length - originalReadyCount} lineup item${lineup.length - originalReadyCount === 1 ? '' : 's'} need an original recording`);
    }
    const lyricsPolicy = plan.experienceConfig.originalTracks.lyricsPolicy;
    if (lyricsPolicy === ORIGINAL_TRACK_LYRICS_POLICIES.required && lineup.length > 0 && lyricsReadyCount < lineup.length) {
      blockers.push(`${lineup.length - lyricsReadyCount} lineup item${lineup.length - lyricsReadyCount === 1 ? '' : 's'} need verified lyrics`);
    } else if (lyricsPolicy !== ORIGINAL_TRACK_LYRICS_POLICIES.off && lineup.length > lyricsReadyCount) {
      warnings.push(`${lineup.length - lyricsReadyCount} lineup item${lineup.length - lyricsReadyCount === 1 ? '' : 's'} will play without big-screen lyrics`);
    }
    if (!appleMusicAuthorized && lineup.some((song) => String(song?.appleMusicId || '').trim())) {
      blockers.push('Connect Apple Music to play selected original tracks');
    }
  }

  if ([NIGHT_EXPERIENCE_IDS.trivia, NIGHT_EXPERIENCE_IDS.wouldYouRather].includes(plan.experienceId)) {
    if (promptCount !== null && Math.max(0, Number(promptCount || 0)) === 0) {
      blockers.push(plan.experienceId === NIGHT_EXPERIENCE_IDS.trivia
        ? 'Add a question pack before starting Trivia Night'
        : 'Add a prompt pack before starting Would You Rather');
    }
  }

  if (publicTvConnected === false) warnings.push('Public TV is not connected');

  return {
    status: blockers.length ? 'needs_attention' : warnings.length ? 'ready_with_notes' : 'ready',
    blockers,
    warnings,
    counts: {
      lineup: lineup.length,
      originalReady: originalReadyCount,
      lyricsReady: lyricsReadyCount,
      timedLyrics: timedLyricsCount,
      staticLyrics: staticLyricsCount,
      needsReview: needsReviewCount,
      prompts: promptCount === null ? null : Math.max(0, Number(promptCount || 0)),
    },
  };
};

export const buildNightPlanSummary = ({ room = {}, songs = [], ...readinessOptions } = {}) => {
  const plan = deriveNightPlan(room);
  const experience = getNightExperience(plan.experienceId);
  const hostingLevel = getHostingLevel(plan.hostingLevel);
  const readiness = buildNightReadiness({ room: { ...room, nightPlan: plan }, songs, ...readinessOptions });
  const readinessLabel = readiness.status === 'needs_attention'
    ? `${readiness.blockers.length} item${readiness.blockers.length === 1 ? '' : 's'} need attention`
    : readiness.status === 'ready_with_notes'
      ? 'Ready with notes'
      : 'Ready';
  return {
    plan,
    experience,
    hostingLevel,
    readiness,
    headline: `${experience.label} · ${hostingLevel.label}`,
    sentence: `Tonight is ${experience.label} with ${hostingLevel.label}. ${readinessLabel}.`,
    readinessLabel,
  };
};

export const compileNightPlanToLegacySettings = (value = {}, roomFallback = {}) => {
  const plan = normalizeNightPlan(value, roomFallback);
  const lyricsPolicy = plan.experienceConfig.originalTracks.lyricsPolicy;
  const originalTrackParty = plan.experienceId === NIGHT_EXPERIENCE_IDS.originalTracks;
  return {
    nightPlan: plan,
    autoDj: plan.hostingLevel !== HOSTING_LEVEL_IDS.hostLed,
    performanceMode: originalTrackParty
      ? (lyricsPolicy === ORIGINAL_TRACK_LYRICS_POLICIES.off ? 'lip_sync' : 'sing_along')
      : 'karaoke',
    showLyricsTv: originalTrackParty && lyricsPolicy !== ORIGINAL_TRACK_LYRICS_POLICIES.off,
    autoLyricsOnQueue: originalTrackParty && lyricsPolicy !== ORIGINAL_TRACK_LYRICS_POLICIES.off,
    originalTrackLyricsPolicy: lyricsPolicy,
  };
};
