const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");

admin.initializeApp();
const APP_ID = "bross-app";

setGlobalOptions({
  region: "us-west1",
  maxInstances: 2,
  timeoutSeconds: 30,
  memory: "256MiB",
});

const YOUTUBE_API_KEY = defineSecret("YOUTUBE_API_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const APPLE_MUSIC_TEAM_ID = defineSecret("APPLE_MUSIC_TEAM_ID");
const APPLE_MUSIC_KEY_ID = defineSecret("APPLE_MUSIC_KEY_ID");
const APPLE_MUSIC_PRIVATE_KEY = defineSecret("APPLE_MUSIC_PRIVATE_KEY");
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const GOOGLE_MAPS_API_KEY = defineSecret("GOOGLE_MAPS_API_KEY");

const rateState = new Map();
const GLOBAL_LIMITS = { perMinute: 120, perHour: 1000 };
const DEFAULT_LIMITS = { perMinute: 30, perHour: 300 };

const nowMs = () => Date.now();

const getClientIp = (req) => {
  const forwarded = req.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.ip || "unknown";
};

const limitKey = (scope, ip) => `${scope}:${ip}`;

const checkRateLimit = (req, scope, limits = DEFAULT_LIMITS) => {
  const ip = getClientIp(req);
  const now = nowMs();
  const minuteKey = `${limitKey(scope, ip)}:m:${Math.floor(now / 60000)}`;
  const hourKey = `${limitKey(scope, ip)}:h:${Math.floor(now / 3600000)}`;
  const globalMinuteKey = `global:m:${Math.floor(now / 60000)}`;
  const globalHourKey = `global:h:${Math.floor(now / 3600000)}`;

  const bump = (key) => {
    const next = (rateState.get(key) || 0) + 1;
    rateState.set(key, next);
    return next;
  };

  const minuteCount = bump(minuteKey);
  const hourCount = bump(hourKey);
  const globalMinute = bump(globalMinuteKey);
  const globalHour = bump(globalHourKey);

  if (minuteCount > limits.perMinute || hourCount > limits.perHour) {
    throw new HttpsError("resource-exhausted", "Rate limit exceeded.");
  }
  if (globalMinute > GLOBAL_LIMITS.perMinute || globalHour > GLOBAL_LIMITS.perHour) {
    throw new HttpsError("resource-exhausted", "Server is busy. Try again.");
  }
};

const ensureString = (val, name) => {
  if (!val || typeof val !== "string") {
    throw new HttpsError("invalid-argument", `${name} must be a string.`);
  }
};

const clampNumber = (val, min, max, fallback) => {
  const num = Number(val);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
};

const normalizeText = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const buildSongKey = (title = "", artist = "") => {
  const cleanTitle = normalizeText(title || "unknown");
  const cleanArtist = normalizeText(artist || "unknown");
  return `${cleanTitle}__${cleanArtist}`;
};

const extractYouTubeId = (input = "") => {
  if (!input) return "";
  const match = input.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : "";
};

const getWeekKeyUtc = (date = new Date()) => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() - day);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isBetterScore = (candidateScore, candidateApplause, current) => {
  if (!current) return true;
  const bestScore = Number(current.bestScore || current.score || 0);
  const bestApplause = Number(current.applauseScore || 0);
  if (candidateScore > bestScore) return true;
  if (candidateScore === bestScore && candidateApplause > bestApplause) return true;
  return false;
};

let stripeClient = null;
const getStripeClient = () => {
  if (stripeClient) return stripeClient;
  const key = STRIPE_SECRET_KEY.value();
  if (!key) {
    throw new HttpsError("failed-precondition", "Stripe is not configured.");
  }
  stripeClient = new Stripe(key);
  return stripeClient;
};

const getRootRef = () =>
  admin
    .firestore()
    .collection("artifacts")
    .doc(APP_ID)
    .collection("public")
    .doc("data");

