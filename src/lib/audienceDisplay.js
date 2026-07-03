import { EMOJI, emoji } from './emoji';

export const AUDIENCE_DISPLAY_MODES = Object.freeze({
  off: 'off',
  commentatorRow: 'commentator_row',
  lobbyWall: 'lobby_wall',
  judgesPanel: 'judges_panel',
  featuredGuest: 'featured_guest',
});

export const AUDIENCE_DISPLAY_ROLE_SOURCES = Object.freeze({
  manual: 'manual',
  coHosts: 'cohosts',
  judges: 'judges',
  mostActive: 'most_active',
  random: 'random',
});

export const AUDIENCE_DISPLAY_MODE_OPTIONS = Object.freeze([
  {
    id: AUDIENCE_DISPLAY_MODES.off,
    label: 'Off',
    shortLabel: 'Off',
    description: 'Keep the audience off the Public TV layer.',
  },
  {
    id: AUDIENCE_DISPLAY_MODES.commentatorRow,
    label: 'Commentator Row',
    shortLabel: 'Row',
    description: 'Cast selected guests along the bottom of Public TV with their reactions.',
  },
  {
    id: AUDIENCE_DISPLAY_MODES.lobbyWall,
    label: 'Lobby Wall',
    shortLabel: 'Wall',
    description: 'Use the whole room as an idle or dead-air audience visual.',
  },
  {
    id: AUDIENCE_DISPLAY_MODES.judgesPanel,
    label: 'Judges Panel',
    shortLabel: 'Judges',
    description: 'Reserve a visible panel for judges and competitive moments.',
  },
  {
    id: AUDIENCE_DISPLAY_MODES.featuredGuest,
    label: 'Featured Guest',
    shortLabel: 'Guest',
    description: 'Use the existing audience spotlight as the main TV audience moment.',
  },
]);

const AUDIENCE_DISPLAY_COMMENTATOR_REACTIONS = Object.freeze([
  { type: 'commentator_hot_take', label: 'Hot Take', shortLabel: 'TAKE', iconClass: 'fa-brain', tvToken: 'TAKE', accentClass: 'border-amber-300/45 bg-amber-500/15 text-amber-50' },
  { type: 'commentator_callback', label: 'Callback', shortLabel: 'CALL', iconClass: 'fa-reply', tvToken: 'CALL', accentClass: 'border-sky-300/45 bg-sky-500/15 text-sky-50' },
  { type: 'commentator_vibe_check', label: 'Vibe Check', shortLabel: 'VIBE', iconClass: 'fa-wave-square', tvToken: 'VIBE', accentClass: 'border-lime-300/45 bg-lime-500/15 text-lime-50' },
  { type: 'commentator_wow', label: 'Wow', shortLabel: 'WOW', iconClass: 'fa-wand-magic-sparkles', tvToken: 'WOW', accentClass: 'border-fuchsia-300/45 bg-fuchsia-500/15 text-fuchsia-50' },
]);
const uniqueCleanList = (values = []) => {
  const seen = new Set();
  const output = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    const safeValue = String(value || '').trim();
    if (!safeValue || seen.has(safeValue)) return;
    seen.add(safeValue);
    output.push(safeValue);
  });
  return output;
};

export const normalizeAudienceDisplayMode = (value = '') => {
  const key = String(value || '').trim().toLowerCase();
  return Object.values(AUDIENCE_DISPLAY_MODES).includes(key)
    ? key
    : AUDIENCE_DISPLAY_MODES.off;
};

export const normalizeAudienceDisplayRoleSource = (value = '') => {
  const key = String(value || '').trim().toLowerCase();
  return Object.values(AUDIENCE_DISPLAY_ROLE_SOURCES).includes(key)
    ? key
    : AUDIENCE_DISPLAY_ROLE_SOURCES.manual;
};

export const getAudienceDisplayModeMeta = (mode = '') => (
  AUDIENCE_DISPLAY_MODE_OPTIONS.find((option) => option.id === normalizeAudienceDisplayMode(mode))
  || AUDIENCE_DISPLAY_MODE_OPTIONS[0]
);


export const getAudienceDisplayCommentatorReactions = () => AUDIENCE_DISPLAY_COMMENTATOR_REACTIONS;

export const getAudienceDisplayCommentatorReactionMeta = (type = '') => {
  const key = String(type || '').trim().toLowerCase();
  return AUDIENCE_DISPLAY_COMMENTATOR_REACTIONS.find((reaction) => reaction.type === key) || null;
};

export const getAudienceDisplayCommentatorReactionEmoji = (type = '') => ({
  commentator_hot_take: emoji(0x1F9E0),
  commentator_callback: EMOJI.radio,
  commentator_vibe_check: emoji(0x1F4AF),
  commentator_wow: emoji(0x1F929),
}[String(type || '').trim().toLowerCase()] || EMOJI.sparkle);
export const normalizeAudienceDisplay = (source = {}, { nowMs = Date.now() } = {}) => {
  const safeSource = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const mode = normalizeAudienceDisplayMode(safeSource.mode);
  const maxVisible = Math.max(1, Math.min(8, Math.round(Number(safeSource.maxVisible || 4) || 4)));
  const selectedUids = uniqueCleanList(safeSource.selectedUids).slice(0, maxVisible);
  const expiresAtMs = Math.max(0, Number(safeSource.expiresAtMs || 0) || 0);
  const expired = expiresAtMs > 0 && expiresAtMs <= nowMs;
  if (mode === AUDIENCE_DISPLAY_MODES.off || expired) {
    return {
      mode: AUDIENCE_DISPLAY_MODES.off,
      sessionId: '',
      selectedUids: [],
      roleSource: AUDIENCE_DISPLAY_ROLE_SOURCES.manual,
      maxVisible,
      showReactions: false,
      startedAtMs: 0,
      expiresAtMs: 0,
    };
  }
  return {
    mode,
    sessionId: String(safeSource.sessionId || `audience_display_${mode}_${nowMs}`),
    selectedUids,
    roleSource: normalizeAudienceDisplayRoleSource(safeSource.roleSource),
    maxVisible,
    showReactions: safeSource.showReactions !== false,
    startedAtMs: Math.max(0, Number(safeSource.startedAtMs || nowMs) || nowMs),
    expiresAtMs,
  };
};

export const buildAudienceDisplayPatch = ({
  current = {},
  mode,
  selectedUids,
  roleSource,
  maxVisible,
  showReactions,
  expiresAtMs,
  nowMs = Date.now(),
} = {}) => {
  const previous = normalizeAudienceDisplay(current, { nowMs });
  const nextMode = normalizeAudienceDisplayMode(mode ?? previous.mode);
  const nextSelectedUids = selectedUids === undefined ? previous.selectedUids : uniqueCleanList(selectedUids);
  const next = normalizeAudienceDisplay({
    ...previous,
    mode: nextMode,
    sessionId: nextMode === previous.mode && previous.sessionId
      ? previous.sessionId
      : `audience_display_${nextMode}_${nowMs}`,
    selectedUids: nextSelectedUids,
    roleSource: roleSource === undefined ? previous.roleSource : roleSource,
    maxVisible: maxVisible === undefined ? previous.maxVisible : maxVisible,
    showReactions: showReactions === undefined ? previous.showReactions : showReactions,
    startedAtMs: nextMode === previous.mode && previous.startedAtMs ? previous.startedAtMs : nowMs,
    expiresAtMs: expiresAtMs === undefined ? previous.expiresAtMs : expiresAtMs,
  }, { nowMs });
  return { audienceDisplay: next };
};
