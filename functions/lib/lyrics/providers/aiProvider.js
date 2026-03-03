"use strict";

const sanitizeText = (value = "") =>
  typeof value === "string" ? value.trim() : "";

const resolveAiLyrics = async (
  {
    title = "",
    artist = "",
  } = {},
  {
    fetchAiLyricsFallbackText,
    normalizeLyricsText,
  } = {}
) => {
  if (typeof fetchAiLyricsFallbackText !== "function") {
    throw new Error("aiProvider missing fetchAiLyricsFallbackText dependency.");
  }
  const safeTitle = sanitizeText(title);
  const safeArtist = sanitizeText(artist) || "Unknown";
  if (!safeTitle) {
    return {
      found: false,
      resolution: "ai_missing_title",
      hasLyrics: false,
      hasTimedLyrics: false,
    };
  }

  const aiResult = await fetchAiLyricsFallbackText(safeTitle, safeArtist);
  const lyrics = typeof normalizeLyricsText === "function"
    ? normalizeLyricsText(aiResult?.lyrics || "")
    : sanitizeText(aiResult?.lyrics || "");
  if (!lyrics) {
    return {
      found: false,
      resolution: "ai_no_lyrics",
      hasLyrics: false,
      hasTimedLyrics: false,
    };
  }

  return {
    found: true,
    resolution: "ai_text",
    hasLyrics: true,
    hasTimedLyrics: false,
    lyrics,
    lyricsTimed: null,
    lyricsSource: "ai",
    needsUserToken: false,
    usage: aiResult?.usage || null,
  };
};

module.exports = {
  resolveAiLyrics,
};