const decodeEntities = (input = "") =>
  input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const parseTimeMs = (val = "") => {
  const parts = val.split(":").map((p) => p.trim());
  const toSeconds = (p) => {
    const [s, ms = "0"] = p.split(".");
    return Number(s || 0) + Number(ms.padEnd(3, "0")) / 1000;
  };
  if (parts.length === 3) {
    return (
      Number(parts[0] || 0) * 3600 * 1000 +
      Number(parts[1] || 0) * 60 * 1000 +
      toSeconds(parts[2]) * 1000
    );
  }
  if (parts.length === 2) {
    return Number(parts[0] || 0) * 60 * 1000 + toSeconds(parts[1]) * 1000;
  }
  return toSeconds(parts[0] || "0") * 1000;
};

const parseTtml = (ttml = "") => {
  if (!ttml) return [];
  const results = [];
  const regex = /<p\b[^>]*begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = regex.exec(ttml))) {
    const startMs = parseTimeMs(match[1]);
    const endMs = parseTimeMs(match[2]);
    const rawText = match[3]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    const text = decodeEntities(rawText);
    if (!text) continue;
    results.push({ text, startMs, endMs });
  }
  return results;
};

let appleTokenCache = { token: null, exp: 0 };
const getAppleMusicToken = () => {
  const teamId = APPLE_MUSIC_TEAM_ID.value();
  const keyId = APPLE_MUSIC_KEY_ID.value();
  let privateKey = APPLE_MUSIC_PRIVATE_KEY.value();
  if (!teamId || !keyId || !privateKey) {
    throw new HttpsError("failed-precondition", "Apple Music secrets not configured.");
  }
  privateKey = privateKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  if (appleTokenCache.token && appleTokenCache.exp > now + 60) {
    return appleTokenCache.token;
  }
  const exp = now + 60 * 60;
  const token = jwt.sign(
    { iss: teamId, iat: now, exp },
    privateKey,
    { algorithm: "ES256", header: { kid: keyId } }
  );
  appleTokenCache = { token, exp };
  return token;
};

