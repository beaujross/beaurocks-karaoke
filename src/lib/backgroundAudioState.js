const clean = (value = '') => String(value || '').trim();

export const getBackgroundAudioCapability = ({ sourceType = 'none', appleAuthorized = false } = {}) => {
  const source = clean(sourceType).toLowerCase();
  if (source === 'local' || source === 'local_upload' || source === 'upload') {
    return { key: 'host_playback', label: 'Plays on Host device', detail: 'Uploaded audio uses this Host device audio output.' };
  }
  if (source === 'apple' || source === 'apple_music') {
    return appleAuthorized
      ? { key: 'connected_host_playback', label: 'Connected Host playback', detail: 'Apple Music plays through the connected Host MusicKit session.' }
      : { key: 'connection_required', label: 'Connection required', detail: 'Apple Music playback requires the Host to connect and authorize MusicKit.' };
  }
  if (source === 'youtube') {
    return { key: 'embeddable_stage_media', label: 'Embeddable stage media', detail: 'YouTube playback remains stage media and requires an embeddable result.' };
  }
  if (source === 'spotify') {
    return { key: 'external_only', label: 'Discovery / handoff only', detail: 'Spotify is not represented as authorized in-app playback.' };
  }
  return { key: 'content_agnostic', label: 'Content-agnostic sources', detail: 'Uploads and connected Apple Music can play here; YouTube stage media and Spotify discovery keep their own capabilities.' };
};

