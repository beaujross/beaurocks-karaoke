import assert from "node:assert/strict";
import { test } from "vitest";

import { getCrowdPulseSnapshot } from "../../src/apps/Host/crowdPulse.js";

const now = 1_700_000_000_000;

test("crowd pulse recommends keeping singers moving when phones are active and queue is healthy", () => {
  const snapshot = getCrowdPulseSnapshot({
    roomUsers: [
      { id: "u1", lastActiveAt: now - 20_000 },
      { id: "u2", lastActiveAt: now - 40_000 },
      { id: "u3", lastActiveAt: now - 60_000 },
      { id: "u4", lastActiveAt: now - 110_000 },
    ],
    activities: [
      { uid: "u1", text: "requested Mr. Brightside", timestamp: now - 35_000 },
      { uid: "u2", text: "shared a selfie", timestamp: now - 50_000 },
    ],
    queueDepth: 4,
    runOfShowEnabled: true,
    liveSceneType: "performance",
    now,
  });

  assert.equal(snapshot.level, "hot");
  assert.equal(snapshot.metrics.livePhonePct >= 75, true);
  assert.match(snapshot.recommendationTitle, /Keep singers moving/i);
  assert.equal(snapshot.alignmentLabel, "With You");
  assert.equal(snapshot.metrics.alignmentPct >= 72, true);
  assert.match(snapshot.hostDirective, /Keep singer flow moving/i);
});

test("crowd pulse recommends a short reset when the lobby is thin and queue is short", () => {
  const snapshot = getCrowdPulseSnapshot({
    roomUsers: [
      { id: "u1", lastActiveAt: now - 8 * 60 * 1000 },
      { id: "u2", lastActiveAt: now - 9 * 60 * 1000 },
      { id: "u3", lastActiveAt: now - 10 * 60 * 1000 },
    ],
    activities: [],
    queueDepth: 1,
    runOfShowEnabled: true,
    now,
  });

  assert.equal(snapshot.level, "reset");
  assert.match(snapshot.recommendationTitle, /Slot a short conveyor scene now/i);
  assert.match(snapshot.recommendationDetail, /trivia hit, WYR, or hype beat/i);
  assert.equal(snapshot.alignmentLabel, "Lost");
  assert.equal(snapshot.alignmentWindowOpen, true);
  assert.match(snapshot.hostDirective, /Trigger a reset now/i);
});

test("crowd pulse falls back cleanly when there is no lobby yet", () => {
  const snapshot = getCrowdPulseSnapshot({
    roomUsers: [],
    activities: [],
    queueDepth: 0,
    now,
  });

  assert.equal(snapshot.level, "quiet");
  assert.equal(snapshot.metrics.lobbyCount, 0);
  assert.match(snapshot.recommendationDetail, /until more phones join/i);
  assert.equal(snapshot.alignmentLabel, "Waiting On Phones");
  assert.equal(snapshot.metrics.alignmentPct, 0);
});
