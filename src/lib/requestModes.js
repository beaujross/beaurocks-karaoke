export const REQUEST_MODES = Object.freeze({
  canonicalOpen: 'canonical_open',
  playableOnly: 'playable_only',
  guestBackingOptional: 'guest_backing_optional',
});

export const AUDIENCE_BACKING_MODES = Object.freeze({
  canonicalOnly: 'canonical_only',
  canonicalPlusApprovedBackings: 'canonical_plus_approved_backings',
  canonicalPlusAudienceYoutube: 'canonical_plus_audience_youtube',
});

export const UNKNOWN_BACKING_POLICIES = Object.freeze({
  requireReview: 'require_review',
  autoQueueUnverified: 'auto_queue_unverified',
  blockUnknown: 'block_unknown',
});

export const RESOLUTION_STATUSES = Object.freeze({
  resolved: 'resolved',
  reviewRequired: 'review_required',
  audienceSelectedUnverified: 'audience_selected_unverified',
  rejectedBacking: 'rejected_backing',
});

export const REQUEST_MODE_OPTIONS = Object.freeze([
  {
    id: REQUEST_MODES.canonicalOpen,
    label: 'Host Chooses the Track',
    shortLabel: 'Host picks track',
    description: 'Guests can request any song. If no clear backing is known yet, it waits for you to choose one.',
  },
  {
    id: REQUEST_MODES.playableOnly,
    label: 'Known Tracks Only',
    shortLabel: 'Known tracks only',
    description: 'Guests only see songs that already have a working backing track.',
  },
  {
    id: REQUEST_MODES.guestBackingOptional,
    label: 'Guests Can Pick a Track',
    shortLabel: 'Guests pick track',
    description: 'Guests can request any song and choose a YouTube backing when the room does not already know one.',
  },
]);

const VALID_REQUEST_MODES = new Set(REQUEST_MODE_OPTIONS.map((option) => option.id));
const VALID_AUDIENCE_BACKING_MODES = new Set(Object.values(AUDIENCE_BACKING_MODES));
const VALID_UNKNOWN_BACKING_POLICIES = new Set(Object.values(UNKNOWN_BACKING_POLICIES));
const normalizeResolutionLayer = (value = '') => String(value || '').trim();

export const normalizeBackingResolutionStatus = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'rejected' ? RESOLUTION_STATUSES.rejectedBacking : normalized;
};

export const isAudienceSelectedUnverifiedResolution = (value = '') => (
  normalizeBackingResolutionStatus(value) === RESOLUTION_STATUSES.audienceSelectedUnverified
);

export const isRejectedBackingResolution = (value = '') => (
  normalizeBackingResolutionStatus(value) === RESOLUTION_STATUSES.rejectedBacking
);

export const requiresBackingHostReview = (value = '') => {
  const normalized = normalizeBackingResolutionStatus(value);
  return (
    normalized === RESOLUTION_STATUSES.reviewRequired
    || normalized === RESOLUTION_STATUSES.rejectedBacking
  );
};

export const isPlayableBackingResolution = (value = '') => {
  const normalized = normalizeBackingResolutionStatus(value);
  return (
    normalized === RESOLUTION_STATUSES.resolved
    || normalized === RESOLUTION_STATUSES.audienceSelectedUnverified
  );
};

export const normalizeRoomRequestMode = (value = '', allowSingerTrackSelect = false) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (VALID_REQUEST_MODES.has(normalized)) return normalized;
  return allowSingerTrackSelect
    ? REQUEST_MODES.guestBackingOptional
    : REQUEST_MODES.canonicalOpen;
};

export const deriveAudienceBackingMode = ({
  audienceBackingMode = '',
  requestMode = '',
  allowSingerTrackSelect = false,
} = {}) => {
  const normalizedAudienceBackingMode = String(audienceBackingMode || '').trim().toLowerCase();
  if (VALID_AUDIENCE_BACKING_MODES.has(normalizedAudienceBackingMode)) return normalizedAudienceBackingMode;
  const normalizedRequestMode = normalizeRoomRequestMode(requestMode, allowSingerTrackSelect);
  if (normalizedRequestMode === REQUEST_MODES.playableOnly) {
    return AUDIENCE_BACKING_MODES.canonicalPlusApprovedBackings;
  }
  if (normalizedRequestMode === REQUEST_MODES.guestBackingOptional) {
    return AUDIENCE_BACKING_MODES.canonicalPlusAudienceYoutube;
  }
  return AUDIENCE_BACKING_MODES.canonicalOnly;
};

