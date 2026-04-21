"use strict";

const DEFAULT_POP_TRIVIA_ROUND_SEC = 16;
const DEFAULT_POP_TRIVIA_MAX_QUESTIONS = 4;
const POP_TRIVIA_PENDING_RETRY_AFTER_MS = 45 * 1000;
const POP_TRIVIA_FAILED_RETRY_AFTER_MS = 5 * 60 * 1000;
const POP_TRIVIA_FACT_HEAVY_PATTERN = /\b(what year|which year|release(?:d)?|release year|billboard|chart|grammy|award|which album|album\b|soundtrack|label\b|music video|director\b|producer\b|written by|city\b|country\b|born\b|debut|number one|top 10|peak(?:ed)? at)\b/i;
const POP_TRIVIA_LOW_QUALITY_PATTERN = /\b(which production trick is common|what usually helps most|classic crowd move|sets up the story or mood|artist might use|like the kind .* might use|random tempo changes|guitar cable check|start packing up|go completely silent|turning away from the crowd|ignoring the rhythm)\b/i;
const POP_TRIVIA_KARAOKE_ANCHOR_PATTERN = /\b(karaoke|singer|sing|sings|mic|microphone|stage|crowd|room|hook|chorus|verse|bridge|intro|outro|beat|rhythm|tempo|key|melody|harmony|lyric|backing track|track|performance|performer|energy|join in|sing-along|singalong)\b/i;
const POP_TRIVIA_ALLOWED_CATEGORIES = new Set([
  "arrangement",
  "crowd_moment",
  "hook_recognition",
  "performance",
  "safe_fact",
  "singalong",
]);

const getTimestampMs = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
};

