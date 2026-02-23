import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDirectoryDiscover } from "../hooks/useDirectoryDiscover";
import { useGoogleMapsScript } from "../hooks/useGoogleMapsScript";
import { MARKETING_REGION_PRESETS } from "../geoPresets";
import { EMPTY_STATE_CONTEXT, getEmptyStateConfig } from "../emptyStateOrchestrator";
import EmptyStatePanel from "./EmptyStatePanel";
import InlineConversionActions from "./InlineConversionActions";
import { formatDateTime } from "./shared";

const FINDER_BRAND = "Setlist";
const MAP_DEFAULT_CENTER = { lat: 39.5, lng: -98.35 };
const MAP_TYPE_META = {
  venue: { label: "venue", routePage: "venue", markerColor: "#27d3cb" },
  event: { label: "event", routePage: "event", markerColor: "#ec4899" },
  room_session: { label: "room session", routePage: "session", markerColor: "#ffd166" },
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
  const [boundsOnly, setBoundsOnly] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [mapBounds, setMapBounds] = useState(null);

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

  const allListings = useMemo(() => {
    const next = [];
    data.events.forEach((entry) => next.push(toListing(entry, "event")));
    data.sessions.forEach((entry) => next.push(toListing(entry, "room_session")));
    data.venues.forEach((entry) => next.push(toListing(entry, "venue")));
    return next.sort(sortListings);
  }, [data.events, data.sessions, data.venues]);

  const filteredByType = useMemo(() => {
    if (typeFilter === "all") return allListings;
    return allListings.filter((entry) => entry.listingType === typeFilter);
  }, [allListings, typeFilter]);

  const mappableListings = useMemo(
    () => filteredByType.filter((entry) => !!entry.location),
    [filteredByType]
  );
  const listingsInBounds = useMemo(() => {
    if (!mapBounds) return mappableListings;
    return mappableListings.filter((entry) => pointInBounds(entry.location, mapBounds));
  }, [mappableListings, mapBounds]);
  const visibleListings = useMemo(
    () => (boundsOnly ? listingsInBounds : filteredByType),
    [boundsOnly, listingsInBounds, filteredByType]
  );
  const effectiveSelectedKey = useMemo(() => {
    if (visibleListings.some((entry) => entry.key === selectedKey)) return selectedKey;
    return visibleListings[0]?.key || "";
  }, [visibleListings, selectedKey]);

  const scheduledCount = useMemo(
    () => filteredByType.reduce((count, entry) => (entry.startsAtMs > 0 ? count + 1 : count), 0),
    [filteredByType]
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
    ? filteredByType.length - mappableListings.length
    : 0;
  const mapBoundsLabel = mapBounds
    ? `${mapBounds.south.toFixed(2)} to ${mapBounds.north.toFixed(2)} lat`
    : "Move map to define bounds";
  const hasSearchFilters = !!String(search || "").trim() || !!String(region || "").trim();
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
          <button type="button" onClick={() => { setSearch(""); setRegion(""); setTypeFilter("all"); }}>
            Clear filters
          </button>
        )}
      </div>

      <div className="mk3-metric-row">
        <div className="mk3-metric">
          <span>matching listings</span>
          <strong>{filteredByType.length}</strong>
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
                <button type="button" onClick={() => { setRegion("nationwide"); setSearch(""); setTypeFilter("all"); }}>
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
                <div className="mk3-chip">{entry.typeLabel}</div>
                <h3>{entry.title}</h3>
                <div className="mk3-card-subtitle">{entry.subtitle}</div>
                {entry.timeLabel && <div className="mk3-card-time">{entry.timeLabel}</div>}
                {entry.detailLine && <div className="mk3-card-subtitle">{entry.detailLine}</div>}
                <div className="mk3-actions-inline">
                  <button
                    type="button"
                    onClick={() => focusListing(entry, { pan: true, zoom: true })}
                    disabled={!entry.location || !mapsLoaded}
                  >
                    Focus marker
                  </button>
                  <button type="button" onClick={() => navigate(entry.routePage, entry.id)}>
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
