"use strict";

const sanitizeText = (value = "") =>
  typeof value === "string" ? value.trim() : "";

const resolveCanonicalLyrics = async (
  {
    songId = "",
    title = "",
    artist = "",
  } = {},
  {
    db,
    buildSongKey,
    normalizeLyricsText,
    normalizeTimedLyrics,
  } = {}
) => {
  if (!db || typeof buildSongKey !== "function") {
    throw new Error("canonicalProvider missing required dependencies.");
  }

  const safeTitle = sanitizeText(title);
  const safeArtist = sanitizeText(artist) || "Unknown";
  const canonicalSongId = sanitizeText(songId) || (safeTitle ? buildSongKey(safeTitle, safeArtist) : "");
  if (!canonicalSongId) {
    return {
      found: false,
      resolution: "catalog_missing_song_id",
      hasLyrics: false,
      hasTimedLyrics: false,
    };
  }

  const songLyricsSnap = await db.collection("song_lyrics").doc(canonicalSongId).get();
  if (!songLyricsSnap.exists) {
    return {
      found: false,
      resolution: "catalog_miss",
      songId: canonicalSongId,
      hasLyrics: false,
      hasTimedLyrics: false,
    };
  }

  const entry = songLyricsSnap.data() || {};
  const timedLyrics = typeof normalizeTimedLyrics === "function"
    ? normalizeTimedLyrics(entry.lyricsTimed || [])
    : (Array.isArray(entry.lyricsTimed) ? entry.lyricsTimed : []);
  const lyrics = typeof normalizeLyricsText === "function"
    ? normalizeLyricsText(entry.lyrics || "")
    : sanitizeText(entry.lyrics || "");
  const hasTimedLyrics = timedLyrics.length > 0;
  const hasLyrics = !!lyrics;
  if (!hasTimedLyrics && !hasLyrics) {
    return {
      found: false,
      resolution: "catalog_empty",
      songId: canonicalSongId,
      hasLyrics: false,
      hasTimedLyrics: false,
    };
  }

  return {
    found: true,
    resolution: hasTimedLyrics ? "catalog_timed" : "catalog_text",
    songId: canonicalSongId,
    lyrics,
    lyricsTimed: hasTimedLyrics ? timedLyrics : null,
    lyricsSource: sanitizeText(entry.lyricsSource) || "catalog",
    appleMusicId: sanitizeText(entry.appleMusicId),
    hasLyrics,
    hasTimedLyrics,
  };
};

module.exports = {
  resolveCanonicalLyrics,
};

