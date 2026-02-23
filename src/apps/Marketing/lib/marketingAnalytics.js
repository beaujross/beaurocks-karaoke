const MAX_EVENT_NAME_LENGTH = 64;

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

let lazyFirebaseTrackPromise = null;

const getFirebaseTrackEvent = () => {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!lazyFirebaseTrackPromise) {
    lazyFirebaseTrackPromise = import("../../../lib/firebase")
      .then((mod) => (typeof mod?.trackEvent === "function" ? mod.trackEvent : null))
      .catch(() => null);
  }
  return lazyFirebaseTrackPromise;
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

