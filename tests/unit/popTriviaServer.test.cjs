const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const {
  buildPopTriviaCacheKey,
  buildFallbackPopTriviaSeedRows,
  buildPopTriviaSongContext,
  getPopTriviaRowQualityScore,
  getTimestampMs,
  normalizePopTriviaQuestions,
  normalizePopTriviaSeedRows,
  normalizePopTriviaSongCache,
  sanitizePopTriviaCacheKey,
  selectPopTriviaSeedRows,
  shouldAttemptPopTriviaGeneration,
} = require("../../functions/lib/popTrivia");

test("popTriviaServer.test", async () => {
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
  assert.equal(fallbackRows.every((row) => row.category), true);
  const fallbackText = fallbackRows.map((row) => `${row.q} ${row.correct} ${row.w1} ${row.w2} ${row.w3}`).join(" ");
  assert.match(fallbackText, /Take On Me/);
  assert.doesNotMatch(
    fallbackText,
    /production trick|might use|classic crowd move|usually helps most|guitar cable check|sets up the story/i
  );
  const fallbackQuestions = normalizePopTriviaQuestions(fallbackRows, {
    idPrefix: "ROOM_fallback",
    createdAtMs: 5678,
  });
  assert.equal(fallbackQuestions.length, 4);
  assert.equal(fallbackQuestions.every((row) => row.source === "fallback"), true);
  assert.equal(fallbackQuestions.every((row) => row.category), true);

  const weakScore = getPopTriviaRowQualityScore({
    q: "Which production trick is common in polished pop vocals like the kind this artist might use?",
    correct: "Layered harmonies",
    w1: "Muted melody",
    w2: "No chorus",
    w3: "Random tempo changes",
  }, context);
  const strongScore = getPopTriviaRowQualityScore({
    q: 'In "Take On Me", which cue tells the room the chorus hook is landing?',
    correct: "The melody jumps up",
    w1: "The intro gets quieter",
    w2: "The outro starts",
    w3: "The tempo vanishes",
    category: "hook_recognition",
  }, context);
  assert.equal(strongScore > weakScore, true);

  assert.equal(
    sanitizePopTriviaCacheKey("  Take On Me / A-ha (Live @ 1985)!  "),
    "take_on_me_a-ha_live_1985"
  );
  assert.equal(getTimestampMs({ toMillis: () => 9876 }), 9876);
  assert.equal(getTimestampMs({ seconds: 12 }), 12000);
  assert.equal(getTimestampMs(null), 0);

  const sparseSelectedRows = selectPopTriviaSeedRows({
    song: {
      songTitle: "Mystery YouTube Cut",
      artist: "Indie Friend",
      source: "youtube",
      mediaUrl: "https://youtu.be/demo1234567",
    },
    aiRows: [
      {
        q: "What year did this song hit the Billboard Hot 100?",
        correct: "2016",
        w1: "2014",
        w2: "2018",
        w3: "2020",
      },
      {
        q: "Which production trick is common in polished pop vocals like this artist might use?",
        correct: "Layered harmonies",
        w1: "Muted melody",
        w2: "No chorus",
        w3: "Random tempo changes",
      },
      {
        q: 'In "Mystery YouTube Cut", what cue tells the room the chorus hook is landing?',
        correct: "The repeatable line arrives",
        w1: "The stage lights turn off",
        w2: "The verse gets quieter",
        w3: "The outro starts early",
        category: "hook_recognition",
      },
    ],
    fallbackRows,
    limit: 4,
  });
  assert.equal(
    sparseSelectedRows.some((row) => /billboard/i.test(row.q)),
    false
  );
  assert.equal(
    sparseSelectedRows.some((row) => /production trick|might use/i.test(row.q)),
    false
  );
  assert.equal(sparseSelectedRows[0].q.includes("Mystery YouTube Cut"), true);
  assert.equal(sparseSelectedRows.length, 4);

  const groundedSelectedRows = selectPopTriviaSeedRows({
    song: {
      songTitle: "Take On Me",
      artist: "A-ha",
      album: "Hunting High and Low",
      year: 1985,
      genre: "Synth-pop",
    },
    aiRows: [
      {
        q: 'In "Take On Me", which moment tells the room the chorus is about to explode?',
        correct: "The melody vaults upward",
        w1: "The lights go dark",
        w2: "The beat disappears",
        w3: "The singer stops moving",
        category: "hook_recognition",
      },
      {
        q: 'For "Take On Me", what keeps the first verse comfortable before the high hook arrives?',
        correct: "Stay loose on the lower lines",
        w1: "Push every note full volume",
        w2: "Rush ahead of the groove",
        w3: "Flatten the melody",
        category: "performance",
      },
      {
        q: 'In "Take On Me", what gives the crowd the clearest entry into the big sing-along?',
        correct: "A repeatable chorus line",
        w1: "A hidden backing vocal",
        w2: "An abrupt fade-out",
        w3: "A spoken bridge",
        category: "singalong",
      },
    ],
    fallbackRows,
    limit: 3,
  });
  assert.equal(groundedSelectedRows.length, 3);
  assert.equal(
    groundedSelectedRows.every((row) => row.q.includes("Take On Me")),
    true
  );
  assert.equal(
    groundedSelectedRows.some((row) => row.source === "fallback"),
    false
  );

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
  assert.equal(
    shouldAttemptPopTriviaGeneration({
      id: "song-1",
      status: "performing",
      title: "Alias Title",
    }, { now }).ok,
    true
  );
  assert.equal(
    shouldAttemptPopTriviaGeneration({
      id: "song-1",
      status: "performing",
      popTriviaStatus: "ready",
      songTitle: "Take On Me",
    }, { now }).reason,
    "already_ready"
  );
  assert.equal(
    shouldAttemptPopTriviaGeneration({
      id: "song-1",
      status: "performing",
      songTitle: "",
    }, { now }).reason,
    "missing_title"
  );
  assert.equal(
    shouldAttemptPopTriviaGeneration({
      id: "song-1",
      status: "performing",
      songTitle: "Take On Me",
      popTrivia: [{ id: "q1" }],
    }, { now }).reason,
    "already_ready"
  );
  assert.equal(
    shouldAttemptPopTriviaGeneration({
      id: "song-1",
      status: "performing",
      songTitle: "Take On Me",
      popTriviaStatus: "failed",
      popTriviaGeneratedAt: { seconds: Math.floor((now - 1000) / 1000) },
    }, { now }).reason,
    "failed_recent"
  );

  const functionsSource = readFileSync("functions/index.js", "utf8");
  assert.match(functionsSource, /Do not ask generic filler/);
  assert.match(functionsSource, /"category":"hook_recognition"/);
});
