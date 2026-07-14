export const summarizeBrowseCoverage = (songs = []) => {
  const safeSongs = Array.isArray(songs) ? songs : [];
  const totalCount = safeSongs.length;
  const readyCount = safeSongs.filter((song) => song?.hasApprovedBacking === true).length;
  const reviewCount = Math.max(0, totalCount - readyCount);
  const readyPercent = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
  const readiness = readyCount === totalCount && totalCount > 0
    ? 'complete'
    : readyPercent >= 60
      ? 'strong'
      : readyCount > 0
        ? 'partial'
        : 'empty';
  return { totalCount, readyCount, reviewCount, readyPercent, readiness };
};

export const isBrowseCollectionReadyForTonight = (collection = {}, {
  minimumReadyCount = 3,
  minimumReadyPercent = 60,
} = {}) => Number(collection?.coverage?.readyCount || 0) >= minimumReadyCount
  && Number(collection?.coverage?.readyPercent || 0) >= minimumReadyPercent;

export const sortBrowseCollectionsByReadiness = (collections = []) => (
  [...(Array.isArray(collections) ? collections : [])].sort((left, right) => (
    Number(right?.coverage?.readyPercent || 0) - Number(left?.coverage?.readyPercent || 0)
    || Number(right?.coverage?.readyCount || 0) - Number(left?.coverage?.readyCount || 0)
    || String(left?.title || '').localeCompare(String(right?.title || ''))
  ))
);
