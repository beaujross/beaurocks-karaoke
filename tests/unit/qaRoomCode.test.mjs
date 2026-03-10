import assert from "node:assert/strict";
import {
  extractRoomCodeFromBodyText,
  extractRoomCodeFromUrl,
  isLikelyRoomCode,
  sanitizeRoomCode,
} from "../../scripts/qa/lib/roomCode.js";

const run = () => {
  assert.equal(sanitizeRoomCode(" xjf2 "), "XJF2");
  assert.equal(isLikelyRoomCode("XJF2"), true);
  assert.equal(isLikelyRoomCode("SETUP"), false);

  assert.equal(
    extractRoomCodeFromUrl("https://app.beaurocks.app/?room=XJF2"),
    "XJF2"
  );
  assert.equal(
    extractRoomCodeFromBodyText("Room XJF2 ready. Send the audience link."),
    "XJF2"
  );
  assert.equal(
    extractRoomCodeFromBodyText("FIRST ROOM SETUP"),
    ""
  );

  console.log("PASS qaRoomCode");
};

run();
