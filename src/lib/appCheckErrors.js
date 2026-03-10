const normalizeErrorCode = (error = {}) => String(error?.code || "").trim().toLowerCase();

const normalizeErrorMessage = (error = {}) => String(error?.message || "").trim().toLowerCase();

const isAppCheckRequiredError = (error = {}) => {
  const code = normalizeErrorCode(error);
  const message = normalizeErrorMessage(error);
  return (
    code.includes("failed-precondition")
    && (
      message.includes("app check token required")
      || message.includes("appcheck")
    )
  );
};

const isAppCheckThrottledError = (error = {}) => {
  const code = normalizeErrorCode(error);
  const message = normalizeErrorMessage(error);
  return (
    code.includes("appcheck/throttled")
    || (
      code.includes("appcheck")
      && message.includes("throttled")
    )
    || (
      message.includes("app check")
      && message.includes("throttled")
    )
  );
};

const isRecoverableAppCheckError = (error = {}) => {
  if (isAppCheckRequiredError(error) || isAppCheckThrottledError(error)) {
    return true;
  }
  const code = normalizeErrorCode(error);
  const message = normalizeErrorMessage(error);
  const mentionsAppCheck = (
    message.includes("app check")
    || message.includes("appcheck")
    || message.includes("app check token")
    || message.includes("token required")
  );
  const recoverableCode = (
    code.includes("failed-precondition")
    || code.includes("invalid-argument")
    || code.includes("unauthenticated")
    || code.includes("appcheck")
  );
  return recoverableCode && mentionsAppCheck;
};

const getAppCheckRetryDelayMs = (attempt = 0, throttled = false) => {
  const index = Math.max(0, Math.min(4, Math.trunc(Number(attempt) || 0)));
  const defaultPlan = [250, 600, 1200, 2000, 3000];
  const throttledPlan = [1500, 3000, 5000, 8000, 12000];
  return (throttled ? throttledPlan : defaultPlan)[index];
};

export {
  getAppCheckRetryDelayMs,
  isAppCheckRequiredError,
  isAppCheckThrottledError,
  isRecoverableAppCheckError,
};
