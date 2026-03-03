"use strict";

const { resolveCanonicalLyrics } = require("./providers/canonicalProvider");
const { resolveAppleLyrics } = require("./providers/appleProvider");
const { resolveAiLyrics } = require("./providers/aiProvider");
const { resolveTimedAdapterLyrics } = require("./providers/timedAdapterProvider");

const nowMs = () => Date.now();

const pushTrace = (providerTrace = [], provider = "", status = "miss", startedAtMs = 0, detail = "") => {
  providerTrace.push({
    provider,
    status,
    latencyMs: Math.max(0, nowMs() - Number(startedAtMs || 0)),
    detail: String(detail || "").trim().slice(0, 180),
  });
};

const resultFromProvider = (providerResult = {}) => ({
  hasLyrics: !!providerResult?.hasLyrics || !!providerResult?.lyrics,
  hasTimedLyrics: !!providerResult?.hasTimedLyrics || (Array.isArray(providerResult?.lyricsTimed) && providerResult.lyricsTimed.length > 0),
  lyrics: providerResult?.lyrics || "",
  lyricsTimed: Array.isArray(providerResult?.lyricsTimed) && providerResult.lyricsTimed.length ? providerResult.lyricsTimed : null,
  lyricsSource: providerResult?.lyricsSource || "",
  resolution: providerResult?.resolution || "",
  needsUserToken: !!providerResult?.needsUserToken,
  songId: providerResult?.songId || "",
  appleMusicId: providerResult?.appleMusicId || "",
  providerMeta: providerResult?.providerMeta || null,
  aiUsage: providerResult?.usage || null,
});

const resolveLyricsForSong = async (
  {
    songId = "",
    title = "",
    artist = "",
    storefront = "us",
    musicUserToken = "",
    allowAiFallback = true,
    allowTimedAdapter = true,
    durationSec = 0,
    languageHint = "en",
  } = {},
  deps = {}
) => {
  const providerTrace = [];
  let hasProviderErrors = false;
  let needsUserToken = false;
  let fallbackAppleMusicId = "";

  const runProvider = async (providerName, runner) => {
    const started = nowMs();
    try {
      const result = await runner();
      if (result?.found) {
        pushTrace(providerTrace, providerName, "hit", started, result?.resolution || "hit");
        return { hit: true, result };
      }
      if (result?.needsUserToken) needsUserToken = true;
      if (result?.appleMusicId) fallbackAppleMusicId = result.appleMusicId;
      pushTrace(providerTrace, providerName, "miss", started, result?.resolution || "miss");
      return { hit: false, result };
    } catch (error) {
      hasProviderErrors = true;
      pushTrace(providerTrace, providerName, "error", started, error?.message || error?.code || "error");
      return { hit: false, result: null };
    }
  };

  const canonicalAttempt = await runProvider("canonical", () => resolveCanonicalLyrics(
    { songId, title, artist },
    deps
  ));
  if (canonicalAttempt.hit) {
    const normalized = resultFromProvider(canonicalAttempt.result);
    return {
      ...normalized,
      providerTrace,
    };
  }

  const appleAttempt = await runProvider("apple", () => resolveAppleLyrics(
    { title, artist, storefront, musicUserToken },
    deps
  ));
  if (appleAttempt.hit) {
    const normalized = resultFromProvider(appleAttempt.result);
    return {
      ...normalized,
      providerTrace,
    };
  }

  if (allowTimedAdapter) {
    const timedAdapterAttempt = await runProvider("timed_adapter", () => resolveTimedAdapterLyrics(
      { title, artist, durationSec, languageHint },
      {
        enabled: !!deps?.timedAdapterEnabled,
        resolveTimedLyrics: deps?.resolveTimedLyrics,
        normalizeLyricsText: deps?.normalizeLyricsText,
        normalizeTimedLyrics: deps?.normalizeTimedLyrics,
      }
    ));
    if (timedAdapterAttempt.hit) {
      const normalized = resultFromProvider(timedAdapterAttempt.result);
      return {
        ...normalized,
        providerTrace,
      };
    }
  } else {
    pushTrace(providerTrace, "timed_adapter", "skip", nowMs(), "timed_adapter_skipped");
  }

  if (allowAiFallback) {
    const aiAttempt = await runProvider("ai", () => resolveAiLyrics(
      { title, artist },
      deps
    ));
    if (aiAttempt.hit) {
      const normalized = resultFromProvider(aiAttempt.result);
      return {
        ...normalized,
        providerTrace,
      };
    }
  } else {
    pushTrace(providerTrace, "ai", "skip", nowMs(), "ai_disabled");
  }

  return {
    hasLyrics: false,
    hasTimedLyrics: false,
    lyrics: "",
    lyricsTimed: null,
    lyricsSource: "",
    resolution: needsUserToken ? "needs_user_token" : (hasProviderErrors ? "provider_error" : "no_match"),
    needsUserToken,
    songId: songId || "",
    appleMusicId: fallbackAppleMusicId,
    providerMeta: null,
    aiUsage: null,
    providerTrace,
  };
};

module.exports = {
  resolveLyricsForSong,
};

