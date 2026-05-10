import assert from "node:assert/strict";
import { test } from "vitest";

import {
  HOST_SETTINGS_HISTORY_ACTIONS,
  appendHostSettingsHistoryEntry,
  buildHostSettingsHistoryEntry,
  buildHostSettingsHistoryId,
  buildHostSettingsRestoreOperation,
  buildHostSettingsUndoOperation,
  hasMeaningfulHostSettingsDelta,
} from "../../src/lib/hostSettingsChangeHistory.js";

test("hostSettingsChangeHistory builds deterministic entry ids", () => {
  assert.equal(
    buildHostSettingsHistoryId({
      action: HOST_SETTINGS_HISTORY_ACTIONS.bundleApplied,
      bundleId: "crowd_mode",
      nowMs: 42,
    }),
    "bundle_applied_crowd_mode_42",
  );
});

test("hostSettingsChangeHistory records normalized before and after payloads", () => {
  const entry = buildHostSettingsHistoryEntry({
    action: HOST_SETTINGS_HISTORY_ACTIONS.bundleApplied,
    bundleId: "operating_style",
    label: "Balanced Host Assist",
    before: { autoPlayMedia: false },
    after: { autoPlayMedia: true },
    provenance: { sourceType: "preset", sourceId: "balanced" },
    actorUid: " host_1 ",
    actorRole: " HOST ",
    nowMs: 99,
  });

  assert.deepEqual(entry, {
    id: "bundle_applied_operating_style_99",
    action: "bundle_applied",
    bundleId: "operating_style",
    label: "Balanced Host Assist",
    before: { autoPlayMedia: false },
    after: { autoPlayMedia: true },
    provenance: { sourceType: "preset", sourceId: "balanced" },
    actorUid: "host_1",
    actorRole: "host",
    changedAtMs: 99,
  });
});

test("hostSettingsChangeHistory detects meaningful deltas", () => {
  assert.equal(
    hasMeaningfulHostSettingsDelta(buildHostSettingsHistoryEntry({
      before: { chatShowOnTv: false },
      after: { chatShowOnTv: true },
      nowMs: 1,
    })),
    true,
  );

  assert.equal(
    hasMeaningfulHostSettingsDelta(buildHostSettingsHistoryEntry({
      before: { chatShowOnTv: false },
      after: { chatShowOnTv: false },
      nowMs: 1,
    })),
    false,
  );
});

test("hostSettingsChangeHistory appends entries and respects history limits", () => {
  const history = appendHostSettingsHistoryEntry(
    [
      buildHostSettingsHistoryEntry({ bundleId: "a", nowMs: 1 }),
      buildHostSettingsHistoryEntry({ bundleId: "b", nowMs: 2 }),
    ],
    buildHostSettingsHistoryEntry({ bundleId: "c", nowMs: 3 }),
    2,
  );

  assert.deepEqual(
    history.map((entry) => entry.bundleId),
    ["b", "c"],
  );
});

test("hostSettingsChangeHistory builds undo and restore operations", () => {
  const entry = buildHostSettingsHistoryEntry({
    bundleId: "crowd_mode",
    label: "High Energy Crowd",
    before: { chatShowOnTv: false, popTriviaEnabled: false },
    after: { chatShowOnTv: true, popTriviaEnabled: true },
    nowMs: 5,
  });

  assert.deepEqual(
    buildHostSettingsUndoOperation(entry),
    {
      action: "undo_applied",
      bundleId: "crowd_mode",
      undoPatch: { chatShowOnTv: false, popTriviaEnabled: false },
      summary: "Undo High Energy Crowd",
    },
  );

  assert.deepEqual(
    buildHostSettingsRestoreOperation({
      sourceLabel: "workspace template",
      restorePatch: { chatShowOnTv: false, showScoring: true },
    }),
    {
      action: "restore_applied",
      bundleId: "",
      undoPatch: { chatShowOnTv: false, showScoring: true },
      summary: "Restore from workspace template",
    },
  );
});
