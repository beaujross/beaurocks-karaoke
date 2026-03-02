import { useEffect, useMemo, useState } from "react";

const SCRIPT_ID = "beaurocks-google-maps-script";

const ensureGoogleMapsReady = async (mapsNs = null) => {
  const maps = mapsNs || window.google?.maps;
  if (!maps) {
    throw new Error("Google Maps namespace missing.");
  }

  if (typeof maps.Map === "function") {
    return maps;
  }

  if (typeof maps.importLibrary === "function") {
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
  }

  if (typeof maps.Map !== "function") {
    throw new Error("Google Maps loaded but Map constructor unavailable.");
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
  if (window.google?.maps) {
    return ensureGoogleMapsReady(window.google.maps);
  }
  if (window.__beaurocksMapsPromise) {
    return window.__beaurocksMapsPromise;
  }

  window.__beaurocksMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => {
        ensureGoogleMapsReady(window.google?.maps)
          .then(resolve)
          .catch(reject);
      });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps.")));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.onload = () => {
      ensureGoogleMapsReady(window.google?.maps)
        .then(resolve)
        .catch(reject);
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps script."));
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
