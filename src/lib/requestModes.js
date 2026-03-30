export const REQUEST_MODES = Object.freeze({
  canonicalOpen: 'canonical_open',
  playableOnly: 'playable_only',
  guestBackingOptional: 'guest_backing_optional',
});

export const REQUEST_MODE_OPTIONS = Object.freeze([
  {
    id: REQUEST_MODES.canonicalOpen,
    label: 'Canonical Open',
    shortLabel: 'Open requests',
    description: 'Guests can request any song. Unresolved songs go to host review.',
  },
  {
    id: REQUEST_MODES.playableOnly,
    label: 'Playable Only',
    shortLabel: 'Playable only',
    description: 'Guests can only request songs that already have approved playable backing.',
  },
  {
    id: REQUEST_MODES.guestBackingOptional,
    label: 'Guest Backing Optional',
    shortLabel: 'Guest backing',
    description: 'Guests can request any song and may attach a backing link when needed.',
  },
]);

const VALID_REQUEST_MODES = new Set(REQUEST_MODE_OPTIONS.map((option) => option.id));

export const normalizeRoomRequestMode = (value = '', allowSingerTrackSelect = false) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (VALID_REQUEST_MODES.has(normalized)) return normalized;
  return allowSingerTrackSelect
    ? REQUEST_MODES.guestBackingOptional
    : REQUEST_MODES.canonicalOpen;
};

export const allowsGuestBackingSelection = (requestMode = '', allowSingerTrackSelect = false) => {
  const normalized = normalizeRoomRequestMode(requestMode, allowSingerTrackSelect);
  return normalized === REQUEST_MODES.guestBackingOptional && allowSingerTrackSelect !== false;
};

export const isPlayableOnlyRequestMode = (requestMode = '', allowSingerTrackSelect = false) => (
  normalizeRoomRequestMode(requestMode, allowSingerTrackSelect) === REQUEST_MODES.playableOnly
);

