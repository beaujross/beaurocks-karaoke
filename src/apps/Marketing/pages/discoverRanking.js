const EARTH_RADIUS_MILES = 3958.8;
const MS_PER_HOUR = 60 * 60 * 1000;

export const LIVE_LOOKBACK_MS = 2 * MS_PER_HOUR;
const SOON_LOOKAHEAD_MS = 8 * MS_PER_HOUR;

const toRadians = (value = 0) => (Number(value || 0) * Math.PI) / 180;

export const calculateDistanceMiles = (from = null, to = null) => {
  if (!from || !to) return null;
  const lat1 = Number(from.lat);
  const lng1 = Number(from.lng);
  const lat2 = Number(to.lat);
  const lng2 = Number(to.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((EARTH_RADIUS_MILES * c).toFixed(2));
};

export const formatDistanceLabel = (distanceMiles = null) => {
  const miles = Number(distanceMiles);
  if (!Number.isFinite(miles) || miles < 0) return "";
  if (miles < 0.2) {
    const feet = Math.max(100, Math.round(miles * 5280));
    return `${feet.toLocaleString()} ft away`;
  }
  return `${miles.toFixed(1)} mi away`;
};

export const computeTimePriority = (startsAtMs = 0, nowMs = Date.now()) => {
  const starts = Number(startsAtMs || 0);
  if (starts <= 0) return 0;
  const delta = starts - nowMs;
  if (delta >= -LIVE_LOOKBACK_MS && delta <= SOON_LOOKAHEAD_MS) return 44;
  if (delta > SOON_LOOKAHEAD_MS && delta <= 24 * MS_PER_HOUR) return 28;
  if (delta > 24 * MS_PER_HOUR && delta <= 72 * MS_PER_HOUR) return 16;
  if (delta < -LIVE_LOOKBACK_MS && delta >= -24 * MS_PER_HOUR) return 12;
  return 6;
};

export const scoreSearchRelevance = (entry = {}, searchQuery = "") => {
  const query = String(searchQuery || "").trim().toLowerCase();
  if (!query) return 0;
  const title = String(entry?.title || "").toLowerCase();
  const subtitle = String(entry?.subtitle || "").toLowerCase();
  const detail = String(entry?.detailLine || "").toLowerCase();
  if (title.startsWith(query)) return 26;
  if (title.includes(query)) return 18;
  if (subtitle.includes(query)) return 12;
  if (detail.includes(query)) return 8;
  return 0;
};

export const sortDiscoverListings = (a, b) => {
  const aStarts = Number(a?.startsAtMs || 0);
  const bStarts = Number(b?.startsAtMs || 0);
  if (aStarts > 0 && bStarts > 0 && aStarts !== bStarts) return aStarts - bStarts;
  if (aStarts > 0 && bStarts <= 0) return -1;
  if (aStarts <= 0 && bStarts > 0) return 1;
  return String(a?.title || "").localeCompare(String(b?.title || ""));
};

const decorateListing = ({
  entry = {},
  userLocation = null,
  search = "",
  rankingNowMs = Date.now(),
  deriveExperience = (candidate) => candidate?.experience || {},
  calculateDistance = calculateDistanceMiles,
  formatDistance = formatDistanceLabel,
} = {}) => {
  const experience = entry.experience || deriveExperience(entry);
  const distanceMiles = calculateDistance(userLocation, entry.location);
  const distanceScore = Number.isFinite(distanceMiles)
    ? Math.max(0, 32 - (distanceMiles * 1.8))
    : 0;
  const typeBonus = entry.listingType === "event" ? 12 : entry.listingType === "room_session" ? 8 : 5;
  const elevatedBonus = entry.isOfficialBeauRocksListing ? 32 : entry.isBeauRocksElevated ? 20 : 0;
  const score = computeTimePriority(entry.startsAtMs, rankingNowMs)
    + distanceScore
    + typeBonus
    + elevatedBonus
    + Number(experience.discoveryBoost || 0)
    + scoreSearchRelevance(entry, search);

  return {
    ...entry,
    experience,
    distanceMiles: Number.isFinite(distanceMiles) ? distanceMiles : null,
    distanceLabel: formatDistance(distanceMiles),
    score,
  };
};

const compareNearestListings = (a, b, sortListings) => {
  const aDistance = Number(a?.distanceMiles);
  const bDistance = Number(b?.distanceMiles);
  const aHasDistance = Number.isFinite(aDistance);
  const bHasDistance = Number.isFinite(bDistance);
  if (aHasDistance && bHasDistance && aDistance !== bDistance) return aDistance - bDistance;
  if (aHasDistance && !bHasDistance) return -1;
  if (!aHasDistance && bHasDistance) return 1;
  return sortListings(a, b);
};

const buildHostRanks = (listings = []) => {
  const hostRanks = new Map();
  listings.forEach((entry) => {
    const token = String(entry?.hostToken || "").trim();
    if (!token) return;
    const existing = hostRanks.get(token) || {
      bestScore: Number.NEGATIVE_INFINITY,
      soonestMs: Number.POSITIVE_INFINITY,
      count: 0,
    };
    existing.bestScore = Math.max(existing.bestScore, Number(entry?.score || 0));
    const startsAtMs = Number(entry?.startsAtMs || 0);
    if (startsAtMs > 0) existing.soonestMs = Math.min(existing.soonestMs, startsAtMs);
    existing.count += 1;
    hostRanks.set(token, existing);
  });
  return hostRanks;
};

const compareHostFirstListings = (a, b, hostRanks, sortListings) => {
  const aToken = String(a?.hostToken || "").trim();
  const bToken = String(b?.hostToken || "").trim();
  const aHasHost = !!aToken;
  const bHasHost = !!bToken;
  if (aHasHost !== bHasHost) return aHasHost ? -1 : 1;

  if (aHasHost && bHasHost && aToken !== bToken) {
    const aRank = hostRanks.get(aToken) || {
      bestScore: Number.NEGATIVE_INFINITY,
      soonestMs: Number.POSITIVE_INFINITY,
      count: 0,
    };
    const bRank = hostRanks.get(bToken) || {
      bestScore: Number.NEGATIVE_INFINITY,
      soonestMs: Number.POSITIVE_INFINITY,
      count: 0,
    };
    if (aRank.bestScore !== bRank.bestScore) return bRank.bestScore - aRank.bestScore;
    if (aRank.soonestMs !== bRank.soonestMs) return aRank.soonestMs - bRank.soonestMs;
    if (aRank.count !== bRank.count) return bRank.count - aRank.count;
    const aHostName = String(a?.hostName || "");
    const bHostName = String(b?.hostName || "");
    const hostNameCompare = aHostName.localeCompare(bHostName);
    if (hostNameCompare !== 0) return hostNameCompare;
  }

  if (aHasHost && bHasHost && aToken === bToken) {
    const withinHost = sortListings(a, b);
    if (withinHost !== 0) return withinHost;
    if (a.score !== b.score) return b.score - a.score;
    return String(a?.title || "").localeCompare(String(b?.title || ""));
  }

  if (a.score !== b.score) return b.score - a.score;
  return sortListings(a, b);
};

export const rankDiscoverListings = ({
  listings = [],
  userLocation = null,
  search = "",
  rankingNowMs = Date.now(),
  sortMode = "",
  deriveExperience = (candidate) => candidate?.experience || {},
  calculateDistance = calculateDistanceMiles,
  formatDistance = formatDistanceLabel,
  sortListings = sortDiscoverListings,
} = {}) => {
  const withSignals = (Array.isArray(listings) ? listings : []).map((entry) => decorateListing({
    entry,
    userLocation,
    search,
    rankingNowMs,
    deriveExperience,
    calculateDistance,
    formatDistance,
  }));

  if (sortMode === "soonest") {
    return withSignals.slice().sort(sortListings);
  }
  if (sortMode === "nearest") {
    return withSignals.slice().sort((a, b) => compareNearestListings(a, b, sortListings));
  }
  if (sortMode === "host_first") {
    const hostRanks = buildHostRanks(withSignals);
    return withSignals.slice().sort((a, b) => compareHostFirstListings(a, b, hostRanks, sortListings));
  }
  return withSignals.slice().sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return sortListings(a, b);
  });
};
