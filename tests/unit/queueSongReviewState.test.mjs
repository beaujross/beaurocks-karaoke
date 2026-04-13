import { describe, expect, it } from 'vitest';

import {
  buildHostEditedReviewState,
  buildRejectedReviewState,
  buildResolvedReviewState,
  getQueueStatusAfterReviewResolution,
} from '../../src/lib/queueSongReviewState.js';

describe('queueSongReviewState', () => {
  it('requeues pending or rejected review items when a host resolves them', () => {
    expect(getQueueStatusAfterReviewResolution('pending')).toBe('requested');
    expect(getQueueStatusAfterReviewResolution('rejected')).toBe('requested');
    expect(getQueueStatusAfterReviewResolution('requested')).toBe('requested');
  });

  it('builds resolved review state for host picks and favorites', () => {
    expect(buildResolvedReviewState({
      currentStatus: 'pending',
      candidateLayer: 'room_recent',
      candidateSource: 'youtube',
    })).toMatchObject({
      status: 'requested',
      playbackReady: true,
      mediaResolutionStatus: 'host_reviewed',
      resolutionStatus: 'resolved',
      resolutionLayer: 'room_recent',
      reviewRequestedAt: null,
    });

    expect(buildResolvedReviewState({
      currentStatus: 'rejected',
      candidateLayer: 'room_recent',
      candidateSource: 'youtube',
      saveFavorite: true,
    })).toMatchObject({
      status: 'requested',
      resolutionLayer: 'host_favorite',
    });
  });

  it('builds rejected review state using the canonical rejected backing status', () => {
    expect(buildRejectedReviewState()).toEqual({
      status: 'rejected',
      resolutionStatus: 'rejected_backing',
    });
  });

  it('only auto-recovers host-edited songs when they were review blocked and now have backing', () => {
    expect(buildHostEditedReviewState({
      currentStatus: 'rejected',
      currentResolutionStatus: 'rejected_backing',
      hasPlayableBacking: true,
      trackSource: 'youtube',
    })).toMatchObject({
      status: 'requested',
      playbackReady: true,
      mediaResolutionStatus: 'host_reviewed',
      resolutionStatus: 'resolved',
      resolutionLayer: 'host_favorite',
      reviewRequestedAt: null,
    });

    expect(buildHostEditedReviewState({
      currentStatus: 'requested',
      currentResolutionStatus: 'audience_selected_unverified',
      hasPlayableBacking: true,
      trackSource: 'youtube',
    })).toEqual({});
  });
});
