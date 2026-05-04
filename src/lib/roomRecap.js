const PERFORMED_STATUSES = new Set(["performed", "completed", "done"]);

export const RECAP_SUMMARY_VERSION = 2;

export const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") return value.toMillis();
  const seconds = Number(value?.seconds ?? value?._seconds ?? 0);
  const nanos = Number(value?.nanoseconds ?? value?._nanoseconds ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round((seconds * 1000) + (nanos / 1e6));
};

export const normalizeName = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const firstNameToken = (value = "") => normalizeName(value).split(" ")[0] || "";

export const participantKey = ({ name = "", uid = "" } = {}) => {
  const safeName = normalizeName(name);
  const safeUid = String(uid || "").trim().toLowerCase();
  return safeUid || safeName || "";
};

export const buildRoomRecapUrl = (roomCode = "", origin = "") => {
  const safeRoomCode = String(roomCode || "").trim().toUpperCase();
  if (!safeRoomCode) return "";
  const query = `?room=${encodeURIComponent(safeRoomCode)}&mode=recap`;
  const safeOrigin = String(origin || "").trim().replace(/\/+$/, "");
  return safeOrigin ? `${safeOrigin}/${query}`.replace("/?", "?") : `/${query}`.replace("/?", "?");
};

const labelFor = (value = "", fallback = "") => String(value || "").trim() || fallback;

export const getSongArtworkUrl = (song = {}) =>
  String(
    song?.albumArtUrl
    || song?.artworkUrl600
    || song?.artworkUrl512
    || song?.artworkUrl300
    || song?.artworkUrl100
    || song?.artworkUrl60
    || song?.artworkUrl
    || song?.art
    || ""
  ).trim();

const sortByTimestampDesc = (left = {}, right = {}) => {
  const leftMs = Math.max(
    toMillis(left?.timestamp),
    toMillis(left?.createdAt),
    toMillis(left?.updatedAt)
  );
  const rightMs = Math.max(
    toMillis(right?.timestamp),
    toMillis(right?.createdAt),
    toMillis(right?.updatedAt)
  );
  return rightMs - leftMs;
};

const sumReactionCount = (entry = {}) => Math.max(0, safeNumber(entry?.count, 1) || 1);

const mergeParticipantProfile = (current = {}, incoming = {}) => ({
  key: String(current?.key || incoming?.key || "").trim().toLowerCase(),
  uid: String(current?.uid || incoming?.uid || "").trim(),
  name: labelFor(current?.name, labelFor(incoming?.name, "Guest")),
  avatar: labelFor(current?.avatar, labelFor(incoming?.avatar, "")),
});

const buildParticipantLookup = ({ users = [], songs = [] } = {}) => {
  const byKey = new Map();
  const byUid = new Map();
  const byName = new Map();
  const firstNameEntries = new Map();

  const register = ({ uid = "", name = "", avatar = "", includeFirstName = true } = {}) => {
    const normalizedUid = String(uid || "").trim().toLowerCase();
    const normalizedName = normalizeName(name);
    const key = normalizedUid || normalizedName;
    if (!key) return;
    const merged = mergeParticipantProfile(byKey.get(key), {
      key,
      uid: normalizedUid,
      name: labelFor(name, "Guest"),
      avatar,
    });
    byKey.set(key, merged);
    if (normalizedUid) byUid.set(normalizedUid, merged);
    if (normalizedName) byName.set(normalizedName, merged);
    if (!includeFirstName) return;
    const firstName = firstNameToken(name);
    if (!firstName) return;
    const bucket = firstNameEntries.get(firstName) || [];
    if (!bucket.some((entry) => entry.key === merged.key)) bucket.push(merged);
    firstNameEntries.set(firstName, bucket);
  };

  users.forEach((entry) => {
    register({
      uid: entry?.uid,
      name: entry?.name,
      avatar: entry?.avatar,
      includeFirstName: true,
    });
  });
  songs.forEach((entry) => {
    register({
      uid: entry?.singerUid,
      name: entry?.singerName,
      avatar: entry?.avatar || entry?.emoji,
      includeFirstName: true,
    });
  });
  const uniqueFirstNameMap = new Map();
  firstNameEntries.forEach((entries, firstName) => {
    if (entries.length === 1) uniqueFirstNameMap.set(firstName, entries[0]);
  });

  const resolve = ({ uid = "", name = "", avatar = "" } = {}) => {
    const normalizedUid = String(uid || "").trim().toLowerCase();
    const normalizedName = normalizeName(name);
    const normalizedFirstName = firstNameToken(name);
    const matched = (
      (normalizedUid ? byUid.get(normalizedUid) : null)
      || (normalizedName ? byName.get(normalizedName) : null)
      || (normalizedFirstName ? uniqueFirstNameMap.get(normalizedFirstName) : null)
      || null
    );
    if (matched) {
      return mergeParticipantProfile(matched, {
        uid: normalizedUid,
        name: labelFor(name, matched.name || "Guest"),
        avatar,
      });
    }
    return mergeParticipantProfile({}, {
      key: normalizedUid || normalizedName,
      uid: normalizedUid,
      name: labelFor(name, "Guest"),
      avatar,
    });
  };

  return { resolve };
};

