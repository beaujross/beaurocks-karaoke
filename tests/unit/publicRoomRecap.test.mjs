import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildPublicRoomRecapHtml,
  buildPublicRoomRecapStoragePath,
  buildPublicRoomRecapUrl,
} = require("../../functions/lib/publicRoomRecap.js");

test("publicRoomRecap helper builds stable route and storage paths", () => {
  assert.equal(buildPublicRoomRecapUrl("aahf"), "https://app.beaurocks.app/recaps/AAHF");
  assert.equal(buildPublicRoomRecapUrl("vip777", "https://beaurocks.app"), "https://beaurocks.app/recaps/VIP777");
  assert.equal(buildPublicRoomRecapStoragePath("vip777"), "public_recaps/VIP777/index.html");
});

test("publicRoomRecap helper renders branded static html with social tags", () => {
  const html = buildPublicRoomRecapHtml({
    roomCode: "AAHF",
    publicUrl: "https://app.beaurocks.app/recaps/AAHF",
    origin: "https://app.beaurocks.app",
    roomData: {
      roomName: "Festival Loves",
      logoUrl: "/images/marketing/aahf-combined-badge-clean.png",
    },
    recap: {
      generatedAt: Date.UTC(2026, 4, 3, 3, 0, 0),
      totalSongs: 12,
      totalEmojiBursts: 88,
      totalUsers: 42,
      window: {
        startMs: Date.UTC(2026, 4, 2, 19, 0, 0),
        endMs: Date.UTC(2026, 4, 2, 23, 30, 0),
      },
      stats: {
        totalPerformedSongs: 12,
        totalQueuedSongs: 20,
        reactionCount: 88,
        totalUsers: 42,
      },
      metrics: {
        estimatedPeople: 42,
      },
      topPerformances: [
        {
          songTitle: "Dreams",
          singerName: "Teddy Ross",
          artist: "Fleetwood Mac",
          albumArtUrl: "https://cdn.example.com/dreams.jpg",
          totalPoints: 180,
          applauseScore: 90,
        },
      ],
      topPerformers: [
        {
          name: "Teddy Ross",
          performances: 2,
          loudest: 90,
        },
      ],
      topReactors: [
        {
          name: "Jordan",
          count: 25,
        },
      ],
      highlights: [
        {
          icon: "🔥",
          text: "Crowd lost it during the encore",
        },
      ],
    },
  });

  assert.match(html, /Festival Loves Recap \| BeauRocks Karaoke/);
  assert.match(html, /https:\/\/app\.beaurocks\.app\/recaps\/AAHF/);
  assert.match(html, /og:image/);
  assert.match(html, /aahf-combined-badge-clean\.png/);
  assert.match(html, /Standout performances/);
  assert.match(html, /Crowd leaders/);
  assert.match(html, /Highlights/);
});
