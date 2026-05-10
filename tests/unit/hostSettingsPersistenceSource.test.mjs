import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const hostAppSource = readFileSync("src/apps/Host/HostApp.jsx", "utf8");
const firebaseSource = readFileSync("src/lib/firebase.js", "utf8");

test("host settings bundle cards expose promoted save actions backed by the callable layer", () => {
  assert.match(firebaseSource, /const manageHostSettingsDefaults = async \(payload = \{\}\) => \{/);
  assert.match(firebaseSource, /callFunction\("manageHostSettingsDefaults", payload \|\| \{\}\)/);
  assert.match(hostAppSource, /Save as my default/);
  assert.match(hostAppSource, /Save to workspace template/);
  assert.match(hostAppSource, /Use my default/);
  assert.match(hostAppSource, /Use workspace template/);
  assert.match(hostAppSource, /manageHostSettingsDefaults/);
  assert.match(hostAppSource, /buildHostSettingsPersistenceWritePlan/);
});

test("host settings promoted saves stay mode-aware instead of bypassing the parity contract", () => {
  assert.match(hostAppSource, /modeAwareHostSettingsSaveTargets/);
  assert.match(hostAppSource, /modeAllowsHostSettingsSaveTarget/);
  assert.match(hostAppSource, /is not available in this room format/);
});
