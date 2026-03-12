import assert from "node:assert/strict";
import { test } from "vitest";
import { getJoinPreviewFallback } from "../../src/apps/Marketing/pages/joinFallback.js";

test("joinFallback.test", () => {
  const notFound = getJoinPreviewFallback({
    error: { code: "not-found", message: "Room code not found." },
    roomCode: "vip123",
  });
  assert.equal(notFound.tone, "warning");
  assert.equal(notFound.message.includes("VIP123"), true);
  assert.equal(notFound.message.toLowerCase().includes("join on mobile"), true);

  const network = getJoinPreviewFallback({
    error: { code: "unavailable", message: "Network issue" },
    roomCode: "abc1",
  });
  assert.equal(network.tone, "warning");

  const denied = getJoinPreviewFallback({
    error: { code: "permission-denied", message: "denied" },
    roomCode: "abc1",
  });
  assert.equal(denied.tone, "error");

  const unknown = getJoinPreviewFallback({
    error: { code: "internal", message: "Something went wrong." },
    roomCode: "abc1",
  });
  assert.equal(unknown.tone, "error");
  assert.equal(unknown.message, "Something went wrong.");
});