export const buildRoomRecapSummary = ({
  roomCode = "",
  room = {},
  songs = [],
  queuedSongs = null,
  performedSongs = null,
  users = [],
  reactions = [],
  activities = [],
  crowdSelfies = [],
  chatMessages = [],
  uploads = [],
  generatedAtMs = Date.now(),
  source = "room_close",
  window = null,
} = {}) => {
  const safeSongs = Array.isArray(songs) ? songs : [];
  const safeQueuedSongs = Array.isArray(queuedSongs) ? queuedSongs : safeSongs;
  const safeUsers = Array.isArray(users) ? users : [];
  const safeReactions = Array.isArray(reactions) ? reactions : [];
  const safeActivities = Array.isArray(activities) ? activities : [];
  const safeCrowdSelfies = Array.isArray(crowdSelfies) ? crowdSelfies : [];
  const safeChatMessages = Array.isArray(chatMessages) ? chatMessages : [];
  const safeUploads = Array.isArray(uploads) ? uploads : [];
  const safePerformedSongs = Array.isArray(performedSongs)
    ? performedSongs
    : safeSongs.filter((song) => PERFORMED_STATUSES.has(String(song?.status || "").trim().toLowerCase()));
  const nonPhotoReactions = safeReactions.filter((entry) => String(entry?.type || "").trim().toLowerCase() !== "photo");
  const photoReactions = safeReactions
    .filter((entry) => String(entry?.type || "").trim().toLowerCase() === "photo")
    .slice()
    .sort(sortByTimestampDesc);
  const approvedCrowdSelfies = safeCrowdSelfies
    .filter((entry) => {
      const status = String(entry?.status || "").trim().toLowerCase();
      return !status || status === "approved";
    })
    .slice()
    .sort(sortByTimestampDesc);
  const participantLookup = buildParticipantLookup({
    users: safeUsers,
    songs: safeSongs,
    reactions: nonPhotoReactions,
  });

  const uniqueParticipants = new Set(
    safeUsers
      .map((entry) => participantKey({ name: entry?.name, uid: entry?.uid }))
      .filter(Boolean)
  );
  const requesterCounts = new Map();
  safeQueuedSongs.forEach((song) => {
    const key = participantKey({ name: song?.singerName, uid: song?.singerUid });
    if (!key) return;
    requesterCounts.set(key, (requesterCounts.get(key) || 0) + 1);
  });
  const performerCounts = new Map();
  safePerformedSongs.forEach((song) => {
    const key = participantKey({ name: song?.singerName, uid: song?.singerUid });
    if (!key) return;
    performerCounts.set(key, (performerCounts.get(key) || 0) + 1);
  });

  const reactionCountsByParticipant = new Map();
  nonPhotoReactions.forEach((entry) => {
    const participant = participantLookup.resolve({
      uid: entry?.uid,
      name: entry?.userName || entry?.name,
      avatar: entry?.avatar,
    });
    const key = participant.key;
    if (!key) return;
    const current = reactionCountsByParticipant.get(key) || {
      key,
      name: participant.name,
      avatar: participant.avatar,
      count: 0,
    };
    current.count += sumReactionCount(entry);
    current.name = labelFor(current.name, participant.name || "Guest");
    current.avatar = labelFor(current.avatar, participant.avatar || "");
    reactionCountsByParticipant.set(key, current);
  });

  const reactionTypeCounts = new Map();
  nonPhotoReactions.forEach((entry) => {
    const type = String(entry?.type || "").trim().toLowerCase();
    if (!type) return;
    reactionTypeCounts.set(type, (reactionTypeCounts.get(type) || 0) + sumReactionCount(entry));
  });

  const topPerformersByKey = new Map();
  safePerformedSongs.forEach((song) => {
    const participant = participantLookup.resolve({
      uid: song?.singerUid,
      name: song?.singerName,
      avatar: song?.avatar || song?.emoji,
    });
    const key = participant.key;
    if (!key) return;
    const current = topPerformersByKey.get(key) || {
      key,
      uid: participant.uid,
      name: labelFor(participant.name, "Singer"),
      avatar: labelFor(participant.avatar, ""),
      performances: 0,
      loudest: 0,
    };
    current.performances += 1;
    current.loudest = Math.max(current.loudest, Math.max(0, safeNumber(song?.applauseScore, 0)));
    topPerformersByKey.set(key, current);
  });

  const topPerformances = safePerformedSongs
    .map((song, index) => {
      const participant = participantLookup.resolve({
        uid: song?.singerUid,
        name: song?.singerName,
        avatar: song?.avatar || song?.emoji,
      });
      const hypeScore = Math.max(0, safeNumber(song?.hypeScore, 0));
      const applauseScore = Math.max(0, safeNumber(song?.applauseScore, 0));
      const hostBonus = Math.max(0, safeNumber(song?.hostBonus, 0));
      const totalPoints = Math.max(0, safeNumber(song?.totalPoints, hypeScore + applauseScore + hostBonus));
      return {
        id: song?.id || `performance-${index}`,
        singerUid: participant.uid,
        singerName: labelFor(participant.name, "Singer"),
        singerAvatar: labelFor(participant.avatar, ""),
        songTitle: labelFor(song?.songTitle, "Song"),
        artist: labelFor(song?.artist, ""),
        albumArtUrl: getSongArtworkUrl(song),
        hypeScore,
        applauseScore,
        hostBonus,
        totalPoints,
        startedAt: toMillis(song?.performingStartedAt),
      };
    })
    .sort((left, right) => (
      right.totalPoints - left.totalPoints
      || right.hypeScore - left.hypeScore
      || right.applauseScore - left.applauseScore
    ))
    .slice(0, 8);

  const topReactors = [...reactionCountsByParticipant.values()]
    .map((entry) => ({
      key: entry.key,
      name: labelFor(entry.name, "Guest"),
      avatar: labelFor(entry.avatar, ""),
      count: Math.max(0, safeNumber(entry.count, 0)),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  const topEmojis = topReactors.map((entry) => ({
    name: entry.name,
    avatar: entry.avatar,
    totalEmojis: entry.count,
  }));

  const topPerformers = [...topPerformersByKey.values()]
    .sort((left, right) => (
      right.performances - left.performances
      || right.loudest - left.loudest
      || left.name.localeCompare(right.name)
    ))
    .slice(0, 5);

  const topReactionTypes = [...reactionTypeCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const loudestPerformance = safePerformedSongs.reduce((best, song) => {
    const applauseScore = Math.max(0, safeNumber(song?.applauseScore, 0));
    if (!best || applauseScore > best.applauseScore) {
      return {
        singer: labelFor(song?.singerName, "Singer"),
        song: labelFor(song?.songTitle, "Song"),
        applauseScore,
      };
    }
    return best;
  }, null);

  const repeatPerformers = [...performerCounts.values()].filter((count) => count > 1).length;
  const multiSongGuests = [...requesterCounts.values()].filter((count) => count > 1).length;
  const reactionCount = nonPhotoReactions.reduce((sum, entry) => sum + sumReactionCount(entry), 0);
  const reactionBursts = nonPhotoReactions.length;
  const uniqueRequesters = requesterCounts.size;
  const uniquePerformers = performerCounts.size;
  const uniqueReactors = reactionCountsByParticipant.size;

  const timelineMs = [
    ...safeUsers.map((entry) => toMillis(entry?.lastActiveAt || entry?.updatedAt || entry?.createdAt || entry?.joinedAt)),
    ...nonPhotoReactions.map((entry) => toMillis(entry?.timestamp || entry?.createdAt || entry?.updatedAt)),
    ...safeActivities.map((entry) => toMillis(entry?.timestamp || entry?.createdAt || entry?.updatedAt)),
    ...safeChatMessages.map((entry) => toMillis(entry?.timestamp || entry?.createdAt || entry?.updatedAt)),
    ...safeQueuedSongs.map((entry) => toMillis(entry?.timestamp || entry?.createdAt || entry?.updatedAt)),
    ...safePerformedSongs.map((entry) => toMillis(entry?.performingStartedAt || entry?.completedAt || entry?.endedAt)),
  ].filter((value) => value > 0);

  const firstEventMs = timelineMs.length ? Math.min(...timelineMs) : 0;
  const lastEventMs = timelineMs.length ? Math.max(...timelineMs) : 0;
  const activeMinutes = firstEventMs && lastEventMs
    ? Math.max(1, Math.round(((lastEventMs - firstEventMs) / 60000) * 10) / 10)
    : 0;
  const activeHours = activeMinutes > 0 ? activeMinutes / 60 : 0;
  const performancesPerHour = activeHours > 0 ? Math.round((safePerformedSongs.length / activeHours) * 100) / 100 : 0;
  const reactionsPerPerformance = safePerformedSongs.length > 0
    ? Math.round((reactionCount / safePerformedSongs.length) * 100) / 100
    : 0;

  const recapWindow = {
    startUtc: window?.startUtc || null,
    endUtc: window?.endUtc || null,
    startMs: safeNumber(window?.startMs, 0),
    endMs: safeNumber(window?.endMs, 0),
    firstEventMs,
    lastEventMs,
    activeMinutes,
  };

  return {
    summaryVersion: RECAP_SUMMARY_VERSION,
    source,
    roomCode: String(roomCode || "").trim().toUpperCase(),
    roomName: labelFor(room?.roomName || room?.name, ""),
    generatedAt: generatedAtMs,
    totalSongs: safePerformedSongs.length,
    totalUsers: uniqueParticipants.size,
    totalQueuedSongs: safeQueuedSongs.length,
    totalEmojiBursts: reactionCount,
    repeatPerformers,
    multiSongGuests,
    topPerformers,
    topEmojis,
    topReactors,
    topPerformances,
    topReactionTypes,
    loudestPerformance,
    photos: photoReactions.slice(0, 24),
    crowdSelfies: approvedCrowdSelfies.slice(0, 24),
    highlights: safeActivities
      .slice()
      .sort(sortByTimestampDesc)
      .slice(0, 30)
      .map((entry, index) => ({
        id: entry?.id || `highlight-${index}`,
        icon: entry?.icon || "",
        text: labelFor(entry?.text || entry?.summary || entry?.message || entry?.detail || entry?.label, "Room moment"),
        user: labelFor(entry?.user || entry?.userName || entry?.actorName || entry?.name, ""),
        timestamp: toMillis(entry?.timestamp || entry?.createdAt || entry?.updatedAt),
      })),
    window: recapWindow,
    stats: {
      totalQueuedSongs: safeQueuedSongs.length,
      totalPerformedSongs: safePerformedSongs.length,
      totalUsers: uniqueParticipants.size,
      activeUserDocs: safeUsers.length,
      totalEmojiBursts: reactionCount,
      reactionCount,
      reactionBursts,
      totalPhotos: photoReactions.length,
      totalCrowdSelfies: approvedCrowdSelfies.length,
      repeatPerformers,
      multiSongGuests,
      loudestApplause: Math.max(0, safeNumber(loudestPerformance?.applauseScore, 0)),
      uniqueRequesters,
      uniquePerformers,
      uniqueReactors,
      activityEvents: safeActivities.length,
      chatMessages: safeChatMessages.length,
      uploads: safeUploads.length,
      performancesPerHour,
      reactionsPerPerformance,
    },
    metrics: {
      estimatedPeople: uniqueParticipants.size,
      activeUserDocs: safeUsers.length,
      uniqueRequesters,
      uniquePerformers,
      uniqueReactors,
      reactionCount,
      reactionBursts,
      activityEvents: safeActivities.length,
      chatMessages: safeChatMessages.length,
      uploads: safeUploads.length,
      crowdSelfies: approvedCrowdSelfies.length,
      performancesPerHour,
      reactionsPerPerformance,
      firstEventMs,
      lastEventMs,
      activeMinutes,
    },
  };
};
