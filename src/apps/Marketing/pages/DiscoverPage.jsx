import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useDirectoryDiscover } from "../hooks/useDirectoryDiscover";
import { useGoogleMapsScript } from "../hooks/useGoogleMapsScript";
import { MARKETING_REGION_PRESETS } from "../geoPresets";
import { EMPTY_STATE_CONTEXT, getEmptyStateConfig } from "../emptyStateOrchestrator";
import { trackEvent } from "../lib/marketingAnalytics";
import EmptyStatePanel from "./EmptyStatePanel";
import DiscoverListingCard from "./DiscoverListingCard";
import { createDiscoverViewState, reduceDiscoverViewState } from "./discoverViewState";
import { countJoinableRoomListings, isJoinableRoomListing } from "./discoverFilters";
import {
  deriveDirectoryExperience,
  matchesDirectoryExperienceFilter,
} from "../lib/directoryExperience";
import {
  buildPublicLocationImageUrl,
  extractCadenceBadges,
  formatDateTime,
  resolveListingImageCandidates,
  resolveProfileAvatarUrl,
} from "./shared";
import { buildMarketingPath } from "../routing";

const FINDER_BRAND = "Setlist";
const MAP_DEFAULT_CENTER = { lat: 39.5, lng: -98.35 };
const KITSAP_BOOTSTRAP_REGION = "wa_kitsap";
const KITSAP_BOOTSTRAP_CENTER = { lat: 47.5964, lng: -122.6432 };
const KITSAP_BOOTSTRAP_ZOOM = 10;
const MAP_BRAND_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#020714" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#b9c8e8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#020714" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#17314d" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#08111d" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#5d7191" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#06232c" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#2ce6da" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#0c182b" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#09111f" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#5f7190" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#0b647a" }] },
  { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#083442" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#79fff5" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#7a2558" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#381028" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#ffd6f3" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#ff4db8" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry.stroke", stylers: [{ color: "#5b1d42" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#03384f" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#37efff" }] },
];
const MAP_TYPE_META = {
  venue: { label: "venue", routePage: "venue", markerColor: "#26d7e8" },
  event: { label: "event", routePage: "event", markerColor: "#f1c76f" },
  room_session: { label: "room session", routePage: "session", markerColor: "#ff4fae" },
};
const OFFICIAL_ROOM_MARKER_COLOR = "#ff4fae";
const DEMO_MAP_ID = "DEMO_MAP_ID";
const TIME_WINDOW_OPTIONS = [
  { id: "all", label: "All Times" },
  { id: "now", label: "Now" },
  { id: "tonight", label: "Tonight" },
  { id: "this_week", label: "This Week" },
];
const EVENT_CADENCE_OPTIONS = [
  { id: "all", label: "All events" },
  { id: "recurring", label: "Recurring" },
  { id: "one_time", label: "One-time" },
];
const EXPERIENCE_FILTER_OPTIONS = [
  { id: "all", label: "All nights" },
  { id: "modern", label: "Modern karaoke" },
  { id: "interactive", label: "Interactive rooms" },
  { id: "live_join", label: "Live join" },
  { id: "recap", label: "Recap-enabled" },
  { id: "beginner", label: "Beginner friendly" },
  { id: "fast_rotation", label: "Fast rotation" },
];
const TYPE_FILTER_LABELS = Object.freeze({
  event: "Events",
  venue: "Venues",
  room_session: "Room sessions",
});
const SORT_MODE_LABELS = Object.freeze({
  soonest: "Soonest start time",
  nearest: "Nearest to me",
  host_first: "Host-first",
});
const EARTH_RADIUS_MILES = 3958.8;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const LIVE_LOOKBACK_MS = 2 * MS_PER_HOUR;
const SOON_LOOKAHEAD_MS = 8 * MS_PER_HOUR;
const ENV_DISCOVER_GOOGLE_STATIC_IMAGES_ENABLED = typeof import.meta !== "undefined" && import.meta?.env
  ? String(import.meta.env.VITE_MARKETING_DISCOVER_GOOGLE_STATIC_IMAGES_ENABLED || "")
  : "";
const DISCOVER_DEFAULT_LIMIT_DESKTOP = 120;
const DISCOVER_DEFAULT_LIMIT_MOBILE = 48;

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

const normalizeListingType = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === "event") return "event";
  if (token === "room_session") return "room_session";
  return "venue";
};

