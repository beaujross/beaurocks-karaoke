import assert from "node:assert/strict";
import { test } from "vitest";

import { CAPABILITY_KEYS } from "../../src/billing/capabilities.js";
import { getHostSettingsTargetEntitlementState } from "../../src/lib/hostSettingsEntitlementPolicy.js";

test("hostSettingsEntitlementPolicy makes workspace templates read-only without capability", () => {
  assert.deepEqual(
    getHostSettingsTargetEntitlementState({
      target: "workspace_template",
      capabilities: {},
    }),
    {
      target: "workspace_template",
      requiredCapability: CAPABILITY_KEYS.WORKSPACE_SHARED_TEMPLATES,
      requiredCapabilityLabel: "Shared Workspace Templates",
      canRead: true,
      canSave: false,
      downgradeState: "read_only_after_downgrade",
      message: "Workspace template is read-only on this plan. Shared Workspace Templates is required to save changes.",
    },
  );
});

test("hostSettingsEntitlementPolicy allows workspace template saves when capability is enabled", () => {
  const result = getHostSettingsTargetEntitlementState({
    target: "workspace_template",
    capabilities: {
      [CAPABILITY_KEYS.WORKSPACE_SHARED_TEMPLATES]: true,
    },
  });
  assert.equal(result.canRead, true);
  assert.equal(result.canSave, true);
  assert.equal(result.downgradeState, "active");
  assert.equal(result.requiredCapability, CAPABILITY_KEYS.WORKSPACE_SHARED_TEMPLATES);
});