const cleanText = (value, fallback = "") =>
  String(value || fallback || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeOptionText = (value = "") => cleanText(value).toLowerCase();

const escapeRegExp = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const includesMeaningfulSongText = (question = "", context = {}) => {
  const normalizedQuestion = normalizeOptionText(question);
  const directAnchors = [
    cleanText(context?.songTitle || ""),
    cleanText(context?.artist || ""),
  ].filter((value) => value.length >= 3);
  if (directAnchors.some((value) => normalizedQuestion.includes(value.toLowerCase()))) return true;

  const titleWords = cleanText(context?.songTitle || "")
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter((word) => word.length >= 4);
  return titleWords.some((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(question));
};

const dedupeOptionList = (items = []) => {
  const list = Array.isArray(items) ? items : [];
  return list.filter((optionText, optionIndex) => {
    const key = normalizeOptionText(optionText);
    return list.findIndex((candidate) => normalizeOptionText(candidate) === key) === optionIndex;
  });
};

const shuffleOptions = (list = []) => {
  const next = [...list];
  for (let idx = next.length - 1; idx > 0; idx -= 1) {
    const swap = Math.floor(Math.random() * (idx + 1));
    const tmp = next[idx];
    next[idx] = next[swap];
    next[swap] = tmp;
  }
  return next;
};

const sanitizePopTriviaCacheKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

const buildPopTriviaCacheKey = ({ song = {}, buildSongKey }) => {
  const title = cleanText(song?.songTitle || song?.title || "");
  const artist = cleanText(song?.artist || "Unknown") || "Unknown";
  if (!title || typeof buildSongKey !== "function") return "";
  return sanitizePopTriviaCacheKey(buildSongKey(title, artist));
};

const buildPopTriviaSongContext = (song = {}) => {
  const safeTitle = cleanText(song?.songTitle || song?.title || "");
  const safeArtist = cleanText(song?.artist || "Unknown") || "Unknown";
  const safeSinger = cleanText(song?.singerName || "");
  const mediaUrl = cleanText(song?.mediaUrl || song?.backingUrl || "");
  const sourceToken = cleanText(
    song?.source
    || song?.trackSource
    || song?.backingSource
    || song?.sourceType
    || ""
  ).toLowerCase();
  const isYouTubeSource = sourceToken.includes("youtube") || /youtu\.?be/i.test(mediaUrl);
  const isCustomSource = sourceToken.includes("custom");
  const metadata = {};
  const metadataPairs = [
    ["album", song?.album || song?.albumName || ""],
    ["releaseYear", song?.releaseYear || song?.year || ""],
    ["genre", song?.genre || song?.primaryGenre || song?.primaryGenreName || ""],
    ["language", song?.language || ""],
    ["decade", song?.decade || ""],
    ["source", song?.source || song?.trackSource || ""],
    ["youtubeId", song?.youtubeId || ""],
    ["channelTitle", song?.channelTitle || song?.channel || ""],
    ["videoTitle", song?.videoTitle || ""],
    ["sourceDetail", song?.sourceDetail || ""],
    ["songId", song?.songId || ""],
    ["appleMusicId", song?.appleMusicId || ""],
  ];
  metadataPairs.forEach(([key, value]) => {
    const clean = cleanText(value);
    if (clean) metadata[key] = clean;
  });
  const groundingKeys = ["album", "releaseYear", "genre", "language", "decade"];
  const groundingCount = groundingKeys.reduce((sum, key) => sum + (metadata[key] ? 1 : 0), 0);
  const metadataConfidence = groundingCount >= 2 ? "grounded" : (isYouTubeSource || isCustomSource ? "sparse" : "limited");
  return {
    songTitle: safeTitle,
    artist: safeArtist,
    singerName: safeSinger,
    metadata,
    metadataConfidence,
    sourceMode: isYouTubeSource ? "youtube" : isCustomSource ? "custom" : (sourceToken || "catalog"),
    style: "funny_insightful",
  };
};

const buildFallbackPopTriviaSeedRows = (song = {}) => {
  const context = buildPopTriviaSongContext(song);
  const songTitle = cleanText(context.songTitle || "this song", "this song");
  const singerName = cleanText(context.singerName || "the singer", "the singer");

  return [
    {
      q: `In "${songTitle}", what is the best cue that the whole room can join in?`,
      correct: "The chorus hook",
      w1: "A quiet verse line",
      w2: "The final fade-out",
      w3: "A background count-in",
      category: "hook_recognition",
      source: "fallback",
    },
    {
      q: `If "${songTitle}" starts lower than expected, what is the strongest first move?`,
      correct: "Keep the verse relaxed",
      w1: "Shout the first line",
      w2: "Race ahead of the beat",
      w3: "Drop the melody",
      category: "performance",
      source: "fallback",
    },
    {
      q: `What makes a backing track for "${songTitle}" easiest for the crowd to follow?`,
      correct: "Clear beat and lyric timing",
      w1: "Hidden lead vocals",
      w2: "A surprise tempo jump",
      w3: "No intro cue",
      category: "arrangement",
      source: "fallback",
    },
    {
      q: `When ${singerName} reaches the biggest line in "${songTitle}", what wins the room?`,
      correct: "Commit to the hook",
      w1: "Mumble through the chorus",
      w2: "Hide behind the screen",
      w3: "Skip the payoff",
      category: "crowd_moment",
      source: "fallback",
    },
  ];
};

const normalizePopTriviaSeedRows = (rows = [], options = {}) => {
  if (!Array.isArray(rows)) return [];
  const limit = Math.max(1, Number(options?.limit || DEFAULT_POP_TRIVIA_MAX_QUESTIONS));

  return rows
    .map((entry) => {
      const question = cleanText(entry?.q || entry?.question);
      if (!question) return null;

      const explicitOptions = Array.isArray(entry?.options) ? entry.options : [];
      const fallbackOptions = [entry?.correct, entry?.w1, entry?.w2, entry?.w3];
      const candidateOptions = (explicitOptions.length ? explicitOptions : fallbackOptions)
        .map((item) => cleanText(item))
        .filter(Boolean);
      const dedupedOptions = dedupeOptionList(candidateOptions);
      if (dedupedOptions.length < 2) return null;

      let correctIndex = -1;
      const correctLabel = cleanText(entry?.correct);
      if (correctLabel) {
        const target = normalizeOptionText(correctLabel);
        correctIndex = dedupedOptions.findIndex((item) => normalizeOptionText(item) === target);
      }
      if (correctIndex < 0 && Number.isInteger(entry?.correctIndex)) {
        correctIndex = Math.max(0, Math.min(dedupedOptions.length - 1, Number(entry.correctIndex)));
      }
      if (correctIndex < 0 && Number.isInteger(entry?.correct)) {
        correctIndex = Math.max(0, Math.min(dedupedOptions.length - 1, Number(entry.correct)));
      }
      if (correctIndex < 0) correctIndex = 0;

      return {
        q: question,
        options: dedupedOptions,
        correctIndex,
        category: cleanText(entry?.category || ""),
        source: cleanText(entry?.source || "ai") || "ai",
      };
    })
    .filter(Boolean)
    .slice(0, limit);
};

const normalizePopTriviaQuestions = (rows = [], options = {}) => {
  if (!Array.isArray(rows)) return [];
  const limit = Math.max(1, Number(options?.limit || DEFAULT_POP_TRIVIA_MAX_QUESTIONS));
  const idPrefix = cleanText(options?.idPrefix || "poptrivia");
  const createdAt = Number(options?.createdAtMs || Date.now());

  return rows
    .map((entry, index) => {
      const question = cleanText(entry?.q || entry?.question);
      if (!question) return null;

      const explicitOptions = Array.isArray(entry?.options) ? entry.options : [];
      const fallbackOptions = [entry?.correct, entry?.w1, entry?.w2, entry?.w3];
      const candidateOptions = (explicitOptions.length ? explicitOptions : fallbackOptions)
        .map((item) => cleanText(item))
        .filter(Boolean);
      const dedupedOptions = dedupeOptionList(candidateOptions);
      if (dedupedOptions.length < 2) return null;

      const correctLabel = cleanText(entry?.correct);
      const shuffled = shuffleOptions(dedupedOptions);
      let correctIndex = -1;
      if (correctLabel) {
        const target = normalizeOptionText(correctLabel);
        correctIndex = shuffled.findIndex((item) => normalizeOptionText(item) === target);
      } else if (Number.isInteger(entry?.correctIndex) || Number.isInteger(entry?.correct)) {
        const sourceIndex = Number.isInteger(entry?.correctIndex)
          ? Number(entry.correctIndex)
          : Number(entry.correct);
        const source = dedupedOptions[Math.max(0, Math.min(dedupedOptions.length - 1, sourceIndex))];
        const target = normalizeOptionText(source);
        correctIndex = shuffled.findIndex((item) => normalizeOptionText(item) === target);
      }
      if (correctIndex < 0) correctIndex = 0;

      return {
        id: `${idPrefix}_${createdAt}_${index}`,
        q: question,
        options: shuffled,
        correct: correctIndex,
        category: cleanText(entry?.category || ""),
        source: cleanText(entry?.source || "ai") || "ai",
      };
    })
    .filter(Boolean)
    .slice(0, limit);
};

const normalizePopTriviaSongCache = (value = {}) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next = {};
  Object.entries(value).forEach(([key, entry]) => {
    const safeKey = sanitizePopTriviaCacheKey(key);
    if (!safeKey || !entry || typeof entry !== "object" || Array.isArray(entry)) return;
    const seedRows = normalizePopTriviaSeedRows(entry?.seedRows || entry?.rows || entry?.questions || [], {
      limit: DEFAULT_POP_TRIVIA_MAX_QUESTIONS,
    });
    if (!seedRows.length) return;
    next[safeKey] = {
      seedRows,
      songTitle: cleanText(entry?.songTitle || ""),
      artist: cleanText(entry?.artist || ""),
      source: cleanText(entry?.source || "ai") || "ai",
      updatedAtMs: Math.max(0, Number(entry?.updatedAtMs || getTimestampMs(entry?.updatedAt) || 0)),
    };
  });
  return next;
};

const isFactHeavyPopTriviaRow = (entry = {}) => {
  const haystack = [
    cleanText(entry?.q || entry?.question),
    cleanText(entry?.correct),
    cleanText(entry?.w1),
    cleanText(entry?.w2),
    cleanText(entry?.w3),
    ...(Array.isArray(entry?.options) ? entry.options.map((option) => cleanText(option)) : []),
  ]
    .filter(Boolean)
    .join(" ");
  if (!haystack) return false;
  if (POP_TRIVIA_FACT_HEAVY_PATTERN.test(haystack)) return true;
  return /\b(19|20)\d{2}\b/.test(haystack);
};

const getPopTriviaRowQualityScore = (entry = {}, context = {}) => {
  const question = cleanText(entry?.q || entry?.question);
  if (!question) return -10;
  const options = Array.isArray(entry?.options)
    ? entry.options
    : [entry?.correct, entry?.w1, entry?.w2, entry?.w3];
  const optionText = options.map((option) => cleanText(option)).filter(Boolean);
  const haystack = [question, ...optionText].join(" ");
  let score = 0;

  if (question.length >= 35 && question.length <= 150) score += 2;
  else score -= 2;

  if (includesMeaningfulSongText(question, context)) score += 3;
  if (POP_TRIVIA_KARAOKE_ANCHOR_PATTERN.test(haystack)) score += 2;
  if (POP_TRIVIA_ALLOWED_CATEGORIES.has(cleanText(entry?.category || "").toLowerCase())) score += 1;
  if (optionText.length >= 4) score += 1;
  if (optionText.some((option) => option.length > 55)) score -= 2;
  if (POP_TRIVIA_LOW_QUALITY_PATTERN.test(haystack)) score -= 8;
  if (
    isFactHeavyPopTriviaRow(entry)
    && (context?.metadataConfidence === "sparse" || ["youtube", "custom"].includes(context?.sourceMode))
  ) {
    score -= 4;
  }

  return score;
};

const isLowQualityPopTriviaRow = (entry = {}, context = {}) => {
  const question = cleanText(entry?.q || entry?.question);
  const options = Array.isArray(entry?.options)
    ? entry.options
    : [entry?.correct, entry?.w1, entry?.w2, entry?.w3];
  const haystack = [question, ...options.map((option) => cleanText(option)).filter(Boolean)].join(" ");
  if (!question || POP_TRIVIA_LOW_QUALITY_PATTERN.test(haystack)) return true;
  if (isFactHeavyPopTriviaRow(entry) && context?.metadataConfidence === "sparse") return true;
  if (["youtube", "custom"].includes(context?.sourceMode) && isFactHeavyPopTriviaRow(entry)) return true;
  return getPopTriviaRowQualityScore(entry, context) < 1;
};

const selectPopTriviaSeedRows = ({
  song = {},
  aiRows = [],
  fallbackRows = [],
  limit = DEFAULT_POP_TRIVIA_MAX_QUESTIONS,
} = {}) => {
  const context = buildPopTriviaSongContext(song);
  const safeLimit = Math.max(1, Number(limit || DEFAULT_POP_TRIVIA_MAX_QUESTIONS));
  const normalizedAiRows = normalizePopTriviaSeedRows(aiRows, { limit: safeLimit * 2 });
  const normalizedFallbackRows = normalizePopTriviaSeedRows(fallbackRows, { limit: safeLimit * 2 });
  const metadataSparse = context.metadataConfidence === "sparse";
  const filteredAiRows = (metadataSparse
    ? normalizedAiRows.filter((entry) => !isFactHeavyPopTriviaRow(entry))
    : normalizedAiRows)
    .filter((entry) => !isLowQualityPopTriviaRow(entry, context))
    .map((entry) => ({ entry, score: getPopTriviaRowQualityScore(entry, context) }))
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry);
  const filteredFallbackRows = normalizedFallbackRows
    .filter((entry) => !isLowQualityPopTriviaRow(entry, context))
    .map((entry) => ({ entry, score: getPopTriviaRowQualityScore(entry, context) }))
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry);
  const selected = [];
  const seenQuestions = new Set();
  const pushRow = (entry) => {
    if (!entry || selected.length >= safeLimit) return;
    const key = normalizeOptionText(entry.q || entry.question || "");
    if (!key || seenQuestions.has(key)) return;
    seenQuestions.add(key);
    selected.push(entry);
  };

  filteredAiRows.forEach(pushRow);
  filteredFallbackRows.forEach(pushRow);
  normalizedFallbackRows.forEach(pushRow);

  return selected.slice(0, safeLimit);
};

