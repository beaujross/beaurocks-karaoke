export const COHOST_SIGNAL_WINDOW_MS = 10 * 60 * 1000;
export const COHOST_SIGNAL_COOLDOWN_MS = 75 * 1000;

export const COHOST_SIGNAL_OPTIONS = [
  {
    id: 'wrong_backing',
    label: 'Wrong Backing',
    shortLabel: 'Backing',
    hostLabel: 'Wrong backing or lyrics',
    activityText: 'flagged the backing or lyrics for review',
    toastLabel: 'Sent backing note to host.',
    icon: 'fa-compact-disc',
    emoji: '💿',
    tone: 'rose',
    sortOrder: 1,
  },
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
    sortOrder: 2,
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
    sortOrder: 3,
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
    sortOrder: 4,
  },
  {
    id: 'guest_help',
    label: 'Guest Help',
    shortLabel: 'Guest',
    hostLabel: 'Singer or guest needs help',
    activityText: 'flagged a guest who needs host help',
    toastLabel: 'Sent guest-help note to host.',
    icon: 'fa-person-circle-question',
    emoji: '🙋',
    tone: 'cyan',
    sortOrder: 5,
  },
  {
    id: 'next_not_ready',
    label: 'Next Not Ready',
    shortLabel: 'Next',
    hostLabel: 'Next singer is not ready',
    activityText: 'flagged that the next singer is not ready',
    toastLabel: 'Sent readiness note to host.',
    icon: 'fa-user-clock',
    emoji: '⏳',
    tone: 'amber',
    sortOrder: 6,
  },
  {
    id: 'pacing',
    label: 'Dead Air',
    shortLabel: 'Pacing',
    hostLabel: 'Dead air or pacing needs attention',
    activityText: 'flagged dead air or a pacing issue',
    toastLabel: 'Sent pacing note to host.',
    icon: 'fa-forward-step',
    emoji: '⏩',
    tone: 'violet',
    sortOrder: 7,
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
