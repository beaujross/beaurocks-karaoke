import { useEffect, useMemo, useState } from "react";

const SCRIPT_ID = "beaurocks-google-maps-script";
const PRECONNECT_ID = "beaurocks-google-maps-preconnect";
const CALLBACK_NAME = "__beaurocksMapsInit";
const CONSTRUCTOR_WAIT_TIMEOUT_MS = 4000;
const CONSTRUCTOR_WAIT_STEP_MS = 60;

const warmGoogleMapsConnections = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(PRECONNECT_ID)) return;

  const holder = document.createElement("meta");
  holder.id = PRECONNECT_ID;
  holder.setAttribute("data-owner", "beaurocks");
  document.head.appendChild(holder);

  [
    { rel: "preconnect", href: "https://maps.googleapis.com" },
    { rel: "preconnect", href: "https://maps.gstatic.com", crossOrigin: "anonymous" },
    { rel: "dns-prefetch", href: "https://maps.googleapis.com" },
    { rel: "dns-prefetch", href: "https://maps.gstatic.com" },
  ].forEach((entry) => {
    const link = document.createElement("link");
    link.rel = entry.rel;
    link.href = entry.href;
    if (entry.crossOrigin) {
      link.crossOrigin = entry.crossOrigin;
    }
    document.head.appendChild(link);
  });
};

const sleep = (ms = 0) => new Promise((resolve) => {
  window.setTimeout(resolve, Math.max(0, Number(ms) || 0));
});

const waitForMapConstructor = async (maps, timeoutMs = CONSTRUCTOR_WAIT_TIMEOUT_MS) => {
  const timeout = Math.max(250, Number(timeoutMs) || CONSTRUCTOR_WAIT_TIMEOUT_MS);
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeout) {
    if (typeof maps?.Map === "function") return true;
    await sleep(CONSTRUCTOR_WAIT_STEP_MS);
  }
  return typeof maps?.Map === "function";
};

const ensureGoogleMapsReady = async (mapsNs = null) => {
  const maps = mapsNs || window.google?.maps;
  if (!maps) {
    throw new Error("Google Maps namespace missing.");
  }

  if (typeof maps.Map === "function") {
    return maps;
  }

  let importLibraryError = null;
  if (typeof maps.importLibrary === "function") {
    try {
      const mapsLibrary = await maps.importLibrary("maps");
      if (typeof maps.Map !== "function" && typeof mapsLibrary?.Map === "function") {
        maps.Map = mapsLibrary.Map;
      }
      if (typeof maps.InfoWindow !== "function" && typeof mapsLibrary?.InfoWindow === "function") {
        maps.InfoWindow = mapsLibrary.InfoWindow;
      }
      if (typeof maps.LatLngBounds !== "function" && typeof mapsLibrary?.LatLngBounds === "function") {
        maps.LatLngBounds = mapsLibrary.LatLngBounds;
      }
      if (!maps.SymbolPath && mapsLibrary?.SymbolPath) {
        maps.SymbolPath = mapsLibrary.SymbolPath;
      }
    } catch (error) {
      importLibraryError = error;
    }
    try {
      const markerLibrary = await maps.importLibrary("marker");
      if (markerLibrary && typeof markerLibrary === "object") {
        maps.marker = {
          ...(maps.marker || {}),
          ...markerLibrary,
        };
      }
    } catch {
      // Keep the map usable even if the marker library fails; callers can fall back.
    }
  }

  if (typeof maps.Map !== "function" && await waitForMapConstructor(maps)) {
    return maps;
  }

  if (typeof maps.Map !== "function") {
    const suffix = importLibraryError
      ? ` (${String(importLibraryError?.message || importLibraryError)})`
      : "";
    throw new Error(`Google Maps loaded but Map constructor unavailable${suffix}.`);
  }
  return maps;
};

const loadGoogleMapsScript = (apiKey = "") => {
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key missing."));
  }
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window unavailable."));
  }
  warmGoogleMapsConnections();
  if (window.google?.maps) {
    return ensureGoogleMapsReady(window.google.maps);
  }
  if (window.__beaurocksMapsPromise) {
    return window.__beaurocksMapsPromise;
  }

  window.__beaurocksMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        ensureGoogleMapsReady(window.google?.maps)
          .then(resolve)
          .catch(reject);
        return;
      }
      existing.addEventListener("load", () => {
        ensureGoogleMapsReady(window.google?.maps)
          .then(resolve)
          .catch(reject);
      }, { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    let settled = false;
    const settleResolve = (mapsNs) => {
      if (settled) return;
      settled = true;
      resolve(mapsNs);
    };
    const settleReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const callback = () => {
      script.dataset.loaded = "true";
      ensureGoogleMapsReady(window.google?.maps)
        .then(settleResolve)
        .catch(settleReject);
    };
    window[CALLBACK_NAME] = callback;

    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=marker&callback=${encodeURIComponent(CALLBACK_NAME)}`;
    script.onload = () => {
      script.dataset.loaded = "true";
      ensureGoogleMapsReady(window.google?.maps)
        .then(settleResolve)
        .catch(settleReject);
    };
    script.onerror = () => settleReject(new Error("Failed to load Google Maps script."));
    document.head.appendChild(script);
  });

  return window.__beaurocksMapsPromise;
};

export const useGoogleMapsScript = ({ enabled = false, apiKey = "" } = {}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!enabled) return () => {
      cancelled = true;
    };

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled) return;
        setLoaded(true);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoaded(false);
        setError(String(err?.message || "Google Maps failed to load."));
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, apiKey]);

  return useMemo(
    () => ({
      loaded: enabled ? loaded : false,
      error: enabled ? error : "",
    }),
    [enabled, loaded, error]
  );
};
