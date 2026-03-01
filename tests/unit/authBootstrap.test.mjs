import assert from "node:assert/strict";
import { shouldBootstrapAnonymousAuth } from "../../src/lib/authBootstrap.js";

const run = () => {
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

  console.log("PASS authBootstrap");
};

run();

