const normalizeSongIntentText = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/karaoke|official|instrumental|backing track|lyrics video|lyric video|hd|4k/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const tokenizeSongIntent = (value = '') => normalizeSongIntentText(value)
  .split(' ')
  .map((token) => token.trim())
  .filter(Boolean);

const overlapCount = (left = [], right = []) => {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  return left.reduce((count, token) => count + (rightSet.has(token) ? 1 : 0), 0);
};

const scoreTextMatch = (needle = '', haystack = '') => {
  const safeNeedle = normalizeSongIntentText(needle);
  const safeHaystack = normalizeSongIntentText(haystack);
  if (!safeNeedle || !safeHaystack) return 0;
  if (safeNeedle === safeHaystack) return 120;
  if (safeHaystack.includes(safeNeedle) || safeNeedle.includes(safeHaystack)) return 80;
  const needleTokens = tokenizeSongIntent(safeNeedle);
  const hayTokens = tokenizeSongIntent(safeHaystack);
  return overlapCount(needleTokens, hayTokens) * 12;
};

const buildCatalogCandidateId = (candidate = {}, fallback = '') => (
  String(candidate.trackId || candidate.videoId || candidate.appleMusicId || candidate.mediaUrl || candidate.url || fallback || '')
);

const candidateLayerWeight = (layer = '') => {
  const safeLayer = String(layer || '').trim().toLowerCase();
  if (safeLayer === 'host_favorite') return 120;
  if (safeLayer === 'room_recent') return 85;
  if (safeLayer === 'global_approved') return 70;
  if (safeLayer === 'global_catalog') return 40;
  return 15;
};

const buildTrustedCandidate = ({
  songId = '',
  title = '',
  artist = '',
  trackId = '',
  mediaUrl = '',
  appleMusicId = '',
  source = '',
  label = '',
  layer = 'global_catalog',
  qualityScore = 0,
  successCount = 0,
  usageCount = 0,
  approvalState = '',
  reason = ''
} = {}) => ({
  id: buildCatalogCandidateId({ trackId, mediaUrl, appleMusicId }, `${songId}:${layer}`),
  songId: String(songId || '').trim(),
  trackId: String(trackId || '').trim(),
  mediaUrl: String(mediaUrl || '').trim(),
  appleMusicId: String(appleMusicId || '').trim(),
  source: String(source || '').trim().toLowerCase(),
  title: String(title || '').trim(),
  artist: String(artist || '').trim(),
  label: String(label || '').trim(),
  layer: String(layer || 'global_catalog').trim(),
  qualityScore: Number(qualityScore || 0),
  successCount: Number(successCount || 0),
  usageCount: Number(usageCount || 0),
  approvalState: String(approvalState || '').trim().toLowerCase(),
  reason: String(reason || '').trim()
});

const buildYouTubeIndexCandidate = (entry = {}) => ({
  id: buildCatalogCandidateId(entry, `${entry.trackName || ''}:${entry.artistName || ''}`),
  songId: '',
  trackId: '',
  mediaUrl: String(entry.url || '').trim(),
  appleMusicId: '',
  source: 'youtube',
  title: String(entry.trackName || '').trim(),
  artist: String(entry.artistName || '').trim(),
  label: 'Host-curated YouTube',
  layer: 'room_recent',
  qualityScore: Number(entry.qualityScore || 0),
  successCount: Number(entry.successCount || 0),
  usageCount: Number(entry.usageCount || 0),
  approvalState: entry.playable === true ? 'approved' : 'candidate',
  reason: 'Matches the host-curated room library.'
});

