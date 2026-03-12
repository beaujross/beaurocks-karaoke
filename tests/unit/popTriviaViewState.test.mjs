import assert from "node:assert/strict";
import { test } from "vitest";

import { getActivePopTriviaQuestion } from "../../src/lib/popTrivia.js";

test("popTriviaViewState returns live question during active rounds", () => {
  const startMs = 1_700_000_000_000;
  const state = getActivePopTriviaQuestion({
    song: {
      performingStartedAt: startMs,
      popTrivia: [
        { id: "q1", q: "Question one", options: ["A", "B"], correct: 0 },
        { id: "q2", q: "Question two", options: ["A", "B"], correct: 1 },
      ],
    },
    now: startMs + 9_000,
    roundSec: 16,
  });

  assert.equal(state?.status, "live");
  assert.equal(state?.index, 0);
  assert.equal(state?.question?.id, "q1");
  assert.equal(state?.timeLeftSec, 7);
});

test("popTriviaViewState returns complete state after final round ends", () => {
  const startMs = 1_700_000_000_000;
  const state = getActivePopTriviaQuestion({
    song: {
      performingStartedAt: startMs,
      popTrivia: [
        { id: "q1", q: "Question one", options: ["A", "B"], correct: 0 },
        { id: "q2", q: "Question two", options: ["A", "B"], correct: 1 },
      ],
    },
    now: startMs + 33_000,
    roundSec: 16,
  });

  assert.equal(state?.status, "complete");
  assert.equal(state?.question, null);
  assert.equal(state?.index, 2);
  assert.equal(state?.timeLeftSec, 0);
  assert.equal(state?.completedAtMs, startMs + 32_000);
});
