import { deriveDirectoryExperience } from "../lib/directoryExperience";
import {
  MARKETING_BRAND_BADGE_URL,
  buildPublicLocationImageUrl,
  extractCadenceBadges,
  formatDateTime,
  resolveListingImageCandidates,
  resolveProfileAvatarUrl,
} from "./shared";
import { normalizeListingType } from "./discoverListingTypes";

const MAP_TYPE_META = {
  venue: { label: "venue", routePage: "venue", markerColor: "#26d7e8" },
  event: { label: "event", routePage: "event", markerColor: "#f1c76f" },
  room_session: { label: "room session", routePage: "session", markerColor: "#ff4fae" },
};

const OFFICIAL_ROOM_MARKER_COLOR = "#ff4fae";
const PLACEHOLDER_SCREEN_IMAGE_TOKENS = [
  "/images/marketing/app-landing-live.png",
  "/images/marketing/audience-surface-live.png",
  "/images/marketing/tv-surface-live.png",
  "/images/marketing/beaurocks-hostpanel.png",
  "/images/marketing/beaurocks-audienceapp.png",
  MARKETING_BRAND_BADGE_URL,
  "/images/logo-library/beaurocks-karaoke-logo-2.png",
  "/images/logo-library/bross-entertainment",
];

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

const isScreenPlaceholderImage = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (!token) return false;
  return PLACEHOLDER_SCREEN_IMAGE_TOKENS.some((entry) => token.includes(entry));
};

const dedupeUrls = (entries = []) =>
  entries.filter((value, index, array) => String(value || "").trim() && array.indexOf(value) === index);

const sanitizeMediaUrl = (value = "") => {
  const token = String(value || "").trim();
  if (!token) return "";
  if (token.startsWith("/")) return token;
  if (/^https?:\/\//i.test(token)) return token.replace(/^http:\/\//i, "https://");
  return "";
};

export const buildDiscoverListing = (entry = {}, fallbackType = "venue", options = {}) => {
  const mapsApiKey = String(options?.mapsApiKey || "").trim();
  const allowGoogleImageApis = options?.allowGoogleImageApis !== false;
  const allowGoogleStaticFallback = options?.allowGoogleStaticFallback === true;
  const listingType = normalizeListingType(entry?.listingType || fallbackType);
  const meta = MAP_TYPE_META[listingType] || MAP_TYPE_META.venue;
  const location = options?.resolvedLocation || null;
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
    entry?.officialBadgeImageUrl
    || entry?.logoUrl
    || entry?.hostLogoUrl
    || entry?.brandLogoUrl
    || entry?.branding?.logoUrl
    || avatarUrl
    || imageUrl
    || MARKETING_BRAND_BADGE_URL
  );
  const locationLabel = [city, state, address1].filter(Boolean).join(", ");
  const roomCode = String(entry?.roomCode || "").trim().toUpperCase();
  const virtualOnly = !!entry?.virtualOnly
    || !!entry?.isVirtualOnly
    || String(entry?.sessionMode || "").trim().toLowerCase() === "virtual";
  const isOfficialBeauRocksListing = !!entry?.isOfficialBeauRocksListing || !!entry?.isOfficialBeauRocksRoom;
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
  const isBeauRocksElevated = !!entry?.isBeauRocksElevated || isOfficialBeauRocksListing;
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
    isOfficialBeauRocksListing,
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
    officialBeauRocksStatus: String(entry?.officialBeauRocksStatus || "").trim().toLowerCase(),
    officialBeauRocksStatusLabel: String(entry?.officialBeauRocksStatusLabel || "").trim(),
    isOfficialBeauRocksListing,
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
