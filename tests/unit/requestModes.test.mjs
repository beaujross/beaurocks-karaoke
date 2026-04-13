import { describe, expect, it } from 'vitest';

import {
  AUDIENCE_BACKING_MODES,
  REQUEST_MODES,
  RESOLUTION_STATUSES,
  UNKNOWN_BACKING_POLICIES,
  allowsGuestBackingSelection,
  deriveAudienceBackingResolution,
  deriveAudienceBackingMode,
  deriveAudienceRequestState,
  deriveUnknownBackingPolicy,
  isAudienceSelectedUnverifiedResolution,
  isAudienceBackingBlockedByPolicy,
  isPlayableBackingResolution,
  isRejectedBackingResolution,
  isPlayableOnlyRequestMode,
  normalizeBackingResolutionStatus,
  normalizeRoomRequestMode,
  requiresBackingHostReview,
} from '../../src/lib/requestModes.js';

describe('requestModes', () => {
  it('defaults blank rooms to canonical open', () => {
    expect(normalizeRoomRequestMode('', false)).toBe(REQUEST_MODES.canonicalOpen);
  });

  it('maps legacy guest backing rooms to guest backing optional', () => {
    expect(normalizeRoomRequestMode('', true)).toBe(REQUEST_MODES.guestBackingOptional);
  });

  it('detects playable only rooms directly', () => {
    expect(isPlayableOnlyRequestMode(REQUEST_MODES.playableOnly, false)).toBe(true);
    expect(allowsGuestBackingSelection(REQUEST_MODES.playableOnly, false)).toBe(false);
  });

  it('allows guest backing only when the derived audience backing mode is YouTube-enabled', () => {
    expect(allowsGuestBackingSelection(REQUEST_MODES.guestBackingOptional, true)).toBe(true);
    expect(allowsGuestBackingSelection(
      REQUEST_MODES.guestBackingOptional,
      false,
      AUDIENCE_BACKING_MODES.canonicalPlusApprovedBackings,
    )).toBe(false);
  });

  it('derives audience backing mode from legacy room settings', () => {
    expect(deriveAudienceBackingMode({
      requestMode: REQUEST_MODES.canonicalOpen,
      allowSingerTrackSelect: false,
    })).toBe(AUDIENCE_BACKING_MODES.canonicalOnly);
    expect(deriveAudienceBackingMode({
      requestMode: REQUEST_MODES.playableOnly,
      allowSingerTrackSelect: false,
    })).toBe(AUDIENCE_BACKING_MODES.canonicalPlusApprovedBackings);
    expect(deriveAudienceBackingMode({
      requestMode: REQUEST_MODES.guestBackingOptional,
      allowSingerTrackSelect: true,
    })).toBe(AUDIENCE_BACKING_MODES.canonicalPlusAudienceYoutube);
  });

  it('prefers explicit audience backing mode and unknown policy when provided', () => {
    expect(deriveAudienceBackingMode({
      audienceBackingMode: AUDIENCE_BACKING_MODES.canonicalPlusApprovedBackings,
      requestMode: REQUEST_MODES.guestBackingOptional,
      allowSingerTrackSelect: true,
    })).toBe(AUDIENCE_BACKING_MODES.canonicalPlusApprovedBackings);
    expect(deriveUnknownBackingPolicy({
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.autoQueueUnverified,
      requestMode: REQUEST_MODES.guestBackingOptional,
      allowSingerTrackSelect: true,
    })).toBe(UNKNOWN_BACKING_POLICIES.autoQueueUnverified);
  });

  it('derives unknown backing policy from legacy room settings', () => {
    expect(deriveUnknownBackingPolicy({
      requestMode: REQUEST_MODES.playableOnly,
      allowSingerTrackSelect: false,
    })).toBe(UNKNOWN_BACKING_POLICIES.blockUnknown);
    expect(deriveUnknownBackingPolicy({
      requestMode: REQUEST_MODES.guestBackingOptional,
      allowSingerTrackSelect: true,
    })).toBe(UNKNOWN_BACKING_POLICIES.requireReview);
  });

  it('derives audience backing resolution for untrusted selections from room policy', () => {
    expect(deriveAudienceBackingResolution({
      hasBacking: true,
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.requireReview,
    })).toEqual({
      mediaResolutionStatus: 'audience_selected',
      resolutionStatus: 'review_required',
      resolutionLayer: 'audience_selected',
    });

    expect(deriveAudienceBackingResolution({
      hasBacking: true,
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.autoQueueUnverified,
    })).toEqual({
      mediaResolutionStatus: 'audience_selected',
      resolutionStatus: 'audience_selected_unverified',
      resolutionLayer: 'audience_selected',
    });
  });

  it('prefers explicit audience backing resolution metadata when provided', () => {
    expect(deriveAudienceBackingResolution({
      hasBacking: true,
      explicitResolutionStatus: 'resolved',
      explicitResolutionLayer: 'room_recent',
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.requireReview,
    })).toEqual({
      mediaResolutionStatus: 'audience_selected',
      resolutionStatus: 'resolved',
      resolutionLayer: 'room_recent',
    });
  });

  it('promotes trusted candidates and blocks only untrusted unknown backings when policy requires it', () => {
    expect(deriveAudienceBackingResolution({
      hasBacking: true,
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.blockUnknown,
      trustedCandidate: true,
      explicitResolutionLayer: 'global_approved',
    })).toEqual({
      mediaResolutionStatus: 'audience_selected',
      resolutionStatus: 'resolved',
      resolutionLayer: 'global_approved',
    });

    expect(isAudienceBackingBlockedByPolicy({
      hasBacking: true,
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.blockUnknown,
    })).toBe(true);

    expect(isAudienceBackingBlockedByPolicy({
      hasBacking: true,
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.blockUnknown,
      explicitResolutionStatus: 'resolved',
    })).toBe(false);

    expect(isAudienceBackingBlockedByPolicy({
      hasBacking: true,
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.blockUnknown,
      trustedCandidate: true,
    })).toBe(false);
  });

  it('normalizes backing resolution aliases and exposes shared predicates', () => {
    expect(normalizeBackingResolutionStatus('rejected')).toBe(RESOLUTION_STATUSES.rejectedBacking);
    expect(isRejectedBackingResolution('rejected')).toBe(true);
    expect(isRejectedBackingResolution(RESOLUTION_STATUSES.rejectedBacking)).toBe(true);
    expect(requiresBackingHostReview('review_required')).toBe(true);
    expect(requiresBackingHostReview('rejected')).toBe(true);
    expect(isPlayableBackingResolution('resolved')).toBe(true);
    expect(isPlayableBackingResolution('audience_selected_unverified')).toBe(true);
    expect(isPlayableBackingResolution('review_required')).toBe(false);
    expect(isAudienceSelectedUnverifiedResolution('audience_selected_unverified')).toBe(true);
  });

  it('derives the queue admission matrix independently from backing trust', () => {
    expect(deriveAudienceRequestState({
      hasBacking: true,
      trustedCandidate: true,
      requiresQueueApproval: false,
    })).toMatchObject({
      requestStatus: 'requested',
      resolutionStatus: RESOLUTION_STATUSES.resolved,
      shouldStampReviewRequestedAt: false,
    });

    expect(deriveAudienceRequestState({
      hasBacking: true,
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.autoQueueUnverified,
      requiresQueueApproval: false,
    })).toMatchObject({
      requestStatus: 'requested',
      resolutionStatus: RESOLUTION_STATUSES.audienceSelectedUnverified,
      shouldStampReviewRequestedAt: false,
    });

    expect(deriveAudienceRequestState({
      hasBacking: true,
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.requireReview,
      requiresQueueApproval: false,
    })).toMatchObject({
      requestStatus: 'requested',
      resolutionStatus: RESOLUTION_STATUSES.reviewRequired,
      shouldStampReviewRequestedAt: true,
    });

    expect(deriveAudienceRequestState({
      hasBacking: true,
      trustedCandidate: true,
      requiresQueueApproval: true,
    })).toMatchObject({
      requestStatus: 'pending',
      resolutionStatus: RESOLUTION_STATUSES.resolved,
      shouldStampReviewRequestedAt: false,
    });

    expect(deriveAudienceRequestState({
      hasBacking: true,
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.autoQueueUnverified,
      requiresQueueApproval: true,
    })).toMatchObject({
      requestStatus: 'pending',
      resolutionStatus: RESOLUTION_STATUSES.audienceSelectedUnverified,
      shouldStampReviewRequestedAt: false,
    });

    expect(deriveAudienceRequestState({
      hasBacking: true,
      unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.requireReview,
      requiresQueueApproval: true,
    })).toMatchObject({
      requestStatus: 'pending',
      resolutionStatus: RESOLUTION_STATUSES.reviewRequired,
      shouldStampReviewRequestedAt: true,
    });
  });
});