const shouldAttemptPopTriviaGeneration = (
  song = {},
  {
    now = Date.now(),
    pendingRetryAfterMs = POP_TRIVIA_PENDING_RETRY_AFTER_MS,
    failedRetryAfterMs = POP_TRIVIA_FAILED_RETRY_AFTER_MS,
  } = {}
) => {
  const currentStatus = cleanText(song?.status || "").toLowerCase();
  if (!["requested", "pending", "performing"].includes(currentStatus)) {
    return { ok: false, reason: "song_status_ineligible" };
  }
  if (!cleanText(song?.songTitle || song?.title || "")) {
    return { ok: false, reason: "missing_title" };
  }
  if (Array.isArray(song?.popTrivia) && song.popTrivia.length > 0) {
    return { ok: false, reason: "already_ready" };
  }

  const triviaStatus = cleanText(song?.popTriviaStatus || "").toLowerCase();
  const lastAttemptMs = Math.max(
    0,
    Number(song?.popTriviaRequestedAtMs || 0),
    getTimestampMs(song?.popTriviaGeneratedAt),
    getTimestampMs(song?.popTriviaUpdatedAt)
  );
  if (triviaStatus === "ready") {
    return { ok: false, reason: "already_ready" };
  }
  if (triviaStatus === "pending" && lastAttemptMs > 0 && (Number(now) - lastAttemptMs) < pendingRetryAfterMs) {
    return { ok: false, reason: "pending_recent" };
  }
  if (triviaStatus === "failed" && lastAttemptMs > 0 && (Number(now) - lastAttemptMs) < failedRetryAfterMs) {
    return { ok: false, reason: "failed_recent" };
  }
  return { ok: true, reason: triviaStatus || "missing_status" };
};

module.exports = {
  DEFAULT_POP_TRIVIA_MAX_QUESTIONS,
  DEFAULT_POP_TRIVIA_ROUND_SEC,
  POP_TRIVIA_FAILED_RETRY_AFTER_MS,
  POP_TRIVIA_PENDING_RETRY_AFTER_MS,
  buildPopTriviaCacheKey,
  buildFallbackPopTriviaSeedRows,
  buildPopTriviaSongContext,
  getPopTriviaRowQualityScore,
  getTimestampMs,
  normalizePopTriviaQuestions,
  normalizePopTriviaSeedRows,
  normalizePopTriviaSongCache,
  selectPopTriviaSeedRows,
  sanitizePopTriviaCacheKey,
  shouldAttemptPopTriviaGeneration,
};
