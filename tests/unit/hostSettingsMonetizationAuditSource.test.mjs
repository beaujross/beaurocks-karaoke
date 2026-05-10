import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const hostAppSource = readFileSync("src/apps/Host/HostApp.jsx", "utf8");
const functionsSource = readFileSync("functions/index.js", "utf8");
const capabilitiesSource = readFileSync("src/billing/capabilities.js", "utf8");

test("host settings promoted saves enforce shared-template capability and write audit entries", () => {
  assert.match(capabilitiesSource, /WORKSPACE_SHARED_TEMPLATES: 'workspace\.shared_templates'/);
  assert.match(hostAppSource, /getHostSettingsTargetEntitlementState/);
  assert.match(hostAppSource, /deniedReason: 'capability_blocked'/);
  assert.match(functionsSource, /HOST_SETTINGS_SHARED_TEMPLATES_CAPABILITY = "workspace\.shared_templates"/);
  assert.match(functionsSource, /buildHostSettingsDefaultsAccessState/);
  assert.match(functionsSource, /settings_audit/);
  assert.match(functionsSource, /downgradeState: canSave \? "active" : "read_only_after_downgrade"/);
  assert.match(functionsSource, /exports\.listHostSettingsAuditEntries = onCall/);
});