const ensureSongAdmin = async ({
  title,
  artist,
  artworkUrl,
  itunesId,
  appleMusicId,
  aliases = [],
  verifyMeta = false,
  verifiedBy = "host",
}) => {
  const safeTitle = (title || "").trim();
  if (!safeTitle) return null;
  const safeArtist = (artist || "Unknown").trim() || "Unknown";
  const songId = buildSongKey(safeTitle, safeArtist);
  const ref = admin.firestore().collection("songs").doc(songId);
  const snap = await ref.get();

  const updates = {
    title: safeTitle,
    artist: safeArtist,
    normalizedKey: songId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!snap.exists) {
    updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  if (artworkUrl) {
    updates.artworkUrl = artworkUrl;
  }
  if (itunesId) {
    updates.itunesId = String(itunesId);
  }
  if (appleMusicId) {
    updates.appleMusicIds = admin.firestore.FieldValue.arrayUnion(String(appleMusicId));
  }
  if (aliases.length) {
    const cleanAliases = aliases.filter(Boolean).map((item) => String(item));
    if (cleanAliases.length) {
      updates.aliases = admin.firestore.FieldValue.arrayUnion(...cleanAliases);
    }
  }

  if (verifyMeta && typeof verifyMeta === "object") {
    updates.verifiedMeta = {
      title: safeTitle,
      artist: safeArtist,
      artworkUrl: artworkUrl || null,
      lyricsSource: verifyMeta.lyricsSource || null,
      lyricsTimed: !!verifyMeta.lyricsTimed,
      lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedBy,
    };
  }

  await ref.set(updates, { merge: true });
  return { songId, songData: snap.exists ? snap.data() : null };
};

const ensureTrackAdmin = async ({
  songId,
  source,
  mediaUrl,
  appleMusicId,
  label,
  duration,
  audioOnly,
  backingOnly,
  addedBy,
}) => {
  if (!songId) return null;
  const cleanSource = source || "custom";
  const youtubeId = cleanSource === "youtube" ? extractYouTubeId(mediaUrl) : "";
  let trackId = "";

  if (cleanSource === "youtube" && youtubeId) {
    trackId = `${songId}__yt__${youtubeId}`;
  } else if (cleanSource === "apple" && appleMusicId) {
    trackId = `${songId}__apple__${appleMusicId}`;
  }

  const payload = {
    songId,
    source: cleanSource,
    mediaUrl: mediaUrl || null,
    appleMusicId: appleMusicId || null,
    label: label || null,
    duration: duration || null,
    audioOnly: !!audioOnly,
    backingOnly: !!backingOnly,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (addedBy) payload.addedBy = addedBy;

  if (trackId) {
    const ref = admin.firestore().collection("tracks").doc(trackId);
    const snap = await ref.get();
    if (!snap.exists) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    await ref.set(payload, { merge: true });
    return { trackId };
  }

  payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  const docRef = await admin.firestore().collection("tracks").add(payload);
  return { trackId: docRef.id };
};

const isSongVerified = (songDoc) => {
  const meta = songDoc?.verifiedMeta || {};
  return !!(meta.title && meta.artist && meta.artworkUrl);
};

const buildGeminiPrompt = (type, context) => {
  if (type === "bingo_board") {
    const { title, size, mode } = context || {};
    const count = Number(size || 5) ** 2;
    if (mode === "mystery") {
      return `Generate ${count} pairs of (Clue, Song Title, Artist) for a music bingo game with the theme "${title}". Format strictly as JSON array of objects: [{"clue": "...", "title": "...", "artist": "..."}]. Do not include markdown.`;
    }
    return `Generate ${count} short bingo terms (1-3 words) for a bingo game with the theme "${title}". Format strictly as JSON array of strings. Do not include markdown.`;
  }
  if (type === "lyrics") {
    const { title, artist } = context || {};
    return `Generate the full lyrics for the song "${title}" by "${artist}". Format strictly as JSON object with a single key "lyrics" containing the text with \\n for line breaks. Example: {"lyrics": "Line 1\\nLine 2"}. Do not include markdown.`;
  }
  if (type === "selfie_prompt") {
    return 'Generate 5 short, funny selfie prompts for a karaoke crowd. Format strictly as JSON array of strings. Do not include markdown.';
  }
  if (type === "doodle_lyrics") {
    const { topic, count } = context || {};
    const total = clampNumber(count || 12, 5, 30, 12);
    return `Generate ${total} short, recognizable lyric lines for a karaoke drawing game. Keep each line under 8 words. Theme: "${topic || 'karaoke hits'}". Format strictly as JSON array of strings. Do not include markdown.`;
  }
  const songs = Array.isArray(context)
    ? context.slice(0, 5).map((s) => `${s.songTitle} by ${s.artist}`).join(", ")
    : "";
  if (type === "trivia") {
    return `Generate 3 trivia questions based on: ${songs}. Format strictly as JSON array of objects: [{q, correct, w1, w2, w3}]`;
  }
  return `Generate 3 "Would You Rather" questions based on: ${songs}. Format strictly as JSON array: [{q, a, b}]`;
};

exports.itunesSearch = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "itunes");
  const term = request.data?.term || "";
  ensureString(term, "term");
  const limit = clampNumber(request.data?.limit || 6, 1, 25, 6);
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new HttpsError("unavailable", "iTunes search failed.");
  }
  const data = await res.json();
  return { results: data.results || [] };
});

