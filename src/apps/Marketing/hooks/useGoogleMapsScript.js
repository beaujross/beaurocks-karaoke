import { useEffect, useMemo, useState } from "react";

const SCRIPT_ID = "beaurocks-google-maps-script";

const loadGoogleMapsScript = (apiKey = "") => {
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key missing."));
  }
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window unavailable."));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (window.__beaurocksMapsPromise) {
    return window.__beaurocksMapsPromise;
  }

  window.__beaurocksMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.google?.maps) resolve(window.google.maps);
      });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps.")));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }
      reject(new Error("Google Maps loaded but maps namespace missing."));
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
