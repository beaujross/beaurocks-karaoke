import { describe, expect, it } from 'vitest';

import { partitionQueueSongsByResolution } from '../../src/apps/Host/hooks/useQueueDerivedState.js';

describe('host queue resolution state', () => {
  it('keeps review-blocked songs out of queue, pending, and assigned buckets', () => {
    const partitioned = partitionQueueSongsByResolution([
      {
        id: 'requested_review',
        status: 'requested',
        resolutionStatus: 'review_required',
        priorityScore: 40,
      },
      {
        id: 'pending_rejected_alias',
        status: 'pending',
        resolutionStatus: 'rejected',
        priorityScore: 10,
      },
      {
        id: 'requested_unverified',
        status: 'requested',
        resolutionStatus: 'audience_selected_unverified',
        priorityScore: 20,
      },
      {
        id: 'pending_resolved',
        status: 'pending',
        resolutionStatus: 'resolved',
        priorityScore: 30,
      },
      {
        id: 'assigned_resolved',
        status: 'assigned',
        resolutionStatus: 'resolved',
        priorityScore: 15,
      },
    ]);

    expect(partitioned.reviewRequired.map((song) => song.id)).toEqual([
      'pending_rejected_alias',
      'requested_review',
    ]);
    expect(partitioned.queue.map((song) => song.id)).toEqual(['requested_unverified']);
    expect(partitioned.pending.map((song) => song.id)).toEqual(['pending_resolved']);
    expect(partitioned.assigned.map((song) => song.id)).toEqual(['assigned_resolved']);
  });

  it('ignores already rejected queue entries because they are no longer active queue work', () => {
    const partitioned = partitionQueueSongsByResolution([
      {
        id: 'fully_rejected',
        status: 'rejected',
        resolutionStatus: 'rejected_backing',
        priorityScore: 1,
      },
    ]);

    expect(partitioned.reviewRequired).toEqual([]);
    expect(partitioned.queue).toEqual([]);
    expect(partitioned.pending).toEqual([]);
    expect(partitioned.assigned).toEqual([]);
  });
});
