import {
  RESOLUTION_STATUSES,
  requiresBackingHostReview,
} from './requestModes.js';

const normalizeSongStatus = (value = '') => String(value || '').trim().toLowerCase();
const normalizeLayer = (value = '') => String(value || '').trim();

export const getQueueStatusAfterReviewResolution = (status = '') => {
  const normalizedStatus = normalizeSongStatus(status);
  if (normalizedStatus === 'pending' || normalizedStatus === 'rejected') {
    return 'requested';
  }
  return normalizedStatus || 'requested';
};

export const buildResolvedReviewState = ({
  currentStatus = '',
  candidateLayer = '',
  candidateSource = '',
  saveFavorite = false,
  submitTrustedReview = false,
} = {}) => ({
  status: getQueueStatusAfterReviewResolution(currentStatus),
  playbackReady: true,
  mediaResolutionStatus: submitTrustedReview ? 'trusted_review_submitted' : 'host_reviewed',
  resolutionStatus: RESOLUTION_STATUSES.resolved,
  resolutionLayer: saveFavorite
    ? 'host_favorite'
    : normalizeLayer(candidateLayer) || normalizeLayer(candidateSource) || 'room_recent',
  reviewRequestedAt: null,
});

export const buildRejectedReviewState = () => ({
  status: 'rejected',
  resolutionStatus: RESOLUTION_STATUSES.rejectedBacking,
});

export const buildHostEditedReviewState = ({
  currentStatus = '',
  currentResolutionStatus = '',
  hasPlayableBacking = false,
  trackSource = '',
} = {}) => {
  if (!hasPlayableBacking || !requiresBackingHostReview(currentResolutionStatus)) {
    return {};
  }
  return {
    ...buildResolvedReviewState({
      currentStatus,
      candidateSource: trackSource === 'youtube' ? 'host_favorite' : 'host_reviewed',
    }),
    mediaResolutionStatus: 'host_reviewed',
    resolutionLayer: trackSource === 'youtube' ? 'host_favorite' : 'host_reviewed',
  };
};
