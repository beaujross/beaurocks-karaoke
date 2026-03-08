export const MARKETING_BRAND_BADGE_URL = "/images/marketing/beaurocks-karaoke-logo 2.png";
export const MARKETING_DJ_BEAUROCKS_AVATAR_URL = "/images/marketing/bross-host-beaurocks.png";

export const isBeauRocksPoweredListing = (entity = {}) => {
  const safe = entity && typeof entity === "object" ? entity : {};
  return !!safe?.isOfficialBeauRocksRoom
    || !!safe?.isBeauRocksElevated
    || !!safe?.hasBeauRocksHostAccount
    || !!safe?.hasBeauRocksHostPlan
    || (Array.isArray(safe?.beauRocksCapabilities) && safe.beauRocksCapabilities.length > 0);
};

export const getBeauRocksBadgeLabel = (entity = {}, { defaultLabel = "BeauRocks-powered" } = {}) => {
  const safe = entity && typeof entity === "object" ? entity : {};
  const listingType = String(safe?.listingType || "").trim().toLowerCase();
  if (listingType === "room_session" && !!safe?.isOfficialBeauRocksRoom) return "Official BeauRocks Room";
  if (listingType === "host") return "BeauRocks Host";
  if (listingType === "venue") return "BeauRocks Venue";
  if (listingType === "event") return "Hosted with BeauRocks";
  if (listingType === "room_session") return "BeauRocks Room";
  return defaultLabel;
};

export const formatDateTime = (ms = 0) => {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return "TBD";
  try {
    return new Date(value).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "TBD";
  }
};

export const buildGoogleMapsSearchUrl = (parts = []) => {
  const source = Array.isArray(parts) ? parts : [parts];
  const query = source
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .join(", ");
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export const toTelephoneHref = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "";
  return `tel:${hasPlus ? "+" : ""}${digits}`;
};

const MARKETING_IMAGE_FALLBACKS = {
  venue: [
    "/images/marketing/venue-location-fallback.svg",
  ],
  event: [
    "/images/marketing/venue-location-fallback.svg",
  ],
  host: [
    "/images/marketing/BeauRocks-HostPanel.png",
    "/images/marketing/venue-location-fallback.svg",
  ],
  performer: [
    "/images/marketing/BeauRocks-Audienceapp.png",
    "/images/marketing/venue-location-fallback.svg",
  ],
  session: [
    "/images/marketing/venue-location-fallback.svg",
  ],
  default: [
    "/images/marketing/venue-location-fallback.svg",
  ],
};

const MARKETING_PLACEHOLDER_IMAGE_TOKENS = [
  "/images/marketing/venue-location-fallback.svg",
  "/images/marketing/app-landing-live.png",
  "/images/marketing/audience-surface-live.png",
  "/images/marketing/tv-surface-live.png",
  "/images/marketing/beaurocks-hostpanel.png",
  "/images/marketing/beaurocks-audienceapp.png",
  MARKETING_BRAND_BADGE_URL,
  "/images/logo-library/beaurocks-karaoke-logo-2.png",
  "/images/logo-library/bross-entertainment",
];

const normalizeMediaCandidateUrl = (raw = "") => {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^http:\/\//i, "https://");
  }
  return "";
};

const isPlaceholderMediaCandidate = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (!token) return false;
  return MARKETING_PLACEHOLDER_IMAGE_TOKENS.some((entry) => token.includes(entry));
};

