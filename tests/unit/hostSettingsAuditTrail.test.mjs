import assert from "node:assert/strict";
import { test } from "vitest";

import {
  buildHostSettingsAuditEntry,
  canViewHostSettingsAuditEntry,
} from "../../src/lib/hostSettingsAuditTrail.js";

test("hostSettingsAuditTrail builds workspace-visible entries with flattened changed keys", () => {
  assert.deepEqual(
    buildHostSettingsAuditEntry({
      target: "workspace_template",
      bundleKey: "operating_style",
      actorUid: "host_1",
      actorRole: "host",
      workspaceRole: "owner",
      roomCode: "br123",
      sourceType: "room_override",
      sourceId: "BR123",
      settings: {
        autoPlayMedia: true,
        queueSettings: {
          limitMode: "per_hour",
          limitCount: 2,
        },
      },
      nowMs: 88,
    }),
    {
      action: "bundle_saved",
      target: "workspace_template",
      bundleKey: "operating_style",
      actorUid: "host_1",
      actorRole: "host",
      workspaceRole: "owner",
      roomCode: "BR123",
      sourceType: "room_override",
      sourceId: "BR123",
      changedKeys: [
        "autoPlayMedia",
        "queueSettings.limitMode",
        "queueSettings.limitCount",
      ],
      changedKeyCount: 3,
      visibility: "workspace_visible",
      changedAtMs: 88,
    },
  );
});

test("hostSettingsAuditTrail restricts host-private entries to actor or admin", () => {
  const entry = buildHostSettingsAuditEntry({
    target: "host_default",
    actorUid: "host_1",
  });

  assert.equal(canViewHostSettingsAuditEntry({ entry, actorUid: "host_1", workspaceRole: "member" }), true);
  assert.equal(canViewHostSettingsAuditEntry({ entry, actorUid: "host_2", workspaceRole: "member" }), false);
  assert.equal(canViewHostSettingsAuditEntry({ entry, actorUid: "host_2", workspaceRole: "admin" }), true);
});
