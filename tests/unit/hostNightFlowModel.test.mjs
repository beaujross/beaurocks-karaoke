import { test } from 'vitest';

import {
  getHostNightFlowBuckets,
  promotePreparedItemsToLiveQueue,
  schedulePreparedMomentsByPerformanceCadence,
} from '../../src/apps/Host/lib/hostNightFlowModel.js';

const buildDirector = () => ({
  items: [
    {
      id: 'prepared_trivia',
      type: 'trivia_break',
      title: 'Song Trivia',
      destination: 'planner',
      status: 'ready',
      sequence: 1,
    },
    {
      id: 'prepared_performance',
      type: 'performance',
      title: 'Opening Number',
      destination: 'planner',
      status: 'blocked',
      sequence: 2,
    },
    {
      id: 'queued_announcement',
      type: 'announcement',
      title: 'Welcome',
      destination: 'run_of_show',
      status: 'ready',
      sequence: 3,
    },
    {
      id: 'completed_break',
      type: 'game_break',
      title: 'Finished',
      destination: 'run_of_show',
      status: 'complete',
      sequence: 4,
    },
  ],
});

test('night flow separates prepared work from the committed live queue', () => {
  const buckets = getHostNightFlowBuckets(buildDirector());

  assert.deepEqual(buckets.preparedItems.map((item) => item.id), [
    'prepared_trivia',
    'prepared_performance',
  ]);
  assert.deepEqual(buckets.preparedMomentItems.map((item) => item.id), ['prepared_trivia']);
  assert.deepEqual(buckets.preparedPerformanceItems.map((item) => item.id), ['prepared_performance']);
  assert.deepEqual(buckets.liveQueueItems.map((item) => item.id), ['queued_announcement']);
  assert.deepEqual(buckets.completedItems.map((item) => item.id), ['completed_break']);
});

test('prepared items move into the live queue in one normalized update', () => {
  const result = promotePreparedItemsToLiveQueue(
    buildDirector(),
    ['prepared_trivia', 'prepared_performance', 'missing'],
  );
  const buckets = getHostNightFlowBuckets(result.director);

  assert.equal(result.promotedCount, 2);
  assert.deepEqual(result.promotedIds, ['prepared_trivia', 'prepared_performance']);
  assert.deepEqual(buckets.preparedItems, []);
  assert.deepEqual(
    buckets.liveQueueItems.map((item) => item.id),
    ['prepared_trivia', 'prepared_performance', 'queued_announcement'],
  );
  assert.equal(
    result.director.items.find((item) => item.id === 'prepared_trivia')?.destination,
    'run_of_show',
  );
  assert.equal(
    result.director.items.find((item) => item.id === 'prepared_performance')?.status,
    'blocked',
  );
});

test('spaces prepared moments after a host-selected number of live performances', () => {
  const director = {
    items: [
      { id: 'performance-1', type: 'performance', destination: 'run_of_show', status: 'ready', sequence: 1 },
      { id: 'performance-2', type: 'performance', destination: 'run_of_show', status: 'ready', sequence: 2 },
      { id: 'performance-3', type: 'performance', destination: 'run_of_show', status: 'ready', sequence: 3 },
      { id: 'performance-4', type: 'performance', destination: 'run_of_show', status: 'ready', sequence: 4 },
      { id: 'trivia-1', type: 'trivia_break', destination: 'planner', status: 'ready', sequence: 5 },
      { id: 'trivia-2', type: 'trivia_break', destination: 'planner', status: 'ready', sequence: 6 },
      { id: 'saved-game', type: 'game_break', destination: 'planner', status: 'ready', sequence: 7 },
    ],
  };

  const result = schedulePreparedMomentsByPerformanceCadence(
    director,
    ['trivia-1', 'trivia-2'],
    2,
  );

  assert.equal(result.promotedCount, 2);
  assert.equal(result.cadence, 2);
  assert.deepEqual(result.director.items.map((entry) => entry.id), [
    'performance-1',
    'performance-2',
    'trivia-1',
    'performance-3',
    'performance-4',
    'trivia-2',
    'saved-game',
  ]);
  assert.equal(result.director.items.find((entry) => entry.id === 'saved-game').destination, 'planner');
});

test('appends overflow prepared moments without dropping them', () => {
  const director = {
    items: [
      { id: 'performance-1', type: 'performance', destination: 'run_of_show', status: 'ready', sequence: 1 },
      { id: 'trivia-1', type: 'trivia_break', destination: 'planner', status: 'ready', sequence: 2 },
      { id: 'trivia-2', type: 'trivia_break', destination: 'planner', status: 'ready', sequence: 3 },
    ],
  };

  const result = schedulePreparedMomentsByPerformanceCadence(
    director,
    ['trivia-1', 'trivia-2'],
    3,
  );

  assert.deepEqual(result.director.items.map((entry) => entry.id), [
    'performance-1',
    'trivia-1',
    'trivia-2',
  ]);
});
