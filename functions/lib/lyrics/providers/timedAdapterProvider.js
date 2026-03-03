"use strict";

const resolveTimedAdapterLyrics = async (
  {
    title = "",
    artist = "",
    durationSec = 0,
    languageHint = "en",
  } = {},
  {
    enabled = false,
    resolveTimedLyrics,
    normalizeLyricsText,
    normalizeTimedLyrics,
  } = {}
) => {
  if (!enabled || typeof resolveTimedLyrics !== "function") {
    return {
      found: false,
      resolution: "timed_adapter_disabled",
      hasLyrics: false,
      hasTimedLyrics: false,
      providerMeta: { enabled: !!enabled },
    };
  }

  const timedResult = await resolveTimedLyrics({
    title,
    artist,
    durationSec,
    languageHint,
  });
  const timedLyrics = typeof normalizeTimedLyrics === "function"
    ? normalizeTimedLyrics(timedResult?.lyricsTimed || [])
    : (Array.isArray(timedResult?.lyricsTimed) ? timedResult.lyricsTimed : []);
  const lyrics = typeof normalizeLyricsText === "function"
    ? normalizeLyricsText(timedResult?.lyrics || "")
    : String(timedResult?.lyrics || "").trim();
  const hasTimedLyrics = timedLyrics.length > 0;
  const hasLyrics = !!lyrics;
  if (!timedResult?.found || (!hasTimedLyrics && !hasLyrics)) {
    return {
      found: false,
      resolution: "timed_adapter_no_match",
      hasLyrics: false,
      hasTimedLyrics: false,
      providerMeta: {
        source: timedResult?.source || "",
        confidence: Number(timedResult?.confidence || 0) || 0,
      },
    };
  }

  return {
    found: true,
    resolution: hasTimedLyrics ? "timed_adapter_timed" : "timed_adapter_text",
    hasLyrics,
    hasTimedLyrics,
    lyrics,
    lyricsTimed: hasTimedLyrics ? timedLyrics : null,
    lyricsSource: "timed_adapter",
    providerMeta: {
      source: timedResult?.source || "timed_adapter",
      confidence: Number(timedResult?.confidence || 0) || 0,
      language: timedResult?.language || languageHint || "en",
    },
  };
};

module.exports = {
  resolveTimedAdapterLyrics,
};

