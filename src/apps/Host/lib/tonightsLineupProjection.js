const clean = (value = '') => String(value || '').trim();
const ACTIVE_STATUSES = new Set(['draft', 'planned', 'prepared', 'queued', 'pending', 'ready', 'staged', 'live', 'blocked']);

const buildQueueLookup = (queueSongs = []) => {
  const lookup = new Map();
  (Array.isArray(queueSongs) ? queueSongs : []).forEach((song) => {
    [song?.id, song?.songDocId, song?.songId].map(clean).filter(Boolean).forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, song);
    });
  });
  return lookup;
};

const getDirectorQueueSongId = (item = {}) => clean(
  item?.queueSongId
  || item?.preparedQueueSongId
  || (item?.type === 'performance' ? item?.songDocId : '')
);

const joinDirectorItem = (item = {}, queueLookup = new Map()) => {
  const queueSongId = getDirectorQueueSongId(item);
  const queueSong = queueSongId ? queueLookup.get(queueSongId) || null : null;
  if (item?.type !== 'performance') {
    return {
      ...item,
      projectionSource: 'director',
    };
  }
  return {
    ...item,
    queueSongId,
    preparedQueueSongId: queueSongId || clean(item?.preparedQueueSongId),
    assignedPerformerUid: clean(queueSong?.singerUid || item?.assignedPerformerUid),
    assignedPerformerName: clean(queueSong?.singerName || item?.assignedPerformerName) || 'Guest',
    songId: clean(queueSong?.songId || item?.songId),
    songTitle: clean(queueSong?.songTitle || queueSong?.title || item?.songTitle) || 'Song not assigned',
    artistName: clean(queueSong?.artist || queueSong?.artistName || item?.artistName),
    status: queueSongId && !queueSong ? 'blocked' : item?.status,
    blockedReason: queueSongId && !queueSong ? 'missing_queue_performance' : item?.blockedReason,
    referenceState: queueSongId ? (queueSong ? 'linked' : 'missing') : 'unlinked',
    projectionSource: 'director',
    queueSong: queueSong || undefined,
  };
};

const buildQueueProjection = (song = {}) => ({
  id: `queue_${clean(song?.id)}`,
  type: 'performance',
  status: 'ready',
  destination: 'queue',
  projectionSource: 'queue_song',
  queueSongId: clean(song?.id),
  preparedQueueSongId: clean(song?.id),
  assignedPerformerUid: clean(song?.singerUid),
  assignedPerformerName: clean(song?.singerName) || 'Guest',
  songId: clean(song?.songId),
  songTitle: clean(song?.songTitle || song?.title) || 'Song not assigned',
  artistName: clean(song?.artist || song?.artistName),
  queueSong: song,
});

const projectLegacyAnchoredMoments = ({ queueSongs = [], directorItems = [] } = {}) => {
  const anchoredBySongId = new Map();
  const unanchored = [];
  directorItems.forEach((item) => {
    const anchorId = clean(item?.automationOccurrence?.anchorQueueSongId);
    if (!anchorId) {
      unanchored.push(item);
      return;
    }
    const current = anchoredBySongId.get(anchorId) || [];
    current.push(item);
    anchoredBySongId.set(anchorId, current);
  });
  const queueSongIds = new Set(queueSongs.map((song) => clean(song?.id)).filter(Boolean));
  const projected = [];
  anchoredBySongId.forEach((items, anchorId) => {
    if (queueSongIds.has(anchorId)) return;
    items.forEach((item) => projected.push({ ...item, projectionSource: 'director' }));
  });
  queueSongs.forEach((song) => {
    if (!clean(song?.id)) return;
    projected.push(buildQueueProjection(song));
    (anchoredBySongId.get(clean(song.id)) || []).forEach((item) => projected.push({ ...item, projectionSource: 'director' }));
  });
  unanchored
    .sort((left, right) => Number(left?.sequence || 0) - Number(right?.sequence || 0))
    .forEach((item) => projected.push({ ...item, projectionSource: 'director' }));
  return projected;
};

export const buildCanonicalTonightLineup = ({ queueSongs = [], directorItems = [] } = {}) => {
  const orderedQueueSongs = (Array.isArray(queueSongs) ? queueSongs : [])
    .filter((song) => clean(song?.id))
    .sort((left, right) => Number(left?.priorityScore || 0) - Number(right?.priorityScore || 0));
  const activeDirectorItems = (Array.isArray(directorItems) ? directorItems : [])
    .filter((item) => item?.destination !== 'planner')
    .filter((item) => ACTIVE_STATUSES.has(clean(item?.status).toLowerCase()))
    .sort((left, right) => Number(left?.sequence || 0) - Number(right?.sequence || 0));
  const onlyLegacyAnchoredAutomation = activeDirectorItems.length > 0
    && activeDirectorItems.every((item) => (
      item?.type !== 'performance'
      && clean(item?.automationOccurrence?.anchorQueueSongId)
    ));

  if (onlyLegacyAnchoredAutomation) {
    return projectLegacyAnchoredMoments({
      queueSongs: orderedQueueSongs,
      directorItems: activeDirectorItems,
    }).map((item, index) => ({ ...item, projectedSequence: index + 1 }));
  }

  const queueLookup = buildQueueLookup(orderedQueueSongs);
  const linkedQueueSongIds = new Set(
    activeDirectorItems.map(getDirectorQueueSongId).filter(Boolean)
  );
  const canonicalItems = activeDirectorItems.map((item) => joinDirectorItem(item, queueLookup));
  orderedQueueSongs.forEach((song) => {
    if (!linkedQueueSongIds.has(clean(song?.id))) {
      canonicalItems.push(buildQueueProjection(song));
    }
  });
  return canonicalItems.map((item, index) => ({ ...item, projectedSequence: index + 1 }));
};

export default buildCanonicalTonightLineup;
