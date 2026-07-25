import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';

const noop = () => {};
const styles = new Proxy({}, { get: () => '' });

const buildProps = (overrides = {}) => ({
  searchQ: 'vale',
  setSearchQ: noop,
  autocompleteProvider: 'youtube',
  setAutocompleteProvider: noop,
  styles,
  quickAddOnResultClick: false,
  setQuickAddOnResultClick: noop,
  results: [
    {
      trackName: 'Valerie',
      artistName: 'Amy Winehouse',
      artworkUrl100: 'https://example.com/cover.jpg',
      source: 'youtube',
      sourceDetail: 'Trusted karaoke backing.',
      url: 'https://youtu.be/example123',
    },
  ],
  queueSearchSourceNote: '',
  queueSearchNoResultHint: '',
  getResultRowKey: () => 'result-1',
  quickAddLoadingKey: '',
  handleResultClick: noop,
  searchSources: {},
  itunesBackoffRemaining: 0,
  quickAddNotice: null,
  onUndoQuickAdd: noop,
  onChangeQuickAddBacking: noop,
  onManualQueueResult: noop,
  manual: {
    song: 'Valerie',
    artist: 'Amy Winehouse',
    singer: 'Taylor',
  },
  setManual: noop,
  manualSingerMode: 'custom',
  setManualSingerMode: noop,
  hostName: 'Host',
  users: [],
  addSong: vi.fn(async () => ({ id: 'queued-1', songTitle: 'Valerie' })),
  appleMusicAuthorized: false,
  openYtSearch: noop,
  onOpenPlanner: noop,
  onOpenTvLibrary: noop,
  scenePresets: [],
  onQueueScenePreset: noop,
  onAddScenePresetToRunOfShow: noop,
  onAddQuickRunOfShowMoment: vi.fn(),
  runOfShowOpenSlots: [
    { id: 'slot-1', label: '#2 Performance Slot', sequence: 2 },
    { id: 'slot-2', label: '#3 Performance Slot', sequence: 3 },
  ],
  onQueuePerformanceResult: vi.fn(),
  onQueueManualPerformance: vi.fn(async () => ({})),
  dockResults: true,
  ...overrides,
});

const isElementNode = (node) => Boolean(node) && typeof node === 'object' && 'type' in node && 'props' in node;

const visitTree = (node, visitor) => {
  if (Array.isArray(node)) {
    node.forEach((child) => visitTree(child, visitor));
    return;
  }
  if (!isElementNode(node)) return;
  if (typeof node.type === 'function') {
    visitTree(node.type(node.props), visitor);
    return;
  }
  visitor(node);
  visitTree(node.props?.children, visitor);
};

const findByFeatureId = (tree, featureId) => {
  let match = null;
  visitTree(tree, (node) => {
    if (!match && node.props?.['data-feature-id'] === featureId) {
      match = node;
    }
  });
  return match;
};

const renderAddToQueueFormBody = async (overrides = {}, stateOverrides = {}) => {
  vi.resetModules();
  vi.doMock('../../src/lib/gameRegistry.js', () => ({
    GAMES_META: [
      { id: 'bingo', name: 'Bingo', description: 'Mark live stage moments.', category: 'brain' },
      { id: 'vocal_challenge', name: 'Vocal Challenge', description: 'Follow moving pitch targets.', category: 'voice' },
      { id: 'trivia_pop', name: 'Trivia', description: 'Quick room trivia.', category: 'brain' },
      { id: 'wyr', name: 'Would You Rather', description: 'Fast audience vote.', category: 'brain' },
    ],
  }));
  vi.doMock('react', async () => {
    const useState = (initialValue) => {
      const resolvedValue = typeof initialValue === 'function' ? initialValue() : initialValue;
      if (stateOverrides.activeMomentType && resolvedValue === 'performance') {
        return [stateOverrides.activeMomentType, noop];
      }
      if (stateOverrides.selectedGameMomentBundleId && resolvedValue === 'between_songs') {
        return [stateOverrides.selectedGameMomentBundleId, noop];
      }
      return [resolvedValue, noop];
    };
    const useEffect = noop;
    const useMemo = (factory) => factory();
    const nextDefault = {
      useState,
      useEffect,
      useMemo,
    };
    return {
      default: nextDefault,
      useState,
      useEffect,
      useMemo,
    };
  });
  const { default: AddToQueueFormBody } = await import('../../src/apps/Host/components/AddToQueueFormBody.jsx');
  const props = buildProps(overrides);
  return {
    props,
    tree: AddToQueueFormBody(props),
  };
};

afterEach(() => {
  vi.doUnmock('react');
  vi.resetModules();
  vi.restoreAllMocks();
});

