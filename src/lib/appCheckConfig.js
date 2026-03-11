const parseOptionalBoolToken = (raw = "") => {
  const token = String(raw || "").trim().toLowerCase();
  if (!token) return null;
  if (["1", "true", "yes", "on"].includes(token)) return true;
  if (["0", "false", "no", "off"].includes(token)) return false;
  return null;
};

const normalizeAppCheckProviderMode = (value = "", fallback = "v3") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "enterprise" || normalized === "recaptcha_enterprise") {
    return "enterprise";
  }
  if (normalized === "v3" || normalized === "recaptcha_v3" || normalized === "recaptcha") {
    return "v3";
  }
  return fallback;
};

const resolveAppCheckProviderMode = ({
  runtimeProvider = "",
  envProvider = "",
  fallback = "v3",
} = {}) => (
  normalizeAppCheckProviderMode(runtimeProvider, normalizeAppCheckProviderMode(envProvider, fallback))
);

const shouldEnableRuntimeAppCheckDebug = ({
  host = "",
  envEnabled = "",
  runtimeEnabled = null,
  storedEnabled = "",
} = {}) => {
  const normalizedHost = String(host || "").trim().toLowerCase();
  if (normalizedHost === "localhost" || normalizedHost === "127.0.0.1") {
    return true;
  }
  if (runtimeEnabled === true) return true;
  const envDecision = parseOptionalBoolToken(envEnabled);
  if (envDecision === true) return true;
  return parseOptionalBoolToken(storedEnabled) === true;
};

const resolveRuntimeAppCheckDebugToken = ({
  runtimeDebugToken = "",
  storedDebugToken = "",
} = {}) => (
  String(runtimeDebugToken || "").trim()
  || String(storedDebugToken || "").trim()
  || ""
);

export {
  normalizeAppCheckProviderMode,
  parseOptionalBoolToken,
  resolveAppCheckProviderMode,
  resolveRuntimeAppCheckDebugToken,
  shouldEnableRuntimeAppCheckDebug,
};
