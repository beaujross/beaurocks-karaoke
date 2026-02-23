import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDirectoryDiscover } from "../hooks/useDirectoryDiscover";
import { useGoogleMapsScript } from "../hooks/useGoogleMapsScript";
import { MARKETING_REGION_PRESETS } from "../geoPresets";
import { EMPTY_STATE_CONTEXT, getEmptyStateConfig } from "../emptyStateOrchestrator";
import { trackEvent } from "../lib/marketingAnalytics";
import EmptyStatePanel from "./EmptyStatePanel";
import InlineConversionActions from "./InlineConversionActions";
import {
  formatDateTime,
  getInitials,
  resolveListingImageCandidates,
  resolveProfileAvatarUrl,
} from "./shared";

const FINDER_BRAND = "Setlist";
const MAP_DEFAULT_CENTER = { lat: 39.5, lng: -98.35 };
const MAP_BRAND_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#1d062b" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#f9d58a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#2a0a3a" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#6c2f84" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#ffd98c" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#2d0d3f" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#3a114f" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#3b1a58" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#4d1a61" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#7b2f8f" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#643179" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#8340a0" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#f1b85b" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#5a246f" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#2b0f45" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#ffc86a" }] },
];
const MAP_TYPE_META = {
  venue: { label: "venue", routePage: "venue", markerColor: "#ff68bf" },
  event: { label: "event", routePage: "event", markerColor: "#ffd668" },
  room_session: { label: "room session", routePage: "session", markerColor: "#b384ff" },
};
const TIME_WINDOW_OPTIONS = [
  { id: "all", label: "All Times" },
  { id: "now", label: "Now" },
  { id: "tonight", label: "Tonight" },
  { id: "this_week", label: "This Week" },
];
const EARTH_RADIUS_MILES = 3958.8;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const LIVE_LOOKBACK_MS = 2 * MS_PER_HOUR;
const SOON_LOOKAHEAD_MS = 8 * MS_PER_HOUR;

const toRadians = (value = 0) => (Number(value || 0) * Math.PI) / 180;

