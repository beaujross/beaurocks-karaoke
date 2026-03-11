import assert from "node:assert/strict";
import {
  normalizeAppCheckProviderMode,
  parseOptionalBoolToken,
  resolveAppCheckProviderMode,
  resolveRuntimeAppCheckDebugToken,
  shouldEnableRuntimeAppCheckDebug,
} from "../../src/lib/appCheckConfig.js";

const run = async () => {
  assert.equal(parseOptionalBoolToken("true"), true);
  assert.equal(parseOptionalBoolToken("0"), false);
  assert.equal(parseOptionalBoolToken(""), null);

  assert.equal(normalizeAppCheckProviderMode("enterprise"), "enterprise");
  assert.equal(normalizeAppCheckProviderMode("recaptcha_v3"), "v3");
  assert.equal(normalizeAppCheckProviderMode("unknown"), "v3");
  assert.equal(normalizeAppCheckProviderMode("unknown", "enterprise"), "enterprise");

  assert.equal(
    resolveAppCheckProviderMode({ runtimeProvider: "", envProvider: "v3" }),
    "v3"
  );
  assert.equal(
    resolveAppCheckProviderMode({ runtimeProvider: "", envProvider: "" }),
    "v3"
  );
  assert.equal(
    resolveAppCheckProviderMode({ runtimeProvider: "enterprise", envProvider: "v3" }),
    "enterprise"
  );

  assert.equal(
    shouldEnableRuntimeAppCheckDebug({
      host: "localhost",
      envEnabled: "",
      runtimeEnabled: false,
      storedEnabled: "",
    }),
    true
  );
  assert.equal(
    shouldEnableRuntimeAppCheckDebug({
      host: "beaurocks.app",
      envEnabled: "",
      runtimeEnabled: true,
      storedEnabled: "",
    }),
    true
  );
  assert.equal(
    shouldEnableRuntimeAppCheckDebug({
      host: "beaurocks.app",
      envEnabled: "",
      runtimeEnabled: false,
      storedEnabled: "",
    }),
    false
  );

  assert.equal(
    resolveRuntimeAppCheckDebugToken({
      runtimeDebugToken: "runtime-token",
      storedDebugToken: "stored-token",
    }),
    "runtime-token"
  );
  assert.equal(
    resolveRuntimeAppCheckDebugToken({
      runtimeDebugToken: "",
      storedDebugToken: "stored-token",
    }),
    "stored-token"
  );

  console.log("PASS appCheckConfig");
};

run();
