import assert from "node:assert/strict";
import {
  normalizeHostPermissionLevel,
  canQuickStartForRole,
} from "../../src/apps/Host/launchAccess.js";

const run = () => {
  assert.equal(normalizeHostPermissionLevel("owner"), "owner");
  assert.equal(normalizeHostPermissionLevel(" ADMIN "), "admin");
  assert.equal(normalizeHostPermissionLevel("member"), "member");
  assert.equal(normalizeHostPermissionLevel("captain"), "unknown");
  assert.equal(normalizeHostPermissionLevel(""), "unknown");

  assert.equal(canQuickStartForRole("owner"), true);
  assert.equal(canQuickStartForRole("admin"), true);
  assert.equal(canQuickStartForRole("member"), false);
  assert.equal(canQuickStartForRole("moderator"), false);

  console.log("PASS hostLaunchAccess");
};

run();
