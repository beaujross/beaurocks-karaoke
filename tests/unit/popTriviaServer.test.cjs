const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const {
  buildPopTriviaCacheKey,
  buildCuratedPopTriviaSeedRows,
  buildFallbackPopTriviaSeedRows,
  buildPopTriviaSongContext,
  getPopTriviaQuestionType,
  getPopTriviaRowQualityScore,
  getTimestampMs,
  normalizePopTriviaQuestions,
  normalizePopTriviaSeedRows,
  normalizePopTriviaSongCache,
  sanitizePopTriviaCacheKey,
  selectPopTriviaSeedRows,
  shouldAttemptPopTriviaGeneration,
} = require("../../functions/lib/popTrivia");

const selectedAnswerText = (row) => row?.correct || row?.options?.[row?.correctIndex] || "";

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
    year: 1985,
    genre: "Synth-pop",
  });
  assert.equal(fallbackRows.length, 2);
  assert.equal(fallbackRows.every((row) => row.source === "fallback"), true);
  assert.equal(fallbackRows.every((row) => row.category), true);
  const fallbackText = fallbackRows.map((row) => `${row.q} ${row.correct} ${row.w1} ${row.w2} ${row.w3}`).join(" ");
  assert.match(fallbackText, /1985|Synth-pop/);
  assert.doesNotMatch(
    fallbackText,
    /QA Singer|production trick|might use|classic crowd move|usually helps most|guitar cable check|sets up the story|safest fan clue|best keeps|what kind of trivia clue|release-year|billboard|grammy|music video|record label|current singer|performer|microphone/i
  );
  const fallbackQuestions = normalizePopTriviaQuestions(fallbackRows, {
    idPrefix: "ROOM_fallback",
    createdAtMs: 5678,
  });
  assert.equal(fallbackQuestions.length, 2);
  assert.equal(fallbackQuestions.every((row) => row.source === "fallback"), true);
  assert.equal(fallbackQuestions.every((row) => row.category), true);

  const curatedU2Rows = buildCuratedPopTriviaSeedRows({
    songTitle: "With or Without You",
    artist: "U2",
    source: "youtube",
  });
  assert.equal(curatedU2Rows.length, 4);
  assert.match(curatedU2Rows.map((row) => `${row.q} ${row.correct}`).join(" "), /The Joshua Tree|1987|Infinite Guitar/);
  assert.equal(curatedU2Rows.every((row) => row.source === "curated_fact"), true);

  const selectedU2Rows = selectPopTriviaSeedRows({
    song: { songTitle: "With or Without You", artist: "U2", source: "youtube" },
    aiRows: [],
    fallbackRows: buildFallbackPopTriviaSeedRows({ songTitle: "With or Without You", artist: "U2", source: "youtube" }),
    limit: 4,
  });
  const selectedU2Text = selectedU2Rows.map((row) => `${row.q} ${selectedAnswerText(row)}`).join(" ");
  const selectedU2Context = buildPopTriviaSongContext({ songTitle: "With or Without You", artist: "U2", source: "youtube" });
  assert.match(selectedU2Text, /The Joshua Tree/);
  assert.match(selectedU2Text, /1987/);
  assert.match(selectedU2Text, /Infinite Guitar/);
  assert.equal(
    selectedU2Rows.filter((row) => getPopTriviaQuestionType(row, selectedU2Context).startsWith("identity_")).length <= 1,
    true
  );

  const weakScore = getPopTriviaRowQualityScore({
    q: "Which production trick is common in polished pop vocals like the kind this artist might use?",
    correct: "Layered harmonies",
    w1: "Muted melody",
    w2: "No chorus",
    w3: "Random tempo changes",
  }, context);
  const strongScore = getPopTriviaRowQualityScore({
    q: 'For "Take On Me" by A-ha, which clue is about the song title?',
    correct: "The title phrase",
    w1: "A fake chart record",
    w2: "An unrelated playlist note",
    w3: "A random venue clue",
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
        q: 'For "Mystery YouTube Cut" by Indie Friend, which clue is safest for fans?',
        correct: "The title and artist",
        w1: "A made-up release year",
        w2: "An unrelated rumor",
        w3: "A random venue clue",
        category: "hook_recognition",
      },
    ],
    fallbackRows: buildFallbackPopTriviaSeedRows({ songTitle: "Mystery YouTube Cut", artist: "Indie Friend", source: "youtube" }),
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
  assert.equal(sparseSelectedRows.length, 0);

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
        q: 'For "Take On Me" by A-ha, which phrase is the fan clue?',
        correct: "Take On Me",
        w1: "Hunting High and Low",
        w2: "Synth-pop",
        w3: "A-ha",
        category: "hook_recognition",
      },
      {
        q: 'Which listed album includes "Take On Me" by A-ha?',
        correct: "Hunting High and Low",
        w1: "A greatest-hits playlist",
        w2: "A fan-made remix",
        w3: "A tour poster",
        category: "song_fact",
      },
      {
        q: 'Which genre tag fits "Take On Me" by A-ha?',
        correct: "Synth-pop",
        w1: "Bluegrass",
        w2: "Opera",
        w3: "Salsa",
        category: "song_fact",
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
    groundedSelectedRows.some((row) => selectedAnswerText(row) === "Take On Me" || selectedAnswerText(row) === "A-ha"),
    false
  );

  const cache = normalizePopTriviaSongCache({
    "take_on_me_a-ha": {
      seedRows: [
        ...buildFallbackPopTriviaSeedRows({ songTitle: "Take On Me", artist: "A-ha", year: 1985, genre: "Synth-pop" }),
        {
          q: "What should the current singer do during Take On Me?",
          correct: "Work the stage",
          w1: "Mention A-ha",
          w2: "Name the title",
          w3: "Pick a fact",
        },
      ],
      songTitle: "Take On Me",
      artist: "A-ha",
      source: "ai",
      updatedAtMs: 4567,
    },
  });
  assert.equal(Object.keys(cache).length, 1);
  assert.equal(cache["take_on_me-a-ha"]?.seedRows?.length || cache["take_on_me_a-ha"].seedRows.length, 2);
  assert.equal(cache["take_on_me_a-ha"].seedRows.some((row) => /current singer|stage/i.test(row.q)), false);

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
  assert.match(functionsSource, /Every question must focus on the requested song/);
  assert.match(functionsSource, /Do not mention or ask about the current singer/);
  assert.match(functionsSource, /At most 1 question may ask for the listed artist/);
  assert.match(functionsSource, /If you cannot write a safe factual question, write a title, artist, hook, or arrangement question instead/);
  assert.match(functionsSource, /"category":"hook_recognition"/);
});
