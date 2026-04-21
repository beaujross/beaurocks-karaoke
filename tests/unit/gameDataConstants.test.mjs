import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

import { TRIVIA_BANK } from "../../src/lib/gameDataConstants.js";

test("trivia bank has enough reusable questions for full-screen breaks", () => {
  assert.equal(TRIVIA_BANK.length >= 12, true);
  assert.equal(TRIVIA_BANK.every((entry) => entry.q && entry.correct && entry.w1 && entry.w2 && entry.w3), true);
});

test("game data constants stay free of mojibake characters", () => {
  const source = readFileSync("src/lib/gameDataConstants.js", "utf8");
  assert.doesNotMatch(source, /[^\x00-\x7F]/);
  assert.doesNotMatch(source, /Beyonc(?:\u00c3|\u00e9)/);
});
