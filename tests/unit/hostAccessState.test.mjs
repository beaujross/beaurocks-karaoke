import assert from "node:assert/strict";
import {
  EMPTY_HOST_ACCESS,
  fetchHostAccessStatusWithRetry,
  isAppCheckWarmupError,
  normalizeHostAccessPayload,
} from "../../src/apps/Marketing/hooks/hostAccessState.js";

const run = async () => {
  assert.deepEqual(normalizeHostAccessPayload(), EMPTY_HOST_ACCESS);

  assert.equal(
    isAppCheckWarmupError({
      code: "failed-precondition",
      message: "App Check token required.",
    }),
    true
  );
  assert.equal(
    isAppCheckWarmupError({
      code: "permission-denied",
      message: "Capability missing.",
    }),
    false
  );

  let attempts = 0;
  const resolved = await fetchHostAccessStatusWithRetry(async () => {
    attempts += 1;
    if (attempts < 3) {
      const error = new Error("App Check token required.");
      error.code = "failed-precondition";
      throw error;
    }
    return {
      hasHostWorkspaceAccess: true,
      entitledHostAccess: true,
      hostApprovalEnabled: true,
      applicationStatus: "APPROVED",
    };
  }, { retryDelaysMs: [0, 0, 0] });

  assert.equal(attempts, 3);
  assert.deepEqual(resolved, {
    hasHostWorkspaceAccess: true,
    entitledHostAccess: true,
    hostApprovalEnabled: true,
    applicationStatus: "approved",
  });

  await assert.rejects(
    fetchHostAccessStatusWithRetry(async () => {
      const error = new Error("Permission denied.");
      error.code = "permission-denied";
      throw error;
    }, { retryDelaysMs: [0, 0, 0] }),
    /Permission denied/i
  );

  console.log("PASS hostAccessState");
};

run();
