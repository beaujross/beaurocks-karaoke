const clean = (value = '') => String(value || '').trim();

const getPlaybackFailureReason = (error = null) => {
  const name = clean(error?.name).toLowerCase();
  const message = clean(error?.message || error);
  if (name === 'notallowederror' || /user gesture|not allowed|permission/i.test(message)) {
    return 'Browser playback is blocked. Use Start Background once to allow audio on this device.';
  }
  if (name === 'notsupportederror' || /not supported|unsupported|no supported source/i.test(message)) {
    return 'This background file cannot be played by this browser.';
  }
  if (/network|fetch|load|decode|media/i.test(message)) {
    return 'The background file could not be loaded. Check the file or connection and retry.';
  }
  return message || 'Background audio could not start. Retry from the Host controls.';
};

export const startBackgroundAudioElement = async (audio = null, { url = '' } = {}) => {
  if (!audio || typeof audio.play !== 'function') {
    return {
      ok: false,
      status: 'blocked',
      reason: 'Background playback is unavailable on this Host device.',
    };
  }

  const nextUrl = clean(url);
  try {
    if (nextUrl && clean(audio.src) !== nextUrl) audio.src = nextUrl;
    await audio.play();
    if (audio.paused === true) {
      return {
        ok: false,
        status: 'blocked',
        reason: 'The browser did not confirm audible background playback. Use Start Background to retry.',
      };
    }
    return { ok: true, status: 'playing', reason: '' };
  } catch (error) {
    return {
      ok: false,
      status: clean(error?.name).toLowerCase() === 'notallowederror' ? 'blocked' : 'error',
      reason: getPlaybackFailureReason(error),
    };
  }
};

export const buildLocalBackgroundPlayback = ({
  track = {},
  status = 'paused',
  reason = '',
  nowMs = Date.now(),
} = {}) => {
  const normalizedStatus = clean(status).toLowerCase();
  return {
    type: 'local_upload',
    id: clean(track?.id || track?.uploadId),
    title: clean(track?.name || track?.title) || 'Room upload',
    url: clean(track?.url || track?.mediaUrl),
    status: ['starting', 'playing', 'paused', 'blocked', 'error'].includes(normalizedStatus)
      ? normalizedStatus
      : 'paused',
    reason: clean(reason),
    lastReportedAt: Math.max(0, Number(nowMs || Date.now()) || Date.now()),
  };
};

export const getBackgroundStageTransition = ({
  performanceActive = false,
  backgroundActive = false,
  autoBackgroundEnabled = false,
} = {}) => {
  if (performanceActive && backgroundActive && autoBackgroundEnabled) {
    return { action: 'pause', restoreAfterPerformance: true };
  }
  if (!performanceActive && !backgroundActive && autoBackgroundEnabled) {
    return { action: 'restore', restoreAfterPerformance: false };
  }
  return { action: 'none', restoreAfterPerformance: false };
};