exports.ensureSong = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const data = request.data || {};
  const title = (data.title || "").trim();
  if (!title) {
    throw new HttpsError("invalid-argument", "title is required.");
  }
  const res = await ensureSongAdmin({
    title,
    artist: data.artist || "Unknown",
    artworkUrl: data.artworkUrl || "",
    itunesId: data.itunesId || "",
    appleMusicId: data.appleMusicId || "",
    aliases: Array.isArray(data.aliases) ? data.aliases : [],
    verifyMeta: data.verifyMeta || false,
    verifiedBy: data.verifiedBy || "host",
  });
  return { songId: res?.songId || buildSongKey(title, data.artist || "Unknown") };
});

exports.ensureTrack = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const data = request.data || {};
  if (!data.songId) {
    throw new HttpsError("invalid-argument", "songId is required.");
  }
  const res = await ensureTrackAdmin({
    songId: data.songId,
    source: data.source || "custom",
    mediaUrl: data.mediaUrl || "",
    appleMusicId: data.appleMusicId || "",
    label: data.label || null,
    duration: data.duration ?? null,
    audioOnly: !!data.audioOnly,
    backingOnly: !!data.backingOnly,
    addedBy: data.addedBy || "",
  });
  return { trackId: res?.trackId || null };
});

exports.logPerformance = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const data = request.data || {};
  const songTitle = (data.songTitle || data.title || "").trim();
  if (!songTitle) {
    throw new HttpsError("invalid-argument", "songTitle is required.");
  }
  const artist = (data.artist || "Unknown").trim() || "Unknown";
  const roomCode = data.roomCode || "";
  const albumArtUrl = data.albumArtUrl || "";
  const songResult = await ensureSongAdmin({
    title: songTitle,
    artist,
    artworkUrl: albumArtUrl,
    verifyMeta: false,
    verifiedBy: data.verifiedBy || "host",
  });
  const songId = data.songId || songResult?.songId || buildSongKey(songTitle, artist);
  const sourceGuess = data.trackSource
    || (data.appleMusicId ? "apple" : extractYouTubeId(data.mediaUrl || "") ? "youtube" : "custom");

  let trackId = data.trackId || null;
  if (!trackId && (data.mediaUrl || data.appleMusicId)) {
    const trackResult = await ensureTrackAdmin({
      songId,
      source: sourceGuess,
      mediaUrl: data.mediaUrl || "",
      appleMusicId: data.appleMusicId || "",
      duration: data.duration ?? null,
      audioOnly: !!data.audioOnly,
      backingOnly: !!data.backingAudioOnly,
      addedBy: data.addedBy || data.hostName || "Host",
    });
    trackId = trackResult?.trackId || null;
  }

  const applauseScore = Math.round(data.applauseScore || 0);
  const hypeScore = Math.round(data.hypeScore || 0);
  const hostBonus = Math.round(data.hostBonus || 0);
  const totalScore = hypeScore + applauseScore + hostBonus;
  const weekKey = getWeekKeyUtc(new Date());
  const isOfficial = isSongVerified(songResult?.songData);

  await admin.firestore().collection("performances").add({
    songId,
    trackId: trackId || null,
    roomCode,
    singerName: data.singerName || "",
    singerUid: data.singerUid || null,
    songTitle,
    artist,
    score: totalScore,
    totalScore,
    applauseScore,
    hypeScore,
    hostBonus,
    isOfficial,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  const bestRef = admin.firestore().collection("song_hall_of_fame").doc(songId);
  const bestSnap = await bestRef.get();
  const bestData = bestSnap.exists ? bestSnap.data() : null;
  const isNewAllTime = isBetterScore(totalScore, applauseScore, bestData);

  if (isNewAllTime) {
    await bestRef.set({
      songId,
      songTitle,
      artist,
      albumArtUrl,
      bestScore: totalScore,
      applauseScore,
      singerName: data.singerName || "",
      singerUid: data.singerUid || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  const weeklyId = `${weekKey}__${songId}`;
  const weeklyRef = admin.firestore().collection("song_hall_of_fame_weeks").doc(weeklyId);
  const weeklySnap = await weeklyRef.get();
  const weeklyData = weeklySnap.exists ? weeklySnap.data() : null;
  if (isBetterScore(totalScore, applauseScore, weeklyData)) {
    await weeklyRef.set({
      weekKey,
      songId,
      songTitle,
      artist,
      albumArtUrl,
      bestScore: totalScore,
      applauseScore,
      singerName: data.singerName || "",
      singerUid: data.singerUid || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return {
    songId,
    trackId,
    totalScore,
    applauseScore,
    hypeScore,
    hostBonus,
    isNewAllTime,
    weekKey,
  };
});

exports.youtubeSearch = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_search");
  const query = request.data?.query || "";
  ensureString(query, "query");
  const maxResults = clampNumber(request.data?.maxResults || 10, 1, 10, 10);
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&q=${encodeURIComponent(query)}&part=snippet&type=video&maxResults=${maxResults}&order=relevance`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `YouTube search failed: ${text}`);
  }
  const data = await res.json();
  const items = (data.items || []).map((item) => ({
    id: item.id?.videoId || item.id,
    title: item.snippet?.title || "",
    channelTitle: item.snippet?.channelTitle || "",
    thumbnails: item.snippet?.thumbnails || {},
  }));
  return { items };
});

exports.youtubePlaylist = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_playlist");
  const playlistId = request.data?.playlistId || "";
  ensureString(playlistId, "playlistId");
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  const maxTotal = clampNumber(request.data?.maxTotal || 150, 1, 250, 150);
  const items = [];
  let pageToken = "";
  while (items.length < maxTotal) {
    const batchSize = Math.min(50, maxTotal - items.length);
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?key=${apiKey}&part=snippet&maxResults=${batchSize}&playlistId=${playlistId}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new HttpsError("unavailable", `Playlist fetch failed: ${text}`);
    }
    const data = await res.json();
    (data.items || []).forEach((item) => {
      items.push({
        id: item.snippet?.resourceId?.videoId || item.id,
        title: item.snippet?.title || "",
        channelTitle: item.snippet?.channelTitle || "",
        thumbnails: item.snippet?.thumbnails || {},
      });
    });
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return { items };
});

exports.youtubeStatus = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_status");
  const ids = Array.isArray(request.data?.ids) ? request.data.ids : [];
  if (!ids.length) return { items: [] };
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  const sliced = ids.slice(0, 50);
  const url = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&part=status&id=${sliced.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `YouTube status failed: ${text}`);
  }
  const data = await res.json();
  const items = (data.items || []).map((item) => ({
    id: item.id,
    embeddable: !!item.status?.embeddable,
  }));
  return { items };
});

const parseIsoDuration = (value = "") => {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
};

exports.youtubeDetails = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_details");
  const ids = Array.isArray(request.data?.ids) ? request.data.ids : [];
  if (!ids.length) return { items: [] };
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  const sliced = ids.slice(0, 50);
  const url = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&part=contentDetails&id=${sliced.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `YouTube details failed: ${text}`);
  }
  const data = await res.json();
  const items = (data.items || []).map((item) => ({
    id: item.id,
    durationSec: parseIsoDuration(item.contentDetails?.duration || ""),
  }));
  return { items };
});

exports.geminiGenerate = onCall({ cors: true, secrets: [GEMINI_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "gemini");
  const type = request.data?.type || "";
  ensureString(type, "type");
  const prompt = buildGeminiPrompt(type, request.data?.context);
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Gemini API key not configured.");
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `Gemini request failed: ${text}`);
  }
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanText = rawText.replace(/```json|```/g, "").trim();
  try {
    return { result: JSON.parse(cleanText) };
  } catch (_err) {
    throw new HttpsError("data-loss", "Gemini response parse failed.");
  }
});

exports.appleMusicLyrics = onCall(
  { cors: true, secrets: [APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "apple_music");
    const title = request.data?.title || "";
    const artist = request.data?.artist || "";
    ensureString(title, "title");
    const storefront = request.data?.storefront || "us";
    const term = `${title} ${artist}`.trim();
    if (!term) throw new HttpsError("invalid-argument", "Missing title/artist.");

    const token = getAppleMusicToken();
    const searchUrl = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(
      term
    )}&types=songs&limit=1`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!searchRes.ok) {
      const text = await searchRes.text();
      throw new HttpsError("unavailable", `Apple Music search failed: ${text}`);
    }
    const searchData = await searchRes.json();
    const song = searchData?.results?.songs?.data?.[0];
    if (!song?.id) {
      return { found: false, message: "No Apple Music match." };
    }
    const songId = song.id;
    const lyricsUrl = `https://api.music.apple.com/v1/catalog/${storefront}/songs/${songId}/lyrics`;
    const lyricsRes = await fetch(lyricsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!lyricsRes.ok) {
      const text = await lyricsRes.text();
      throw new HttpsError("unavailable", `Apple Music lyrics failed: ${text}`);
    }
    const lyricsData = await lyricsRes.json();
    const attrs = lyricsData?.data?.[0]?.attributes || {};
    const ttml = attrs.ttml || "";
    const plainLyrics = attrs.lyrics || "";
    const timedLyrics = parseTtml(ttml);
    return {
      found: true,
      songId,
      title: song.attributes?.name || title,
      artist: song.attributes?.artistName || artist,
      timedLyrics,
      lyrics: plainLyrics,
    };
  }
);

exports.autoAppleLyrics = onDocumentCreated(
  {
    document: `artifacts/${APP_ID}/public/data/karaoke_songs/{songId}`,
    secrets: [APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    if (data.lyricsTimed?.length || data.lyrics) return;
    if (data.lyricsSource) return;
    const rawTitle = data.songTitle || data.title || "";
    const rawArtist = data.artist || "";
    const cleanedTitle = rawTitle.replace(/\bkaraoke\b/gi, "").replace(/\s+/g, " ").trim();
    const cleanedArtist = rawArtist.replace(/\bkaraoke\b/gi, "").replace(/\s+/g, " ").trim();
    const term = `${cleanedTitle} ${cleanedArtist}`.trim();
    if (!cleanedTitle) return;

    try {
      const storefront = data.storefront || "us";
      const token = getAppleMusicToken();
      const searchApple = async (q) => {
        const url = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(
          q
        )}&types=songs&limit=1`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          const text = await res.text();
          console.warn(`Apple search failed (${res.status})`, text?.slice(0, 300));
          return null;
        }
        const data = await res.json();
        return data?.results?.songs?.data?.[0] || null;
      };
      let song = await searchApple(term);
      if (!song && cleanedTitle) {
        song = await searchApple(cleanedTitle);
      }
      if (!song?.id) return;
      const songId = song.id;
      const lyricsUrl = `https://api.music.apple.com/v1/catalog/${storefront}/songs/${songId}/lyrics`;
      const lyricsRes = await fetch(lyricsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!lyricsRes.ok) {
        const text = await lyricsRes.text();
        console.warn(`Apple lyrics failed (${lyricsRes.status})`, text?.slice(0, 300));
        return;
      }
      const lyricsData = await lyricsRes.json();
      const attrs = lyricsData?.data?.[0]?.attributes || {};
      const ttml = attrs.ttml || "";
      const plainLyrics = attrs.lyrics || "";
      const timedLyrics = parseTtml(ttml);
      await event.data.ref.set(
        {
          lyrics: plainLyrics || "",
          lyricsTimed: timedLyrics || null,
          appleMusicId: songId,
          lyricsSource: timedLyrics?.length ? "apple" : plainLyrics ? "apple" : "",
        },
        { merge: true }
      );
    } catch (err) {
      console.error("autoAppleLyrics failed", err?.message || err);
    }
  }
);

const resolveOrigin = (req, originFromClient) => {
  const origin = originFromClient || req.get("origin") || "";
  const isAllowed =
    origin.includes("beauross.com") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1");
  return isAllowed && origin.startsWith("http") ? origin : "https://beauross.com";
};

const isAllowedOrigin = (origin = "") =>
  origin.includes("beauross.com") ||
  origin.includes("localhost") ||
  origin.includes("127.0.0.1");

exports.googleMapsKey = onCall({ cors: true, secrets: [GOOGLE_MAPS_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "google_maps_key");
  const origin = request.rawRequest?.get?.("origin") || "";
  if (origin && !isAllowedOrigin(origin)) {
    throw new HttpsError("permission-denied", "Origin not allowed.");
  }
  const apiKey = GOOGLE_MAPS_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Google Maps API key not configured.");
  }
  return { apiKey };
});

exports.createTipCrateCheckout = onCall(
  { cors: true, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "stripe_checkout");
    const roomCode = request.data?.roomCode || "";
    const crateId = request.data?.crateId || "";
    ensureString(roomCode, "roomCode");
    ensureString(crateId, "crateId");

    const roomSnap = await getRootRef().collection("rooms").doc(roomCode).get();
    if (!roomSnap.exists) {
      throw new HttpsError("not-found", "Room not found.");
    }
    const crates = Array.isArray(roomSnap.data()?.tipCrates)
      ? roomSnap.data().tipCrates
      : [];
    const crate = crates.find((c) => c.id === crateId);
    if (!crate) {
      throw new HttpsError("invalid-argument", "Tip crate not found.");
    }
    const amount = clampNumber(crate.amount || 0, 1, 500, 0);
    if (!amount) {
      throw new HttpsError("invalid-argument", "Invalid tip amount.");
    }
    const points = clampNumber(crate.points || 0, 0, 100000, 0);
    const origin = resolveOrigin(request.rawRequest, request.data?.origin);
    const buyerUid = request.auth?.uid || request.data?.userUid || "";
    const buyerName = request.data?.userName || "";
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `BROSS Room Tip: ${crate.label || "Room Boost"}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        roomCode,
        crateId,
        points: `${points}`,
        rewardScope: crate.rewardScope || "room",
        awardBadge: crate.awardBadge ? "1" : "0",
        buyerUid,
        buyerName,
        label: crate.label || "Room Boost",
      },
      success_url: `${origin}/?room=${encodeURIComponent(roomCode)}&tip=success`,
      cancel_url: `${origin}/?room=${encodeURIComponent(roomCode)}&tip=cancel`,
    });

    return { url: session.url, id: session.id };
  }
);

exports.createPointsCheckout = onCall(
  { cors: true, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "stripe_checkout");
    const roomCode = request.data?.roomCode || "";
    const amount = clampNumber(request.data?.amount || 0, 1, 500, 0);
    const points = clampNumber(request.data?.points || 0, 0, 100000, 0);
    const label = request.data?.label || "Points Pack";
    const packId = request.data?.packId || "points_pack";
    ensureString(roomCode, "roomCode");
    if (!amount || !points) {
      throw new HttpsError("invalid-argument", "Invalid points pack.");
    }

    const roomSnap = await getRootRef().collection("rooms").doc(roomCode).get();
    if (!roomSnap.exists) {
      throw new HttpsError("not-found", "Room not found.");
    }

    const origin = resolveOrigin(request.rawRequest, request.data?.origin);
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `BROSS Points: ${label}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        roomCode,
        points: `${points}`,
        packId,
        label,
      },
      success_url: `${origin}/?room=${encodeURIComponent(roomCode)}&points=success`,
      cancel_url: `${origin}/?room=${encodeURIComponent(roomCode)}&points=cancel`,
    });

    return { url: session.url, id: session.id };
  }
);

