const MAX_EVENT_NAME_LENGTH = 64;
const MAX_TELEMETRY_QUEUE = 180;
const TELEMETRY_BATCH_SIZE = 20;
const TELEMETRY_FLUSH_MS = 3200;

const sanitizeEventName = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, MAX_EVENT_NAME_LENGTH);

const sanitizeEventParams = (params = {}) => {
  if (!params || typeof params !== "object") return {};
  const out = {};
  Object.entries(params).forEach(([key, rawValue]) => {
    const safeKey = String(key || "").trim().replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
    if (!safeKey) return;
    if (rawValue === undefined) return;
    if (rawValue === null) {
      out[safeKey] = null;
      return;
    }
    if (typeof rawValue === "string") {
      out[safeKey] = rawValue.slice(0, 260);
      return;
    }
    if (typeof rawValue === "number" || typeof rawValue === "boolean") {
      out[safeKey] = rawValue;
      return;
    }
    out[safeKey] = String(rawValue).slice(0, 260);
  });
  return out;
};

const sanitizeRouteToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

let lazyFirebaseTrackPromise = null;
let lazyMarketingTelemetryPromise = null;
let telemetryFlushTimer = null;
let telemetryInFlight = false;

const MARKETING_SESSION_KEY = "__beaurocks_marketing_session_id";
const MARKETING_TELEMETRY_KEY = "__beaurocks_marketing_telemetry_queue";

const getFirebaseTrackEvent = () => {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!lazyFirebaseTrackPromise) {
    lazyFirebaseTrackPromise = import("../../../lib/firebase")
      .then((mod) => (typeof mod?.trackEvent === "function" ? mod.trackEvent : null))
      .catch(() => null);
  }
  return lazyFirebaseTrackPromise;
};

const getMarketingTelemetryWriter = () => {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!lazyMarketingTelemetryPromise) {
    lazyMarketingTelemetryPromise = import("../../../lib/firebase")
      .then((mod) => (typeof mod?.recordMarketingTelemetry === "function" ? mod.recordMarketingTelemetry : null))
      .catch(() => null);
  }
  return lazyMarketingTelemetryPromise;
};

const getMarketingSessionId = () => {
  if (typeof window === "undefined") return "";
  try {
    const existing = sanitizeRouteToken(window.localStorage.getItem(MARKETING_SESSION_KEY) || "");
    if (existing) return existing;
    const next = sanitizeRouteToken(`mk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
    if (next) {
      window.localStorage.setItem(MARKETING_SESSION_KEY, next);
      return next;
    }
  } catch {
    // Ignore storage failures.
  }
  return "";
};

const inferRoutePage = (params = {}) => {
  const direct = sanitizeRouteToken(params.route || params.page || "");
  if (direct) return direct;
  if (typeof window === "undefined") return "unknown";
  const path = String(window.location?.pathname || "").trim().toLowerCase();
  const parts = path.split("/").filter(Boolean);
  return sanitizeRouteToken(parts[parts.length - 1] || "discover") || "discover";
};

const readTelemetryQueue = () => {
  if (typeof window === "undefined") return [];
  return Array.isArray(window[MARKETING_TELEMETRY_KEY]) ? window[MARKETING_TELEMETRY_KEY] : [];
};

const writeTelemetryQueue = (nextQueue = []) => {
  if (typeof window === "undefined") return;
  window[MARKETING_TELEMETRY_KEY] = Array.isArray(nextQueue) ? nextQueue : [];
};

const flushTelemetryQueue = async () => {
  if (telemetryInFlight) return;
  const queue = readTelemetryQueue();
  if (!queue.length) return;
  telemetryInFlight = true;
  telemetryFlushTimer = null;
  const batch = queue.slice(0, TELEMETRY_BATCH_SIZE);
  writeTelemetryQueue(queue.slice(TELEMETRY_BATCH_SIZE));
  try {
    const writer = await getMarketingTelemetryWriter();
    if (!writer) return;
    await writer({
      events: batch,
      sessionId: getMarketingSessionId(),
      routePage: inferRoutePage({}),
    });
  } catch {
    // Ignore telemetry failures to keep UX unaffected.
  } finally {
    telemetryInFlight = false;
    const remaining = readTelemetryQueue();
    if (remaining.length) {
      telemetryFlushTimer = setTimeout(() => {
        flushTelemetryQueue();
      }, 700);
    }
  }
};

const scheduleTelemetryFlush = () => {
  const queue = readTelemetryQueue();
  if (queue.length >= TELEMETRY_BATCH_SIZE) {
    flushTelemetryQueue();
    return;
  }
  if (telemetryFlushTimer) return;
  telemetryFlushTimer = setTimeout(() => {
    flushTelemetryQueue();
  }, TELEMETRY_FLUSH_MS);
};

const enqueueMarketingTelemetry = (payload = {}) => {
  if (typeof window === "undefined") return;
  const queue = readTelemetryQueue();
  queue.push(payload);
  if (queue.length > MAX_TELEMETRY_QUEUE) {
    queue.splice(0, queue.length - MAX_TELEMETRY_QUEUE);
  }
  writeTelemetryQueue(queue);
  scheduleTelemetryFlush();
};

const enqueueMarketingEvent = (payload = {}) => {
  if (typeof window === "undefined") return;
  const key = "__beaurocks_marketing_events";
  const queue = Array.isArray(window[key]) ? window[key] : [];
  queue.push(payload);
  if (queue.length > 150) queue.shift();
  window[key] = queue;
};

export const trackEvent = (name, params = {}) => {
  const eventName = sanitizeEventName(name);
  if (!eventName) return;
  const eventParams = sanitizeEventParams(params);
  const payload = {
    name: eventName,
    params: eventParams,
    atMs: Date.now(),
  };

  enqueueMarketingEvent(payload);
  enqueueMarketingTelemetry({
    name: eventName,
    params: eventParams,
    atMs: payload.atMs,
    routePage: inferRoutePage(eventParams),
    sessionId: getMarketingSessionId(),
  });

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("beaurocks:marketing:event", { detail: payload }));
    } catch {
      // Ignore event dispatch failures in restricted contexts.
    }
  }

  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    try {
      window.gtag("event", eventName, eventParams);
      return;
    } catch {
      // Fall through to Firebase analytics fallback.
    }
  }

  getFirebaseTrackEvent().then((track) => {
    if (!track) return;
    try {
      track(eventName, eventParams);
    } catch {
      // Ignore analytics failures.
    }
  });
};

export const trackGoldenPathEntry = ({ pathId = "", workstream = "", source = "golden_rail" } = {}) => {
  trackEvent("mk_golden_path_entry", {
    pathId: sanitizeRouteToken(pathId),
    workstream: sanitizeRouteToken(workstream),
    source: sanitizeRouteToken(source),
    step: "entry",
  });
};

export const trackGoldenPathMilestone = ({ pathId = "", workstream = "", source = "app_flow" } = {}) => {
  trackEvent("mk_golden_path_milestone", {
    pathId: sanitizeRouteToken(pathId),
    workstream: sanitizeRouteToken(workstream),
    source: sanitizeRouteToken(source),
    step: "milestone",
  });
};
