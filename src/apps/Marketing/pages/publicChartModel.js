import { BROWSE_CATEGORIES } from "../../../lib/browseLists.js";
import { buildBrowseSongKey } from "../../../lib/browseCatalog.js";

export const PUBLIC_CHART_VISIBLE_LIMIT = 10;

const OPENING_SCORE_MIN = 9;
const OPENING_SCORE_SPAN = 16;

const hashText = (value = "") => {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const getPopularBrowseSongs = () => {
  const popularCategory = BROWSE_CATEGORIES.find((category) => category.id === "popular_now");
  return Array.isArray(popularCategory?.songs) ? popularCategory.songs : [];
};

export const buildOpeningSongScores = () => getPopularBrowseSongs()
  .slice(0, PUBLIC_CHART_VISIBLE_LIMIT)
  .map((song) => {
    const songId = buildBrowseSongKey(song.title, song.artist);
    return {
      id: `opening_${songId}`,
      songId,
      canonicalSongId: songId,
      songTitle: song.title,
      artist: song.artist,
      albumArtUrl: "",
      bestScore: OPENING_SCORE_MIN + (hashText(songId) % OPENING_SCORE_SPAN),
      displayName: "Open challenge",
      identityVisibility: "opening_score",
      isOpeningScore: true,
    };
  });

const buildSongMatchKey = (song = {}) => buildBrowseSongKey(
  song.songTitle || song.title || "",
  song.artist || song.artistName || ""
);

export const mergePublicSongChart = (
  publicSongs = [],
  limitCount = PUBLIC_CHART_VISIBLE_LIMIT
) => {
  const bySong = new Map();

  buildOpeningSongScores().forEach((song) => {
    bySong.set(buildSongMatchKey(song), song);
  });

  (Array.isArray(publicSongs) ? publicSongs : []).forEach((song) => {
    const matchKey = buildSongMatchKey(song);
    if (!matchKey.replaceAll("_", "")) return;
    bySong.set(matchKey, { ...song, isOpeningScore: false });
  });

  return [...bySong.values()]
    .sort((left, right) => {
      const scoreDelta = Number(right.bestScore || 0) - Number(left.bestScore || 0);
      if (scoreDelta) return scoreDelta;
      return String(left.songTitle || "").localeCompare(String(right.songTitle || ""));
    })
    .slice(0, Math.max(3, Number(limitCount || PUBLIC_CHART_VISIBLE_LIMIT)));
};
