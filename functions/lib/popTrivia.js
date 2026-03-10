"use strict";

const DEFAULT_POP_TRIVIA_ROUND_SEC = 16;
const DEFAULT_POP_TRIVIA_MAX_QUESTIONS = 4;
const POP_TRIVIA_PENDING_RETRY_AFTER_MS = 45 * 1000;
const POP_TRIVIA_FAILED_RETRY_AFTER_MS = 5 * 60 * 1000;

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
  const metadata = {};
  const metadataPairs = [
    ["album", song?.album || song?.albumName || ""],
    ["releaseYear", song?.releaseYear || song?.year || ""],
    ["genre", song?.genre || song?.primaryGenre || song?.primaryGenreName || ""],
    ["language", song?.language || ""],
    ["decade", song?.decade || ""],
    ["source", song?.source || song?.trackSource || ""],
    ["songId", song?.songId || ""],
    ["appleMusicId", song?.appleMusicId || ""],
  ];
  metadataPairs.forEach(([key, value]) => {
    const clean = cleanText(value);
    if (clean) metadata[key] = clean;
  });
  return {
    songTitle: safeTitle,
    artist: safeArtist,
    singerName: safeSinger,
    metadata,
    style: "funny_insightful",
  };
};

const buildFallbackPopTriviaSeedRows = (song = {}) => {
  const context = buildPopTriviaSongContext(song);
  const songTitle = cleanText(context.songTitle || "this song", "this song");
  const artist = cleanText(context.artist || "the artist", "the artist");
  const singerName = cleanText(context.singerName || "the singer", "the singer");

  return [
    {
      q: `Before "${songTitle}" hits the big hook, which song section usually sets up the story or mood?`,
      correct: "The verse",
      w1: "The outro",
      w2: "The final bow",
      w3: "The guitar cable check",
      source: "fallback",
    },
    {
      q: `When ${singerName} takes the mic for "${songTitle}", what usually helps most in karaoke?`,
      correct: "Confidence and staying on beat",
      w1: "Ignoring the rhythm entirely",
      w2: "Turning away from the crowd",
      w3: "Rushing every lyric",
      source: "fallback",
    },
    {
      q: `Which production trick is common in polished pop vocals like the kind ${artist} might use?`,
      correct: "Layered harmonies",
      w1: "Muting the melody",
      w2: "Removing the chorus",
      w3: "Random tempo changes every bar",
      source: "fallback",
    },
    {
      q: `When the chorus of "${songTitle}" lands, what is the classic crowd move?`,
      correct: "Sing along on the hook",
      w1: "Go completely silent",
      w2: "Ask for a sound check",
      w3: "Start packing up the room",
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
  getTimestampMs,
  normalizePopTriviaQuestions,
  normalizePopTriviaSeedRows,
  normalizePopTriviaSongCache,
  sanitizePopTriviaCacheKey,
  shouldAttemptPopTriviaGeneration,
};