const toFiniteCoordinate = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLocation = (entry = {}) => {
  const location = entry?.location || entry?.latLng || entry?.coordinates || {};
  const lat = toFiniteCoordinate(location?.lat ?? entry?.lat ?? entry?.latitude);
  const lng = toFiniteCoordinate(location?.lng ?? entry?.lon ?? entry?.lng ?? entry?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return null;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
};

const normalizeLookupToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const buildVenueLookupKey = ({ venueName = "", city = "", state = "" } = {}) => {
  const nameToken = normalizeLookupToken(venueName);
  if (!nameToken) return "";
  const cityToken = normalizeLookupToken(city);
  const stateToken = normalizeLookupToken(state);
  return [nameToken, cityToken, stateToken].filter(Boolean).join("|");
};

const toLocationFields = (entry = {}) => ({
  address1: String(entry?.address1 || entry?.address || "").trim(),
  city: String(entry?.city || "").trim(),
  state: String(entry?.state || "").trim(),
  postalCode: String(entry?.postalCode || "").trim(),
  country: String(entry?.country || "").trim(),
});

const mergeLocationFields = (primary = {}, fallback = {}) => ({
  address1: String(primary?.address1 || fallback?.address1 || "").trim(),
  city: String(primary?.city || fallback?.city || "").trim(),
  state: String(primary?.state || fallback?.state || "").trim(),
  postalCode: String(primary?.postalCode || fallback?.postalCode || "").trim(),
  country: String(primary?.country || fallback?.country || "").trim(),
});

const buildVenueLocationIndex = (venues = []) => {
  const byVenueId = new Map();
  const byVenueKey = new Map();
  venues.forEach((venue) => {
    const venueId = String(venue?.id || "").trim();
    const venueName = String(venue?.title || venue?.venueName || "").trim();
    const locationFields = toLocationFields(venue);
    const location = normalizeLocation(venue);
    const payload = { location, locationFields };
    if (venueId && !byVenueId.has(venueId)) byVenueId.set(venueId, payload);
    const venueKey = buildVenueLookupKey({
      venueName,
      city: locationFields.city,
      state: locationFields.state,
    });
    if (venueKey && !byVenueKey.has(venueKey)) byVenueKey.set(venueKey, payload);
  });
  return { byVenueId, byVenueKey };
};

const resolveListingLocationData = (entry = {}, venueIndex = null) => {
  const locationFields = toLocationFields(entry);
  const directLocation = normalizeLocation(entry);
  let source = directLocation ? "entry" : "missing";
  let fallbackData = null;

  const venueId = String(entry?.venueId || "").trim();
  if (venueIndex && venueId) {
    fallbackData = venueIndex.byVenueId.get(venueId) || null;
    if (!directLocation && fallbackData?.location) source = "venue_id";
  }
  if ((!fallbackData || !fallbackData.location) && venueIndex) {
    const venueKey = buildVenueLookupKey({
      venueName: entry?.venueName || entry?.title,
      city: locationFields.city || entry?.city,
      state: locationFields.state || entry?.state,
    });
    if (venueKey) {
      const keyMatch = venueIndex.byVenueKey.get(venueKey) || null;
      if (keyMatch) {
        fallbackData = fallbackData
          ? {
            location: fallbackData.location || keyMatch.location || null,
            locationFields: mergeLocationFields(fallbackData.locationFields || {}, keyMatch.locationFields || {}),
          }
          : keyMatch;
        if (!directLocation && fallbackData?.location) source = "venue_match";
      }
    }
  }

  return {
    location: directLocation || fallbackData?.location || null,
    locationFields: mergeLocationFields(locationFields, fallbackData?.locationFields || {}),
    locationSource: source,
  };
};

const toAddressLine = (entry = {}) =>
  [entry?.address1, entry?.city, entry?.state, entry?.postalCode, entry?.country]
    .filter(Boolean)
    .join(", ");

const buildStreetViewImageUrl = ({ location = null, addressLine = "", mapsApiKey = "" } = {}) => {
  const key = String(mapsApiKey || "").trim();
  if (!key) return "";
  const locationToken = location
    ? `${Number(location.lat).toFixed(6)},${Number(location.lng).toFixed(6)}`
    : String(addressLine || "").trim();
  if (!locationToken) return "";
  return `https://maps.googleapis.com/maps/api/streetview?size=960x540&location=${encodeURIComponent(locationToken)}&source=outdoor&fov=95&pitch=4&key=${encodeURIComponent(key)}`;
};

const buildStaticMapImageUrl = ({ location = null, mapsApiKey = "" } = {}) => {
  const key = String(mapsApiKey || "").trim();
  if (!key || !location) return "";
  const marker = `${Number(location.lat).toFixed(6)},${Number(location.lng).toFixed(6)}`;
  return `https://maps.googleapis.com/maps/api/staticmap?size=960x540&maptype=roadmap&markers=color:0xff4fae%7C${encodeURIComponent(marker)}&style=feature:all%7Csaturation:-75&style=feature:all%7Clightness:-32&style=feature:road.highway%7Ccolor:0x7a2558&style=feature:water%7Ccolor:0x03384f&key=${encodeURIComponent(key)}`;
};

const buildGooglePlacePhotoUrls = ({ entry = {}, mapsApiKey = "" } = {}) => {
  const key = String(mapsApiKey || "").trim();
  if (!key) return [];
  const googleExternal = entry?.externalSources?.google || {};
  const refs = [
    googleExternal.photoRef,
    ...(Array.isArray(googleExternal.photoRefs) ? googleExternal.photoRefs : []),
    ...(Array.isArray(googleExternal.photoReferences) ? googleExternal.photoReferences : []),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (!refs.length) return [];
  const seen = new Set();
  const urls = [];
  refs.forEach((ref) => {
    if (seen.has(ref)) return;
    seen.add(ref);
    urls.push(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=1400&photo_reference=${encodeURIComponent(ref)}&key=${encodeURIComponent(key)}`);
  });
  return urls.slice(0, 6);
};

const getHostToken = ({ hostUid = "", hostName = "" } = {}) => {
  const uid = String(hostUid || "").trim();
  if (uid) return `uid:${uid.toLowerCase()}`;
  const name = String(hostName || "").trim().toLowerCase();
  return name ? `name:${name}` : "";
};

const PLACEHOLDER_SCREEN_IMAGE_TOKENS = [
  "/images/marketing/app-landing-live.png",
  "/images/marketing/audience-surface-live.png",
  "/images/marketing/tv-surface-live.png",
  "/images/marketing/beaurocks-hostpanel.png",
  "/images/marketing/beaurocks-audienceapp.png",
  "/images/logo-library/beaurocks-karaoke-logo-2.png",
  "/images/logo-library/bross-entertainment",
];

const isScreenPlaceholderImage = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (!token) return false;
  return PLACEHOLDER_SCREEN_IMAGE_TOKENS.some((entry) => token.includes(entry));
};

const dedupeUrls = (entries = []) =>
  entries.filter((value, index, array) => String(value || "").trim() && array.indexOf(value) === index);

const applyFallbackImage = (event, fallbackUrls = []) => {
  const target = event?.currentTarget;
  if (!target) return;
  const chain = dedupeUrls(Array.isArray(fallbackUrls) ? fallbackUrls : [fallbackUrls]);
  if (!chain.length) return;

  let nextIndex = Number(target.dataset.fallbackIndex || 0);
  if (!Number.isFinite(nextIndex) || nextIndex < 0) nextIndex = 0;

  while (nextIndex < chain.length) {
    const candidate = String(chain[nextIndex] || "").trim();
    nextIndex += 1;
    if (!candidate) continue;
    target.dataset.fallbackIndex = String(nextIndex);
    target.src = candidate;
    return;
  }
  target.onerror = null;
};

const escapeHtml = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeMediaUrl = (value = "") => {
  const token = String(value || "").trim();
  if (!token) return "";
  if (token.startsWith("/")) return token;
  if (/^https?:\/\//i.test(token)) return token.replace(/^http:\/\//i, "https://");
  return "";
};

const hexToRgba = (hex = "", alpha = 1) => {
  const token = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(token)) return `rgba(255, 255, 255, ${alpha})`;
  const parsed = Number.parseInt(token, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const buildListingActionHref = (listing = null) => {
  if (!listing || typeof listing !== "object") return "";
  const listingType = normalizeListingType(listing?.listingType);
  const roomCode = String(listing?.roomCode || "").trim().toUpperCase();
  if (listingType === "room_session" && roomCode) {
    return buildMarketingPath({ page: "join", id: roomCode, params: { roomCode } });
  }
  const routePage = String(listing?.routePage || "").trim();
  const listingId = String(listing?.id || "").trim();
  if (!routePage || !listingId) return "";
  return buildMarketingPath({ page: routePage, id: listingId });
};

const toListing = (entry = {}, fallbackType = "venue", options = {}) => {
  const mapsApiKey = String(options?.mapsApiKey || "").trim();
  const allowGoogleImageApis = options?.allowGoogleImageApis !== false;
  const allowGoogleStaticFallback = options?.allowGoogleStaticFallback === true;
  const listingType = normalizeListingType(entry?.listingType || fallbackType);
  const meta = MAP_TYPE_META[listingType] || MAP_TYPE_META.venue;
  const location = options?.resolvedLocation || normalizeLocation(entry);
  const resolvedFields = options?.resolvedLocationFields || {};
  const address1 = String(resolvedFields?.address1 || entry?.address1 || entry?.address || "").trim();
  const city = String(resolvedFields?.city || entry?.city || "").trim();
  const state = String(resolvedFields?.state || entry?.state || "").trim();
  const postalCode = String(resolvedFields?.postalCode || entry?.postalCode || "").trim();
  const country = String(resolvedFields?.country || entry?.country || "").trim();
  const startsAtMs = Number(entry?.startsAtMs || 0) || 0;
  const mediaType = listingType === "room_session" ? "session" : listingType;
  const explicitImageCandidates = resolveListingImageCandidates(entry, mediaType, { includeFallback: false })
    .filter((url) => !isScreenPlaceholderImage(url));
  const addressLine = toAddressLine({ address1, city, state, postalCode, country });
  const venueImageUrl = allowGoogleImageApis && allowGoogleStaticFallback
    ? buildStreetViewImageUrl({ location, addressLine, mapsApiKey })
    : "";
  const mapFallbackImageUrl = allowGoogleImageApis && allowGoogleStaticFallback
    ? buildStaticMapImageUrl({ location, mapsApiKey })
    : "";
  const publicLocationFallbackUrl = buildPublicLocationImageUrl({ location });
  const hardFallbackImageUrl = "/images/marketing/venue-location-fallback.svg";
  const googlePhotoUrls = allowGoogleImageApis
    ? buildGooglePlacePhotoUrls({ entry, mapsApiKey })
    : [];
  const googleImageCandidates = dedupeUrls([
    ...googlePhotoUrls,
    ...(allowGoogleStaticFallback ? [venueImageUrl, mapFallbackImageUrl] : []),
  ]);
  const imageCandidates = dedupeUrls([
    ...explicitImageCandidates,
    publicLocationFallbackUrl,
    hardFallbackImageUrl,
  ]).filter((url) => !isScreenPlaceholderImage(url) || url === hardFallbackImageUrl);
  const imageUrl = imageCandidates[0] || hardFallbackImageUrl;
  const imageFallbackUrls = imageCandidates.slice(1);
  const hostUid = String(entry?.hostUid || "").trim();
  const hostName = String(entry?.hostName || "").trim();
  const avatarUrl = resolveProfileAvatarUrl(entry);
  const officialBadgeImageUrl = sanitizeMediaUrl(
    entry?.logoUrl
    || entry?.hostLogoUrl
    || entry?.brandLogoUrl
    || entry?.branding?.logoUrl
    || avatarUrl
    || imageUrl
    || "/images/logo-library/beaurocks-karaoke-logo-2.png"
  );
  const locationLabel = [city, state, address1].filter(Boolean).join(", ");
  const roomCode = String(entry?.roomCode || "").trim().toUpperCase();
  const virtualOnly = !!entry?.virtualOnly
    || !!entry?.isVirtualOnly
    || String(entry?.sessionMode || "").trim().toLowerCase() === "virtual";
  const isOfficialBeauRocksRoom = listingType === "room_session" && !!entry?.isOfficialBeauRocksRoom;
  const hasBeauRocksHostAccount = !!entry?.hasBeauRocksHostAccount;
  const hostLeaderboardRank = Math.max(0, Number(entry?.hostLeaderboardRank || 0) || 0);
  const hostLeaderboardScore = Math.max(0, Number(entry?.hostLeaderboardScore || 0) || 0);
  const hostHostedRooms = Math.max(0, Number(entry?.hostHostedRooms || 0) || 0);
  const hostRecapCount = Math.max(0, Number(entry?.hostRecapCount || 0) || 0);
  const venueLeaderboardRank = Math.max(0, Number(entry?.venueLeaderboardRank || 0) || 0);
  const venueLeaderboardScore = Math.max(0, Number(entry?.venueLeaderboardScore || 0) || 0);
  const venueAverageRating = Math.max(0, Number(entry?.venueAverageRating || 0) || 0);
  const venueReviewCount = Math.max(0, Number(entry?.venueReviewCount || 0) || 0);
  const venueCheckinCount = Math.max(0, Number(entry?.venueCheckinCount || 0) || 0);
  const beauRocksHostTier = String(entry?.beauRocksHostTier || "").trim().toLowerCase();
  const beauRocksElevatedReasons = Array.isArray(entry?.beauRocksElevatedReasons)
    ? entry.beauRocksElevatedReasons.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const isBeauRocksElevated = !!entry?.isBeauRocksElevated || isOfficialBeauRocksRoom || hasBeauRocksHostAccount;
  const subtitle = virtualOnly
    ? "Virtual session"
    : locationLabel || [city, state].filter(Boolean).join(", ") || "Location pending";
  const timeLabel = listingType === "venue"
    ? String(entry?.karaokeNightsLabel || "").trim()
    : startsAtMs > 0 ? formatDateTime(startsAtMs) : "Time TBD";
  const cadenceBadges = extractCadenceBadges({
    karaokeNightsLabel: entry?.karaokeNightsLabel,
    recurringRule: entry?.recurringRule,
    startsAtMs,
    max: listingType === "venue" ? 4 : 3,
  });
  const recurringRule = String(entry?.recurringRule || "").trim();
  const karaokeNightsLabel = String(entry?.karaokeNightsLabel || "").trim();
  const isRecurringEvent = listingType === "event" && (!!recurringRule || !!karaokeNightsLabel);
  const experience = deriveDirectoryExperience({
    ...entry,
    listingType,
    isOfficialBeauRocksRoom,
    isBeauRocksElevated,
    hasBeauRocksHostAccount,
    beauRocksHostTier,
    beauRocksElevatedReasons,
    hostLeaderboardRank,
    hostLeaderboardScore,
    hostHostedRooms,
    hostRecapCount,
    venueLeaderboardRank,
    venueLeaderboardScore,
    venueAverageRating,
    venueReviewCount,
    venueCheckinCount,
    startsAtMs,
    roomCode,
    recurringRule,
    karaokeNightsLabel,
  });
  return {
    key: `${listingType}:${entry.id}`,
    id: entry.id,
    listingType,
    routePage: meta.routePage,
    markerColor: isBeauRocksElevated ? OFFICIAL_ROOM_MARKER_COLOR : meta.markerColor,
    typeLabel: meta.label,
    title: String(entry?.title || "Untitled listing"),
    imageUrl,
    imageFallbackUrl: hardFallbackImageUrl,
    imageFallbackUrls,
    googleImageCandidates,
    avatarUrl,
    avatarLabel: listingType === "event"
      ? String(entry?.hostName || entry?.venueName || entry?.title || "").trim()
      : listingType === "room_session"
        ? String(entry?.hostName || entry?.roomCode || entry?.title || "").trim()
        : String(entry?.title || "").trim(),
    officialBadgeImageUrl,
    subtitle,
    detailLine: listingType === "event"
      ? [entry?.hostName, entry?.venueName].filter(Boolean).join(" | ")
      : listingType === "room_session"
        ? [virtualOnly ? "Virtual" : "", entry?.venueName, roomCode].filter(Boolean).join(" | ")
        : String(entry?.description || "").trim().slice(0, 120),
    hostUid,
    hostName,
    hostToken: getHostToken({ hostUid, hostName }),
    performerUid: String(entry?.performerUid || "").trim(),
    timeLabel,
    cadenceBadges,
    startsAtMs,
    location,
    roomCode,
    virtualOnly,
    recurringRule,
    karaokeNightsLabel,
    isRecurringEvent,
    isOfficialBeauRocksRoom,
    isBeauRocksElevated,
    hasBeauRocksHostAccount,
    beauRocksHostTier,
    beauRocksElevatedReasons,
    hostLeaderboardRank,
    hostLeaderboardScore,
    hostHostedRooms,
    hostRecapCount,
    venueLeaderboardRank,
    venueLeaderboardScore,
    venueAverageRating,
    venueReviewCount,
    venueCheckinCount,
    locationSource: String(options?.locationSource || "").trim() || (location ? "entry" : "missing"),
    experience,
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

const buildMarkerVisual = (
  color,
  selected = false,
  isElevated = false,
  isOfficialRoom = false,
  pulsePhase = 0
) => {
  const accentColor = isOfficialRoom
    ? (pulsePhase ? "#ff72c1" : "#ff4fae")
    : isElevated
      ? "#f1c76f"
      : color || "#26d7e8";
  const ringColor = isOfficialRoom
    ? "#f1c76f"
    : isElevated
      ? (selected ? "#fff3c7" : "#f1c76f")
      : selected
        ? "#dffcff"
        : hexToRgba(accentColor, 0.54);
  const bodyColor = isElevated ? "#120d18" : selected ? "#07182b" : "#091326";
  const coreColor = isOfficialRoom
    ? "#f1c76f"
    : isElevated
      ? "#ffd987"
      : selected
        ? "#37efff"
        : accentColor;
  const haloColor = isOfficialRoom
    ? hexToRgba("#ff4fae", selected ? 0.34 : 0.26)
    : isElevated
      ? hexToRgba("#f1c76f", selected ? 0.3 : 0.2)
      : hexToRgba(accentColor, selected ? 0.3 : 0.18);
  const haloRingColor = isOfficialRoom
    ? hexToRgba("#f1c76f", selected ? 0.24 : 0.18)
    : isElevated
      ? hexToRgba("#fff3c7", selected ? 0.22 : 0.14)
      : hexToRgba(accentColor, selected ? 0.18 : 0.1);
  const radius = selected
    ? (isOfficialRoom ? (16 + (pulsePhase ? 1 : 0)) : isElevated ? 15 : 14)
    : (isOfficialRoom ? (13 + (pulsePhase ? 1 : 0)) : isElevated ? 12 : 11);
  const strokeWidth = selected
    ? (isOfficialRoom ? 3.8 : isElevated ? 3.3 : 3.1)
    : (isOfficialRoom ? 3 : isElevated ? 2.5 : 2.2);
  return {
    accentColor,
    bodyColor,
    coreColor,
    haloColor,
    haloRingColor,
    ringColor,
    fillColor: coreColor,
    strokeColor: ringColor,
    strokeWidth,
    radius,
    fillOpacity: selected ? 1 : (isOfficialRoom ? 0.98 : 0.94),
    shadow: selected
      ? isOfficialRoom
        ? `0 0 0 4px ${hexToRgba("#f1c76f", 0.18)}, 0 0 30px ${hexToRgba("#ff4fae", 0.42)}, 0 14px 32px rgba(2, 7, 20, 0.62)`
        : isElevated
          ? `0 0 0 4px ${hexToRgba("#f1c76f", 0.16)}, 0 0 28px ${hexToRgba("#f1c76f", 0.28)}, 0 12px 28px rgba(2, 7, 20, 0.56)`
        : `0 0 0 4px ${hexToRgba(accentColor, 0.16)}, 0 0 26px ${hexToRgba(accentColor, 0.34)}, 0 12px 28px rgba(2, 7, 20, 0.54)`
      : isOfficialRoom
        ? `0 0 0 3px ${hexToRgba("#f1c76f", 0.12)}, 0 0 18px ${hexToRgba("#ff4fae", 0.22)}, 0 8px 24px rgba(2, 7, 20, 0.46)`
        : isElevated
          ? `0 0 0 2px ${hexToRgba("#f1c76f", 0.1)}, 0 0 16px ${hexToRgba("#f1c76f", 0.16)}, 0 8px 22px rgba(2, 7, 20, 0.4)`
        : `0 0 0 2px ${hexToRgba(accentColor, 0.08)}, 0 6px 18px rgba(2, 7, 20, 0.36)`,
    scale: radius,
    selected,
    isElevated,
    isOfficialRoom,
  };
};

const buildMarkerIcon = (
  googleMaps,
  color,
  selected = false,
  isElevated = false,
  isOfficialRoom = false,
  pulsePhase = 0
) => {
  const visual = buildMarkerVisual(color, selected, isElevated, isOfficialRoom, pulsePhase);
  return {
    path: googleMaps.SymbolPath.CIRCLE,
    fillColor: visual.fillColor,
    fillOpacity: visual.fillOpacity,
    strokeColor: visual.strokeColor,
    strokeWeight: visual.strokeWidth,
    scale: visual.scale,
  };
};

const applyAdvancedMarkerStyles = (element, visual, title = "") => {
  if (!element) return;
  const diameter = Math.max(visual.radius * 2, 22);
  element.className = `mk3-map-pin${visual.selected ? " is-selected" : ""}${visual.isElevated ? " is-highlighted" : ""}${visual.isOfficialRoom ? " is-official" : ""}`;
  element.setAttribute("aria-label", title || "Map marker");
  element.title = title || "";
  element.style.setProperty("--mk3-map-pin-size", `${diameter}px`);
  element.style.setProperty("--mk3-map-pin-accent", visual.accentColor);
  element.style.setProperty("--mk3-map-pin-body", visual.bodyColor);
  element.style.setProperty("--mk3-map-pin-ring", visual.ringColor);
  element.style.setProperty("--mk3-map-pin-core", visual.coreColor);
  element.style.setProperty("--mk3-map-pin-halo", visual.haloColor);
  element.style.setProperty("--mk3-map-pin-halo-ring", visual.haloRingColor);
  element.style.setProperty("--mk3-map-pin-stroke-width", `${Math.max(2, Math.round(visual.strokeWidth))}px`);
  element.style.opacity = String(visual.fillOpacity);
  element.style.boxShadow = visual.shadow;
  element.style.cursor = "pointer";
  element.style.boxSizing = "border-box";
  element.style.borderRadius = "999px";
  element.style.background = "transparent";
  element.style.backfaceVisibility = "hidden";
  element.style.webkitBackfaceVisibility = "hidden";
  element.style.transition = "transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease";
};

const createAdvancedMarkerElement = (visual, title = "") => {
  const element = document.createElement("div");
  element.innerHTML = `
    <span class="mk3-map-pin__halo" aria-hidden="true"></span>
    <span class="mk3-map-pin__body" aria-hidden="true">
      <span class="mk3-map-pin__core"></span>
    </span>
    ${visual.isElevated ? '<span class="mk3-map-pin__spark" aria-hidden="true"></span>' : ""}
  `;
  applyAdvancedMarkerStyles(element, visual, title);
  return element;
};

const bindAdvancedMarkerClick = (marker, onClick, content = null) => {
  const removers = [];
  if (typeof marker?.addEventListener === "function") {
    marker.addEventListener("gmp-click", onClick);
    removers.push(() => marker.removeEventListener?.("gmp-click", onClick));
    marker.addEventListener("click", onClick);
    removers.push(() => marker.removeEventListener?.("click", onClick));
  }
  if (typeof marker?.addListener === "function") {
    const clickListener = marker.addListener("click", onClick)
      || marker.addListener("gmp-click", onClick)
      || null;
    if (clickListener?.remove) removers.push(() => clickListener.remove());
  }
  if (typeof content?.addEventListener === "function") {
    content.addEventListener("click", onClick);
    removers.push(() => content.removeEventListener?.("click", onClick));
  }
  if (!removers.length) return null;
  return {
    remove: () => removers.forEach((dispose) => dispose()),
  };
};

const disposeMapMarker = (googleMaps, markerEntry) => {
  if (!markerEntry?.marker) return;
  markerEntry.listener?.remove?.();
  if (markerEntry.kind === "advanced") {
    markerEntry.marker.map = null;
    return;
  }
  googleMaps?.event?.clearInstanceListeners?.(markerEntry.marker);
  markerEntry.marker.setMap?.(null);
};

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
const toBooleanFlag = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  const token = String(value || "").trim().toLowerCase();
  if (!token) return fallback;
  if (["1", "true", "yes", "on"].includes(token)) return true;
  if (["0", "false", "no", "off"].includes(token)) return false;
  return fallback;
};

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

const DiscoverPage = ({ navigate, mapsConfig, session, authFlow, heroStats }) => {
  const initialIsMobile = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 1120px)").matches;
  const initialRegion = initialIsMobile ? KITSAP_BOOTSTRAP_REGION : "";
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState(initialRegion);
  const [typeFilter, setTypeFilter] = useState("all");
  const [timeWindow, setTimeWindow] = useState("all");
  const [sortMode, setSortMode] = useState("smart");
  const [mapFirst, setMapFirst] = useState(true);
  const [mapOnly, setMapOnly] = useState(false);
  const [boundsOnly, setBoundsOnly] = useState(false);
  const [eventCadenceFilter, setEventCadenceFilter] = useState("all");
  const [selectedKey, setSelectedKey] = useState("");
  const [hostFilter, setHostFilter] = useState("all");
  const [beauRocksFilter, setBeauRocksFilter] = useState("all");
  const [officialRoomFilter, setOfficialRoomFilter] = useState("all");
  const [roomAccessFilter, setRoomAccessFilter] = useState("all");
  const [experienceFilter, setExperienceFilter] = useState("all");
  const [mapBounds, setMapBounds] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [rankingNowMs, setRankingNowMs] = useState(() => Date.now());
  const [isMobileViewport, setIsMobileViewport] = useState(initialIsMobile);
  const [advancedFiltersExpanded, setAdvancedFiltersExpanded] = useState(false);
  const [viewState, dispatchView] = useReducer(
    reduceDiscoverViewState,
    { isMobile: initialIsMobile },
    createDiscoverViewState
  );
  const { resultsView, mobileSurface, mobileFiltersExpanded } = viewState;

  const mapContainerRef = useRef(null);
  const mapStageRef = useRef(null);
  const mapRef = useRef(null);
  const selectedInfoWindowRef = useRef(null);
  const markerMapRef = useRef(new Map());
  const cardRefs = useRef(new Map());
  const cardRailRef = useRef(null);
  const hasAutoFitRef = useRef(false);
  const [virtualRange, setVirtualRange] = useState({
    start: 0,
    end: 0,
    padTop: 0,
    padBottom: 0,
  });
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [officialMarkerPulsePhase, setOfficialMarkerPulsePhase] = useState(0);
  const mobileBootstrapRegion = isMobileViewport ? KITSAP_BOOTSTRAP_REGION : "";
  const bootstrapMapView = useMemo(() => {
    const regionToken = String(region || "").trim().toLowerCase();
    if (regionToken === KITSAP_BOOTSTRAP_REGION) {
      return {
        center: KITSAP_BOOTSTRAP_CENTER,
        zoom: KITSAP_BOOTSTRAP_ZOOM,
      };
    }
    return {
      center: MAP_DEFAULT_CENTER,
      zoom: 4,
    };
  }, [region]);

  const {
    loading,
    loadingMore,
    error,
    data,
    rawData,
    facets,
    total,
    hasMore,
    loadMore,
  } = useDirectoryDiscover({
    search,
    region,
    listingType: typeFilter,
    timeWindow,
    sortMode: sortMode === "nearest" ? "smart" : sortMode,
    hostUid: "",
    officialRoomOnly: officialRoomFilter === "official",
    limit: isMobileViewport ? DISCOVER_DEFAULT_LIMIT_MOBILE : DISCOVER_DEFAULT_LIMIT_DESKTOP,
  });
  const permissionError = isPermissionError(error);
  const indexError = isIndexError(error);
  const mapEnabled = !!mapsConfig?.mapEnabled && !!mapsConfig?.apiKey;
  const shouldLoadMaps = mapEnabled && (!isMobileViewport || mobileSurface === "map");
  const mapsApiKey = mapEnabled ? String(mapsConfig?.apiKey || "") : "";
  const mapsMapId = mapEnabled ? String(mapsConfig?.mapId || "").trim() : "";
  const hasCloudStyledMapId = !!mapsMapId && mapsMapId !== DEMO_MAP_ID;
  const { loaded: mapsLoaded, error: mapsError } = useGoogleMapsScript({
    enabled: shouldLoadMaps,
    apiKey: String(mapsConfig?.apiKey || ""),
  });
  const discoverGoogleStaticImagesEnabled = useMemo(() => {
    const serverFlag = mapsConfig?.featureFlags?.marketing_discover_google_static_images_enabled;
    if (typeof serverFlag === "boolean" || String(serverFlag || "").trim()) {
      return toBooleanFlag(serverFlag, false);
    }
    return toBooleanFlag(ENV_DISCOVER_GOOGLE_STATIC_IMAGES_ENABLED, false);
  }, [mapsConfig]);
  const discoverGoogleStaticFallbackEnabled = useMemo(() => {
    const serverFlag = mapsConfig?.featureFlags?.marketing_discover_google_static_fallback_enabled;
    if (typeof serverFlag === "boolean" || String(serverFlag || "").trim()) {
      return toBooleanFlag(serverFlag, false);
    }
    return false;
  }, [mapsConfig]);
  // Keep static imagery traffic off unless explicitly enabled.
  const allowGoogleImageApis = mapEnabled && mapsLoaded && discoverGoogleStaticImagesEnabled;
  const venueLocationIndex = useMemo(
    () => buildVenueLocationIndex(Array.isArray(rawData?.venues) ? rawData.venues : []),
    [rawData]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setRankingNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
    const media = window.matchMedia("(max-width: 1120px)");
    const syncViewport = (matches) => {
      const isMobile = !!matches;
      setIsMobileViewport(isMobile);
      if (isMobile) setAdvancedFiltersExpanded(false);
      dispatchView({ type: "viewport_changed", isMobile });
    };
    const onViewportChange = (event) => syncViewport(event?.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onViewportChange);
      return () => media.removeEventListener("change", onViewportChange);
    }
    media.addListener(onViewportChange);
    return () => media.removeListener(onViewportChange);
  }, []);
  useEffect(() => {
    if (!mapOnly || !isMobileViewport) return;
    dispatchView({ type: "show_map" });
  }, [dispatchView, isMobileViewport, mapOnly]);

  const allListings = useMemo(() => {
    const next = [];
    data.events.forEach((entry) => {
      const resolved = resolveListingLocationData(entry, venueLocationIndex);
      next.push(toListing(entry, "event", {
        mapsApiKey,
        allowGoogleImageApis,
        allowGoogleStaticFallback: discoverGoogleStaticFallbackEnabled,
        resolvedLocation: resolved.location,
        resolvedLocationFields: resolved.locationFields,
        locationSource: resolved.locationSource,
      }));
    });
    data.sessions.forEach((entry) => {
      const resolved = resolveListingLocationData(entry, venueLocationIndex);
      next.push(toListing(entry, "room_session", {
        mapsApiKey,
        allowGoogleImageApis,
        allowGoogleStaticFallback: discoverGoogleStaticFallbackEnabled,
        resolvedLocation: resolved.location,
        resolvedLocationFields: resolved.locationFields,
        locationSource: resolved.locationSource,
      }));
    });
    data.venues.forEach((entry) => {
      const resolved = resolveListingLocationData(entry, venueLocationIndex);
      next.push(toListing(entry, "venue", {
        mapsApiKey,
        allowGoogleImageApis,
        allowGoogleStaticFallback: discoverGoogleStaticFallbackEnabled,
        resolvedLocation: resolved.location,
        resolvedLocationFields: resolved.locationFields,
        locationSource: resolved.locationSource,
      }));
    });
    return next;
  }, [allowGoogleImageApis, data.events, data.sessions, data.venues, discoverGoogleStaticFallbackEnabled, mapsApiKey, venueLocationIndex]);

  const hostFacetOptions = useMemo(() => {
    const fromServer = Array.isArray(facets?.host) ? facets.host : [];
    if (fromServer.length) {
      return fromServer
        .map((entry) => ({
          id: String(entry?.hostUid || "").trim(),
          hostUid: String(entry?.hostUid || "").trim(),
          hostName: String(entry?.hostName || "").trim() || "Host",
          count: Number(entry?.count || 0) || 0,
        }))
        .filter((entry) => !!entry.id)
        .slice(0, 16);
    }

    const byHost = new Map();
    allListings.forEach((entry) => {
      const hostUid = String(entry?.hostUid || "").trim();
      if (!hostUid) return;
      const existing = byHost.get(hostUid) || {
        id: hostUid,
        hostUid,
        hostName: String(entry?.hostName || "").trim() || "Host",
        count: 0,
      };
      existing.count += 1;
      byHost.set(hostUid, existing);
    });
    return Array.from(byHost.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 16);
  }, [allListings, facets]);
  const effectiveHostFilter = useMemo(() => {
    if (hostFilter === "all") return "all";
    return hostFacetOptions.some((entry) => entry.id === hostFilter) ? hostFilter : "all";
  }, [hostFacetOptions, hostFilter]);
  const filteredByHost = useMemo(() => {
    if (effectiveHostFilter === "all") return allListings;
    return allListings.filter((entry) => String(entry?.hostUid || "").trim() === effectiveHostFilter);
  }, [allListings, effectiveHostFilter]);
  const filteredByBeauRocks = useMemo(() => {
    if (beauRocksFilter !== "elevated") return filteredByHost;
    return filteredByHost.filter((entry) => !!entry.isBeauRocksElevated);
  }, [beauRocksFilter, filteredByHost]);
  const filteredByRoomAccess = useMemo(() => {
    if (roomAccessFilter !== "joinable") return filteredByBeauRocks;
    return filteredByBeauRocks.filter((entry) => isJoinableRoomListing(entry));
  }, [filteredByBeauRocks, roomAccessFilter]);
  const filteredByExperience = useMemo(() => {
    if (experienceFilter === "all") return filteredByRoomAccess;
    return filteredByRoomAccess.filter((entry) => matchesDirectoryExperienceFilter(entry.experience || entry, experienceFilter));
  }, [experienceFilter, filteredByRoomAccess]);
  const eventCadenceCounts = useMemo(() => {
    const counts = { total: 0, recurring: 0, one_time: 0 };
    filteredByExperience.forEach((entry) => {
      if (entry.listingType !== "event") return;
      counts.total += 1;
      if (entry.isRecurringEvent) counts.recurring += 1;
      else counts.one_time += 1;
    });
    return counts;
  }, [filteredByExperience]);
  const filteredByEventCadence = useMemo(() => {
    if (eventCadenceFilter === "all") return filteredByExperience;
    if (eventCadenceFilter === "recurring") {
      return filteredByExperience.filter((entry) => entry.listingType === "event" && entry.isRecurringEvent);
    }
    return filteredByExperience.filter((entry) => entry.listingType === "event" && !entry.isRecurringEvent);
  }, [eventCadenceFilter, filteredByExperience]);

  const rankedListings = useMemo(() => {
    const withSignals = filteredByEventCadence.map((entry) => {
      const experience = entry.experience || deriveDirectoryExperience(entry);
      const distanceMiles = calculateDistanceMiles(userLocation, entry.location);
      const distanceScore = Number.isFinite(distanceMiles)
        ? Math.max(0, 32 - (distanceMiles * 1.8))
        : 0;
      const typeBonus = entry.listingType === "event" ? 12 : entry.listingType === "room_session" ? 8 : 5;
      const elevatedBonus = entry.isOfficialBeauRocksRoom ? 32 : entry.isBeauRocksElevated ? 20 : 0;
      const score = computeTimePriority(entry.startsAtMs, rankingNowMs)
        + distanceScore
        + typeBonus
        + elevatedBonus
        + Number(experience.discoveryBoost || 0)
        + scoreSearchRelevance(entry, search);
      return {
        ...entry,
        experience,
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
    if (sortMode === "host_first") {
      const hostRanks = new Map();
      withSignals.forEach((entry) => {
        const token = String(entry?.hostToken || "").trim();
        if (!token) return;
        const existing = hostRanks.get(token) || {
          bestScore: Number.NEGATIVE_INFINITY,
          soonestMs: Number.POSITIVE_INFINITY,
          count: 0,
        };
        existing.bestScore = Math.max(existing.bestScore, Number(entry?.score || 0));
        const startsAtMs = Number(entry?.startsAtMs || 0);
        if (startsAtMs > 0) existing.soonestMs = Math.min(existing.soonestMs, startsAtMs);
        existing.count += 1;
        hostRanks.set(token, existing);
      });

      return withSignals.slice().sort((a, b) => {
        const aToken = String(a?.hostToken || "").trim();
        const bToken = String(b?.hostToken || "").trim();
        const aHasHost = !!aToken;
        const bHasHost = !!bToken;
        if (aHasHost !== bHasHost) return aHasHost ? -1 : 1;

        if (aHasHost && bHasHost && aToken !== bToken) {
          const aRank = hostRanks.get(aToken) || {
            bestScore: Number.NEGATIVE_INFINITY,
            soonestMs: Number.POSITIVE_INFINITY,
            count: 0,
          };
          const bRank = hostRanks.get(bToken) || {
            bestScore: Number.NEGATIVE_INFINITY,
            soonestMs: Number.POSITIVE_INFINITY,
            count: 0,
          };
          if (aRank.bestScore !== bRank.bestScore) return bRank.bestScore - aRank.bestScore;
          if (aRank.soonestMs !== bRank.soonestMs) return aRank.soonestMs - bRank.soonestMs;
          if (aRank.count !== bRank.count) return bRank.count - aRank.count;
          const aHostName = String(a?.hostName || "");
          const bHostName = String(b?.hostName || "");
          const hostNameCompare = aHostName.localeCompare(bHostName);
          if (hostNameCompare !== 0) return hostNameCompare;
        }

        if (aHasHost && bHasHost && aToken === bToken) {
          const withinHost = sortListings(a, b);
          if (withinHost !== 0) return withinHost;
          if (a.score !== b.score) return b.score - a.score;
          return String(a?.title || "").localeCompare(String(b?.title || ""));
        }

        if (a.score !== b.score) return b.score - a.score;
        return sortListings(a, b);
      });
    }
    return withSignals.slice().sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return sortListings(a, b);
    });
  }, [filteredByEventCadence, sortMode, userLocation, search, rankingNowMs]);

  const mappableListings = useMemo(
    () => rankedListings.filter((entry) => !!entry.location),
    [rankedListings]
  );
  useEffect(() => {
    if (!mappableListings.some((entry) => entry.isOfficialBeauRocksRoom)) return () => {};
    const timer = window.setInterval(() => {
      setOfficialMarkerPulsePhase((prev) => (prev ? 0 : 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [mappableListings]);
  const listingsInBounds = useMemo(() => {
    if (!mapBounds) return mappableListings;
    return mappableListings.filter((entry) => pointInBounds(entry.location, mapBounds));
  }, [mappableListings, mapBounds]);
  const visibleListings = useMemo(
    () => (boundsOnly ? listingsInBounds : rankedListings),
    [boundsOnly, listingsInBounds, rankedListings]
  );
  const effectiveSelectedKey = useMemo(() => {
    if (!selectedKey) return "";
    if (visibleListings.some((entry) => entry.key === selectedKey)) return selectedKey;
    return "";
  }, [visibleListings, selectedKey]);

  const listingTypeCounts = useMemo(() => {
    const counts = { venue: 0, event: 0, room_session: 0, elevated: 0 };
    rankedListings.forEach((entry) => {
      if (entry.listingType === "event") counts.event += 1;
      else if (entry.listingType === "room_session") counts.room_session += 1;
      else counts.venue += 1;
      if (entry.isBeauRocksElevated) counts.elevated += 1;
    });
    return counts;
  }, [rankedListings]);

  const selectedListing = useMemo(
    () => visibleListings.find((entry) => entry.key === effectiveSelectedKey) || null,
    [visibleListings, effectiveSelectedKey]
  );
  const selectedListingIndex = useMemo(
    () => visibleListings.findIndex((entry) => entry.key === effectiveSelectedKey),
    [visibleListings, effectiveSelectedKey]
  );
  const googleImageEligibleKeys = useMemo(() => {
    const next = new Set();
    if (!allowGoogleImageApis) return next;
    if (effectiveSelectedKey) next.add(effectiveSelectedKey);
    return next;
  }, [allowGoogleImageApis, effectiveSelectedKey]);
  const featuredListing = selectedListing;
  const useScrollableRail = resultsView === "tiles";

  const recomputeVirtualRange = useCallback(() => {
    const rail = cardRailRef.current;
    const totalItems = visibleListings.length;
    if (!rail || totalItems <= 0) {
      setVirtualRange({ start: 0, end: 0, padTop: 0, padBottom: 0 });
      return;
    }
    if (!useScrollableRail) {
      setVirtualRange({ start: 0, end: totalItems, padTop: 0, padBottom: 0 });
      return;
    }
    const estimatedRowHeight = 360;
    const itemMinWidth = 250;
    const columns = Math.max(1, Math.floor((rail.clientWidth + 10) / itemMinWidth));
    const totalRows = Math.ceil(totalItems / columns);
    const viewportHeight = Math.max(320, rail.clientHeight || 640);
    const scrollTop = Math.max(0, rail.scrollTop || 0);
    const overscanRows = 3;
    const startRow = Math.max(0, Math.floor(scrollTop / estimatedRowHeight) - overscanRows);
    const endRow = Math.min(
      totalRows,
      Math.ceil((scrollTop + viewportHeight) / estimatedRowHeight) + overscanRows
    );
    const start = startRow * columns;
    const end = Math.min(totalItems, endRow * columns);
    setVirtualRange({
      start,
      end,
      padTop: startRow * estimatedRowHeight,
      padBottom: Math.max(0, (totalRows - endRow) * estimatedRowHeight),
    });
  }, [useScrollableRail, visibleListings.length]);

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const raf = window.requestAnimationFrame(() => recomputeVirtualRange());
    return () => window.cancelAnimationFrame(raf);
  }, [recomputeVirtualRange, isMobileViewport]);

  useEffect(() => {
    const rail = cardRailRef.current;
    if (!rail || typeof window === "undefined" || !useScrollableRail) return () => {};
    let frameId = 0;
    const processRailMetrics = () => {
      frameId = 0;
      recomputeVirtualRange();
      if (hasMore && !loadingMore && (rail.scrollTop + rail.clientHeight >= rail.scrollHeight - 320)) {
        loadMore();
      }
    };
    const scheduleRailMetrics = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(processRailMetrics);
    };
    rail.addEventListener("scroll", scheduleRailMetrics, { passive: true });
    window.addEventListener("resize", scheduleRailMetrics);
    scheduleRailMetrics();
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      rail.removeEventListener("scroll", scheduleRailMetrics);
      window.removeEventListener("resize", scheduleRailMetrics);
    };
  }, [hasMore, loadMore, loadingMore, recomputeVirtualRange, useScrollableRail]);

  useEffect(() => {
    if (typeof window === "undefined" || useScrollableRail) return () => {};
    let frameId = 0;
    const checkPageBottom = () => {
      frameId = 0;
      recomputeVirtualRange();
      const doc = document.documentElement;
      const viewportBottom = window.scrollY + window.innerHeight;
      if (hasMore && !loadingMore && viewportBottom >= doc.scrollHeight - 960) {
        loadMore();
      }
    };
    const scheduleCheck = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(checkPageBottom);
    };
    window.addEventListener("scroll", scheduleCheck, { passive: true });
    window.addEventListener("resize", scheduleCheck);
    scheduleCheck();
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleCheck);
      window.removeEventListener("resize", scheduleCheck);
    };
  }, [hasMore, loadMore, loadingMore, recomputeVirtualRange, useScrollableRail]);

  const virtualListings = useMemo(() => {
    if (!visibleListings.length) return [];
    const start = Math.max(0, Number(virtualRange.start || 0));
    const end = Math.max(start, Number(virtualRange.end || 0));
    if (!end || end >= visibleListings.length) return visibleListings.slice(start);
    return visibleListings.slice(start, end);
  }, [visibleListings, virtualRange.end, virtualRange.start]);

  const resetDiscoverFilters = useCallback(() => {
    setSearch("");
    setRegion(mobileBootstrapRegion);
    setTypeFilter("all");
    setTimeWindow("all");
    setSortMode("smart");
    setHostFilter("all");
    setBeauRocksFilter("all");
    setOfficialRoomFilter("all");
    setRoomAccessFilter("all");
    setExperienceFilter("all");
    setEventCadenceFilter("all");
  }, [mobileBootstrapRegion]);

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
  const toggleMapFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        trackEvent("mk_discover_map_fullscreen_toggle", {
          source: "discover_map",
          mode: "exit",
        });
        return;
      }
      if (!mapStageRef.current || typeof mapStageRef.current.requestFullscreen !== "function") return;
      await mapStageRef.current.requestFullscreen();
      trackEvent("mk_discover_map_fullscreen_toggle", {
        source: "discover_map",
        mode: "enter",
      });
    } catch {
      // Ignore fullscreen API failures in unsupported browsers.
    }
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return () => {};
    const syncFullscreen = () => {
      const root = mapStageRef.current;
      const active = !!root && !!document.fullscreenElement
        && (document.fullscreenElement === root || root.contains(document.fullscreenElement));
      setMapFullscreen(active);
      const googleMaps = window.google?.maps;
      const map = mapRef.current;
      if (googleMaps?.event && map) {
        window.setTimeout(() => googleMaps.event.trigger(map, "resize"), 80);
      }
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

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
        setSortMode((prev) => (prev === "smart" ? "nearest" : prev));
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
    if (!selectedListing || resultsView !== "results") return;
    const node = cardRefs.current.get(selectedListing.key);
    if (!useScrollableRail) {
      node?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      return;
    }
    const rail = cardRailRef.current;
    if (!rail) return;
    const ensureVisible = () => {
      const selectedNode = cardRefs.current.get(selectedListing.key);
      if (!selectedNode) return false;
      const padding = 12;
      const itemTop = Math.max(0, selectedNode.offsetTop - padding);
      const itemBottom = selectedNode.offsetTop + selectedNode.offsetHeight + padding;
      const viewportTop = rail.scrollTop;
      const viewportBottom = rail.scrollTop + rail.clientHeight;
      if (itemTop < viewportTop || itemBottom > viewportBottom) {
        rail.scrollTo({ top: itemTop, behavior: "auto" });
      }
      return true;
    };
    if (node && ensureVisible()) return;
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    let rafOne = 0;
    let rafTwo = 0;
    rafOne = window.requestAnimationFrame(() => {
      if (ensureVisible()) return;
      rafTwo = window.requestAnimationFrame(() => {
        ensureVisible();
      });
    });
    return () => {
      if (rafOne) window.cancelAnimationFrame(rafOne);
      if (rafTwo) window.cancelAnimationFrame(rafTwo);
    };
  }, [selectedListing, selectedListingIndex, resultsView, useScrollableRail, visibleListings.length]);

  useEffect(() => {
    if (!isMobileViewport || mobileSurface !== "map") return () => {};
    const googleMaps = window.google?.maps;
    const map = mapRef.current;
    if (!googleMaps || !map) return () => {};
    const timer = window.setTimeout(() => {
      googleMaps.event.trigger(map, "resize");
      if (selectedListing?.location) map.panTo(selectedListing.location);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [isMobileViewport, mobileSurface, selectedListing]);

  useEffect(() => {
    if (!mapsLoaded || !mapEnabled || mapRef.current || !mapContainerRef.current) return;
    const googleMaps = window.google?.maps;
    if (!googleMaps || typeof googleMaps.Map !== "function") return;
    let idleListener = null;
    const frameId = window.requestAnimationFrame(() => {
      const container = mapContainerRef.current;
      if (!container || mapRef.current) return;
      const map = new googleMaps.Map(container, {
        center: bootstrapMapView.center,
        zoom: bootstrapMapView.zoom,
        minZoom: 3,
        clickableIcons: false,
        gestureHandling: "greedy",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        backgroundColor: "#020714",
        ...(hasCloudStyledMapId ? { mapId: mapsMapId } : { styles: MAP_BRAND_STYLES }),
      });
      mapRef.current = map;
      idleListener = map.addListener("idle", () => {
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
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      idleListener?.remove?.();
    };
  }, [mapsLoaded, mapEnabled, mapsMapId, hasCloudStyledMapId, bootstrapMapView]);

  useEffect(() => () => {
    const googleMaps = window.google?.maps;
    if (selectedInfoWindowRef.current) {
      selectedInfoWindowRef.current.close();
      selectedInfoWindowRef.current = null;
    }
    markerMapRef.current.forEach((markerEntry) => {
      disposeMapMarker(googleMaps, markerEntry);
    });
    markerMapRef.current.clear();
    mapRef.current = null;
  }, []);

  useEffect(() => {
    const googleMaps = window.google?.maps;
    const map = mapRef.current;
    if (!googleMaps || !map) return;

    const AdvancedMarkerElement = googleMaps?.marker?.AdvancedMarkerElement;
    const supportsAdvancedMarkers = hasCloudStyledMapId && typeof AdvancedMarkerElement === "function";
    const markerMap = markerMapRef.current;
    const nextMarkerKeys = new Set();
    mappableListings.forEach((entry) => {
      nextMarkerKeys.add(entry.key);
      const selected = entry.key === effectiveSelectedKey;
      const visual = buildMarkerVisual(
        entry.markerColor,
        selected,
        !!entry.isBeauRocksElevated,
        !!entry.isOfficialBeauRocksRoom,
        officialMarkerPulsePhase
      );
      const zIndex = selected ? 999 : entry.isBeauRocksElevated ? 320 : 180;
      let markerEntry = markerMap.get(entry.key);

      if (!markerEntry) {
        if (supportsAdvancedMarkers) {
          const content = createAdvancedMarkerElement(visual, entry.title);
          const marker = new AdvancedMarkerElement({
            map,
            position: entry.location,
            title: entry.title,
            content,
            gmpClickable: true,
            zIndex,
          });
          markerEntry = {
            kind: "advanced",
            marker,
            content,
            listener: bindAdvancedMarkerClick(marker, () => setSelectedKey(entry.key), content),
          };
        } else {
          const marker = new googleMaps.Marker({
            map,
            position: entry.location,
            title: entry.title,
            optimized: true,
          });
          markerEntry = {
            kind: "legacy",
            marker,
            listener: marker.addListener("click", () => setSelectedKey(entry.key)),
          };
        }
        markerMap.set(entry.key, markerEntry);
      } else {
        if (markerEntry.kind === "advanced") {
          markerEntry.marker.position = entry.location;
          markerEntry.marker.title = entry.title;
          markerEntry.marker.map = map;
          applyAdvancedMarkerStyles(markerEntry.content, visual, entry.title);
        } else {
          markerEntry.marker.setPosition(entry.location);
          markerEntry.marker.setTitle(entry.title);
          if (!markerEntry.marker.getMap()) markerEntry.marker.setMap(map);
          markerEntry.marker.setIcon(
            buildMarkerIcon(
              googleMaps,
              entry.markerColor,
              selected,
              !!entry.isBeauRocksElevated,
              !!entry.isOfficialBeauRocksRoom,
              officialMarkerPulsePhase
            )
          );
          markerEntry.marker.setLabel(null);
        }
      }
      if (markerEntry.kind === "advanced") {
        markerEntry.marker.zIndex = zIndex;
      } else {
        markerEntry.marker.setZIndex(zIndex);
      }
    });

    markerMap.forEach((markerEntry, key) => {
      if (nextMarkerKeys.has(key)) return;
      disposeMapMarker(googleMaps, markerEntry);
      markerMap.delete(key);
    });

    if (!hasAutoFitRef.current && mappableListings.length) {
      window.requestAnimationFrame(() => {
        if (!mapRef.current) return;
        fitMapToListings({ googleMaps, map: mapRef.current, listings: mappableListings });
      });
      hasAutoFitRef.current = true;
    }
    const selectedListingInMap = mappableListings.find((entry) => entry.key === effectiveSelectedKey);
    if (!selectedInfoWindowRef.current) {
      selectedInfoWindowRef.current = new googleMaps.InfoWindow({
        disableAutoPan: true,
        maxWidth: 240,
      });
    }
    const infoWindow = selectedInfoWindowRef.current;
    if (!selectedListingInMap) {
      infoWindow.close();
      return;
    }
    const markerEntry = markerMap.get(selectedListingInMap.key);
    if (!markerEntry?.marker) {
      infoWindow.close();
      return;
    }
    const detailLine = selectedListingInMap.timeLabel
      || selectedListingInMap.distanceLabel
      || selectedListingInMap.subtitle
      || selectedListingInMap.typeLabel;
    const statsLine = selectedListingInMap.hostLeaderboardRank > 0
      ? `Host rank #${selectedListingInMap.hostLeaderboardRank}`
      : selectedListingInMap.venueLeaderboardRank > 0
        ? `Venue rank #${selectedListingInMap.venueLeaderboardRank}`
        : "";
    const experienceLine = selectedListingInMap?.experience?.capabilityBadges?.length
      ? selectedListingInMap.experience.capabilityBadges.slice(0, 2).join(" | ")
      : selectedListingInMap?.experience?.funBadges?.slice(0, 2).join(" | ") || "";
    const elevatedBadgeImage = selectedListingInMap.isBeauRocksElevated && selectedListingInMap.officialBadgeImageUrl
      ? `<img class="mk3-map-chip-icon" src="${escapeHtml(selectedListingInMap.officialBadgeImageUrl)}" alt="Official BeauRocks logo" loading="lazy" />`
      : "";
    const elevatedBadge = selectedListingInMap.isOfficialBeauRocksRoom
      ? `<div class="mk3-chip mk3-chip-elevated mk3-map-marker-selected-badge">${elevatedBadgeImage}<span>Official BeauRocks Room</span></div>`
      : selectedListingInMap.isBeauRocksElevated
        ? `<div class="mk3-chip mk3-chip-elevated mk3-map-marker-selected-badge">${elevatedBadgeImage}<span>Featured BeauRocks Host</span></div>`
      : "";
    const selectedActionHref = buildListingActionHref(selectedListingInMap);
    const selectedActionLabel = selectedListingInMap.listingType === "room_session" && selectedListingInMap.roomCode
      ? "Open room"
      : "Open details";
    const selectedAction = selectedActionHref
      ? `<a class="mk3-map-marker-selected-action" href="${escapeHtml(selectedActionHref)}">${escapeHtml(selectedActionLabel)}</a>`
      : "";
    infoWindow.setContent(
      `<div class="mk3-map-marker-selected">
        <div class="mk3-map-marker-selected-kicker">Selected</div>
        ${elevatedBadge}
        <strong>${escapeHtml(selectedListingInMap.title)}</strong>
        <small>${escapeHtml(detailLine)}</small>
        ${statsLine ? `<small>${escapeHtml(statsLine)}</small>` : ""}
        ${experienceLine ? `<small>${escapeHtml(experienceLine)}</small>` : ""}
        ${selectedAction}
      </div>`
    );
    infoWindow.open({ map, anchor: markerEntry.marker });
  }, [mappableListings, effectiveSelectedKey, focusListing, officialMarkerPulsePhase, hasCloudStyledMapId]);

  const hiddenWithoutCoords = boundsOnly
    ? rankedListings.length - mappableListings.length
    : 0;
  const mapBoundsLabel = mapBounds
    ? `${mapBounds.south.toFixed(2)} to ${mapBounds.north.toFixed(2)} lat`
    : "Move map to define bounds";
  const activeRegionLabel = useMemo(() => {
    const token = String(region || "").trim().toLowerCase();
    if (!token) return "Nationwide";
    if (token === "nationwide") return "Nationwide";
    return humanizeRegion(token) || token;
  }, [region]);
  const officialBeauRocksRoomCount = Number(facets?.counts?.officialBeauRocksRooms || 0) || 0;
  const beauRocksElevatedCount = Number(facets?.counts?.beaurocksElevated || 0) || officialBeauRocksRoomCount;
  const joinableRoomCount = useMemo(
    () => countJoinableRoomListings(filteredByBeauRocks),
    [filteredByBeauRocks]
  );
  const experienceCounts = useMemo(() => {
    const counts = {
      modern: 0,
      interactive: 0,
      live_join: 0,
      recap: 0,
      beginner: 0,
      fast_rotation: 0,
    };
    filteredByHost.forEach((entry) => {
      const experience = entry.experience || deriveDirectoryExperience(entry);
      if (experience.isBeauRocksPowered) counts.modern += 1;
      if (matchesDirectoryExperienceFilter(experience, "interactive")) counts.interactive += 1;
      if (matchesDirectoryExperienceFilter(experience, "live_join")) counts.live_join += 1;
      if (matchesDirectoryExperienceFilter(experience, "recap")) counts.recap += 1;
      if (matchesDirectoryExperienceFilter(experience, "beginner")) counts.beginner += 1;
      if (matchesDirectoryExperienceFilter(experience, "fast_rotation")) counts.fast_rotation += 1;
    });
    return counts;
  }, [filteredByHost]);
  const hasFullAccount = !!session?.isAuthed && !session?.isAnonymous;
  const resultCount = (Number(total || 0) || visibleListings.length);
  const isInitialCountLoading = loading && !error && resultCount <= 0;
  const resultCountLabel = isInitialCountLoading ? "Loading" : resultCount.toLocaleString();
  const hasSearchFilters = !!String(search || "").trim()
    || !!String(region || "").trim()
    || typeFilter !== "all"
    || effectiveHostFilter !== "all"
    || beauRocksFilter !== "all"
    || sortMode !== "smart"
    || timeWindow !== "all"
    || eventCadenceFilter !== "all"
    || officialRoomFilter !== "all"
    || roomAccessFilter !== "all"
    || experienceFilter !== "all";
  const activeFilterBadges = useMemo(() => {
    const next = [];
    const searchToken = String(search || "").trim();
    if (searchToken) {
      const clipped = searchToken.length > 24 ? `${searchToken.slice(0, 24)}...` : searchToken;
      next.push(`Search: "${clipped}"`);
    }
    const regionToken = String(region || "").trim().toLowerCase();
    if (regionToken && regionToken !== "nationwide") {
      next.push(`Region: ${activeRegionLabel}`);
    }
    if (typeFilter !== "all" && TYPE_FILTER_LABELS[typeFilter]) {
      next.push(`Type: ${TYPE_FILTER_LABELS[typeFilter]}`);
    }
    if (sortMode !== "smart" && SORT_MODE_LABELS[sortMode]) {
      next.push(`Rank: ${SORT_MODE_LABELS[sortMode]}`);
    }
    if (timeWindow !== "all") {
      const timeLabel = TIME_WINDOW_OPTIONS.find((option) => option.id === timeWindow)?.label || timeWindow;
      next.push(`Time: ${timeLabel}`);
    }
    if (eventCadenceFilter !== "all") {
      const cadenceLabel = EVENT_CADENCE_OPTIONS.find((option) => option.id === eventCadenceFilter)?.label || eventCadenceFilter;
      next.push(`Events: ${cadenceLabel}`);
    }
    if (beauRocksFilter === "elevated") next.push("Featured: Official BeauRocks Rooms");
    if (officialRoomFilter === "official") next.push("Room: Official");
    if (roomAccessFilter === "joinable") next.push("Access: Joinable by code");
    if (experienceFilter !== "all") {
      const label = EXPERIENCE_FILTER_OPTIONS.find((option) => option.id === experienceFilter)?.label || experienceFilter;
      next.push(`Experience: ${label}`);
    }
    if (effectiveHostFilter !== "all") {
      const hostName = hostFacetOptions.find((host) => host.id === effectiveHostFilter)?.hostName || "Selected host";
      next.push(`Host: ${hostName}`);
    }
    return next;
  }, [
    activeRegionLabel,
    beauRocksFilter,
    effectiveHostFilter,
    hostFacetOptions,
    officialRoomFilter,
    region,
    roomAccessFilter,
    experienceFilter,
    search,
    sortMode,
    timeWindow,
    eventCadenceFilter,
    typeFilter,
  ]);
  const filterStackClasses = [
    "mk3-discover-filter-stack",
    isMobileViewport && !mobileFiltersExpanded ? "is-collapsed" : "",
    !isMobileViewport && !advancedFiltersExpanded ? "is-advanced-collapsed" : "",
  ].filter(Boolean).join(" ");
  const dynamicRegionPresets = useMemo(() => {
    const regionFacets = Array.isArray(facets?.region) ? facets.region : [];
    const ranked = regionFacets
      .map((entry) => {
        const id = String(entry?.id || "").trim().toLowerCase();
        return {
          id,
          label: humanizeRegion(id) || id,
          count: Number(entry?.count || 0) || 0,
        };
      })
      .filter((entry) => !!entry.id && entry.id !== "nationwide")
      .slice(0, 14);
    if (!ranked.length) {
      return MARKETING_REGION_PRESETS.map((preset) => ({
        ...preset,
        count: 0,
      }));
    }
    return [{ id: "nationwide", label: "Nationwide", count: total }, ...ranked];
  }, [facets, total]);

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
      resetDiscoverFilters();
      setRegion("nationwide");
      return;
    }
    if (intent === "submit_listing") {
      navigate("submit", "", { intent: "listing_submit" });
      return;
    }
    navigate("discover");
  };

  const heroPulseLabel = heroStats?.generatedAtMs
    ? `Updated ${formatDateTime(heroStats.generatedAtMs)}`
    : isInitialCountLoading
      ? "Syncing the live directory now"
      : `Live now in ${activeRegionLabel}`;
  const openHostAccess = () => {
    trackEvent("mk_discover_premium_hero_host_access_click", { source: "discover_premium_hero" });
    navigate("host_access");
  };
  const openJoinPage = () => {
    trackEvent("mk_discover_premium_hero_join_click", { source: "discover_premium_hero" });
    navigate("join");
  };
  const openListingSubmission = () => {
    trackEvent("mk_discover_premium_hero_list_click", { source: "discover_premium_hero" });
    navigate("submit", "", { intent: "listing_submit", targetType: "venue" });
  };
  const renderDiscoverFilters = () => (
    <>
      <div className={filterStackClasses}>
        <div className="mk3-filter-row mk3-discover-filters mk3-zone mk3-zone-filters">
          <label className="mk3-discover-filter-basic">
            Search
            <input
              value={search}
              placeholder="Host, venue, city, or vibe"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="mk3-discover-filter-basic">
            Region
            <input
              value={region}
              placeholder="Nationwide, or pick a preset below"
              onChange={(event) => setRegion(event.target.value)}
            />
          </label>
          <label className="mk3-discover-filter-advanced-field">
            Type
            <select
              value={typeFilter}
              onChange={(event) => {
                const nextType = event.target.value;
                setTypeFilter(nextType);
                if (nextType !== "room_session" && roomAccessFilter === "joinable") {
                  setRoomAccessFilter("all");
                }
                if (nextType !== "event" && eventCadenceFilter !== "all") {
                  setEventCadenceFilter("all");
                }
              }}
            >
              <option value="all">All</option>
              <option value="event">Events</option>
              <option value="venue">Venues</option>
              <option value="room_session">Room Sessions</option>
            </select>
          </label>
          <label className="mk3-discover-filter-advanced-field">
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
              <option value="host_first">Host-first</option>
            </select>
          </label>
          {!isMobileViewport && (
            <div className="mk3-discover-filter-meta">
              <button
                type="button"
                className={`mk3-discover-filter-toggle ${advancedFiltersExpanded ? "active" : ""}`}
                onClick={() => {
                  setAdvancedFiltersExpanded((prev) => !prev);
                  trackEvent("mk_discover_advanced_toggle", {
                    source: "discover_filters",
                    expanded: !advancedFiltersExpanded,
                  });
                }}
              >
                {advancedFiltersExpanded ? "Hide advanced" : "Advanced filters"}
              </button>
              {hasSearchFilters && (
                <button
                  type="button"
                  className="mk3-discover-filter-clear"
                  onClick={resetDiscoverFilters}
                >
                  Clear all
                </button>
              )}
            </div>
          )}
          <div className="mk3-discover-fast-start">
            <span className="mk3-filter-chip-label">Popular shortcuts</span>
            <button
              type="button"
              className={`mk3-discover-fast-chip ${officialRoomFilter === "official" ? "active" : ""}`}
              onClick={() => {
                setTypeFilter("room_session");
                setOfficialRoomFilter("official");
                trackEvent("mk_discover_official_room_filter_change", {
                  source: "discover_quick_filters",
                  mode: "official_only",
                });
              }}
            >
              Official BeauRocks Rooms
              {officialBeauRocksRoomCount > 0 && <span className="mk3-filter-chip-count"> ({officialBeauRocksRoomCount})</span>}
            </button>
            <button
              type="button"
              className={`mk3-discover-fast-chip ${roomAccessFilter === "joinable" ? "active" : ""}`}
              onClick={() => {
                setTypeFilter("room_session");
                setRoomAccessFilter("joinable");
                trackEvent("mk_discover_room_access_filter_change", {
                  source: "discover_quick_filters",
                  mode: "joinable_only",
                });
              }}
            >
              Joinable by code
              {joinableRoomCount > 0 && <span className="mk3-filter-chip-count"> ({joinableRoomCount})</span>}
            </button>
            <button
              type="button"
              className={`mk3-discover-fast-chip ${experienceFilter === "modern" ? "active" : ""}`}
              onClick={() => {
                setExperienceFilter("modern");
                trackEvent("mk_discover_experience_filter_change", {
                  source: "discover_quick_filters",
                  filter: "modern",
                });
              }}
            >
              Modern karaoke
              {experienceCounts.modern > 0 && <span className="mk3-filter-chip-count"> ({experienceCounts.modern})</span>}
            </button>
          </div>
        </div>
        {hasSearchFilters && (
          <div className="mk3-filter-chips mk3-zone mk3-zone-time mk3-discover-active-row">
            <span className="mk3-filter-chip-label">Active filters</span>
            {activeFilterBadges.map((badge) => (
              <span key={badge} className="mk3-discover-active-chip">{badge}</span>
            ))}
            <button
              type="button"
              className="mk3-discover-active-clear"
              onClick={resetDiscoverFilters}
            >
              Clear all
            </button>
          </div>
        )}
        <div className="mk3-filter-chips mk3-zone mk3-zone-time mk3-discover-filter-advanced">
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
        <div className="mk3-filter-chips mk3-zone mk3-zone-time mk3-discover-filter-advanced">
          <span className="mk3-filter-chip-label">Event cadence</span>
          {EVENT_CADENCE_OPTIONS.map((option) => {
            const count = option.id === "recurring"
              ? eventCadenceCounts.recurring
              : option.id === "one_time"
                ? eventCadenceCounts.one_time
                : eventCadenceCounts.total;
            return (
              <button
                key={option.id}
                type="button"
                className={eventCadenceFilter === option.id ? "active" : ""}
                onClick={() => {
                  setEventCadenceFilter(option.id);
                  if (option.id !== "all") setTypeFilter("event");
                  trackEvent("mk_discover_event_cadence_filter_change", {
                    source: "discover_filters",
                    cadence: option.id,
                  });
                }}
              >
                {option.label}
                {count > 0 && <span className="mk3-filter-chip-count"> ({count})</span>}
              </button>
            );
          })}
        </div>
        <div className="mk3-filter-chips mk3-zone mk3-zone-region mk3-discover-filter-advanced">
          {dynamicRegionPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={String(region).trim().toLowerCase() === preset.id ? "active" : ""}
              onClick={() => setRegion(preset.id)}
            >
              {preset.label}
              {Number(preset.count || 0) > 0 && <span className="mk3-filter-chip-count">{preset.count}</span>}
            </button>
          ))}
        </div>
        <div className="mk3-filter-chips mk3-zone mk3-zone-host mk3-discover-filter-advanced">
          <span className="mk3-filter-chip-label">Featured</span>
          <button
            type="button"
            className={beauRocksFilter === "all" ? "active" : ""}
            onClick={() => setBeauRocksFilter("all")}
          >
            All listings
          </button>
          <button
            type="button"
            className={beauRocksFilter === "elevated" ? "active" : ""}
            onClick={() => {
              setBeauRocksFilter("elevated");
              trackEvent("mk_discover_beaurocks_filter_change", {
                source: "discover_filters",
                mode: "elevated_only",
              });
            }}
          >
            Official spotlight
            {beauRocksElevatedCount > 0 && <span className="mk3-filter-chip-count"> ({beauRocksElevatedCount})</span>}
          </button>
        </div>
        <div className="mk3-filter-chips mk3-zone mk3-zone-host mk3-discover-filter-advanced">
          <span className="mk3-filter-chip-label">Room filters</span>
          <button
            type="button"
            className={typeFilter === "room_session" && officialRoomFilter === "all" && roomAccessFilter === "all" ? "active" : ""}
            onClick={() => {
              setTypeFilter("room_session");
              setOfficialRoomFilter("all");
              setRoomAccessFilter("all");
            }}
          >
            All rooms
          </button>
          <button
            type="button"
            className={officialRoomFilter === "official" ? "active" : ""}
            onClick={() => {
              setTypeFilter("room_session");
              setOfficialRoomFilter("official");
              trackEvent("mk_discover_official_room_filter_change", {
                source: "discover_filters",
                mode: "official_only",
              });
            }}
          >
            Official BeauRocks Rooms
            {officialBeauRocksRoomCount > 0 && <span className="mk3-filter-chip-count"> ({officialBeauRocksRoomCount})</span>}
          </button>
          <button
            type="button"
            className={roomAccessFilter === "all" ? "active" : ""}
            onClick={() => setRoomAccessFilter("all")}
          >
            Any access
          </button>
          <button
            type="button"
            className={roomAccessFilter === "joinable" ? "active" : ""}
            onClick={() => {
              setRoomAccessFilter("joinable");
              setTypeFilter("room_session");
              trackEvent("mk_discover_room_access_filter_change", {
                source: "discover_filters",
                mode: "joinable_only",
              });
            }}
          >
            Joinable by code
            {joinableRoomCount > 0 && <span className="mk3-filter-chip-count"> ({joinableRoomCount})</span>}
          </button>
        </div>
        <div className="mk3-filter-chips mk3-zone mk3-zone-host mk3-discover-filter-advanced">
          <span className="mk3-filter-chip-label">Experience</span>
          {EXPERIENCE_FILTER_OPTIONS.map((option) => {
            const count = option.id === "all"
              ? filteredByHost.length
              : Number(experienceCounts[option.id] || 0);
            return (
              <button
                key={option.id}
                type="button"
                className={experienceFilter === option.id ? "active" : ""}
                onClick={() => {
                  setExperienceFilter(option.id);
                  trackEvent("mk_discover_experience_filter_change", {
                    source: "discover_filters",
                    filter: option.id,
                  });
                }}
              >
                {option.label}
                {count > 0 && <span className="mk3-filter-chip-count"> ({count})</span>}
              </button>
            );
          })}
        </div>
        {hostFacetOptions.length > 0 && (
          <div className="mk3-filter-chips mk3-zone mk3-zone-host mk3-discover-filter-advanced">
            <span className="mk3-filter-chip-label">Host</span>
            <button
              type="button"
              className={effectiveHostFilter === "all" ? "active" : ""}
              onClick={() => setHostFilter("all")}
            >
              All hosts
            </button>
            {hostFacetOptions.map((host) => (
              <button
                key={host.id}
                type="button"
                className={effectiveHostFilter === host.id ? "active" : ""}
                onClick={() => {
                  setHostFilter(host.id);
                  trackEvent("mk_discover_host_filter_change", {
                    source: "discover_filters",
                    hostToken: host.id,
                    hostUid: host.hostUid || "",
                  });
                }}
              >
                {host.hostName} ({host.count})
              </button>
            ))}
          </div>
        )}
      </div>
      {geoError && <div className="mk3-status mk3-status-warning">{geoError}</div>}
    </>
  );

  return (
    <section className="mk3-page">
      <div className="mk3-status mk3-zone mk3-zone-finder mk3-discover-hero mk3-discover-intro">
        <div className="mk3-discover-hero-main">
          <strong>Find a karaoke night worth leaving the house for.</strong>
          <span>
            {isInitialCountLoading
              ? `Loading the live directory in ${activeRegionLabel}...`
              : `The map is the main event. Start there, then tighten the filters if you want to get picky about host, venue, city, or vibe.`}
          </span>
          <div className="mk3-discover-hero-stats">
            <span>{isInitialCountLoading ? "Syncing live directory..." : `${resultCountLabel} results`}</span>
            {officialBeauRocksRoomCount > 0 && <span>{officialBeauRocksRoomCount} official rooms</span>}
            {joinableRoomCount > 0 && <span>{joinableRoomCount} joinable by code</span>}
            <span>{heroPulseLabel}</span>
          </div>
        </div>
        <div className="mk3-finder-cta-row mk3-discover-intro-actions">
          <button
            type="button"
            className="mk3-discover-hero-cta-primary"
            onClick={openHostAccess}
          >
            {hasFullAccount ? "Open Host Access" : "Request Host Access"}
          </button>
          <button
            type="button"
            className="mk3-discover-hero-cta-secondary"
            onClick={openJoinPage}
          >
            Join with code
          </button>
          <button
            type="button"
            className="mk3-discover-hero-cta-tertiary"
            onClick={openListingSubmission}
          >
            List a public room
          </button>
        </div>
      </div>
      {isMobileViewport && (
        <div className="mk3-mobile-discover-switch mk3-zone mk3-zone-mobile-controls">
          <button
            type="button"
            className={mobileSurface === "map" ? "active" : ""}
            onClick={() => {
              dispatchView({ type: "show_map" });
            }}
          >
            Map ({mappableListings.length})
          </button>
          <button
            type="button"
            className={mobileSurface === "list" ? "active" : ""}
            onClick={() => {
              if (mapOnly) setMapOnly(false);
              dispatchView({ type: "show_list" });
            }}
          >
            Results ({visibleListings.length})
          </button>
          <button
            type="button"
            className={mobileFiltersExpanded ? "active" : ""}
            onClick={() => dispatchView({ type: "toggle_filters" })}
          >
            {mobileFiltersExpanded ? "Hide Filters" : "Show Filters"}
          </button>
        </div>
      )}
      <div className={`mk3-discover-shell ${mapFirst ? "is-map-first" : "is-balanced"} ${mapOnly ? "is-map-only" : ""} ${isMobileViewport ? `is-mobile-surface-${mobileSurface}` : ""}`}>
        <article className={`mk3-map-card mk3-zone mk3-zone-map ${isMobileViewport && mobileSurface !== "map" ? "is-mobile-hidden" : ""}`}>
          <h2>{FINDER_BRAND} Map</h2>
          <div className={`mk3-map-toolbar ${isMobileViewport ? "is-mobile-compact" : ""}`}>
            {!isMobileViewport && (
              <label className="mk3-inline">
                <input
                  type="checkbox"
                  checked={boundsOnly}
                  onChange={(event) => setBoundsOnly(event.target.checked)}
                />
                Bounds-only list
              </label>
            )}
            {!isMobileViewport && (
              <button type="button" onClick={recenterMap} disabled={!mappableListings.length || !mapsLoaded}>
                Recenter to markers
              </button>
            )}
            <button
              type="button"
              onClick={requestUserLocation}
              disabled={geoLoading}
            >
              {geoLoading ? "Locating..." : userLocation ? "Refresh my location" : "Use my location"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMapOnly((prev) => !prev);
                if (!mapOnly && isMobileViewport) dispatchView({ type: "show_map" });
                trackEvent("mk_discover_map_only_toggle", {
                  source: "discover_map",
                  mode: mapOnly ? "off" : "on",
                });
              }}
            >
              {mapOnly ? "Show results rail" : "Map only"}
            </button>
            <button
              type="button"
              onClick={toggleMapFullscreen}
              disabled={!mapEnabled || !mapsLoaded}
            >
              {mapFullscreen ? "Exit fullscreen" : "Fullscreen map"}
            </button>
            {isMobileViewport ? (
              <button type="button" onClick={() => dispatchView({ type: "show_list" })}>
                Show list
              </button>
            ) : (
              <button type="button" onClick={() => setMapFirst((prev) => !prev)}>
                {mapFirst ? "Balanced layout" : "Map-first layout"}
              </button>
            )}
          </div>

          {!mapEnabled && (
            <div className="mk3-status">
              Live map is off in config right now, but browsing still works.
            </div>
          )}
          {!!mapsError && <div className="mk3-status mk3-status-error">{mapsError}</div>}

          <div className="mk3-map-stage" ref={mapStageRef}>
            {mapEnabled && mapsLoaded ? (
              <div ref={mapContainerRef} className="mk3-map-canvas" />
            ) : (
              <div className="mk3-map-grid">
                <div className="mk3-map-placeholder">{mapEnabled ? "Loading live map..." : "Map unavailable."}</div>
              </div>
            )}
            <div className="mk3-map-stage-overlay">
              <div className="mk3-map-legend" aria-label="Map legend">
                <span className="mk3-map-legend-item is-event">Events {listingTypeCounts.event}</span>
                <span className="mk3-map-legend-item is-venue">Venues {listingTypeCounts.venue}</span>
                <span className="mk3-map-legend-item is-session">Sessions {listingTypeCounts.room_session}</span>
                <span className="mk3-map-legend-item is-elevated">Featured BeauRocks {listingTypeCounts.elevated}</span>
                {userLocation && <span className="mk3-map-legend-item is-you">You are centered</span>}
              </div>
              {mapEnabled && mapsLoaded && mappableListings.length > 0
                && !mappableListings.some((entry) => entry.key === effectiveSelectedKey) && (
                <div className="mk3-map-discovery-hint" role="status" aria-live="polite">
                  <span>{mappableListings.length.toLocaleString()} map pins ready. Recenter to zoom in and tap a pin.</span>
                  <button type="button" onClick={recenterMap}>Recenter</button>
                </div>
              )}
            </div>
          </div>

          <div className="mk3-map-footer">
              <span>{mapOnly ? `${mappableListings.length} shown on map` : `${visibleListings.length} shown in rail`}</span>
              <span>{featuredListing ? `selected: ${featuredListing.title}` : "select a marker or card"}</span>
              <span className="mk3-map-footer-bounds">{mapBoundsLabel}</span>
            </div>
          </article>

        <aside className={`mk3-feed-column mk3-zone mk3-zone-rail ${isMobileViewport && mobileSurface !== "list" ? "is-mobile-hidden" : ""} ${mapOnly ? "is-map-only-hidden" : ""}`}>
          <div className="mk3-rail-head">
            <strong>Results</strong>
            <div className="mk3-rail-head-meta">
              <span>{visibleListings.length} shown{Number(total || 0) > visibleListings.length ? ` of ${Number(total || 0)}` : ""}</span>
              <div className="mk3-rail-view-toggle" role="group" aria-label="Results display mode">
                <button
                  type="button"
                  className={resultsView === "results" ? "active" : ""}
                  onClick={() => dispatchView({ type: "set_results_view", value: "results" })}
                >
                  Results
                </button>
                <button
                  type="button"
                  className={resultsView === "tiles" ? "active" : ""}
                  onClick={() => dispatchView({ type: "set_results_view", value: "tiles" })}
                >
                  Tiles
                </button>
              </div>
            </div>
            {isMobileViewport && (
              <button type="button" onClick={() => dispatchView({ type: "show_map" })}>
                Open map
              </button>
            )}
          </div>
          {loading && <div className="mk3-status">Loading listings...</div>}
          {!loading && !!error && !permissionError && !indexError && (
            <div className="mk3-status mk3-status-error">{error}</div>
          )}
          {!loading && indexError && (
            <div className="mk3-status mk3-status-warning">
              <strong>The directory is still warming up.</strong>
              <span>Give it about a minute while indexes finish syncing.</span>
              <div className="mk3-actions-inline">
                <button type="button" onClick={() => window.location.reload()}>
                  Refresh now
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

          <div
            ref={cardRailRef}
            className={`mk3-card-list mk3-card-rail ${resultsView === "tiles" ? "mk3-card-tiles" : "mk3-card-results"}`}
          >
            {useScrollableRail && virtualRange.padTop > 0 && <div style={{ height: `${virtualRange.padTop}px` }} aria-hidden="true" />}
            {(useScrollableRail ? virtualListings : visibleListings).map((entry) => {
              const googleCandidates = Array.isArray(entry.googleImageCandidates)
                ? entry.googleImageCandidates
                : [];
              const useGoogleImages = googleImageEligibleKeys.has(entry.key) && googleCandidates.length > 0;
              const cardEntry = useGoogleImages
                ? {
                  ...entry,
                  imageUrl: googleCandidates[0],
                  imageFallbackUrls: dedupeUrls([
                    ...googleCandidates.slice(1),
                    entry.imageUrl,
                    ...(Array.isArray(entry.imageFallbackUrls) ? entry.imageFallbackUrls : []),
                  ]),
                }
                : entry;
              return (
                <DiscoverListingCard
                key={entry.key}
                entry={cardEntry}
                isSelected={entry.key === effectiveSelectedKey}
                isMobileViewport={isMobileViewport}
                mapsLoaded={mapsLoaded}
                registerCardRef={registerCardRef}
                onImageError={applyFallbackImage}
                onFocus={(item) => {
                  if (isMobileViewport) dispatchView({ type: "show_map" });
                  focusListing(item, { pan: true, zoom: true });
                  trackEvent("mk_discover_focus_marker", {
                    source: "discover_rail",
                    listingType: item.listingType,
                    listingId: item.id,
                    sortMode,
                  });
                }}
                onOpenDetails={(item) => {
                  trackEvent("mk_discover_open_details", {
                    source: "discover_rail",
                    listingType: item.listingType,
                    listingId: item.id,
                    sortMode,
                  });
                  navigate(item.routePage, item.id, {
                    src: "discover",
                    src_listing_type: item.listingType,
                    src_sort_mode: sortMode,
                  });
                }}
                onJoinRoom={(item) => {
                  trackEvent("mk_discover_join_room", {
                    source: "discover_rail",
                    roomCode: item.roomCode,
                  });
                  navigate("join", item.roomCode, {
                    roomCode: item.roomCode,
                    src: "discover_join_room",
                    src_listing_type: item.listingType,
                  });
                }}
              />
              );
            })}
            {useScrollableRail && virtualRange.padBottom > 0 && <div style={{ height: `${virtualRange.padBottom}px` }} aria-hidden="true" />}
            {loadingMore && <div className="mk3-status">Loading more listings...</div>}
            {hasMore && !loadingMore && (
              <div className="mk3-actions-inline">
                <button type="button" onClick={loadMore}>
                  Load more
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
      {renderDiscoverFilters()}
    </section>
  );
};

export default DiscoverPage;

