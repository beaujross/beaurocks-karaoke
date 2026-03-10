const assert = require("node:assert/strict");
const {
  buildPopTriviaCacheKey,
  buildFallbackPopTriviaSeedRows,
  buildPopTriviaSongContext,
  normalizePopTriviaQuestions,
  normalizePopTriviaSeedRows,
  normalizePopTriviaSongCache,
  shouldAttemptPopTriviaGeneration,
} = require("../../functions/lib/popTrivia");

const run = async () => {
  const seedRows = normalizePopTriviaSeedRows([
    {
      q: "Which decade broke this song big?",
      correct: "1980s",
      w1: "1970s",
      w2: "1990s",
      w3: "2000s",
    },
    {
      q: "Duplicate options should collapse",
      correct: "A",
      w1: "A",
      w2: "B",
      w3: "C",
    },
  ]);
  assert.equal(seedRows.length, 2);
  assert.equal(seedRows[0].correctIndex >= 0, true);
  assert.equal(seedRows[1].options.length, 3);

  const questions = normalizePopTriviaQuestions(seedRows, {
    idPrefix: "ROOM_song",
    createdAtMs: 1234,
  });
  assert.equal(questions.length, 2);
  assert.equal(questions[0].id, "ROOM_song_1234_0");
  assert.equal(questions[0].correct >= 0, true);
  assert.equal(questions[0].correct < questions[0].options.length, true);

  const cacheKey = buildPopTriviaCacheKey({
    song: { songTitle: "Take On Me", artist: "A-ha" },
    buildSongKey: (title, artist) => `${title}__${artist}`,
  });
  assert.equal(cacheKey, "take_on_me_a-ha");

  const context = buildPopTriviaSongContext({
    songTitle: "Take On Me",
    artist: "A-ha",
    singerName: "QA Singer",
    year: 1985,
  });
  assert.equal(context.songTitle, "Take On Me");
  assert.equal(context.metadata.releaseYear, "1985");

  const fallbackRows = buildFallbackPopTriviaSeedRows({
    songTitle: "Take On Me",
    artist: "A-ha",
    singerName: "QA Singer",
  });
  assert.equal(fallbackRows.length, 4);
  assert.equal(fallbackRows.every((row) => row.source === "fallback"), true);
  const fallbackQuestions = normalizePopTriviaQuestions(fallbackRows, {
    idPrefix: "ROOM_fallback",
    createdAtMs: 5678,
  });
  assert.equal(fallbackQuestions.length, 4);
  assert.equal(fallbackQuestions.every((row) => row.source === "fallback"), true);

  const cache = normalizePopTriviaSongCache({
    "take_on_me_a-ha": {
      seedRows,
      songTitle: "Take On Me",
      artist: "A-ha",
      source: "ai",
      updatedAtMs: 4567,
    },
  });
  assert.equal(Object.keys(cache).length, 1);
  assert.equal(cache["take_on_me_a-ha"].seedRows.length, 2);

  const now = Date.now();
  assert.equal(
    shouldAttemptPopTriviaGeneration({
      id: "song-1",
      status: "performing",
      songTitle: "Take On Me",
    }, { now }).ok,
    true
  );
  assert.equal(
    shouldAttemptPopTriviaGeneration({
      id: "song-1",
      status: "performing",
      songTitle: "Take On Me",
      popTriviaStatus: "pending",
      popTriviaRequestedAtMs: now - 5000,
    }, { now }).reason,
    "pending_recent"
  );
  assert.equal(
    shouldAttemptPopTriviaGeneration({
      id: "song-1",
      status: "performing",
      songTitle: "Take On Me",
      popTriviaStatus: "failed",
      popTriviaRequestedAtMs: now - (10 * 60 * 1000),
    }, { now }).ok,
    true
  );
  assert.equal(
    shouldAttemptPopTriviaGeneration({
      id: "song-1",
      status: "complete",
      songTitle: "Take On Me",
    }, { now }).reason,
    "song_status_ineligible"
  );

  console.log("PASS popTriviaServer");
};

run();
