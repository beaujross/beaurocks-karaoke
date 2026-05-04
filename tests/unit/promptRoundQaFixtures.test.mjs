import assert from "node:assert/strict";
import { test } from "vitest";

import { buildQaHostFixture } from "../../src/apps/Host/qaHostFixtures.js";
import { buildQaAudienceFixture } from "../../src/apps/Mobile/qaAudienceFixtures.js";
import { buildQaTvFixture } from "../../src/apps/TV/qaTvFixtures.js";

test("host prompt-round fixtures cover trivia and would-you-rather live states", () => {
  const triviaFixture = buildQaHostFixture("prompt-round-trivia-live", { roomCode: "DEMOAAHF", nowMs: 1763503200000 });
  const wyrFixture = buildQaHostFixture("prompt-round-wyr-live", { roomCode: "DEMOAAHF", nowMs: 1763503200000 });

  assert.equal(triviaFixture.tab, "stage");
  assert.equal(triviaFixture.room.activeMode, "trivia_pop");
  assert.equal(triviaFixture.room.triviaQuestion.q, "Which anthem gets the room singing first?");
  assert.equal(triviaFixture.room.triviaQuestion.correct, 0);
  assert.equal(triviaFixture.room.wyrData, null);

  assert.equal(wyrFixture.tab, "stage");
  assert.equal(wyrFixture.room.activeMode, "wyr");
  assert.equal(wyrFixture.room.triviaQuestion, null);
  assert.equal(wyrFixture.room.wyrData.question, "Would you rather open with a power ballad or a crowd singalong?");
  assert.equal(wyrFixture.room.wyrData.optionA, "Power ballad");
  assert.equal(wyrFixture.room.wyrData.optionB, "Crowd singalong");
});

test("audience prompt-round fixtures expose streamlined trivia and wyr rounds", () => {
  const triviaFixture = buildQaAudienceFixture("streamlined-trivia-live", { roomCode: "DEMOAAHF" });
  const wyrFixture = buildQaAudienceFixture("streamlined-wyr-live", { roomCode: "DEMOAAHF" });

  assert.equal(triviaFixture.room.audienceShellVariant, "streamlined");
  assert.equal(triviaFixture.room.activeMode, "trivia_pop");
  assert.equal(triviaFixture.room.triviaQuestion.q, "Which anthem gets the room singing first?");
  assert.equal(Array.isArray(triviaFixture.room.triviaQuestion.options), true);

  assert.equal(wyrFixture.room.audienceShellVariant, "streamlined");
  assert.equal(wyrFixture.room.activeMode, "wyr");
  assert.equal(wyrFixture.room.wyrData.question, "Would you rather open with a power ballad or a crowd singalong?");
  assert.equal(wyrFixture.room.wyrData.optionA, "Power ballad");
  assert.equal(wyrFixture.room.wyrData.optionB, "Crowd singalong");
});

test("tv prompt-round fixtures expose trivia and would-you-rather overlays", () => {
  const triviaFixture = buildQaTvFixture("prompt-round-trivia-live", { roomCode: "DEMOAAHF", nowMs: 1763503200000 });
  const wyrFixture = buildQaTvFixture("prompt-round-wyr-live", { roomCode: "DEMOAAHF", nowMs: 1763503200000 });

  assert.equal(triviaFixture.started, true);
  assert.equal(triviaFixture.room.activeMode, "trivia_pop");
  assert.equal(triviaFixture.room.triviaQuestion.q, "Which anthem gets the room singing first?");

  assert.equal(wyrFixture.started, true);
  assert.equal(wyrFixture.room.activeMode, "wyr");
  assert.equal(wyrFixture.room.wyrData.question, "Would you rather open with a power ballad or a crowd singalong?");
  assert.equal(wyrFixture.room.wyrData.optionA, "Power ballad");
  assert.equal(wyrFixture.room.wyrData.optionB, "Crowd singalong");
});
