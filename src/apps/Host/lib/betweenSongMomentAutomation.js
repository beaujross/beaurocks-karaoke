import {
  createRunOfShowItem,
  normalizeRunOfShowDirector,
  resequenceRunOfShowItems,
} from '../../../lib/runOfShowDirector.js';
import { buildCanonicalTonightLineup } from './tonightsLineupProjection.js';

export const BETWEEN_SONG_MOMENT_KINDS = Object.freeze({
  trivia: 'trivia',
  wouldYouRather: 'would_you_rather',
});

const AUTOMATION_SOURCE = 'between_song_rule';
const PRESERVED_OCCURRENCE_STATUSES = new Set(['staged', 'live', 'complete', 'skipped']);

const clean = (value = '') => String(value || '').trim();
const clampCadence = (value = 3) => Math.max(1, Math.min(12, Math.round(Number(value || 3) || 3)));

const getSongTimestampMs = (song = {}) => {
  const raw = song?.performanceEndedAtMs
    ?? song?.completedAtMs
    ?? song?.timestamp?.toMillis?.()
    ?? song?.timestamp
    ?? 0;
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getCompletedPerformanceHistory = (songs = []) => (
  (Array.isArray(songs) ? songs : [])
    .filter((song) => ['performed', 'complete', 'completed'].includes(clean(song?.status).toLowerCase()))
    .map((song) => ({
      id: clean(song?.performanceSessionId || song?.id),
      songId: clean(song?.id),
      songTitle: clean(song?.songTitle || song?.title),
      artist: clean(song?.artist || song?.artistName),
      completedAtMs: getSongTimestampMs(song),
    }))
    .filter((song) => song.id && song.songTitle)
    .sort((left, right) => left.completedAtMs - right.completedAtMs || left.id.localeCompare(right.id))
);

export const normalizeBetweenSongMomentRule = ({ roomCode = '', party = {} } = {}) => {
  const preferredTypes = Array.isArray(party?.autoCrowdMomentPreferredTypes)
    ? party.autoCrowdMomentPreferredTypes
      .map((entry) => clean(entry).toLowerCase())
      .filter((entry) => ['trivia', 'would_you_rather'].includes(entry))
    : [];
  const rotation = [...new Set(preferredTypes)];
  return {
    ruleId: `between_song_${clean(roomCode).toLowerCase() || 'room'}`,
    enabled: party?.autoCrowdMomentsEnabled === true && rotation.length > 0,
    cadence: clampCadence(party?.autoCrowdMomentEverySongs),
    rotation: rotation.length ? rotation : ['trivia', 'would_you_rather'],
  };
};

const getOccurrenceKey = ({ ruleId = '', cadence = 3, boundaryOrdinal = 0 } = {}) => (
  `${clean(ruleId)}:c${clampCadence(cadence)}:o${Math.max(1, Number(boundaryOrdinal || 1) || 1)}`
);

const getOccurrenceKind = (rule = {}, occurrenceIndex = 0) => {
  const rotation = Array.isArray(rule?.rotation) && rule.rotation.length
    ? rule.rotation
    : ['trivia', 'would_you_rather'];
  return rotation[Math.max(0, Number(occurrenceIndex || 0)) % rotation.length] || 'trivia';
};

const getOccurrenceItemType = (kind = '') => (
  kind === BETWEEN_SONG_MOMENT_KINDS.wouldYouRather
    ? 'would_you_rather_break'
    : 'trivia_break'
);

const getOccurrenceTitle = (kind = '') => (
  kind === BETWEEN_SONG_MOMENT_KINDS.wouldYouRather
    ? 'Would You Rather Moment'
    : 'Trivia Moment'
);

export const buildDesiredBetweenSongOccurrences = ({
  roomCode = '',
  party = {},
  queueSongs = [],
  completedSongs = [],
} = {}) => {
  const rule = normalizeBetweenSongMomentRule({ roomCode, party });
  if (!rule.enabled) return [];
  const completedCount = getCompletedPerformanceHistory(completedSongs).length;
  const orderedQueue = (Array.isArray(queueSongs) ? queueSongs : []).filter((song) => clean(song?.id));
  const desired = [];
  orderedQueue.forEach((song, queueIndex) => {
    const boundaryOrdinal = completedCount + queueIndex + 1;
    if (boundaryOrdinal % rule.cadence !== 0) return;
    const occurrenceIndex = Math.floor(boundaryOrdinal / rule.cadence) - 1;
    const kind = getOccurrenceKind(rule, occurrenceIndex);
    desired.push({
      occurrenceKey: getOccurrenceKey({
        ruleId: rule.ruleId,
        cadence: rule.cadence,
        boundaryOrdinal,
      }),
      ruleId: rule.ruleId,
      kind,
      cycle: occurrenceIndex + 1,
      cadence: rule.cadence,
      boundaryOrdinal,
      anchorQueueSongId: clean(song.id),
      anchorQueueIndex: queueIndex,
    });
  });
  return desired;
};

const occurrenceIsHostOwned = (item = {}) => (
  item?.automationOccurrence?.placementMode === 'host_pinned'
  || item?.automationOccurrence?.contentOwnership === 'host'
  || PRESERVED_OCCURRENCE_STATUSES.has(clean(item?.status).toLowerCase())
);

const buildOccurrenceItem = (occurrence = {}, existingItem = null) => {
  const itemType = getOccurrenceItemType(occurrence.kind);
  const previousOccurrence = existingItem?.automationOccurrence || {};
  return createRunOfShowItem(itemType, {
    ...(existingItem || {}),
    id: existingItem?.id || `auto_${occurrence.occurrenceKey.replace(/[^a-z0-9]+/gi, '_')}`,
    type: itemType,
    title: existingItem?.title || getOccurrenceTitle(occurrence.kind),
    destination: 'queue',
    status: existingItem?.status || 'ready',
    automationOccurrence: {
      ...previousOccurrence,
      ...occurrence,
      source: AUTOMATION_SOURCE,
      lifecycleSlot: 'between_performances',
      placementMode: previousOccurrence.placementMode || 'automatic',
      contentOwnership: previousOccurrence.contentOwnership || 'automation',
      contentState: previousOccurrence.contentState || 'waiting_for_context',
    },
  });
};

export const reconcileBetweenSongMomentOccurrences = ({
  director = {},
  roomCode = '',
  party = {},
  queueSongs = [],
  completedSongs = [],
} = {}) => {
  const normalizedDirector = normalizeRunOfShowDirector(director || {});
  const desired = buildDesiredBetweenSongOccurrences({ roomCode, party, queueSongs, completedSongs });
  const completedCount = getCompletedPerformanceHistory(completedSongs).length;
  const desiredByKey = new Map(desired.map((entry) => [entry.occurrenceKey, entry]));
  const suppressedKeys = new Set(
    (Array.isArray(normalizedDirector?.betweenSongAutomation?.suppressedOccurrenceKeys)
      ? normalizedDirector.betweenSongAutomation.suppressedOccurrenceKeys
      : [])
      .map(clean)
      .filter(Boolean)
  );
  const retainedItems = [];
  const retainedOccurrenceKeys = new Set();

  normalizedDirector.items.forEach((item) => {
    const occurrence = item?.automationOccurrence;
    if (occurrence?.source !== AUTOMATION_SOURCE || !clean(occurrence?.occurrenceKey)) {
      retainedItems.push(item);
      return;
    }
    const occurrenceKey = clean(occurrence.occurrenceKey);
    const desiredOccurrence = desiredByKey.get(occurrenceKey);
    if (desiredOccurrence) {
      retainedItems.push(occurrenceIsHostOwned(item) ? item : buildOccurrenceItem(desiredOccurrence, item));
      retainedOccurrenceKeys.add(occurrenceKey);
      return;
    }
    if (Number(occurrence?.boundaryOrdinal || 0) <= completedCount) {
      retainedItems.push(item);
      retainedOccurrenceKeys.add(occurrenceKey);
      return;
    }
    if (occurrenceIsHostOwned(item)) {
      retainedItems.push(item);
      retainedOccurrenceKeys.add(occurrenceKey);
    }
  });

  desired.forEach((occurrence) => {
    if (suppressedKeys.has(occurrence.occurrenceKey) || retainedOccurrenceKeys.has(occurrence.occurrenceKey)) return;
    retainedItems.push(buildOccurrenceItem(occurrence));
    retainedOccurrenceKeys.add(occurrence.occurrenceKey);
  });

  const movableOccurrences = retainedItems.filter((item) => (
    item?.automationOccurrence?.source === AUTOMATION_SOURCE
    && !occurrenceIsHostOwned(item)
  ));
  const fixedItems = retainedItems.filter((item) => !movableOccurrences.includes(item));
  const movableByAnchor = new Map();
  movableOccurrences.forEach((item) => {
    const anchorQueueSongId = clean(item?.automationOccurrence?.anchorQueueSongId);
    const anchored = movableByAnchor.get(anchorQueueSongId) || [];
    anchored.push(item);
    movableByAnchor.set(anchorQueueSongId, anchored);
  });
  const placedOccurrenceIds = new Set();
  const orderedItems = [];
  fixedItems.forEach((item) => {
    orderedItems.push(item);
    if (item?.type !== 'performance') return;
    const queueSongId = clean(item?.queueSongId || item?.preparedQueueSongId || item?.songDocId);
    (movableByAnchor.get(queueSongId) || []).forEach((occurrenceItem) => {
      orderedItems.push(occurrenceItem);
      placedOccurrenceIds.add(occurrenceItem.id);
    });
  });
  movableOccurrences.forEach((item) => {
    if (!placedOccurrenceIds.has(item.id)) orderedItems.push(item);
  });

  const nextDirector = normalizeRunOfShowDirector({
    ...normalizedDirector,
    betweenSongAutomation: {
      ...(normalizedDirector.betweenSongAutomation || {}),
      ruleId: normalizeBetweenSongMomentRule({ roomCode, party }).ruleId,
      suppressedOccurrenceKeys: [...suppressedKeys].slice(-120),
      lastReconciledQueueSongIds: (Array.isArray(queueSongs) ? queueSongs : []).map((song) => clean(song?.id)).filter(Boolean),
    },
    items: resequenceRunOfShowItems(orderedItems),
  });
  return {
    director: nextDirector,
    desiredOccurrences: desired,
    changed: JSON.stringify(nextDirector) !== JSON.stringify(normalizedDirector),
  };
};

export const suppressBetweenSongOccurrence = (director = {}, itemId = '') => {
  const normalizedDirector = normalizeRunOfShowDirector(director || {});
  const target = normalizedDirector.items.find((item) => item.id === clean(itemId));
  const occurrenceKey = clean(target?.automationOccurrence?.occurrenceKey);
  if (!occurrenceKey) return normalizedDirector;
  const suppressed = new Set([
    ...(normalizedDirector?.betweenSongAutomation?.suppressedOccurrenceKeys || []),
    occurrenceKey,
  ].map(clean).filter(Boolean));
  return normalizeRunOfShowDirector({
    ...normalizedDirector,
    betweenSongAutomation: {
      ...(normalizedDirector.betweenSongAutomation || {}),
      suppressedOccurrenceKeys: [...suppressed].slice(-120),
    },
    items: normalizedDirector.items.filter((item) => item.id !== target.id),
  });
};

export const buildUnifiedTonightLineup = buildCanonicalTonightLineup;
