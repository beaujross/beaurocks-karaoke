import { describe, expect, it } from 'vitest';

import {
  buildQueueStageSummary,
  buildQueueSurfaceCounts,
} from '../../src/apps/Host/queueSurfaceModel.js';

describe('queue surface model', () => {
  it('counts all queue lanes and exposes needs-attention totals', () => {
    const counts = buildQueueSurfaceCounts({
      reviewRequired: [{ id: 'review-1' }, { id: 'review-2' }],
      pending: [{ id: 'pending-1' }],
      queue: [{ id: 'ready-1' }, { id: 'ready-2' }, { id: 'ready-3' }],
      assigned: [{ id: 'assigned-1' }],
    });

    expect(counts).toEqual({
      review: 2,
      pending: 1,
      ready: 3,
      assigned: 1,
      needsAttention: 3,
      total: 7,
    });
  });

  it('falls back to host-attention messaging when no ready song can go next', () => {
    const summary = buildQueueStageSummary({
      counts: {
        review: 1,
        pending: 1,
        ready: 0,
        assigned: 2,
        needsAttention: 2,
        total: 4,
      },
      nextQueueSong: null,
    });

    expect(summary).toEqual({
      queueCount: 4,
      nextQueueText: '2 requests need host attention',
    });
  });

  it('prefers the next runnable queue song when one exists', () => {
    const summary = buildQueueStageSummary({
      counts: {
        review: 0,
        pending: 0,
        ready: 1,
        assigned: 0,
        needsAttention: 0,
        total: 1,
      },
      nextQueueSong: {
        singerName: 'Alex',
        songTitle: 'Pretty Woman',
      },
    });

    expect(summary).toEqual({
      queueCount: 1,
      nextQueueText: 'Alex - Pretty Woman',
    });
  });
});
