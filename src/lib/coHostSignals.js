export const COHOST_SIGNAL_WINDOW_MS = 10 * 60 * 1000;
export const COHOST_SIGNAL_COOLDOWN_MS = 75 * 1000;

export const COHOST_SIGNAL_OPTIONS = [
  {
    id: 'track_up',
    label: 'Track Up',
    shortLabel: 'Track Up',
    hostLabel: 'Track needs a bump',
    activityText: 'flagged that the backing track should come up',
    toastLabel: 'Sent track-up note to host.',
    icon: 'fa-wave-square',
    emoji: '🎛️',
    tone: 'amber',
    sortOrder: 1,
  },
  {
    id: 'track_down',
    label: 'Track Down',
    shortLabel: 'Track Down',
    hostLabel: 'Track needs a trim',
    activityText: 'flagged that the backing track should come down',
    toastLabel: 'Sent track-down note to host.',
    icon: 'fa-wave-square',
    emoji: '🎚️',
    tone: 'sky',
    sortOrder: 2,
  },
  {
    id: 'vocal_up',
    label: 'Vocal Up',
    shortLabel: 'Vocal Up',
    hostLabel: 'Vocals need a bump',
    activityText: 'flagged that the vocals should come up',
    toastLabel: 'Sent vocal-up note to host.',
    icon: 'fa-microphone-lines',
    emoji: '🎤',
    tone: 'emerald',
    sortOrder: 3,
  },
  {
    id: 'vocal_down',
    label: 'Vocal Down',
    shortLabel: 'Vocal Down',
    hostLabel: 'Vocals need a trim',
    activityText: 'flagged that the vocals should come down',
    toastLabel: 'Sent vocal-down note to host.',
    icon: 'fa-microphone-lines-slash',
    emoji: '🔉',
    tone: 'rose',
    sortOrder: 4,
  },
  {
    id: 'mix_issue',
    label: 'Mix Issue',
    shortLabel: 'Mix Issue',
    hostLabel: 'Mix issue',
    activityText: 'flagged a broader mix issue in the room',
    toastLabel: 'Sent mix note to host.',
    icon: 'fa-sliders',
    emoji: '⚠️',
    tone: 'violet',
    sortOrder: 5,
  },
];

export const normalizeCoHostSignalId = (value = '') => String(value || '').trim().toLowerCase();

export const getCoHostSignalMeta = (signalId = '') =>
  COHOST_SIGNAL_OPTIONS.find((entry) => entry.id === normalizeCoHostSignalId(signalId)) || null;

export const isCoHostSignalActivity = (entry = {}) =>
  String(entry?.type || '').trim().toLowerCase() === 'cohost_signal'
  && !!getCoHostSignalMeta(entry?.signalId);
