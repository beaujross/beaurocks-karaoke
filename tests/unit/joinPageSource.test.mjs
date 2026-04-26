import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const source = readFileSync("src/apps/Marketing/pages/JoinPage.jsx", "utf8");

test("join page becomes a direct room-entry surface when a room code already exists in the route", () => {
  assert.match(source, /const \[showManualEntry, setShowManualEntry\] = useState\(false\);/);
  assert.match(source, /const hasJoinCodeInRoute = !!normalizeJoinEntryCode\(id\);/);
  assert.match(source, /hasJoinCodeInRoute && !showManualEntry \?/);
  assert.match(source, /Join Room Now/);
  assert.match(source, /Use Different Room Code/);
});
