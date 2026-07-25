const assert = require("node:assert/strict");
const {
  buildFallbackPopTriviaSeedRows,
  selectItunesPopTriviaMetadata,
} = require("../../functions/lib/popTrivia");

test("iTunes metadata grounds song-specific pop trivia", () => {
  const metadata = selectItunesPopTriviaMetadata(
    { songTitle: "Take On Me", artist: "A-ha" },
    [
      {
        trackName: "Take On Me",
        artistName: "A-ha",
        collectionName: "Hunting High and Low",
        releaseDate: "1985-06-01T00:00:00Z",
        primaryGenreName: "Pop",
        trackTimeMillis: 225000,
        trackId: 12345,
        artworkUrl100: "https://example.test/art.jpg",
      },
      {
        trackName: "Take On Me",
        artistName: "Cover Band",
        collectionName: "Karaoke Covers",
      },
    ]
  );

  assert.deepEqual(metadata, {
    album: "Hunting High and Low",
    releaseYear: "1985",
    genre: "Pop",
    durationSec: 225,
    appleMusicId: "12345",
    albumArtUrl: "https://example.test/art.jpg",
    metadataProvider: "itunes_search",
  });

  const rows = buildFallbackPopTriviaSeedRows({
    songTitle: "Take On Me",
    artist: "A-ha",
    ...metadata,
  });
  const questionText = rows.map((row) => `${row.q} ${row.correct}`).join(" ");
  assert.match(questionText, /1985/);
  assert.match(questionText, /Hunting High and Low/);
  assert.match(questionText, /Pop/);
  assert.match(questionText, /3 to 4 minutes/);
  assert.equal(rows.every((row) => row.q.includes("Take On Me")), true);
});

test("iTunes metadata rejects a title-only mismatch", () => {
  const metadata = selectItunesPopTriviaMetadata(
    { songTitle: "Halo", artist: "Beyonce" },
    [{
      trackName: "Halo",
      artistName: "Unrelated Cover Band",
      collectionName: "Cover Collection",
    }]
  );
  assert.deepEqual(metadata, {});
});
