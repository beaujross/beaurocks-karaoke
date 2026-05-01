export const COHOST_SIGNAL_WINDOW_MS = 10 * 60 * 1000;
export const COHOST_SIGNAL_COOLDOWN_MS = 75 * 1000;

export const COHOST_SIGNAL_OPTIONS = [
  {
    id: 'track_issue',
    label: 'Track Issue',
    shortLabel: 'Track',
    hostLabel: 'Track level issue',
    activityText: 'flagged an issue with the backing track level',
    toastLabel: 'Sent track note to host.',
    icon: 'fa-wave-square',
    emoji: '🎛️',
    tone: 'amber',
    sortOrder: 1,
  },
  {
    id: 'vocal_issue',
    label: 'Vocal Issue',
    shortLabel: 'Vocals',
    hostLabel: 'Vocal level issue',
    activityText: 'flagged an issue with the vocal level',
    toastLabel: 'Sent vocal note to host.',
    icon: 'fa-microphone-lines',
    emoji: '🎤',
    tone: 'emerald',
    sortOrder: 2,
  },
  {
    id: 'mix_issue',
    label: 'Mix Issue',
    shortLabel: 'Mix',
    hostLabel: 'Mix issue',
    activityText: 'flagged a broader mix issue in the room',
    toastLabel: 'Sent mix note to host.',
    icon: 'fa-sliders',
    emoji: '⚠️',
    tone: 'violet',
    sortOrder: 3,
  },
];

export const normalizeCoHostSignalId = (value = '') => {
  const safeValue = String(value || '').trim().toLowerCase();
  if (safeValue === 'track_up' || safeValue === 'track_down') return 'track_issue';
  if (safeValue === 'vocal_up' || safeValue === 'vocal_down') return 'vocal_issue';
  return safeValue;
};

export const getCoHostSignalMeta = (signalId = '') =>
  COHOST_SIGNAL_OPTIONS.find((entry) => entry.id === normalizeCoHostSignalId(signalId)) || null;

export const isCoHostSignalActivity = (entry = {}) =>
  String(entry?.type || '').trim().toLowerCase() === 'cohost_signal'
  && !!getCoHostSignalMeta(entry?.signalId);
