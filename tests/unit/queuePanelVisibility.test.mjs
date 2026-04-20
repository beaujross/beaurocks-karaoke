import { describe, expect, it } from 'vitest';

import { deriveQueuePanelAutoExpandState } from '../../src/apps/Host/queuePanelVisibility.js';

describe('deriveQueuePanelAutoExpandState', () => {
  it('opens the ready lane when new queued songs arrive', () => {
    const result = deriveQueuePanelAutoExpandState({
      previousCounts: { review: 0, pending: 0, ready: 0, assigned: 0 },
      nextCounts: { review: 0, pending: 0, ready: 2, assigned: 0 },
      currentVisibility: {
        showQueueList: false,
        reviewQueueOpen: false,
        pendingQueueOpen: false,
        readyQueueOpen: false,
        assignedQueueOpen: false,
      },
    });

    expect(result.shouldExpand).toBe(true);
    expect(result.nextVisibility).toEqual({
      showQueueList: true,
      reviewQueueOpen: false,
      pendingQueueOpen: false,
      readyQueueOpen: true,
      assignedQueueOpen: false,
    });
  });

  it('leaves visibility unchanged when counts are flat', () => {
    const result = deriveQueuePanelAutoExpandState({
      previousCounts: { review: 1, pending: 0, ready: 3, assigned: 0 },
      nextCounts: { review: 1, pending: 0, ready: 3, assigned: 0 },
      currentVisibility: {
        showQueueList: false,
        reviewQueueOpen: true,
        pendingQueueOpen: false,
        readyQueueOpen: false,
        assignedQueueOpen: false,
      },
    });

    expect(result.shouldExpand).toBe(false);
    expect(result.nextVisibility).toEqual({
      showQueueList: false,
      reviewQueueOpen: true,
      pendingQueueOpen: false,
      readyQueueOpen: false,
      assignedQueueOpen: false,
    });
  });
});
