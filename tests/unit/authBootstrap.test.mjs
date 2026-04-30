import assert from "node:assert/strict";
import { test } from "vitest";
import { shouldBootstrapAnonymousAuth } from "../../src/lib/authBootstrap.js";

test("authBootstrap.test", () => {
  assert.equal(
    shouldBootstrapAnonymousAuth({ customToken: "custom-token", currentUser: null }),
    false
  );

  assert.equal(
    shouldBootstrapAnonymousAuth({ customToken: "", currentUser: { uid: "user_123", isAnonymous: false } }),
    false
  );

  assert.equal(
    shouldBootstrapAnonymousAuth({ customToken: "", currentUser: { uid: "anon_123", isAnonymous: true } }),
    false
  );

  assert.equal(
    shouldBootstrapAnonymousAuth({ customToken: "", currentUser: null }),
    true
  );

  assert.equal(
    shouldBootstrapAnonymousAuth({ customToken: "", currentUser: null, viewHint: "marketing" }),
    false
  );

  assert.equal(
    shouldBootstrapAnonymousAuth({ customToken: "", currentUser: null, viewHint: "host" }),
    false
  );

  assert.equal(
    shouldBootstrapAnonymousAuth({
      customToken: "",
      currentUser: null,
      locationLike: {
        hostname: "beaurocks.app",
        pathname: "/discover",
        search: "",
      },
    }),
    false
  );

  assert.equal(
    shouldBootstrapAnonymousAuth({
      customToken: "",
      currentUser: null,
      locationLike: {
        hostname: "beaurocks.app",
        pathname: "/",
        search: "?room=AAHF",
      },
    }),
    true
  );

  assert.equal(
    shouldBootstrapAnonymousAuth({
      customToken: "",
      currentUser: null,
      locationLike: {
        hostname: "host.beaurocks.app",
        pathname: "/",
        search: "",
      },
    }),
    false
  );
});