export const deriveBackgroundAudioState = ({
  room = {},
  performanceActive = false,
  appleAuthorized = false,
  applePendingId = '',
  applePlaylistId = '',
  applePlaylistTitle = '',
  localTrackId = '',
  localTrackTitle = '',
  statusMessage = '',
  nowMs = Date.now(),
  staleHeartbeatMs = 45000,
} = {}) => {
  const playback = room?.appleMusicPlayback && typeof room.appleMusicPlayback === 'object' ? room.appleMusicPlayback : {};
  const localPlayback = room?.backgroundAudioPlayback && typeof room.backgroundAudioPlayback === 'object' ? room.backgroundAudioPlayback : {};
  const playbackType = clean(playback.type).toLowerCase();
  const playbackStatus = clean(playback.status).toLowerCase();
  const localPlaybackType = clean(localPlayback.type).toLowerCase();
  const localPlaybackStatus = clean(localPlayback.status).toLowerCase();
  const configuredAppleId = clean(applePlaylistId || room?.appleMusicAutoPlaylistId);
  const configuredAppleTitle = clean(applePlaylistTitle || room?.appleMusicAutoPlaylistTitle || configuredAppleId);
  const pendingAppleId = clean(applePendingId);
  const selectedLocalId = clean(localTrackId || localPlayback.id);
  const selectedLocalTitle = clean(localTrackTitle || localPlayback.title);
  const message = clean(statusMessage);
  const errorMessage = /could not|failed|invalid|unavailable|not configured/i.test(message) ? message : '';
  const applePlaybackActive = ['playlist', 'station'].includes(playbackType) && ['playing', 'paused'].includes(playbackStatus);
  const heartbeatAtMs = Number(playback.lastHeartbeatAt || playback.lastReportedAt || 0);
  const heartbeatAgeMs = heartbeatAtMs > 0 ? Math.max(0, Number(nowMs || Date.now()) - heartbeatAtMs) : 0;
  const applePlaybackStale = playbackStatus === 'playing' && heartbeatAtMs > 0 && heartbeatAgeMs > Math.max(5000, Number(staleHeartbeatMs || 45000));

  if (applePlaybackActive && !applePlaybackStale) {
    const playing = playbackStatus === 'playing';
    return {
      key: playing ? 'playing' : 'paused',
      label: playing ? 'Background Playing' : 'Background Paused',
      detail: playing ? 'Apple Music is audible in the room.' : 'Apple Music is selected and paused.',
      sourceType: 'apple',
      sourceLabel: clean(playback.title || configuredAppleTitle) || 'Apple Music soundtrack',
      tone: playing ? 'ready' : 'paused',
      actionKey: playing ? 'pause_apple' : 'resume_apple', actionLabel: playing ? 'Pause Background' : 'Resume Background',
    };
  }
  if (applePlaybackStale) {
    return { key: 'stale', label: 'Playback Confirmation Lost', detail: 'Apple Music stopped reporting playback. Retry to confirm the room is audible.', sourceType: 'apple', sourceLabel: clean(playback.title || configuredAppleTitle) || 'Apple Music soundtrack', tone: 'error', actionKey: 'retry_apple', actionLabel: 'Retry Apple Music', heartbeatAgeMs };
  }
  if (pendingAppleId) {
    return { key: 'starting', label: 'Starting Background', detail: 'Waiting for Apple Music to confirm audible playback.', sourceType: 'apple', sourceLabel: configuredAppleTitle || pendingAppleId, tone: 'working', actionKey: '', actionLabel: '' };
  }
  if (localPlaybackType === 'local_upload' && localPlaybackStatus === 'playing') {
    return { key: 'playing', label: 'Background Playing', detail: 'The Host device confirmed audible playback.', sourceType: 'local', sourceLabel: selectedLocalTitle || 'Room upload', tone: 'ready', actionKey: 'pause_local', actionLabel: 'Pause Background' };
  }
  if (localPlaybackType === 'local_upload' && localPlaybackStatus === 'starting') {
    return { key: 'starting', label: 'Starting Background', detail: 'Waiting for the Host device to confirm audible playback.', sourceType: 'local', sourceLabel: selectedLocalTitle || 'Room upload', tone: 'working', actionKey: '', actionLabel: '' };
  }
  if (errorMessage) {
    return { key: 'error', label: 'Background Needs Attention', detail: errorMessage, sourceType: configuredAppleId ? 'apple' : selectedLocalId ? 'local' : 'none', sourceLabel: configuredAppleTitle || selectedLocalTitle || 'Background audio', tone: 'error', actionKey: configuredAppleId ? 'retry_apple' : selectedLocalId ? 'start_local' : '', actionLabel: configuredAppleId ? 'Retry Apple Music' : selectedLocalId ? 'Start Upload' : '' };
  }
  if (localPlaybackType === 'local_upload' && ['blocked', 'error'].includes(localPlaybackStatus)) {
    const blocked = localPlaybackStatus === 'blocked';
    return { key: localPlaybackStatus, label: blocked ? 'Playback Blocked' : 'Background Needs Attention', detail: clean(localPlayback.reason) || 'The Host device could not start this background file.', sourceType: 'local', sourceLabel: selectedLocalTitle || 'Room upload', tone: 'error', actionKey: 'start_local', actionLabel: 'Retry Upload' };
  }
  if (performanceActive && room?.autoBgMusic && (configuredAppleId || selectedLocalId)) {
    return { key: 'deferred', label: 'Ready After Performance', detail: 'Background audio will start when the current performance ends.', sourceType: configuredAppleId ? 'apple' : 'local', sourceLabel: configuredAppleTitle || selectedLocalTitle || 'Selected background', tone: 'deferred', actionKey: '', actionLabel: '' };
  }
  if (configuredAppleId && !appleAuthorized) {
    return { key: 'needs_connection', label: 'Connect Apple Music', detail: 'Reconnect Apple Music before this room soundtrack can become audible.', sourceType: 'apple', sourceLabel: configuredAppleTitle || configuredAppleId, tone: 'error', actionKey: 'connect_apple', actionLabel: 'Connect Apple Music' };
  }
  if (room?.bgMusicPlaying && selectedLocalId) {
    return { key: 'playing', label: 'Background Playing', detail: 'The selected room upload is reported as playing.', sourceType: 'local', sourceLabel: selectedLocalTitle || 'Room upload', tone: 'ready', actionKey: 'pause_local', actionLabel: 'Pause Background' };
  }
  if (configuredAppleId || selectedLocalId) {
    return { key: 'ready', label: 'Background Ready', detail: 'The source is selected and can start now.', sourceType: configuredAppleId ? 'apple' : 'local', sourceLabel: configuredAppleTitle || selectedLocalTitle || 'Selected background', tone: 'ready', actionKey: configuredAppleId ? 'retry_apple' : 'start_local', actionLabel: configuredAppleId ? 'Start Apple Music' : 'Start Upload' };
  }
  return { key: 'off', label: 'No Background Selected', detail: 'Choose an Apple playlist, recent station, or room upload.', sourceType: 'none', sourceLabel: '', tone: 'idle', actionKey: '', actionLabel: '' };
};

export const buildBackgroundAudioQaSnapshot = (state = {}) => {
  const sourceType = clean(state.sourceType) || 'none';
  const capability = getBackgroundAudioCapability({
    sourceType,
    appleAuthorized: sourceType !== 'apple' || clean(state.key) !== 'needs_connection',
  });
  return {
    key: clean(state.key) || 'unknown',
    label: clean(state.label),
    sourceType,
    sourceLabel: clean(state.sourceLabel),
    tone: clean(state.tone) || 'idle',
    actionKey: clean(state.actionKey),
    heartbeatAgeMs: Math.max(0, Number(state.heartbeatAgeMs || 0)),
    capabilityKey: capability.key,
    capabilityLabel: capability.label,
  };
};