test('AddToQueueFormBody exposes one append-only performance result action', async () => {
  const { tree } = await renderAddToQueueFormBody();
  const addNext = findByFeatureId(tree, 'performance-result-add-next');
  const addLater = findByFeatureId(tree, 'performance-result-add-later');
  const queueOnly = findByFeatureId(tree, 'performance-result-queue-only');
  const resultRow = findByFeatureId(tree, 'performance-result-row');

  assert.equal(addNext, null);
  assert.equal(addLater, null);
  assert.equal(queueOnly, null);
  assert.ok(resultRow);
  assert.equal(resultRow.props.role, 'button');
  assert.match(resultRow.props['aria-label'], /^Add to queue /);
});

test('AddToQueueFormBody queues a performance when the host taps its result card', async () => {
  const { props, tree } = await renderAddToQueueFormBody();
  const resultRow = findByFeatureId(tree, 'performance-result-row');

  assert.ok(resultRow);
  resultRow.props.onClick();

  assert.equal(props.onQueuePerformanceResult.mock.calls.length, 1);
  assert.equal(props.onQueuePerformanceResult.mock.calls[0][0].trackName, 'Valerie');
});

test('AddToQueueFormBody exposes one secondary YouTube expansion action', async () => {
  const openYtSearch = vi.fn();
  const { tree } = await renderAddToQueueFormBody({ openYtSearch });
  const expandSearch = findByFeatureId(tree, 'host-performance-search-expand');
  const momentTabs = findByFeatureId(tree, 'host-moment-type-tabs');

  assert.ok(expandSearch);
  assert.ok(momentTabs);
  assert.equal(momentTabs.props.role, 'tablist');

  expandSearch.props.onClick();

  assert.equal(openYtSearch.mock.calls.length, 1);
  assert.deepEqual(openYtSearch.mock.calls[0], ['manual', 'vale']);
});

test('AddToQueueFormBody exposes one manual Add to Queue action', async () => {
  const { props, tree } = await renderAddToQueueFormBody({ dockResults: false });
  const addNext = findByFeatureId(tree, 'host-manual-add-next');
  const addLater = findByFeatureId(tree, 'host-manual-add-later');
  const addToQueue = findByFeatureId(tree, 'host-manual-queue-submit');

  assert.equal(addNext, null);
  assert.equal(addLater, null);
  assert.ok(addToQueue);
  assert.equal(addToQueue.props.children, 'Add Manual Request');

  await addToQueue.props.onClick();

  assert.equal(props.addSong.mock.calls.length, 1);
});

test('AddToQueueFormBody lets hosts search game modes and use one destination-aware action', async () => {
  const { props, tree } = await renderAddToQueueFormBody({
    searchQ: 'bingo',
  }, {
    activeMomentType: 'game',
    selectedGameMomentBundleId: 'alongside_karaoke',
  });
  const searchInput = findByFeatureId(tree, 'host-moment-search-input');
  const destinationAction = findByFeatureId(tree, 'moment-pack-destination-bingo');
  const nonMatch = findByFeatureId(tree, 'moment-pack-destination-vocal_challenge');

  assert.ok(searchInput);
  assert.equal(searchInput.props.placeholder, 'Search game modes');
  assert.ok(destinationAction);
  assert.equal(nonMatch, null);

  destinationAction.props.onClick();

  assert.equal(props.onAddQuickRunOfShowMoment.mock.calls.length, 1);
  assert.deepEqual(props.onAddQuickRunOfShowMoment.mock.calls[0], ['bingo', {
    destination: 'queue',
    placement: 'append',
  }]);
});

test('buildGameMomentQueueOptions creates spotlight singer queue payloads for voice games', async () => {
  vi.resetModules();
  const { buildGameMomentQueueOptions, GAME_QUEUE_ASSIGNMENT_MODES } = await import('../../src/apps/Host/components/AddToQueueFormBody.jsx');

  assert.deepEqual(
    buildGameMomentQueueOptions('vocal_challenge', {
      destination: 'planner',
      assignmentMode: GAME_QUEUE_ASSIGNMENT_MODES.spotlight,
      performer: { uid: 'u2', name: 'Taylor' },
    }),
    {
      destination: 'planner',
      placement: 'append',
      launchConfigOverrides: {
        participantMode: 'selected',
        participants: ['u2'],
      },
      itemOverrides: {
        notes: 'Spotlight singer: Taylor.',
      },
      presentationOverrides: {
        subhead: 'Taylor takes the mic on phone while the room watches.',
      },
    },
  );

  assert.deepEqual(
    buildGameMomentQueueOptions('bingo', {
      destination: 'queue',
      assignmentMode: GAME_QUEUE_ASSIGNMENT_MODES.spotlight,
      performer: { uid: 'u2', name: 'Taylor' },
    }),
    {
      destination: 'queue',
      placement: 'append',
    },
  );
});
