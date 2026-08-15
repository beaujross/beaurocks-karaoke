import {
  BACKGROUND_AUDIO_SOURCES,
  isAppleBackgroundAudioSource,
  resolveBackgroundAudioSource,
} from './backgroundAudioSource';

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
  activeSource = '',
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
  const appleSessionActive = ['apple_playlist', 'apple_station'].includes(localPlaybackType);
  const configuredAppleId = clean(applePlaylistId || room?.appleMusicAutoPlaylistId);
  const configuredAppleTitle = clean(applePlaylistTitle || room?.appleMusicAutoPlaylistTitle || configuredAppleId);
  const selectedSource = resolveBackgroundAudioSource({
    source: activeSource,
    room,
    applePlaylistId: configuredAppleId || clean(applePendingId),
  });
  const appleSourceSelected = isAppleBackgroundAudioSource(selectedSource);
  const pendingAppleId = clean(applePendingId);
  const selectedLocalId = clean(localTrackId || localPlayback.id);
  const selectedLocalTitle = clean(localTrackTitle || localPlayback.title);
  const message = clean(statusMessage);
  const errorMessage = /could not|failed|invalid|unavailable|not configured/i.test(message) ? message : '';
  const applePlaybackActive = ['playlist', 'station'].includes(playbackType) && ['playing', 'paused'].includes(playbackStatus);
  const heartbeatAtMs = Number(playback.lastHeartbeatAt || playback.lastReportedAt || 0);
  const heartbeatAgeMs = heartbeatAtMs > 0 ? Math.max(0, Number(nowMs || Date.now()) - heartbeatAtMs) : 0;
  const applePlaybackStale = playbackStatus === 'playing' && heartbeatAtMs > 0 && heartbeatAgeMs > Math.max(5000, Number(staleHeartbeatMs || 45000));

  if (appleSourceSelected && appleSessionActive) {
    const sessionSourceLabel = clean(localPlayback.trackTitle || localPlayback.title || configuredAppleTitle) || 'Apple Music soundtrack';
    if (localPlaybackStatus === 'paused_performance' || (performanceActive && localPlaybackStatus === 'playing')) {
      return {
        key: 'interrupted',
        label: 'Paused for Performance',
        detail: localPlayback.desiredState === 'paused'
          ? 'The soundtrack will stay paused when this performance ends.'
          : 'The soundtrack will continue from this track when the performance ends.',
        sourceType: 'apple',
        sourceLabel: sessionSourceLabel,
        tone: 'deferred',
        actionKey: '',
        actionLabel: '',
      };
    }
    if (localPlaybackStatus === 'restoring') {
      return { key: 'restoring', label: 'Restoring Soundtrack', detail: 'Apple Music is returning to the interrupted playlist position.', sourceType: 'apple', sourceLabel: sessionSourceLabel, tone: 'working', actionKey: '', actionLabel: '' };
    }
    if (localPlaybackStatus === 'error') {
      return { key: 'error', label: 'Soundtrack Needs Attention', detail: clean(localPlayback.reason) || 'Apple Music could not restore the saved soundtrack.', sourceType: 'apple', sourceLabel: sessionSourceLabel, tone: 'error', actionKey: 'retry_apple', actionLabel: 'Retry Soundtrack' };
    }
    if (localPlaybackStatus === 'paused_host') {
      return { key: 'paused', label: 'Paused by Host', detail: 'The soundtrack will remain paused until the Host resumes it.', sourceType: 'apple', sourceLabel: sessionSourceLabel, tone: 'paused', actionKey: 'resume_apple', actionLabel: 'Resume Background' };
    }
  }

  if (appleSourceSelected && applePlaybackActive && !applePlaybackStale) {
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
  if (appleSourceSelected && applePlaybackStale) {
    return { key: 'stale', label: 'Playback Confirmation Lost', detail: 'Apple Music stopped reporting playback. Retry to confirm the room is audible.', sourceType: 'apple', sourceLabel: clean(playback.title || configuredAppleTitle) || 'Apple Music soundtrack', tone: 'error', actionKey: 'retry_apple', actionLabel: 'Retry Apple Music', heartbeatAgeMs };
  }
  if (appleSourceSelected && pendingAppleId) {
    return { key: 'starting', label: 'Starting Background', detail: 'Waiting for Apple Music to confirm audible playback.', sourceType: 'apple', sourceLabel: configuredAppleTitle || pendingAppleId, tone: 'working', actionKey: '', actionLabel: '' };
  }
  if (!appleSourceSelected && localPlaybackType === 'local_upload' && localPlaybackStatus === 'playing') {
    return { key: 'playing', label: 'Background Playing', detail: 'The Host device confirmed audible playback.', sourceType: 'local', sourceLabel: selectedLocalTitle || 'Room upload', tone: 'ready', actionKey: 'pause_local', actionLabel: 'Pause Background' };
  }
  if (!appleSourceSelected && localPlaybackType === 'local_upload' && localPlaybackStatus === 'starting') {
    return { key: 'starting', label: 'Starting Background', detail: 'Waiting for the Host device to confirm audible playback.', sourceType: 'local', sourceLabel: selectedLocalTitle || 'Room upload', tone: 'working', actionKey: '', actionLabel: '' };
  }
  if (errorMessage) {
    return appleSourceSelected
      ? { key: 'error', label: 'Apple Music Needs Attention', detail: errorMessage, sourceType: 'apple', sourceLabel: configuredAppleTitle || 'Apple Music soundtrack', tone: 'error', actionKey: configuredAppleId ? 'retry_apple' : 'connect_apple', actionLabel: configuredAppleId ? 'Retry Apple Music' : 'Connect Apple Music' }
      : { key: 'error', label: 'Background Needs Attention', detail: errorMessage, sourceType: 'local', sourceLabel: selectedLocalTitle || 'BeauRocks Loop', tone: 'error', actionKey: selectedLocalId ? 'start_local' : '', actionLabel: selectedLocalId ? 'Retry Background' : '' };
  }
  if (!appleSourceSelected && localPlaybackType === 'local_upload' && ['blocked', 'error'].includes(localPlaybackStatus)) {
    const blocked = localPlaybackStatus === 'blocked';
    return { key: localPlaybackStatus, label: blocked ? 'Playback Blocked' : 'Background Needs Attention', detail: clean(localPlayback.reason) || 'The Host device could not start this background file.', sourceType: 'local', sourceLabel: selectedLocalTitle || 'Room upload', tone: 'error', actionKey: 'start_local', actionLabel: 'Retry Upload' };
  }
  if (performanceActive && room?.autoBgMusic) {
    return { key: 'deferred', label: 'Ready After Performance', detail: 'Background audio will start when the current performance ends.', sourceType: appleSourceSelected ? 'apple' : 'local', sourceLabel: appleSourceSelected ? (configuredAppleTitle || 'Apple Music soundtrack') : (selectedLocalTitle || 'BeauRocks Loop'), tone: 'deferred', actionKey: '', actionLabel: '' };
  }
  if (appleSourceSelected && configuredAppleId && !appleAuthorized) {
    return { key: 'needs_connection', label: 'Connect Apple Music', detail: 'Reconnect Apple Music before this room soundtrack can become audible.', sourceType: 'apple', sourceLabel: configuredAppleTitle || configuredAppleId, tone: 'error', actionKey: 'connect_apple', actionLabel: 'Connect Apple Music' };
  }
  if (!appleSourceSelected && room?.bgMusicPlaying && selectedLocalId) {
    return { key: 'playing', label: 'Background Playing', detail: 'The selected room upload is reported as playing.', sourceType: 'local', sourceLabel: selectedLocalTitle || 'Room upload', tone: 'ready', actionKey: 'pause_local', actionLabel: 'Pause Background' };
  }
  if (appleSourceSelected && configuredAppleId) {
    return { key: 'ready', label: 'Background Ready', detail: 'The Apple Music source is selected and can start now.', sourceType: 'apple', sourceLabel: configuredAppleTitle || configuredAppleId, tone: 'ready', actionKey: 'retry_apple', actionLabel: 'Start Apple Music' };
  }
  if (selectedSource === BACKGROUND_AUDIO_SOURCES.beaurocks) {
    return { key: 'ready', label: 'BeauRocks Loop Ready', detail: 'Turn on Auto BG or press play to start the room loop.', sourceType: 'local', sourceLabel: selectedLocalTitle || 'BeauRocks Loop', tone: 'ready', actionKey: selectedLocalId ? 'start_local' : '', actionLabel: selectedLocalId ? 'Start Background' : '' };
  }
  return { key: 'off', label: 'Choose an Apple Soundtrack', detail: 'Select an Apple Music playlist or recent station, or switch to the BeauRocks Loop.', sourceType: 'apple', sourceLabel: '', tone: 'idle', actionKey: appleAuthorized ? '' : 'connect_apple', actionLabel: appleAuthorized ? '' : 'Connect Apple Music' };
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
