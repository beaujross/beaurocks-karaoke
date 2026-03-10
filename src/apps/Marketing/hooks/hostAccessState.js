export const EMPTY_HOST_ACCESS = Object.freeze({
  hasHostWorkspaceAccess: false,
  entitledHostAccess: false,
  hostApprovalEnabled: false,
  applicationStatus: "",
});

export const HOST_ACCESS_RETRY_DELAYS_MS = Object.freeze([0, 400, 1200, 2400]);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const buildHostAccessState = (overrides = {}) => ({
  ...EMPTY_HOST_ACCESS,
  loading: false,
  needsRetry: false,
  resolvedUid: "",
  ...(overrides || {}),
});

export const normalizeHostAccessPayload = (payload = {}) => ({
  hasHostWorkspaceAccess: !!payload?.hasHostWorkspaceAccess,
  entitledHostAccess: !!payload?.entitledHostAccess,
  hostApprovalEnabled: !!payload?.hostApprovalEnabled || !!payload?.privateHostAccessEnabled,
  applicationStatus: String(payload?.applicationStatus || "").trim().toLowerCase(),
});

export const isAppCheckWarmupError = (error) => {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code.includes("failed-precondition")
    && (
      message.includes("app check token required")
      || message.includes("appcheck")
      || message.includes("app check")
    )
  );
};

export const fetchHostAccessStatusWithRetry = async (
  fetcher,
  { retryDelaysMs = HOST_ACCESS_RETRY_DELAYS_MS } = {}
) => {
  const safeDelays = Array.isArray(retryDelaysMs) && retryDelaysMs.length
    ? retryDelaysMs
    : HOST_ACCESS_RETRY_DELAYS_MS;

  let lastError = null;
  for (const waitMs of safeDelays) {
    if (waitMs > 0) {
      await delay(waitMs);
    }
    try {
      const payload = await fetcher();
      return normalizeHostAccessPayload(payload);
    } catch (error) {
      lastError = error;
      if (!isAppCheckWarmupError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Host access lookup failed.");
};
