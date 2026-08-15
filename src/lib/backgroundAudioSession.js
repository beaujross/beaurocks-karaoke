export const BACKGROUND_AUDIO_SESSION_VERSION = 2;

export const BACKGROUND_AUDIO_SESSION_TYPES = Object.freeze({
  localUpload: 'local_upload',
  applePlaylist: 'apple_playlist',
  appleStation: 'apple_station',
});

export const BACKGROUND_AUDIO_SESSION_STATUSES = Object.freeze({
  starting: 'starting',
  playing: 'playing',
  pausedHost: 'paused_host',
  pausedPerformance: 'paused_performance',
  restoring: 'restoring',
  ended: 'ended',
  blocked: 'blocked',
  error: 'error',
});

const clean = (value = '') => String(value || '').trim();
const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const isAppleBackgroundSession = (session = null) => (
  session?.type === BACKGROUND_AUDIO_SESSION_TYPES.applePlaylist
  || session?.type === BACKGROUND_AUDIO_SESSION_TYPES.appleStation
);

export const isPerformanceInterruptedBackgroundSession = (session = null) => (
  isAppleBackgroundSession(session)
  && session?.status === BACKGROUND_AUDIO_SESSION_STATUSES.pausedPerformance
);

export const buildAppleBackgroundSession = ({
  existing = null,
  playback = null,
  snapshot = null,
  playlistId = '',
  title = '',
  sourceType = '',
  status = BACKGROUND_AUDIO_SESSION_STATUSES.playing,
  desiredState = 'playing',
  interruptionReason = '',
  performanceSessionId = '',
  sourceRevision = 0,
  now = Date.now(),
} = {}) => {
  const previous = isAppleBackgroundSession(existing) ? existing : {};
  const resolvedSourceType = clean(sourceType || previous.sourceType || playback?.type).toLowerCase();
  const station = resolvedSourceType.includes('station')
    || clean(playlistId || previous.id || playback?.id).startsWith('ra.');
  const normalizedStatus = clean(status || previous.status || BACKGROUND_AUDIO_SESSION_STATUSES.playing).toLowerCase();
  const next = {
    version: BACKGROUND_AUDIO_SESSION_VERSION,
    type: station ? BACKGROUND_AUDIO_SESSION_TYPES.appleStation : BACKGROUND_AUDIO_SESSION_TYPES.applePlaylist,
    provider: 'apple_music',
    id: clean(playlistId || previous.id || playback?.id),
    title: clean(title || previous.title || playback?.title),
    sourceType: resolvedSourceType || (station ? 'station' : 'playlist'),
    status: normalizedStatus,
    desiredState: desiredState === 'paused' ? 'paused' : 'playing',
    trackId: clean(snapshot?.trackId || previous.trackId || playback?.trackId),
    trackTitle: clean(snapshot?.trackTitle || previous.trackTitle || playback?.trackTitle),
    artist: clean(snapshot?.artist || previous.artist || playback?.trackArtist || playback?.artist),
    artworkUrl: clean(snapshot?.artworkUrl || previous.artworkUrl || playback?.artworkUrl),
    queueIndex: Math.max(0, Math.round(finite(snapshot?.queueIndex, finite(previous.queueIndex, finite(playback?.queueIndex, 0))))),
    queueLength: Math.max(0, Math.round(finite(snapshot?.queueLength, finite(previous.queueLength, finite(playback?.queueLength, 0))))),
    positionSec: Math.max(0, Math.round(finite(snapshot?.currentTimeSec, finite(previous.positionSec, finite(playback?.positionSec, 0))) * 10) / 10),
    shuffleMode: clean(snapshot?.shuffleMode || previous.shuffleMode),
    repeatMode: clean(snapshot?.repeatMode || previous.repeatMode),
    interruptionReason: clean(interruptionReason),
    performanceSessionId: clean(performanceSessionId),
    sourceRevision: Math.max(1, Math.round(finite(sourceRevision, finite(previous.sourceRevision, 0) || Number(now) || 1))),
    transportRole: normalizedStatus === BACKGROUND_AUDIO_SESSION_STATUSES.pausedPerformance ? 'performance' : 'background',
    reason: normalizedStatus === BACKGROUND_AUDIO_SESSION_STATUSES.error ? clean(previous.reason) : '',
    errorCode: normalizedStatus === BACKGROUND_AUDIO_SESSION_STATUSES.error ? clean(previous.errorCode) : '',
    lastReportedAt: Math.max(0, Math.round(finite(now, Date.now()))),
  };
  return next;
};

export const interruptAppleBackgroundSession = ({
  existing = null,
  playback = null,
  snapshot = null,
  playlistId = '',
  title = '',
  sourceType = '',
  performanceSessionId = '',
  now = Date.now(),
} = {}) => {
  const sameInterruption = isPerformanceInterruptedBackgroundSession(existing)
    && clean(existing.performanceSessionId) === clean(performanceSessionId);
  if (sameInterruption) return existing;

  return buildAppleBackgroundSession({
    existing,
    playback,
    snapshot,
    playlistId,
    title,
    sourceType,
    status: BACKGROUND_AUDIO_SESSION_STATUSES.pausedPerformance,
    desiredState: existing?.desiredState === 'paused' ? 'paused' : 'playing',
    interruptionReason: 'performance',
    performanceSessionId,
    sourceRevision: finite(existing?.sourceRevision, 0) || Number(now),
    now,
  });
};

export const markAppleBackgroundHostPaused = ({ session = null, playback = null, snapshot = null, now = Date.now() } = {}) => (
  buildAppleBackgroundSession({
    existing: session,
    playback,
    snapshot,
    status: BACKGROUND_AUDIO_SESSION_STATUSES.pausedHost,
    desiredState: 'paused',
    sourceRevision: finite(session?.sourceRevision, 0) || Number(now),
    now,
  })
);

export const markAppleBackgroundRestoring = ({ session = null, now = Date.now() } = {}) => (
  buildAppleBackgroundSession({
    existing: session,
    status: BACKGROUND_AUDIO_SESSION_STATUSES.restoring,
    desiredState: session?.desiredState,
    interruptionReason: session?.interruptionReason,
    performanceSessionId: session?.performanceSessionId,
    sourceRevision: session?.sourceRevision,
    now,
  })
);

export const markAppleBackgroundRestored = ({ session = null, snapshot = null, now = Date.now() } = {}) => (
  buildAppleBackgroundSession({
    existing: session,
    snapshot,
    status: session?.desiredState === 'paused'
      ? BACKGROUND_AUDIO_SESSION_STATUSES.pausedHost
      : BACKGROUND_AUDIO_SESSION_STATUSES.playing,
    desiredState: session?.desiredState,
    interruptionReason: '',
    performanceSessionId: '',
    sourceRevision: session?.sourceRevision,
    now,
  })
);

export const markAppleBackgroundError = ({ session = null, error = null, now = Date.now() } = {}) => ({
  ...buildAppleBackgroundSession({
    existing: session,
    status: BACKGROUND_AUDIO_SESSION_STATUSES.error,
    desiredState: session?.desiredState,
    interruptionReason: session?.interruptionReason,
    performanceSessionId: session?.performanceSessionId,
    sourceRevision: session?.sourceRevision,
    now,
  }),
  reason: clean(error?.message || 'Apple Music background playback needs attention.'),
  errorCode: clean(error?.code || 'apple_background_restore_failed'),
});
