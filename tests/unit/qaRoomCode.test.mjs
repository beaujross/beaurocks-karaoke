import assert from "node:assert/strict";
import { test } from "vitest";
import {
  extractRoomCodeFromBodyText,
  extractRoomCodeFromUrl,
  isLikelyRoomCode,
  sanitizeRoomCode,
} from "../../scripts/qa/lib/roomCode.js";

test("qaRoomCode.test", () => {
  assert.equal(sanitizeRoomCode(" xjf2 "), "XJF2");
  assert.equal(isLikelyRoomCode("XJF2"), true);
  assert.equal(isLikelyRoomCode("SETUP"), false);
  assert.equal(isLikelyRoomCode("BROWSER"), false);
  assert.equal(isLikelyRoomCode("DASHBOARD"), false);

  assert.equal(
    extractRoomCodeFromUrl("https://app.beaurocks.app/?room=XJF2"),
    "XJF2"
  );
  assert.equal(
    extractRoomCodeFromUrl("https://host.beaurocks.app/?room=BROWSER&mode=host"),
    ""
  );
  assert.equal(
    extractRoomCodeFromBodyText("Room XJF2 ready. Send the audience link."),
    "XJF2"
  );
  assert.equal(
    extractRoomCodeFromBodyText("BEAUROCKS HOST ROOMS Browse rooms like a workspace"),
    ""
  );
  assert.equal(
    extractRoomCodeFromBodyText("FIRST ROOM SETUP"),
    ""
  );
});
