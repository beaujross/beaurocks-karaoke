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
  onAddQuickRunOfShowMoment: noop,
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

const renderAddToQueueFormBody = async (overrides = {}) => {
  vi.resetModules();
  vi.doMock('react', async () => {
    const actual = await vi.importActual('react');
    const useState = (initialValue) => [typeof initialValue === 'function' ? initialValue() : initialValue, noop];
    const useEffect = noop;
    const nextDefault = {
      ...(actual.default ?? actual),
      useState,
      useEffect,
    };
    return {
      ...actual,
      default: nextDefault,
      useState,
      useEffect,
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

test('AddToQueueFormBody routes performance result actions to the intended plan slots', async () => {
  const { props, tree } = await renderAddToQueueFormBody();
  const addNext = findByFeatureId(tree, 'performance-result-add-next');
  const addLater = findByFeatureId(tree, 'performance-result-add-later');
  const queueOnly = findByFeatureId(tree, 'performance-result-queue-only');

  assert.ok(addNext);
  assert.ok(addLater);
  assert.ok(queueOnly);

  addNext.props.onClick({ stopPropagation: noop });
  addLater.props.onClick({ stopPropagation: noop });
  queueOnly.props.onClick({ stopPropagation: noop });

  assert.equal(props.onQueuePerformanceResult.mock.calls.length, 3);
  assert.deepEqual(props.onQueuePerformanceResult.mock.calls[0][1], {
    slotId: 'slot-1',
    slotLabel: '#2 Performance Slot',
  });
  assert.deepEqual(props.onQueuePerformanceResult.mock.calls[1][1], {
    slotId: 'slot-2',
    slotLabel: '#3 Performance Slot',
  });
  assert.equal(props.onQueuePerformanceResult.mock.calls[2].length, 1);
});

test('AddToQueueFormBody routes manual performance buttons to the intended plan slots', async () => {
  const { props, tree } = await renderAddToQueueFormBody();
  const addNext = findByFeatureId(tree, 'host-manual-add-next');
  const addLater = findByFeatureId(tree, 'host-manual-add-later');

  assert.ok(addNext);
  assert.ok(addLater);

  await addNext.props.onClick();
  await addLater.props.onClick();

  assert.equal(props.onQueueManualPerformance.mock.calls.length, 2);
  assert.deepEqual(props.onQueueManualPerformance.mock.calls[0][0], {
    slotId: 'slot-1',
    slotLabel: '#2 Performance Slot',
  });
  assert.deepEqual(props.onQueueManualPerformance.mock.calls[1][0], {
    slotId: 'slot-2',
    slotLabel: '#3 Performance Slot',
  });
});
