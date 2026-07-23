const PUBLIC_SONG_LEADER_LIMIT = 3;

const safeNumber = (value = 0) => Math.max(0, Number(value || 0) || 0);
const safeText = (value = "", maxLength = 120) => String(value || "").trim().slice(0, maxLength);

const buildPublicSongLeaderEntry = (source = {}) => {
  const resultId = safeText(source.resultId || source.id, 80);
  if (!resultId) return null;
  const identityVisibility = safeText(source.identityVisibility, 24) === "anonymous"
    ? "anonymous"
    : "public";
  return {
    resultId,
    memberKey: safeText(source.memberKey, 48) || null,
    displayName: identityVisibility === "anonymous"
      ? "BeauRocks Singer"
      : (safeText(source.displayName || source.singerName, 80) || "BeauRocks Singer"),
    identityVisibility,
    avatarUrl: identityVisibility === "public" ? (safeText(source.avatarUrl, 500) || null) : null,
    score: safeNumber(source.score ?? source.bestScore ?? source.totalScore),
    applauseScore: safeNumber(source.applauseScore),
    qualifiedNightLabel: safeText(source.qualifiedNightLabel, 120) || "Approved BeauRocks night",
    performedAtMs: safeNumber(source.performedAtMs),
  };
};

const comparePublicSongLeaders = (left = {}, right = {}) => (
  safeNumber(right.score) - safeNumber(left.score)
  || safeNumber(right.applauseScore) - safeNumber(left.applauseScore)
  || safeNumber(right.performedAtMs) - safeNumber(left.performedAtMs)
  || String(left.resultId || "").localeCompare(String(right.resultId || ""))
);

const mergePublicSongLeaders = (
  currentLeaders = [],
  candidate = null,
  limit = PUBLIC_SONG_LEADER_LIMIT
) => {
  const byResult = new Map();
  [...(Array.isArray(currentLeaders) ? currentLeaders : []), candidate]
    .filter(Boolean)
    .forEach((entry) => {
      const normalized = buildPublicSongLeaderEntry(entry);
      if (!normalized) return;
      byResult.set(normalized.resultId, normalized);
    });
  return [...byResult.values()]
    .sort(comparePublicSongLeaders)
    .slice(0, Math.max(1, Math.min(PUBLIC_SONG_LEADER_LIMIT, Number(limit || PUBLIC_SONG_LEADER_LIMIT))));
};

module.exports = {
  PUBLIC_SONG_LEADER_LIMIT,
  buildPublicSongLeaderEntry,
  comparePublicSongLeaders,
  mergePublicSongLeaders,
};
