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

const MARKETING_IMAGE_FALLBACKS = {
  venue: [
    "/images/marketing/app-landing-live.png",
    "/images/marketing/audience-surface-live.png",
  ],
  event: [
    "/images/marketing/tv-surface-live.png",
    "/images/marketing/app-landing-live.png",
  ],
  host: [
    "/images/marketing/BeauRocks-HostPanel.png",
    "/images/marketing/tv-surface-live.png",
  ],
  performer: [
    "/images/marketing/BeauRocks-Audienceapp.png",
    "/images/marketing/audience-surface-live.png",
  ],
  session: [
    "/images/marketing/audience-surface-live.png",
    "/images/marketing/app-landing-live.png",
  ],
  default: [
    "/images/logo-library/beaurocks-karaoke-logo-2.png",
  ],
};

const appendMediaCandidate = (list = [], raw = "") => {
  if (!Array.isArray(list)) return;
  if (Array.isArray(raw)) {
    raw.forEach((entry) => appendMediaCandidate(list, entry));
    return;
  }
  const value = String(raw || "").trim();
  if (!value) return;
  if (!/^https?:\/\//i.test(value) && !value.startsWith("/")) return;
  if (!list.includes(value)) list.push(value);
};

export const resolveListingImageCandidates = (entity = {}, listingType = "default", options = {}) => {
  const safe = entity && typeof entity === "object" ? entity : {};
  const includeFallback = options?.includeFallback !== false;
  const next = [];
  appendMediaCandidate(next, safe.heroImageUrl);
  appendMediaCandidate(next, safe.coverImageUrl);
  appendMediaCandidate(next, safe.imageUrl);
  appendMediaCandidate(next, safe.photoUrl);
  appendMediaCandidate(next, safe.bannerUrl);
  appendMediaCandidate(next, safe.imageUrls);
  appendMediaCandidate(next, safe.galleryUrls);
  appendMediaCandidate(next, safe.photos);
  appendMediaCandidate(next, safe.externalSources?.imageUrl);
  appendMediaCandidate(next, safe.externalSources?.photoUrl);
  appendMediaCandidate(next, safe.externalSources?.google?.photoUrl);
  appendMediaCandidate(next, safe.externalSources?.google?.images);
  appendMediaCandidate(next, safe.externalSources?.yelp?.imageUrl);

  if (includeFallback) {
    const fallbackKey = String(listingType || "default").trim().toLowerCase();
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