exports.createAppleMusicToken = onCall(
  { cors: true, secrets: [APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY] },
  async () => {
    const teamId = APPLE_MUSIC_TEAM_ID.value();
    const keyId = APPLE_MUSIC_KEY_ID.value();
    const rawKey = APPLE_MUSIC_PRIVATE_KEY.value();
    const privateKey = rawKey.includes("BEGIN") ? rawKey : rawKey.replace(/\\n/g, "\n");
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 12;
    const token = jwt.sign(
      { iss: teamId, iat: now, exp },
      privateKey,
      { algorithm: "ES256", header: { alg: "ES256", kid: keyId } }
    );
    return { token, expiresAt: exp };
  }
);

exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const stripe = getStripeClient();
    const sig = req.headers["stripe-signature"];
    const webhookSecret = STRIPE_WEBHOOK_SECRET.value();
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook signature failed.", err?.message || err);
      res.status(400).send("Webhook Error");
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object || {};
      const metadata = session.metadata || {};
      const roomCode = metadata.roomCode;
      const points = Number(metadata.points || 0);
      const rewardScope = metadata.rewardScope || "room";
      const awardBadge = metadata.awardBadge === "1";
      const buyerUid = metadata.buyerUid || "";
      const buyerName = metadata.buyerName || "Guest";
      const label = metadata.label || "Room Boost";
      if (!roomCode || !points) {
        res.json({ received: true });
        return;
      }

      const eventId = session.id || event.id;
      const rootRef = getRootRef();
      const eventRef = rootRef.collection("stripe_events").doc(eventId);
      const existing = await eventRef.get();
      if (existing.exists) {
        res.json({ received: true, duplicate: true });
        return;
      }
      await eventRef.set({
        roomCode,
        points,
        amount: session.amount_total || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (rewardScope === "buyer" && buyerUid) {
        const buyerRef = rootRef.collection("room_users").doc(`${roomCode}_${buyerUid}`);
        await buyerRef.set(
          {
            points: admin.firestore.FieldValue.increment(points),
            roomBoostBadge: awardBadge ? true : undefined,
            roomBoosts: awardBadge ? admin.firestore.FieldValue.increment(1) : undefined,
          },
          { merge: true }
        );
      } else {
        const usersSnap = await rootRef
          .collection("room_users")
          .where("roomCode", "==", roomCode)
          .get();
        if (!usersSnap.empty) {
          const batch = admin.firestore().batch();
          usersSnap.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, {
              points: admin.firestore.FieldValue.increment(points),
            });
          });
          await batch.commit();
        }
        if (buyerUid && awardBadge) {
          const buyerRef = rootRef.collection("room_users").doc(`${roomCode}_${buyerUid}`);
          await buyerRef.set(
            {
              roomBoostBadge: true,
              roomBoosts: admin.firestore.FieldValue.increment(1),
            },
            { merge: true }
          );
        }
      }

      const amount = session.amount_total
        ? `$${(session.amount_total / 100).toFixed(2)}`
        : "";
      await rootRef.collection("activities").add({
        roomCode,
        user: rewardScope === "buyer" ? buyerName : "TIP JAR",
        text:
          rewardScope === "buyer"
            ? `${buyerName} grabbed ${label} • +${points} pts`
            : `room tip jar hit ${amount} • everyone +${points} pts`,
        icon: "💸",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json({ received: true });
  }
);

exports.verifyAppleReceipt = onCall(
  { cors: true },
  async (request) => {
    const transactionId = request.data?.transactionId || "";
    const productId = request.data?.productId || "";
    const userUid = request.data?.userUid || "";
    ensureString(transactionId, "transactionId");
    ensureString(productId, "productId");
    ensureString(userUid, "userUid");

    // TODO: Wire App Store Server API with JWT auth and verify transaction.
    // After verification, grant entitlements and store a transaction record
    // to prevent duplicate grants.
    throw new HttpsError(
      "failed-precondition",
      "Apple IAP verification is not configured yet."
    );
  }
);
