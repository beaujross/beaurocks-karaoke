import assert from "node:assert/strict";
import {
  getAppCheckRetryDelayMs,
  isAppCheckRequiredError,
  isAppCheckThrottledError,
  isRecoverableAppCheckError,
} from "../../src/lib/appCheckErrors.js";

const run = async () => {
  assert.equal(
    isAppCheckRequiredError({
      code: "failed-precondition",
      message: "App Check token required.",
    }),
    true
  );

  assert.equal(
    isAppCheckThrottledError({
      code: "appCheck/throttled",
      message: "App Check requests are throttled.",
    }),
    true
  );

  assert.equal(
    isRecoverableAppCheckError({
      code: "unauthenticated",
      message: "App Check token required for this call.",
    }),
    true
  );

  assert.equal(
    isRecoverableAppCheckError({
      code: "permission-denied",
      message: "Capability missing.",
    }),
    false
  );

  assert.equal(getAppCheckRetryDelayMs(0, false), 250);
  assert.equal(getAppCheckRetryDelayMs(0, true), 1500);
  assert.equal(getAppCheckRetryDelayMs(99, true), 12000);

  console.log("PASS appCheckErrors");
};

run();
