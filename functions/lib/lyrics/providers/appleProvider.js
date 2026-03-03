"use strict";

const sanitizeText = (value = "") =>
  typeof value === "string" ? value.trim() : "";

const resolveAppleLyrics = async (
  {
    title = "",
    artist = "",
    storefront = "us",
    musicUserToken = "",
  } = {},
  {
    fetchImpl,
    getAppleMusicToken,
    parseTtml,
    normalizeLyricsText,
    normalizeTimedLyrics,
  } = {}
) => {
  if (typeof fetchImpl !== "function" || typeof getAppleMusicToken !== "function") {
    throw new Error("appleProvider missing required dependencies.");
  }

  const safeTitle = sanitizeText(title);
  const safeArtist = sanitizeText(artist) || "Unknown";
  if (!safeTitle) {
    return {
      found: false,
      resolution: "apple_missing_title",
      hasLyrics: false,
      hasTimedLyrics: false,
      needsUserToken: false,
      appleMusicId: "",
    };
  }

  const safeStorefront = sanitizeText(storefront) || "us";
  const devToken = getAppleMusicToken();
  const authHeaders = {
    Authorization: `Bearer ${devToken}`,
  };
  const safeMusicUserToken = sanitizeText(musicUserToken);
  if (safeMusicUserToken) authHeaders["Music-User-Token"] = safeMusicUserToken;

  const searchApple = async (queryText = "") => {
    const q = sanitizeText(queryText);
    if (!q) return null;
    const url = `https://api.music.apple.com/v1/catalog/${safeStorefront}/search?term=${encodeURIComponent(q)}&types=songs&limit=1`;
    const response = await fetchImpl(url, { headers: { Authorization: authHeaders.Authorization } });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    return payload?.results?.songs?.data?.[0] || null;
  };

  const term = `${safeTitle} ${safeArtist}`.trim();
  let song = await searchApple(term);
  if (!song) {
    song = await searchApple(safeTitle);
  }
  if (!song?.id) {
    return {
      found: false,
      resolution: "apple_no_match",
      hasLyrics: false,
      hasTimedLyrics: false,
      needsUserToken: false,
      appleMusicId: "",
    };
  }

  const appleMusicId = sanitizeText(song.id);
  const resolvedTitle = sanitizeText(song?.attributes?.name || safeTitle) || safeTitle;
  const resolvedArtist = sanitizeText(song?.attributes?.artistName || safeArtist) || safeArtist;
  const lyricsUrl = `https://api.music.apple.com/v1/catalog/${safeStorefront}/songs/${appleMusicId}/lyrics`;
  const lyricsResponse = await fetchImpl(lyricsUrl, { headers: authHeaders });
  if (!lyricsResponse.ok) {
    const text = await lyricsResponse.text();
    const needsUserToken = lyricsResponse.status === 400 && text.includes("\"code\":\"40012\"");
    if (needsUserToken) {
      return {
        found: false,
        resolution: "apple_needs_user_token",
        hasLyrics: false,
        hasTimedLyrics: false,
        needsUserToken: !safeMusicUserToken,
        appleMusicId,
        title: resolvedTitle,
        artist: resolvedArtist,
      };
    }
    return {
      found: false,
      resolution: "apple_fetch_error",
      hasLyrics: false,
      hasTimedLyrics: false,
      needsUserToken: false,
      appleMusicId,
      title: resolvedTitle,
      artist: resolvedArtist,
      error: `lyrics_${lyricsResponse.status}`,
    };
  }

  const payload = await lyricsResponse.json();
  const attrs = payload?.data?.[0]?.attributes || {};
  const ttml = attrs.ttml || "";
  const plainLyricsRaw = attrs.lyrics || "";
  const timedLyrics = typeof normalizeTimedLyrics === "function"
    ? normalizeTimedLyrics(typeof parseTtml === "function" ? parseTtml(ttml) : [])
    : (typeof parseTtml === "function" ? parseTtml(ttml) : []);
  const lyrics = typeof normalizeLyricsText === "function"
    ? normalizeLyricsText(plainLyricsRaw)
    : sanitizeText(plainLyricsRaw);
  const hasTimedLyrics = Array.isArray(timedLyrics) && timedLyrics.length > 0;
  const hasLyrics = !!lyrics;

  if (!hasTimedLyrics && !hasLyrics) {
    return {
      found: false,
      resolution: "apple_no_lyrics",
      hasLyrics: false,
      hasTimedLyrics: false,
      needsUserToken: false,
      appleMusicId,
      title: resolvedTitle,
      artist: resolvedArtist,
    };
  }

  return {
    found: true,
    resolution: hasTimedLyrics ? "apple_timed" : "apple_text",
    hasLyrics,
    hasTimedLyrics,
    lyrics,
    lyricsTimed: hasTimedLyrics ? timedLyrics : null,
    lyricsSource: "apple",
    needsUserToken: false,
    appleMusicId,
    title: resolvedTitle,
    artist: resolvedArtist,
    language: sanitizeText(attrs.language || "en") || "en",
  };
};

module.exports = {
  resolveAppleLyrics,
};

