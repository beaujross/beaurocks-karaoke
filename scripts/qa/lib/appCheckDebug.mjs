const resolveQaAppCheckDebugToken = () => String(process.env.QA_APP_CHECK_DEBUG_TOKEN || "").trim();

const isLocalQaUrl = (value = "") => {
  try {
    const parsed = new URL(String(value || "").trim());
    const host = String(parsed.hostname || "").trim().toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
};

const requireQaAppCheckDebugTokenForRemoteUrl = (rootUrl = "") => {
  const debugToken = resolveQaAppCheckDebugToken();
  if (debugToken || isLocalQaUrl(rootUrl)) {
    return debugToken;
  }
  throw new Error(
    "QA_APP_CHECK_DEBUG_TOKEN is required for remote App Check-protected QA runs. Set a registered App Check debug token before running production smoke."
  );
};

const applyQaAppCheckDebugInitScript = async (context) => {
  const debugToken = resolveQaAppCheckDebugToken();
  if (!debugToken || !context?.addInitScript) {
    return false;
  }

  await context.addInitScript((token) => {
    try {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
      window.__app_check_debug_enabled = true;
      window.__app_check_debug_token = token;
      window.localStorage?.setItem("bross_app_check_debug_enabled", "true");
      window.localStorage?.setItem("bross_app_check_debug_token", token);
    } catch {
      // Ignore pre-init storage failures during automation bootstrap.
    }
  }, debugToken);
  return true;
};

export {
  applyQaAppCheckDebugInitScript,
  requireQaAppCheckDebugTokenForRemoteUrl,
  resolveQaAppCheckDebugToken,
};