const rankSongRequestCandidates = ({
  request = {},
  trustedCatalogEntry = null,
  catalogCandidates = [],
  ytIndex = []
} = {}) => {
  const requestTitle = String(request.songTitle || request.title || '').trim();
  const requestArtist = String(request.artist || '').trim();
  const requestSongId = String(request.songId || '').trim();
  const rawCandidates = [];
  const seen = new Set();
  const pushCandidate = (candidateInput) => {
    const candidate = candidateInput && typeof candidateInput === 'object' ? candidateInput : null;
    if (!candidate) return;
    const key = buildCatalogCandidateId(candidate, `${candidate.title || ''}:${candidate.artist || ''}:${candidate.layer || ''}`);
    if (!key || seen.has(key)) return;
    seen.add(key);
    rawCandidates.push(candidate);
  };

  if (trustedCatalogEntry && typeof trustedCatalogEntry === 'object') {
    const songTitle = String(trustedCatalogEntry.title || requestTitle).trim();
    const songArtist = String(trustedCatalogEntry.artist || requestArtist).trim();
    if (trustedCatalogEntry.hostFavoriteTrackId || trustedCatalogEntry.hostFavoriteMediaUrl || trustedCatalogEntry.hostFavoriteAppleMusicId) {
      pushCandidate(buildTrustedCandidate({
        songId: requestSongId || trustedCatalogEntry.songId || '',
        title: songTitle,
        artist: songArtist,
        trackId: trustedCatalogEntry.hostFavoriteTrackId,
        mediaUrl: trustedCatalogEntry.hostFavoriteMediaUrl,
        appleMusicId: trustedCatalogEntry.hostFavoriteAppleMusicId,
        source: trustedCatalogEntry.hostFavoriteSource,
        label: trustedCatalogEntry.hostFavoriteLabel || 'Host favorite',
        layer: 'host_favorite',
        qualityScore: trustedCatalogEntry.hostFavoriteQualityScore,
        successCount: trustedCatalogEntry.hostFavoriteSuccessCount,
        usageCount: trustedCatalogEntry.hostFavoriteUsageCount,
        approvalState: trustedCatalogEntry.hostFavoriteApprovalState || 'approved',
        reason: 'Preferred room or venue pick for this song.'
      }));
    }
    if (trustedCatalogEntry.roomRecentTrackId || trustedCatalogEntry.roomRecentMediaUrl || trustedCatalogEntry.roomRecentAppleMusicId) {
      pushCandidate(buildTrustedCandidate({
        songId: requestSongId || trustedCatalogEntry.songId || '',
        title: songTitle,
        artist: songArtist,
        trackId: trustedCatalogEntry.roomRecentTrackId,
        mediaUrl: trustedCatalogEntry.roomRecentMediaUrl,
        appleMusicId: trustedCatalogEntry.roomRecentAppleMusicId,
        source: trustedCatalogEntry.roomRecentSource,
        label: trustedCatalogEntry.roomRecentLabel || 'Room recent',
        layer: 'room_recent',
        qualityScore: trustedCatalogEntry.roomRecentQualityScore,
        successCount: trustedCatalogEntry.roomRecentSuccessCount,
        usageCount: trustedCatalogEntry.roomRecentUsageCount,
        approvalState: trustedCatalogEntry.roomRecentApprovalState || 'candidate',
        reason: 'Recently worked in this room.'
      }));
    }
  }

  (Array.isArray(catalogCandidates) ? catalogCandidates : []).forEach((candidate) => {
    pushCandidate(buildTrustedCandidate({
      ...candidate,
      layer: candidate.layer || 'global_catalog'
    }));
  });

  (Array.isArray(ytIndex) ? ytIndex : []).forEach((entry) => {
    if (!entry || entry.playable === false) return;
    const titleScore = scoreTextMatch(requestTitle, entry.trackName || '');
    const artistScore = scoreTextMatch(requestArtist, entry.artistName || '');
    if ((titleScore + artistScore) < 40) return;
    pushCandidate(buildYouTubeIndexCandidate(entry));
  });

  return rawCandidates
    .map((candidate) => {
      const titleScore = scoreTextMatch(requestTitle, candidate.title || '');
      const artistScore = scoreTextMatch(requestArtist, candidate.artist || '');
      const layerScore = candidateLayerWeight(candidate.layer);
      const qualityScore = Number(candidate.qualityScore || 0);
      const successScore = Math.min(40, Number(candidate.successCount || 0) * 4);
      const usageScore = Math.min(24, Number(candidate.usageCount || 0) * 2);
      const approvalScore = candidate.approvalState === 'approved'
        ? 20
        : candidate.approvalState === 'submitted'
          ? 12
          : 0;
      return {
        ...candidate,
        titleScore,
        artistScore,
        score: layerScore + titleScore + artistScore + qualityScore + successScore + usageScore + approvalScore
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
};

const buildTrustedCatalogEntry = ({
  existing = {},
  songId = '',
  title = '',
  artist = '',
  trackId = '',
  mediaUrl = '',
  appleMusicId = '',
  source = '',
  label = '',
  layer = 'room_recent',
  qualityScore = 0,
  approvalState = '',
  nowMs = Date.now()
} = {}) => {
  const safeLayer = String(layer || 'room_recent').trim().toLowerCase();
  const next = {
    ...(existing && typeof existing === 'object' ? existing : {}),
    songId: String(songId || existing?.songId || '').trim(),
    title: String(title || existing?.title || '').trim(),
    artist: String(artist || existing?.artist || '').trim(),
    updatedAtMs: Number(nowMs || Date.now())
  };
  const prefix = safeLayer === 'host_favorite' ? 'hostFavorite' : 'roomRecent';
  next[`${prefix}TrackId`] = String(trackId || '').trim() || '';
  next[`${prefix}MediaUrl`] = String(mediaUrl || '').trim() || '';
  next[`${prefix}AppleMusicId`] = String(appleMusicId || '').trim() || '';
  next[`${prefix}Source`] = String(source || '').trim().toLowerCase() || '';
  next[`${prefix}Label`] = String(label || '').trim() || '';
  next[`${prefix}QualityScore`] = Number(qualityScore || 0);
  next[`${prefix}ApprovalState`] = String(approvalState || (safeLayer === 'host_favorite' ? 'approved' : 'candidate')).trim().toLowerCase();
  next[`${prefix}UsageCount`] = Math.max(1, Number(next[`${prefix}UsageCount`] || 0) + 1);
  next[`${prefix}SuccessCount`] = Math.max(
    safeLayer === 'room_recent' ? 1 : 0,
    Number(next[`${prefix}SuccessCount`] || 0) + (safeLayer === 'room_recent' ? 1 : 0)
  );
  next[`${prefix}UpdatedAtMs`] = Number(nowMs || Date.now());
  return next;
};

const getRoomUserTight15Titles = (roomUser = {}) => {
  const list = Array.isArray(roomUser?.tight15)
    ? roomUser.tight15
    : (Array.isArray(roomUser?.tight15Temp) ? roomUser.tight15Temp : []);
  return list
    .map((entry) => buildSongKeyFromLooseEntry(entry?.songTitle || entry?.title || '', entry?.artist || entry?.artistName || 'Unknown'))
    .filter(Boolean);
};

const buildSongKeyFromLooseEntry = (title = '', artist = '') => {
  const safeTitle = normalizeSongIntentText(title);
  const safeArtist = normalizeSongIntentText(artist || 'unknown') || 'unknown';
  if (!safeTitle) return '';
  return `${safeTitle}__${safeArtist}`;
};

const buildCollaborationSuggestionMap = ({
  songs = [],
  users = []
} = {}) => {
  const safeSongs = Array.isArray(songs) ? songs : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const usersByUid = new Map(
    safeUsers
      .filter((entry) => entry && entry.uid)
      .map((entry) => [String(entry.uid), entry])
  );
  const optedIn = safeSongs.filter((song) => (
    ['requested', 'pending'].includes(String(song?.status || '').trim().toLowerCase())
    && song?.collabOpen === true
    && String(song?.resolutionStatus || '').trim().toLowerCase() !== 'rejected'
  ));
  const groups = new Map();
  optedIn.forEach((song) => {
    const key = String(song.songId || buildSongKeyFromLooseEntry(song.songTitle, song.artist)).trim();
    if (!key) return;
    const group = groups.get(key) || [];
    group.push(song);
    groups.set(key, group);
  });

  const suggestions = {};
  groups.forEach((group) => {
    if (group.length < 2) return;
    group.forEach((song) => {
      const partners = group
        .filter((entry) => entry.id !== song.id)
        .map((entry) => {
          const roomUser = usersByUid.get(String(entry.singerUid || ''));
          const requesterTight15 = new Set(getRoomUserTight15Titles(usersByUid.get(String(song.singerUid || ''))));
          const partnerTight15 = getRoomUserTight15Titles(roomUser);
          const requestSongKey = String(song.songId || buildSongKeyFromLooseEntry(song.songTitle, song.artist)).trim();
          const tight15Overlap = partnerTight15.includes(requestSongKey) && requesterTight15.has(requestSongKey);
          return {
            requestId: entry.id,
            singerUid: entry.singerUid || '',
            singerName: entry.singerName || 'Guest',
            emoji: entry.emoji || '',
            sameSong: true,
            tight15Overlap
          };
        });
      if (partners.length) suggestions[song.id] = partners;
    });
  });
  return suggestions;
};

export {
  normalizeSongIntentText,
  buildSongKeyFromLooseEntry,
  buildTrustedCatalogEntry,
  rankSongRequestCandidates,
  buildCollaborationSuggestionMap
};
