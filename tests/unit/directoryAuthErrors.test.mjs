import assert from "node:assert/strict";
import { test } from "vitest";
import { getDirectoryAuthErrorMessage } from "../../src/apps/Marketing/hooks/directoryAuthErrors.js";

test("directory auth errors use plain, actionable language", () => {
  assert.equal(
    getDirectoryAuthErrorMessage({ code: "auth/email-already-in-use" }),
    "An account already exists for this email. Sign in instead, or reset your password."
  );
  assert.equal(
    getDirectoryAuthErrorMessage({ code: "auth/invalid-credential" }),
    "That email and password did not match. Try again, or reset your password."
  );
  assert.equal(
    getDirectoryAuthErrorMessage({ code: "auth/invalid-email" }),
    "Enter a valid email address."
  );
  assert.equal(
    getDirectoryAuthErrorMessage({ code: "auth/too-many-requests" }),
    "Too many sign-in attempts were made. Wait a few minutes, then try again."
  );
  assert.equal(
    getDirectoryAuthErrorMessage({
      code: "auth/internal-error",
      message: "Firebase: Error (auth/internal-error).",
    }),
    "We could not complete that sign-in request. Please try again."
  );
});