export const deriveUnknownBackingPolicy = ({
  unknownBackingPolicy = '',
  requestMode = '',
  allowSingerTrackSelect = false,
} = {}) => {
  const normalizedUnknownBackingPolicy = String(unknownBackingPolicy || '').trim().toLowerCase();
  if (VALID_UNKNOWN_BACKING_POLICIES.has(normalizedUnknownBackingPolicy)) return normalizedUnknownBackingPolicy;
  const normalizedRequestMode = normalizeRoomRequestMode(requestMode, allowSingerTrackSelect);
  if (normalizedRequestMode === REQUEST_MODES.playableOnly) {
    return UNKNOWN_BACKING_POLICIES.blockUnknown;
  }
  return UNKNOWN_BACKING_POLICIES.requireReview;
};

export const isAudienceBackingBlockedByPolicy = ({
  hasBacking = false,
  explicitResolutionStatus = '',
  unknownBackingPolicy = '',
  trustedCandidate = false,
} = {}) => {
  if (!hasBacking) return false;
  if (normalizeBackingResolutionStatus(explicitResolutionStatus)) return false;
  if (trustedCandidate) return false;
  return (
    deriveUnknownBackingPolicy({ unknownBackingPolicy }) === UNKNOWN_BACKING_POLICIES.blockUnknown
  );
};

export const deriveAudienceBackingResolution = ({
  hasBacking = false,
  explicitResolutionStatus = '',
  explicitResolutionLayer = '',
  unknownBackingPolicy = '',
  trustedCandidate = false,
} = {}) => {
  if (!hasBacking) {
    return {
      mediaResolutionStatus: 'needs_backing',
      resolutionStatus: RESOLUTION_STATUSES.reviewRequired,
      resolutionLayer: 'manual_review',
    };
  }
  const normalizedResolutionStatus = normalizeBackingResolutionStatus(explicitResolutionStatus);
  const normalizedUnknownBackingPolicy = deriveUnknownBackingPolicy({ unknownBackingPolicy });
  return {
    mediaResolutionStatus: 'audience_selected',
    resolutionStatus: normalizedResolutionStatus || (
      trustedCandidate
        ? RESOLUTION_STATUSES.resolved
        : normalizedUnknownBackingPolicy === UNKNOWN_BACKING_POLICIES.autoQueueUnverified
          ? RESOLUTION_STATUSES.audienceSelectedUnverified
          : RESOLUTION_STATUSES.reviewRequired
    ),
    resolutionLayer: normalizeResolutionLayer(explicitResolutionLayer) || 'audience_selected',
  };
};

export const deriveAudienceRequestState = ({
  hasBacking = false,
  explicitResolutionStatus = '',
  explicitResolutionLayer = '',
  unknownBackingPolicy = '',
  trustedCandidate = false,
  requiresQueueApproval = false,
} = {}) => {
  const backingResolution = deriveAudienceBackingResolution({
    hasBacking,
    explicitResolutionStatus,
    explicitResolutionLayer,
    unknownBackingPolicy,
    trustedCandidate,
  });
  return {
    ...backingResolution,
    requestStatus: requiresQueueApproval ? 'pending' : 'requested',
    shouldStampReviewRequestedAt: requiresBackingHostReview(backingResolution.resolutionStatus),
  };
};

export const allowsGuestBackingSelection = (requestMode = '', allowSingerTrackSelect = false, audienceBackingMode = '') => (
  deriveAudienceBackingMode({
    audienceBackingMode,
    requestMode,
    allowSingerTrackSelect,
  }) === AUDIENCE_BACKING_MODES.canonicalPlusAudienceYoutube
);

export const isPlayableOnlyRequestMode = (requestMode = '', allowSingerTrackSelect = false) => (
  normalizeRoomRequestMode(requestMode, allowSingerTrackSelect) === REQUEST_MODES.playableOnly
);