const normalizeLocation = (entity = {}) => {
  const source = entity && typeof entity === "object" ? entity : {};
  const location = source?.location || source?.latLng || source?.coordinates || {};
  const lat = Number(location?.lat ?? source?.lat ?? source?.latitude);
  const lng = Number(location?.lng ?? source?.lon ?? source?.lng ?? source?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
};

export const buildPublicLocationImageUrl = (entity = {}) => {
  const location = normalizeLocation(entity);
  if (!location) return "";
  // External OSM static-map endpoint has become unreliable for this project.
  // Return an internal fallback image to avoid noisy failed-network requests.
  return "/images/marketing/venue-location-fallback.svg";
};

const WEEKDAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_ALIAS_TO_LABEL = {
  sunday: "Sun",
  sun: "Sun",
  monday: "Mon",
  mon: "Mon",
  tuesday: "Tue",
  tue: "Tue",
  wednesday: "Wed",
  wed: "Wed",
  thursday: "Thu",
  thu: "Thu",
  friday: "Fri",
  fri: "Fri",
  saturday: "Sat",
  sat: "Sat",
};
const WEEKDAY_SCAN_RE = /\b(sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)\b/gi;

export const extractCadenceBadges = ({ karaokeNightsLabel = "", recurringRule = "", startsAtMs = 0, max = 4 } = {}) => {
  const text = `${String(karaokeNightsLabel || "")} ${String(recurringRule || "")}`.trim();
  const seen = new Set();
  const out = [];
  if (text) {
    const matches = [...text.matchAll(WEEKDAY_SCAN_RE)];
    matches.forEach((match) => {
      const token = String(match?.[1] || "").toLowerCase();
      const label = WEEKDAY_ALIAS_TO_LABEL[token];
      if (!label || seen.has(label)) return;
      seen.add(label);
      out.push(label);
    });
  }
  if (!out.length) {
    const starts = Number(startsAtMs || 0);
    if (Number.isFinite(starts) && starts > 0) {
      const dayLabel = WEEKDAY_ORDER[new Date(starts).getDay()] || "";
      if (dayLabel) out.push(dayLabel);
    }
  }
  if (out.length <= 1) return out.slice(0, Math.max(1, Number(max || 4)));
  const sortIndex = (label = "") => WEEKDAY_ORDER.indexOf(String(label || "").slice(0, 3));
  return out
    .slice()
    .sort((a, b) => sortIndex(a) - sortIndex(b))
    .slice(0, Math.max(1, Number(max || 4)));
};

const appendMediaCandidate = (list = [], raw = "") => {
  if (!Array.isArray(list)) return;
  if (Array.isArray(raw)) {
    raw.forEach((entry) => appendMediaCandidate(list, entry));
    return;
  }
  if (raw && typeof raw === "object") {
    appendMediaCandidate(list, raw.url);
    appendMediaCandidate(list, raw.src);
    appendMediaCandidate(list, raw.imageUrl);
    appendMediaCandidate(list, raw.photoUrl);
    return;
  }
  const value = normalizeMediaCandidateUrl(raw);
  if (!value) return;
  if (!list.includes(value)) list.push(value);
};

export const resolveListingImageCandidates = (entity = {}, listingType = "default", options = {}) => {
  const safe = entity && typeof entity === "object" ? entity : {};
  const includeFallback = options?.includeFallback !== false;
  const rawCandidates = [];
  appendMediaCandidate(rawCandidates, safe.heroImageUrl);
  appendMediaCandidate(rawCandidates, safe.coverImageUrl);
  appendMediaCandidate(rawCandidates, safe.imageUrl);
  appendMediaCandidate(rawCandidates, safe.photoUrl);
  appendMediaCandidate(rawCandidates, safe.bannerUrl);
  appendMediaCandidate(rawCandidates, safe.imageUrls);
  appendMediaCandidate(rawCandidates, safe.galleryUrls);
  appendMediaCandidate(rawCandidates, safe.photos);
  appendMediaCandidate(rawCandidates, safe.externalSources?.imageUrl);
  appendMediaCandidate(rawCandidates, safe.externalSources?.photoUrl);
  appendMediaCandidate(rawCandidates, safe.externalSources?.google?.photoUrl);
  appendMediaCandidate(rawCandidates, safe.externalSources?.google?.imageUrl);
  appendMediaCandidate(rawCandidates, safe.externalSources?.google?.photoUrls);
  appendMediaCandidate(rawCandidates, safe.externalSources?.google?.images);
  appendMediaCandidate(rawCandidates, safe.externalSources?.yelp?.imageUrl);
  appendMediaCandidate(rawCandidates, safe.externalSources?.yelp?.photoUrl);
  appendMediaCandidate(rawCandidates, safe.externalSources?.yelp?.images);
  appendMediaCandidate(rawCandidates, safe.externalSources?.yelp?.photos);

  const primaryCandidates = rawCandidates.filter((url) => !isPlaceholderMediaCandidate(url));
  const placeholderCandidates = rawCandidates.filter((url) => isPlaceholderMediaCandidate(url));
  const next = includeFallback ? [...primaryCandidates, ...placeholderCandidates] : primaryCandidates;

  if (includeFallback) {
    const fallbackKey = String(listingType || "default").trim().toLowerCase();
    if (fallbackKey === "venue" || fallbackKey === "event" || fallbackKey === "session" || fallbackKey === "room_session") {
      appendMediaCandidate(next, buildPublicLocationImageUrl(safe));
    }
    const fallbacks = MARKETING_IMAGE_FALLBACKS[fallbackKey] || MARKETING_IMAGE_FALLBACKS.default;
    fallbacks.forEach((url) => appendMediaCandidate(next, url));
  }
  return next;
};

export const resolveProfileAvatarUrl = (entity = {}) => {
  const safe = entity && typeof entity === "object" ? entity : {};
  const candidates = [
    safe.avatarUrl,
    safe.profileImageUrl,
    safe.photoUrl,
    safe.imageUrl,
    safe.hostAvatarUrl,
    safe.performerAvatarUrl,
    safe.externalSources?.avatarUrl,
    safe.externalSources?.photoUrl,
  ];
  for (const entry of candidates) {
    const value = String(entry || "").trim();
    if (!value) continue;
    if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  }
  return "";
};

export const getInitials = (value = "") => {
  const token = String(value || "").trim();
  if (!token) return "BK";
  const parts = token.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
};

export const toDateTimeLocalInput = (valueMs = 0) => {
  const ms = Number(valueMs || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const tzShifted = new Date(ms - (date.getTimezoneOffset() * 60000));
  return tzShifted.toISOString().slice(0, 16);
};

export const fromDateTimeLocalInput = (value = "") => {
  const token = String(value || "").trim();
  if (!token) return 0;
  const parsed = new Date(token).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCount = (value = 0) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString();
};

export const readStars = (rating = 0) => {
  const rounded = Math.max(1, Math.min(5, Math.round(Number(rating || 0))));
  return `${"*".repeat(rounded)}${"-".repeat(5 - rounded)}`;
};