const calculateDistanceMiles = (from = null, to = null) => {
  if (!from || !to) return null;
  const lat1 = Number(from.lat);
  const lng1 = Number(from.lng);
  const lat2 = Number(to.lat);
  const lng2 = Number(to.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((EARTH_RADIUS_MILES * c).toFixed(2));
};

const formatDistanceLabel = (distanceMiles = null) => {
  const miles = Number(distanceMiles);
  if (!Number.isFinite(miles) || miles < 0) return "";
  if (miles < 0.2) {
    const feet = Math.max(100, Math.round(miles * 5280));
    return `${feet.toLocaleString()} ft away`;
  }
  return `${miles.toFixed(1)} mi away`;
};

const computeTimePriority = (startsAtMs = 0, nowMs = Date.now()) => {
  const starts = Number(startsAtMs || 0);
  if (starts <= 0) return 0;
  const delta = starts - nowMs;
  if (delta >= -LIVE_LOOKBACK_MS && delta <= SOON_LOOKAHEAD_MS) return 44;
  if (delta > SOON_LOOKAHEAD_MS && delta <= 24 * MS_PER_HOUR) return 28;
  if (delta > 24 * MS_PER_HOUR && delta <= 72 * MS_PER_HOUR) return 16;
  if (delta < -LIVE_LOOKBACK_MS && delta >= -24 * MS_PER_HOUR) return 12;
  return 6;
};

const scoreSearchRelevance = (entry = {}, searchQuery = "") => {
  const query = String(searchQuery || "").trim().toLowerCase();
  if (!query) return 0;
  const title = String(entry?.title || "").toLowerCase();
  const subtitle = String(entry?.subtitle || "").toLowerCase();
  const detail = String(entry?.detailLine || "").toLowerCase();
  if (title.startsWith(query)) return 26;
  if (title.includes(query)) return 18;
  if (subtitle.includes(query)) return 12;
  if (detail.includes(query)) return 8;
  return 0;
};

const getTonightWindowMs = (nowMs = Date.now()) => {
  const now = new Date(nowMs);
  const start = new Date(now);
  start.setHours(17, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(2, 0, 0, 0);
  if (now.getHours() < 2) {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
};

const matchesTimeWindow = (entry = {}, timeWindow = "all", nowMs = Date.now()) => {
  const startsAtMs = Number(entry?.startsAtMs || 0);
  if (timeWindow === "all") return true;
  if (startsAtMs <= 0) return false;
  if (timeWindow === "now") {
    return startsAtMs >= (nowMs - LIVE_LOOKBACK_MS) && startsAtMs <= (nowMs + MS_PER_HOUR);
  }
  if (timeWindow === "tonight") {
    const tonight = getTonightWindowMs(nowMs);
    return startsAtMs >= tonight.startMs && startsAtMs <= tonight.endMs;
  }
  if (timeWindow === "this_week") {
    return startsAtMs >= (nowMs - LIVE_LOOKBACK_MS) && startsAtMs <= (nowMs + (7 * MS_PER_DAY));
  }
  return true;
};

const normalizeListingType = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === "event") return "event";
  if (token === "room_session") return "room_session";
  return "venue";
};

const normalizeLocation = (entry = {}) => {
  const location = entry?.location || entry?.latLng || entry?.coordinates || {};
  const lat = Number(location?.lat ?? entry?.lat ?? entry?.latitude);
  const lng = Number(location?.lng ?? entry?.lon ?? entry?.lng ?? entry?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
};

const toListing = (entry = {}, fallbackType = "venue") => {
  const listingType = normalizeListingType(entry?.listingType || fallbackType);
  const meta = MAP_TYPE_META[listingType] || MAP_TYPE_META.venue;
  const location = normalizeLocation(entry);
  const startsAtMs = Number(entry?.startsAtMs || 0) || 0;
  const mediaType = listingType === "room_session" ? "session" : listingType;
  const imageUrl = resolveListingImageCandidates(entry, mediaType)[0] || "/images/logo-library/beaurocks-karaoke-logo-2.png";
  const avatarUrl = resolveProfileAvatarUrl(entry);
  const locationLabel = [entry?.city, entry?.state, entry?.address1].filter(Boolean).join(", ");
  const subtitle = locationLabel || [entry?.city, entry?.state].filter(Boolean).join(", ") || "Location pending";
  const timeLabel = listingType === "venue"
    ? String(entry?.karaokeNightsLabel || "").trim()
    : startsAtMs > 0 ? formatDateTime(startsAtMs) : "Time TBD";
  return {
    key: `${listingType}:${entry.id}`,
    id: entry.id,
    listingType,
    routePage: meta.routePage,
    markerColor: meta.markerColor,
    typeLabel: meta.label,
    title: String(entry?.title || "Untitled listing"),
    imageUrl,
    avatarUrl,
    avatarLabel: listingType === "event"
      ? String(entry?.hostName || entry?.venueName || entry?.title || "").trim()
      : listingType === "room_session"
        ? String(entry?.hostName || entry?.roomCode || entry?.title || "").trim()
        : String(entry?.title || "").trim(),
    subtitle,
    detailLine: listingType === "event"
      ? [entry?.hostName, entry?.venueName].filter(Boolean).join(" | ")
      : listingType === "room_session"
        ? [entry?.venueName, entry?.roomCode].filter(Boolean).join(" | ")
        : String(entry?.description || "").trim().slice(0, 120),
    hostUid: String(entry?.hostUid || "").trim(),
    performerUid: String(entry?.performerUid || "").trim(),
    timeLabel,
    startsAtMs,
    location,
  };
};

const sortListings = (a, b) => {
  const aStarts = Number(a?.startsAtMs || 0);
  const bStarts = Number(b?.startsAtMs || 0);
  if (aStarts > 0 && bStarts > 0 && aStarts !== bStarts) return aStarts - bStarts;
  if (aStarts > 0 && bStarts <= 0) return -1;
  if (aStarts <= 0 && bStarts > 0) return 1;
  return String(a?.title || "").localeCompare(String(b?.title || ""));
};

const pointInBounds = (location = null, bounds = null) => {
  if (!location || !bounds) return false;
  const inLat = location.lat >= bounds.south && location.lat <= bounds.north;
  const inLng = bounds.west <= bounds.east
    ? location.lng >= bounds.west && location.lng <= bounds.east
    : location.lng >= bounds.west || location.lng <= bounds.east;
  return inLat && inLng;
};

const buildMarkerIcon = (googleMaps, color, selected = false) => ({
  path: googleMaps.SymbolPath.CIRCLE,
  fillColor: color,
  fillOpacity: selected ? 1 : 0.85,
  strokeColor: selected ? "#ffffff" : "#0b1119",
  strokeWeight: selected ? 2.8 : 1.4,
  scale: selected ? 10 : 7,
});

const fitMapToListings = ({ googleMaps, map, listings }) => {
  if (!map || !googleMaps || !Array.isArray(listings) || !listings.length) return;
  if (listings.length === 1) {
    map.panTo(listings[0].location);
    if ((map.getZoom() || 0) < 12) map.setZoom(12);
    return;
  }
  const bounds = new googleMaps.LatLngBounds();
  listings.forEach((entry) => bounds.extend(entry.location));
  map.fitBounds(bounds, 56);
};

const isPermissionError = (message = "") =>
  /permission|missing or insufficient permissions|permission-denied/i.test(String(message || ""));
const isIndexError = (message = "") =>
  /indexing|requires an index|create_composite/i.test(String(message || ""));

const humanizeRegion = (token = "") => {
  const safe = String(token || "").trim().toLowerCase();
  if (!safe) return "";
  const parts = safe.split("_").filter(Boolean);
  if (!parts.length) return "";
  if (parts[0] === "nationwide") return "Nationwide";
  const state = (parts[0] || "").toUpperCase();
  const city = parts.slice(1).join(" ");
  const cityLabel = city
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
  return cityLabel ? `${cityLabel}, ${state}` : state;
};

const DiscoverPage = ({ navigate, mapsConfig, session, authFlow }) => {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [timeWindow, setTimeWindow] = useState("all");
  const [sortMode, setSortMode] = useState("smart");
  const [boundsOnly, setBoundsOnly] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [mapBounds, setMapBounds] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [rankingNowMs, setRankingNowMs] = useState(() => Date.now());

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerMapRef = useRef(new Map());
  const cardRefs = useRef(new Map());
  const hasAutoFitRef = useRef(false);

  const { loading, error, data, rawData } = useDirectoryDiscover({ search, region });
  const permissionError = isPermissionError(error);
  const indexError = isIndexError(error);
  const mapEnabled = !!mapsConfig?.mapEnabled && !!mapsConfig?.apiKey;
  const { loaded: mapsLoaded, error: mapsError } = useGoogleMapsScript({
    enabled: mapEnabled,
    apiKey: String(mapsConfig?.apiKey || ""),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setRankingNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const allListings = useMemo(() => {
    const next = [];
    data.events.forEach((entry) => next.push(toListing(entry, "event")));
    data.sessions.forEach((entry) => next.push(toListing(entry, "room_session")));
    data.venues.forEach((entry) => next.push(toListing(entry, "venue")));
    return next;
  }, [data.events, data.sessions, data.venues]);

  const filteredByType = useMemo(() => {
    if (typeFilter === "all") return allListings;
    return allListings.filter((entry) => entry.listingType === typeFilter);
  }, [allListings, typeFilter]);

  const filteredByTimeWindow = useMemo(
    () => filteredByType.filter((entry) => matchesTimeWindow(entry, timeWindow, rankingNowMs)),
    [filteredByType, timeWindow, rankingNowMs]
  );

  const rankedListings = useMemo(() => {
    const withSignals = filteredByTimeWindow.map((entry) => {
      const distanceMiles = calculateDistanceMiles(userLocation, entry.location);
      const distanceScore = Number.isFinite(distanceMiles)
        ? Math.max(0, 32 - (distanceMiles * 1.8))
        : 0;
      const typeBonus = entry.listingType === "event" ? 12 : entry.listingType === "room_session" ? 8 : 5;
      const score = computeTimePriority(entry.startsAtMs, rankingNowMs)
        + distanceScore
        + typeBonus
        + scoreSearchRelevance(entry, search);
      return {
        ...entry,
        distanceMiles: Number.isFinite(distanceMiles) ? distanceMiles : null,
        distanceLabel: formatDistanceLabel(distanceMiles),
        score,
      };
    });

    if (sortMode === "soonest") {
      return withSignals.slice().sort(sortListings);
    }
    if (sortMode === "nearest") {
      return withSignals.slice().sort((a, b) => {
        const aDistance = Number(a?.distanceMiles);
        const bDistance = Number(b?.distanceMiles);
        const aHasDistance = Number.isFinite(aDistance);
        const bHasDistance = Number.isFinite(bDistance);
        if (aHasDistance && bHasDistance && aDistance !== bDistance) return aDistance - bDistance;
        if (aHasDistance && !bHasDistance) return -1;
        if (!aHasDistance && bHasDistance) return 1;
        return sortListings(a, b);
      });
    }
    return withSignals.slice().sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return sortListings(a, b);
    });
  }, [filteredByTimeWindow, sortMode, userLocation, search, rankingNowMs]);

  const mappableListings = useMemo(
    () => rankedListings.filter((entry) => !!entry.location),
    [rankedListings]
  );
  const listingsInBounds = useMemo(() => {
    if (!mapBounds) return mappableListings;
    return mappableListings.filter((entry) => pointInBounds(entry.location, mapBounds));
  }, [mappableListings, mapBounds]);
  const visibleListings = useMemo(
    () => (boundsOnly ? listingsInBounds : rankedListings),
    [boundsOnly, listingsInBounds, rankedListings]
  );
  const effectiveSelectedKey = useMemo(() => {
    if (visibleListings.some((entry) => entry.key === selectedKey)) return selectedKey;
    return visibleListings[0]?.key || "";
  }, [visibleListings, selectedKey]);

  const scheduledCount = useMemo(
    () => rankedListings.reduce((count, entry) => (entry.startsAtMs > 0 ? count + 1 : count), 0),
    [rankedListings]
  );

  const selectedListing = useMemo(
    () => visibleListings.find((entry) => entry.key === effectiveSelectedKey) || null,
    [visibleListings, effectiveSelectedKey]
  );

  const registerCardRef = useCallback((key, node) => {
    if (!key) return;
    if (node) {
      cardRefs.current.set(key, node);
      return;
    }
    cardRefs.current.delete(key);
  }, []);

  const focusListing = useCallback((listing, options = {}) => {
    if (!listing) return;
    setSelectedKey(listing.key);
    const map = mapRef.current;
    if (!map || !listing.location) return;
    if (options.pan !== false) map.panTo(listing.location);
    if (options.zoom && (map.getZoom() || 0) < 12) map.setZoom(12);
  }, []);

  const recenterMap = useCallback(() => {
    const googleMaps = window.google?.maps;
    const map = mapRef.current;
    if (!googleMaps || !map) return;
    fitMapToListings({ googleMaps, map, listings: mappableListings });
  }, [mappableListings]);

  const requestUserLocation = useCallback(() => {
    if (typeof window === "undefined" || !window.navigator?.geolocation) {
      setGeoError("Location services are unavailable in this browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError("");
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: Number(position?.coords?.latitude || 0),
          lng: Number(position?.coords?.longitude || 0),
        };
        if (!Number.isFinite(nextLocation.lat) || !Number.isFinite(nextLocation.lng)) {
          setGeoError("Could not read your location coordinates.");
          setGeoLoading(false);
          return;
        }
        setUserLocation(nextLocation);
        trackEvent("mk_discover_geolocate_success", {
          source: "discover_map",
          sortMode,
        });
        setSortMode((prev) => (prev === "soonest" ? prev : "nearest"));
        setGeoLoading(false);
        const map = mapRef.current;
        if (map) {
          map.panTo(nextLocation);
          if ((map.getZoom() || 0) < 10) map.setZoom(10);
        }
      },
      (err) => {
        setGeoLoading(false);
        setGeoError(String(err?.message || "Location permission was denied."));
        trackEvent("mk_discover_geolocate_error", {
          source: "discover_map",
          reason: String(err?.code || err?.message || "denied"),
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 120000,
      }
    );
  }, [sortMode]);

  useEffect(() => {
    if (!selectedListing) return;
    const node = cardRefs.current.get(selectedListing.key);
    if (node?.scrollIntoView) {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedListing]);

  useEffect(() => {
    if (!mapsLoaded || !mapEnabled || mapRef.current || !mapContainerRef.current) return;
    const googleMaps = window.google?.maps;
    if (!googleMaps) return;

    const map = new googleMaps.Map(mapContainerRef.current, {
      center: MAP_DEFAULT_CENTER,
      zoom: 4,
      minZoom: 3,
      clickableIcons: false,
      gestureHandling: "greedy",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      backgroundColor: "#190827",
      styles: MAP_BRAND_STYLES,
    });
    mapRef.current = map;
    const idleListener = map.addListener("idle", () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      setMapBounds({
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng(),
      });
    });
    return () => {
      idleListener?.remove?.();
    };
  }, [mapsLoaded, mapEnabled]);

  useEffect(() => () => {
    const googleMaps = window.google?.maps;
    markerMapRef.current.forEach((marker) => {
      googleMaps?.event?.clearInstanceListeners(marker);
      marker.setMap(null);
    });
    markerMapRef.current.clear();
    mapRef.current = null;
  }, []);

  useEffect(() => {
    const googleMaps = window.google?.maps;
    const map = mapRef.current;
    if (!googleMaps || !map) return;

    const markerMap = markerMapRef.current;
    const nextMarkerKeys = new Set();
    mappableListings.forEach((entry) => {
      nextMarkerKeys.add(entry.key);
      let marker = markerMap.get(entry.key);
      if (!marker) {
        marker = new googleMaps.Marker({
          map,
          position: entry.location,
          title: entry.title,
          optimized: true,
        });
        marker.addListener("click", () => setSelectedKey(entry.key));
        markerMap.set(entry.key, marker);
      } else {
        marker.setPosition(entry.location);
        marker.setTitle(entry.title);
        if (!marker.getMap()) marker.setMap(map);
      }
      const selected = entry.key === effectiveSelectedKey;
      marker.setIcon(buildMarkerIcon(googleMaps, entry.markerColor, selected));
      marker.setZIndex(selected ? 999 : 180);
    });

    markerMap.forEach((marker, key) => {
      if (nextMarkerKeys.has(key)) return;
      googleMaps.event.clearInstanceListeners(marker);
      marker.setMap(null);
      markerMap.delete(key);
    });

    if (!hasAutoFitRef.current && mappableListings.length) {
      fitMapToListings({ googleMaps, map, listings: mappableListings });
      hasAutoFitRef.current = true;
    }
  }, [mappableListings, effectiveSelectedKey, focusListing]);

  const hiddenWithoutCoords = boundsOnly
    ? rankedListings.length - mappableListings.length
    : 0;
  const mapBoundsLabel = mapBounds
    ? `${mapBounds.south.toFixed(2)} to ${mapBounds.north.toFixed(2)} lat`
    : "Move map to define bounds";
  const hasSearchFilters = !!String(search || "").trim()
    || !!String(region || "").trim()
    || sortMode !== "smart"
    || timeWindow !== "all";
  const dynamicRegionPresets = useMemo(() => {
    const source = [
      ...(Array.isArray(rawData?.venues) ? rawData.venues : []),
      ...(Array.isArray(rawData?.events) ? rawData.events : []),
      ...(Array.isArray(rawData?.sessions) ? rawData.sessions : []),
    ];
    const counts = new Map();
    source.forEach((item) => {
      const token = String(item?.region || "").trim().toLowerCase();
      if (!token || token === "nationwide") return;
      counts.set(token, (counts.get(token) || 0) + 1);
    });
    const ranked = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([id]) => ({ id, label: humanizeRegion(id) || id }));
    if (!ranked.length) return MARKETING_REGION_PRESETS;
    return [{ id: "nationwide", label: "Nationwide" }, ...ranked];
  }, [rawData]);

  const handleEmptyAction = (action = {}) => {
    const intent = String(action.intent || "");
    if (intent === "auth") {
      authFlow?.requireFullAuth?.({
        intent: "discover",
        targetType: "discover",
        targetId: "",
        returnRoute: { page: "discover" },
      });
      return;
    }
    if (intent === "discover_reset") {
      setRegion("nationwide");
      setSearch("");
      setTypeFilter("all");
      setTimeWindow("all");
      setSortMode("smart");
      return;
    }
    if (intent === "submit_listing") {
      navigate("submit", "", { intent: "listing_submit" });
      return;
    }
    navigate("discover");
  };

  return (
    <section className="mk3-page">
      <div className="mk3-status">
        <strong>BeauRocks Karaoke {FINDER_BRAND} Finder</strong>
        <span>Use map + rail together to find your next karaoke night faster.</span>
      </div>
      <div className="mk3-filter-row mk3-discover-filters">
        <label>
          Search
          <input
            value={search}
            placeholder="Host, venue, city, or vibe"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Region
          <input
            value={region}
            placeholder="Nationwide or pick a preset below"
            onChange={(event) => setRegion(event.target.value)}
          />
        </label>
        <label>
          Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="event">Events</option>
            <option value="venue">Venues</option>
            <option value="room_session">Room Sessions</option>
          </select>
        </label>
        <label>
          Rank
          <select
            value={sortMode}
            onChange={(event) => {
              const nextMode = event.target.value;
              setSortMode(nextMode);
              trackEvent("mk_discover_sort_change", {
                source: "discover_filters",
                sortMode: nextMode,
              });
            }}
          >
            <option value="smart">Smart (live + near)</option>
            <option value="soonest">Soonest start time</option>
            <option value="nearest">Nearest to me</option>
          </select>
        </label>
      </div>
      <div className="mk3-filter-chips">
        {TIME_WINDOW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={timeWindow === option.id ? "active" : ""}
            onClick={() => {
              setTimeWindow(option.id);
              trackEvent("mk_discover_time_filter_change", {
                source: "discover_filters",
                timeWindow: option.id,
              });
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="mk3-filter-chips">
        {dynamicRegionPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={String(region).trim().toLowerCase() === preset.id ? "active" : ""}
            onClick={() => setRegion(preset.id)}
          >
            {preset.label}
          </button>
        ))}
        {hasSearchFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setRegion("");
              setTypeFilter("all");
              setTimeWindow("all");
              setSortMode("smart");
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      {geoError && <div className="mk3-status mk3-status-warning">{geoError}</div>}

      <div className="mk3-metric-row">
        <div className="mk3-metric">
          <span>matching listings</span>
          <strong>{rankedListings.length}</strong>
        </div>
        <div className="mk3-metric">
          <span>with map coords</span>
          <strong>{mappableListings.length}</strong>
        </div>
        <div className="mk3-metric">
          <span>in current bounds</span>
          <strong>{listingsInBounds.length}</strong>
        </div>
        <div className="mk3-metric">
          <span>with schedule time</span>
          <strong>{scheduledCount}</strong>
        </div>
      </div>

      <div className="mk3-discover-shell">
        <article className="mk3-map-card">
          <h2>{FINDER_BRAND} Live Karaoke Map</h2>
          <div className="mk3-map-badge">Marker-synced {FINDER_BRAND} rail</div>
          <div className="mk3-map-toolbar">
            <label className="mk3-inline">
              <input
                type="checkbox"
                checked={boundsOnly}
                onChange={(event) => setBoundsOnly(event.target.checked)}
              />
              Bounds-only rail
            </label>
            <button type="button" onClick={recenterMap} disabled={!mappableListings.length || !mapsLoaded}>
              Recenter to markers
            </button>
            <button
              type="button"
              onClick={requestUserLocation}
              disabled={geoLoading}
            >
              {geoLoading ? "Locating..." : userLocation ? "Refresh my location" : "Use my location"}
            </button>
          </div>

          {!mapEnabled && (
            <div className="mk3-status">
              Google Maps is disabled in `getDirectoryMapsConfig`, but directory browse still works.
            </div>
          )}
          {!!mapsError && <div className="mk3-status mk3-status-error">{mapsError}</div>}

          {mapEnabled && mapsLoaded ? (
            <div ref={mapContainerRef} className="mk3-map-canvas" />
          ) : (
            <div className="mk3-map-grid">
              <div className="mk3-map-placeholder">{mapEnabled ? "Loading live map..." : "Map unavailable."}</div>
            </div>
          )}

          <div className="mk3-map-footer">
              <span>{visibleListings.length} shown in rail</span>
              <span>{selectedListing ? `selected: ${selectedListing.title}` : "select a marker or card"}</span>
              <span>{mapBoundsLabel}</span>
            </div>
          </article>

        <aside className="mk3-feed-column">
          {loading && <div className="mk3-status">Loading approved karaoke listings...</div>}
          {!loading && !!error && !permissionError && !indexError && (
            <div className="mk3-status mk3-status-error">{error}</div>
          )}
          {!loading && indexError && (
            <div className="mk3-status mk3-status-warning">
              <strong>Directory updates are still finishing.</strong>
              <span>Try again in about a minute while indexes sync.</span>
              <div className="mk3-actions-inline">
                <button type="button" onClick={() => window.location.reload()}>
                  Refresh now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegion("nationwide");
                    setSearch("");
                    setTypeFilter("all");
                    setTimeWindow("all");
                    setSortMode("smart");
                  }}
                >
                  Use broad filters
                </button>
              </div>
            </div>
          )}
          {!loading && permissionError && (
            <EmptyStatePanel
              {...getEmptyStateConfig({
                context: EMPTY_STATE_CONTEXT.DISCOVER_PERMISSION,
                session,
                hasFilters: hasSearchFilters,
              })}
              onAction={handleEmptyAction}
            />
          )}
          {!loading && !error && boundsOnly && hiddenWithoutCoords > 0 && (
            <div className="mk3-status">
              {hiddenWithoutCoords} listing(s) hidden in bounds mode because location coordinates are missing.
            </div>
          )}
          {!loading && !error && visibleListings.length === 0 && (
            <EmptyStatePanel
              {...getEmptyStateConfig({
                context: EMPTY_STATE_CONTEXT.DISCOVER_NO_RESULTS,
                session,
                hasFilters: hasSearchFilters,
              })}
              onAction={handleEmptyAction}
            />
          )}

          <div className="mk3-card-list mk3-card-rail">
            {visibleListings.map((entry) => (
              <article
                key={entry.key}
                ref={(node) => registerCardRef(entry.key, node)}
                className={entry.key === effectiveSelectedKey ? "mk3-discover-card is-selected" : "mk3-discover-card"}
              >
                <div className="mk3-discover-media">
                  <img src={entry.imageUrl} alt={`${entry.title} listing visual`} loading="lazy" />
                  <div className="mk3-discover-media-top">
                    <div className="mk3-chip">{entry.typeLabel}</div>
                    <div className="mk3-discover-avatar" aria-hidden="true">
                      {entry.avatarUrl
                        ? <img src={entry.avatarUrl} alt={`${entry.avatarLabel} avatar`} loading="lazy" />
                        : <span>{getInitials(entry.avatarLabel || entry.title)}</span>}
                    </div>
                  </div>
                </div>
                <h3>{entry.title}</h3>
                <div className="mk3-card-subtitle">{entry.subtitle}</div>
                {!!entry.distanceLabel && <div className="mk3-card-subtitle">{entry.distanceLabel}</div>}
                {entry.timeLabel && <div className="mk3-card-time">{entry.timeLabel}</div>}
                {entry.detailLine && <div className="mk3-card-subtitle">{entry.detailLine}</div>}
                <div className="mk3-actions-inline">
                  <button
                    type="button"
                    onClick={() => {
                      focusListing(entry, { pan: true, zoom: true });
                      trackEvent("mk_discover_focus_marker", {
                        source: "discover_rail",
                        listingType: entry.listingType,
                        listingId: entry.id,
                        sortMode,
                      });
                    }}
                    disabled={!entry.location || !mapsLoaded}
                  >
                    Focus marker
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      trackEvent("mk_discover_open_details", {
                        source: "discover_rail",
                        listingType: entry.listingType,
                        listingId: entry.id,
                        sortMode,
                      });
                      navigate(entry.routePage, entry.id, {
                        src: "discover",
                        src_listing_type: entry.listingType,
                        src_sort_mode: sortMode,
                      });
                    }}
                  >
                    Open details
                  </button>
                </div>
                <InlineConversionActions
                  entry={entry}
                  session={session}
                  navigate={navigate}
                  authFlow={authFlow}
                />
              </article>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default DiscoverPage;
