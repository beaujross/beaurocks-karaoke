import { MARKETING_BRAND_BADGE_URL, MARKETING_BRAND_NEON_URL, resolveListingImageCandidates, resolveProfileAvatarUrl } from "./pages/shared.js";
import { buildMarketingPath, MARKETING_ROUTE_PAGES } from "./routing.js";

export const MARKETING_SITE_NAME = "BeauRocks Karaoke";
export const MARKETING_SITE_ORIGIN = "https://beaurocks.app";
export const MARKETING_SOCIAL_IMAGE_WIDTH = 1200;
export const MARKETING_SOCIAL_IMAGE_HEIGHT = 630;

export const SeoRouteRecordShape = Object.freeze({
  route: "route",
  title: "title",
  description: "description",
  canonicalUrl: "canonicalUrl",
  robots: "robots",
  ogType: "ogType",
  siteName: "siteName",
  image: "image",
  jsonLd: "jsonLd",
  indexable: "indexable",
  sitemapImages: "sitemapImages",
});

const STATIC_SOCIAL_CARD_PATHS = Object.freeze({
  default: "/images/social/default.png",
  [MARKETING_ROUTE_PAGES.discover]: "/images/social/discover.png",
  [MARKETING_ROUTE_PAGES.demo]: "/images/social/demo.png",
  [MARKETING_ROUTE_PAGES.demoAuto]: "/images/social/demo-auto.png",
  [MARKETING_ROUTE_PAGES.changelog]: "/images/social/changelog.png",
  [MARKETING_ROUTE_PAGES.forHosts]: "/images/social/for-hosts.png",
  [MARKETING_ROUTE_PAGES.forVenues]: "/images/social/for-venues.png",
  [MARKETING_ROUTE_PAGES.forPerformers]: "/images/social/for-performers.png",
  [MARKETING_ROUTE_PAGES.forFans]: "/images/social/for-fans.png",
  [MARKETING_ROUTE_PAGES.geoCity]: "/images/social/geo.png",
  [MARKETING_ROUTE_PAGES.geoRegion]: "/images/social/geo.png",
  [MARKETING_ROUTE_PAGES.venue]: "/images/social/venue.png",
  [MARKETING_ROUTE_PAGES.event]: "/images/social/event.png",
  [MARKETING_ROUTE_PAGES.host]: "/images/social/host.png",
  [MARKETING_ROUTE_PAGES.performer]: "/images/social/performer.png",
});

const PAGE_TITLE_MAP = Object.freeze({
  [MARKETING_ROUTE_PAGES.discover]: "Setlist Karaoke Finder | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.demo]: "Abstract Demo | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.demoAuto]: "Auto Demo | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.changelog]: "Product Changelog | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.hostAccess]: "Host Access | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.forHosts]: "Apply To Host Karaoke Nights | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.forVenues]: "For Venues | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.forPerformers]: "For Performers | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.forFans]: "Live Karaoke Finder and Host Tools | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.submit]: "Submit Listing | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.profile]: "Profile Dashboard | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.admin]: "Marketing Moderation | BeauRocks Karaoke",
  [MARKETING_ROUTE_PAGES.join]: "Join Private Karaoke Room | BeauRocks Karaoke",
});

const PAGE_DESCRIPTION_MAP = Object.freeze({
  [MARKETING_ROUTE_PAGES.discover]: "Find karaoke nights by city, host, venue, and time window with BeauRocks Setlist Finder.",
  [MARKETING_ROUTE_PAGES.demo]: "See the conceptual system story behind BeauRocks across host, TV, audience, and singer surfaces.",
  [MARKETING_ROUTE_PAGES.demoAuto]: "Watch a local-only autoplay walkthrough of the BeauRocks host, TV, and audience room experience.",
  [MARKETING_ROUTE_PAGES.changelog]: "Release updates and product changes across host, audience, and public TV experiences.",
  [MARKETING_ROUTE_PAGES.hostAccess]: "Approved hosts sign in here to open Host Dashboard. New host partners can request early access.",
  [MARKETING_ROUTE_PAGES.forHosts]: "Apply for BeauRocks host access and launch karaoke nights from a single operator deck.",
  [MARKETING_ROUTE_PAGES.forVenues]: "Claim your venue profile, publish recurring karaoke cadence, and make the night easier to trust.",
  [MARKETING_ROUTE_PAGES.forPerformers]: "Find standout karaoke rooms, compare schedules, and build a weekly rotation.",
  [MARKETING_ROUTE_PAGES.forFans]: "Discover live karaoke nights, run smoother hosted events, and keep the TV, queue, and guest phones moving together with BeauRocks.",
  [MARKETING_ROUTE_PAGES.submit]: "Submit a venue, event, or room session to the BeauRocks directory moderation queue.",
  [MARKETING_ROUTE_PAGES.profile]: "Manage your BeauRocks profile, follows, RSVPs, check-ins, and performance history.",
  [MARKETING_ROUTE_PAGES.admin]: "Directory moderation controls for claims, submissions, and ingestion review.",
  [MARKETING_ROUTE_PAGES.join]: "Enter a private room code to join a non-indexed karaoke session.",
});

const DETAIL_PAGE_LABELS = Object.freeze({
  [MARKETING_ROUTE_PAGES.venue]: "Venue",
  [MARKETING_ROUTE_PAGES.event]: "Event",
  [MARKETING_ROUTE_PAGES.host]: "Host",
  [MARKETING_ROUTE_PAGES.performer]: "Performer",
  [MARKETING_ROUTE_PAGES.session]: "Room Session",
});

const NOINDEX_PAGES = new Set([
  MARKETING_ROUTE_PAGES.hostAccess,
  MARKETING_ROUTE_PAGES.profile,
  MARKETING_ROUTE_PAGES.submit,
  MARKETING_ROUTE_PAGES.admin,
  MARKETING_ROUTE_PAGES.join,
  MARKETING_ROUTE_PAGES.session,
]);

const sameAsArray = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

const cleanText = (value = "", fallback = "") => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
};

const truncateText = (value = "", max = 160) => {
  const text = cleanText(value);
  if (!text || text.length <= max) return text;
  const slice = text.slice(0, Math.max(0, max - 1));
  const breakIndex = slice.lastIndexOf(" ");
  return `${(breakIndex > 72 ? slice.slice(0, breakIndex) : slice).trim()}.`;
};

const toTitleCase = (value = "") =>
  cleanText(String(value || "").replace(/[_-]+/g, " "))
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const normalizeBaseUrl = (value = "") => cleanText(value || MARKETING_SITE_ORIGIN, MARKETING_SITE_ORIGIN).replace(/\/+$/, "");

const toAbsoluteUrl = (baseUrl = MARKETING_SITE_ORIGIN, value = "") => {
  const token = cleanText(value);
  if (!token) return "";
  if (/^https?:\/\//i.test(token)) return token.replace(/^http:\/\//i, "https://");
  const root = normalizeBaseUrl(baseUrl);
  if (!token.startsWith("/")) return `${root}/${token}`;
  return `${root}${token}`;
};

const asIsoDate = (value = 0) => {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  try {
    return new Date(ms).toISOString();
  } catch {
    return "";
  }
};

const buildGeoLabel = (route = {}, entity = null) => {
  const params = route?.params || {};
  const entityLabel = cleanText(entity?.geoLabel || entity?.label);
  if (entityLabel) return entityLabel;
  const state = cleanText(params.state).toUpperCase();
  const city = toTitleCase(params.city);
  const region = toTitleCase(params.regionToken || route?.id);
  if (city && state) return `${city}, ${state}`;
  return region || "Nationwide";
};

const buildLocationLabel = (entity = {}) => {
  const parts = [
    entity?.city,
    entity?.state,
    entity?.country,
  ].map((value) => cleanText(value)).filter(Boolean);
  return parts.join(", ");
};

const buildEntityName = (route = {}, entity = null) => {
  const page = String(route?.page || "");
  if (page === MARKETING_ROUTE_PAGES.venue) {
    return cleanText(entity?.title || entity?.venueName || entity?.name, cleanText(route?.id));
  }
  if (page === MARKETING_ROUTE_PAGES.event) {
    return cleanText(entity?.title || entity?.name, cleanText(route?.id));
  }
  if (page === MARKETING_ROUTE_PAGES.host) {
    return cleanText(entity?.displayName || entity?.handle || entity?.hostName || entity?.name, cleanText(route?.id));
  }
  if (page === MARKETING_ROUTE_PAGES.performer) {
    return cleanText(entity?.displayName || entity?.handle || entity?.performerName || entity?.name, cleanText(route?.id));
  }
  if (page === MARKETING_ROUTE_PAGES.session) {
    return cleanText(entity?.title || entity?.name, cleanText(route?.id));
  }
  return cleanText(entity?.title || entity?.displayName || entity?.name, cleanText(route?.id));
};

const buildEntityDescription = (route = {}, entity = null) => {
  const page = String(route?.page || "");
  const description = truncateText(entity?.seoDescription || entity?.description || entity?.bio || "", 155);
  const location = buildLocationLabel(entity || {});
  if (page === MARKETING_ROUTE_PAGES.venue) {
    return description || truncateText(`View karaoke schedule, venue details, and event updates for ${buildEntityName(route, entity)}${location ? ` in ${location}` : ""}.`, 155);
  }
  if (page === MARKETING_ROUTE_PAGES.event) {
    const startsAt = asIsoDate(entity?.startsAtMs);
    const hostName = cleanText(entity?.hostName);
    const dateLead = startsAt ? ` on ${startsAt.slice(0, 10)}` : "";
    const hostLead = hostName ? ` with ${hostName}` : "";
    return description || truncateText(`See timing, venue details, and host info for ${buildEntityName(route, entity)}${dateLead}${hostLead}.`, 155);
  }
  if (page === MARKETING_ROUTE_PAGES.host) {
    return description || truncateText(`Explore events, public nights, and venue history for host ${buildEntityName(route, entity)}${location ? ` in ${location}` : ""}.`, 155);
  }
  if (page === MARKETING_ROUTE_PAGES.performer) {
    return description || truncateText(`Track profile details, reviews, and karaoke activity for performer ${buildEntityName(route, entity)}${location ? ` in ${location}` : ""}.`, 155);
  }
  if (page === MARKETING_ROUTE_PAGES.geoCity || page === MARKETING_ROUTE_PAGES.geoRegion) {
    const geoLabel = buildGeoLabel(route, entity);
    return truncateText(`Browse karaoke venues and upcoming events in ${geoLabel}.`, 155);
  }
  return description;
};

const pickRepresentativeImagePath = (route = {}, entity = null) => {
  const page = String(route?.page || "");
  const socialCardPath = cleanText(entity?.socialCardPath || entity?.socialImagePath);
  if (socialCardPath) return socialCardPath;

  if (page === MARKETING_ROUTE_PAGES.host) {
    const avatar = resolveProfileAvatarUrl(entity || {});
    if (avatar) return avatar;
  }

  if (page === MARKETING_ROUTE_PAGES.performer) {
    const avatar = resolveProfileAvatarUrl(entity || {});
    if (avatar) return avatar;
  }

  if (
    page === MARKETING_ROUTE_PAGES.venue
    || page === MARKETING_ROUTE_PAGES.event
    || page === MARKETING_ROUTE_PAGES.host
    || page === MARKETING_ROUTE_PAGES.performer
    || page === MARKETING_ROUTE_PAGES.session
  ) {
    const listingType = page === MARKETING_ROUTE_PAGES.session ? "session" : page;
    const imageUrl = resolveListingImageCandidates(entity || {}, listingType, { includeFallback: true })[0];
    if (imageUrl) return imageUrl;
  }

  return STATIC_SOCIAL_CARD_PATHS[page] || STATIC_SOCIAL_CARD_PATHS.default;
};

const buildSocialImage = (route = {}, entity = null, baseUrl = MARKETING_SITE_ORIGIN) => {
  const imagePath = pickRepresentativeImagePath(route, entity);
  const page = String(route?.page || "");
  const fallbackAlt = page === MARKETING_ROUTE_PAGES.forFans
    ? "BeauRocks Karaoke neon logo with microphone over a retro stage grid."
    : `${buildEntityName(route, entity) || MARKETING_SITE_NAME} featured image`;
  return {
    url: toAbsoluteUrl(baseUrl, imagePath),
    width: Number(entity?.socialCardWidth || MARKETING_SOCIAL_IMAGE_WIDTH),
    height: Number(entity?.socialCardHeight || MARKETING_SOCIAL_IMAGE_HEIGHT),
    alt: cleanText(
      entity?.socialCardAlt
      || entity?.imageAlt
      || fallbackAlt,
      `${MARKETING_SITE_NAME} featured image`
    ),
    path: cleanText(imagePath),
  };
};

const buildTitle = (route = {}, entity = null) => {
  const page = String(route?.page || MARKETING_ROUTE_PAGES.forFans);
  if (page === MARKETING_ROUTE_PAGES.venue) {
    return `${buildEntityName(route, entity)} | Karaoke Venue | BeauRocks`;
  }
  if (page === MARKETING_ROUTE_PAGES.event) {
    return `${buildEntityName(route, entity)} | Karaoke Event | BeauRocks`;
  }
  if (page === MARKETING_ROUTE_PAGES.host) {
    return `${buildEntityName(route, entity)} | Host Profile | BeauRocks`;
  }
  if (page === MARKETING_ROUTE_PAGES.performer) {
    return `${buildEntityName(route, entity)} | Performer Profile | BeauRocks`;
  }
  if (page === MARKETING_ROUTE_PAGES.session) {
    return `${buildEntityName(route, entity)} | Room Session | BeauRocks`;
  }
  if (page === MARKETING_ROUTE_PAGES.geoCity || page === MARKETING_ROUTE_PAGES.geoRegion) {
    return `${buildGeoLabel(route, entity)} Karaoke Nights | BeauRocks`;
  }
  return PAGE_TITLE_MAP[page] || `${MARKETING_SITE_NAME}`;
};

const buildDescription = (route = {}, entity = null) => {
  const page = String(route?.page || MARKETING_ROUTE_PAGES.forFans);
  if (
    page === MARKETING_ROUTE_PAGES.venue
    || page === MARKETING_ROUTE_PAGES.event
    || page === MARKETING_ROUTE_PAGES.host
    || page === MARKETING_ROUTE_PAGES.performer
    || page === MARKETING_ROUTE_PAGES.session
    || page === MARKETING_ROUTE_PAGES.geoCity
    || page === MARKETING_ROUTE_PAGES.geoRegion
  ) {
    const description = buildEntityDescription(route, entity);
    if (description) return description;
  }
  return PAGE_DESCRIPTION_MAP[page] || "Premium karaoke technology for hosts who want unforgettable rooms and stronger real-world connection.";
};

const buildBreadcrumbs = (route = {}, entity = null, baseUrl = MARKETING_SITE_ORIGIN) => {
  const page = String(route?.page || "");
  const home = {
    name: "Overview",
    url: toAbsoluteUrl(baseUrl, buildMarketingPath({ page: MARKETING_ROUTE_PAGES.forFans })),
  };
  if (page === MARKETING_ROUTE_PAGES.geoCity || page === MARKETING_ROUTE_PAGES.geoRegion) {
    return [
      home,
      {
        name: "Discover",
        url: toAbsoluteUrl(baseUrl, buildMarketingPath({ page: MARKETING_ROUTE_PAGES.discover })),
      },
      {
        name: buildGeoLabel(route, entity),
        url: toAbsoluteUrl(baseUrl, buildMarketingPath(route)),
      },
    ];
  }
  if (
    page === MARKETING_ROUTE_PAGES.venue
    || page === MARKETING_ROUTE_PAGES.event
    || page === MARKETING_ROUTE_PAGES.host
    || page === MARKETING_ROUTE_PAGES.performer
  ) {
    return [
      home,
      {
        name: "Discover",
        url: toAbsoluteUrl(baseUrl, buildMarketingPath({ page: MARKETING_ROUTE_PAGES.discover })),
      },
      {
        name: buildEntityName(route, entity),
        url: toAbsoluteUrl(baseUrl, buildMarketingPath(route)),
      },
    ];
  }
  return [];
};

const buildBreadcrumbJsonLd = (breadcrumbs = []) => {
  if (!breadcrumbs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.url,
    })),
  };
};

const buildOrganizationJsonLd = ({ baseUrl = MARKETING_SITE_ORIGIN, image = null, sameAs = [] } = {}) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: MARKETING_SITE_NAME,
  url: normalizeBaseUrl(baseUrl),
  logo: image?.url || toAbsoluteUrl(baseUrl, MARKETING_BRAND_NEON_URL),
  ...(sameAsArray(sameAs).length ? { sameAs: sameAsArray(sameAs) } : {}),
});

const buildWebSiteJsonLd = ({ baseUrl = MARKETING_SITE_ORIGIN } = {}) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: MARKETING_SITE_NAME,
  url: normalizeBaseUrl(baseUrl),
});

const buildStaticPageJsonLd = ({ route = {}, canonicalUrl = "", title = "", description = "", image = null } = {}) => ({
  "@context": "https://schema.org",
  "@type": route.page === MARKETING_ROUTE_PAGES.discover ? "CollectionPage" : "WebPage",
  name: title,
  description,
  url: canonicalUrl,
  image: image?.url || undefined,
});

const buildGeoJsonLd = ({ route = {}, canonicalUrl = "", title = "", description = "", image = null, entity = null } = {}) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: title,
  description,
  url: canonicalUrl,
  image: image?.url || undefined,
  about: buildGeoLabel(route, entity),
});

const buildAddressJsonLd = (entity = {}) => {
  const streetAddress = cleanText(entity?.address1 || entity?.address);
  const addressLocality = cleanText(entity?.city);
  const addressRegion = cleanText(entity?.state);
  const postalCode = cleanText(entity?.postalCode);
  const addressCountry = cleanText(entity?.country);
  if (!streetAddress && !addressLocality && !addressRegion && !postalCode && !addressCountry) return null;
  return {
    "@type": "PostalAddress",
    ...(streetAddress ? { streetAddress } : {}),
    ...(addressLocality ? { addressLocality } : {}),
    ...(addressRegion ? { addressRegion } : {}),
    ...(postalCode ? { postalCode } : {}),
    ...(addressCountry ? { addressCountry } : {}),
  };
};

const buildVenueJsonLd = ({ route = {}, entity = null, canonicalUrl = "", title = "", description = "", image = null } = {}) => ({
  "@context": "https://schema.org",
  "@type": "Place",
  name: buildEntityName(route, entity) || title,
  description,
  url: canonicalUrl,
  image: image?.url || undefined,
  ...(buildAddressJsonLd(entity || {}) ? { address: buildAddressJsonLd(entity || {}) } : {}),
  ...(cleanText(entity?.telephone || entity?.phone) ? { telephone: cleanText(entity?.telephone || entity?.phone) } : {}),
});

const buildEventJsonLd = ({ route = {}, entity = null, canonicalUrl = "", title = "", description = "", image = null } = {}) => {
  const locationName = cleanText(entity?.venueName || entity?.venueTitle || entity?.venue);
  const locationAddress = buildAddressJsonLd(entity || {});
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: buildEntityName(route, entity) || title,
    description,
    url: canonicalUrl,
    image: image?.url || undefined,
    ...(asIsoDate(entity?.startsAtMs) ? { startDate: asIsoDate(entity?.startsAtMs) } : {}),
    ...(asIsoDate(entity?.endsAtMs) ? { endDate: asIsoDate(entity?.endsAtMs) } : {}),
    ...(locationName || locationAddress
      ? {
        location: {
          "@type": "Place",
          ...(locationName ? { name: locationName } : {}),
          ...(locationAddress ? { address: locationAddress } : {}),
        },
      }
      : {}),
  };
};

const buildProfileJsonLd = ({ route = {}, entity = null, canonicalUrl = "", title = "", description = "", image = null } = {}) => ({
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  name: buildEntityName(route, entity) || title,
  description,
  url: canonicalUrl,
  image: image?.url || undefined,
  mainEntity: {
    "@type": "Person",
    name: buildEntityName(route, entity),
    description: description || undefined,
    image: image?.url || undefined,
    url: canonicalUrl,
  },
});

const buildJsonLd = ({
  route = {},
  canonicalUrl = "",
  title = "",
  description = "",
  image = null,
  entity = null,
  baseUrl = MARKETING_SITE_ORIGIN,
  sameAs = [],
} = {}) => {
  const page = String(route?.page || MARKETING_ROUTE_PAGES.forFans);
  const items = [];

  if (page === MARKETING_ROUTE_PAGES.forFans) {
    items.push(buildWebSiteJsonLd({ baseUrl }));
    items.push(buildOrganizationJsonLd({ baseUrl, image, sameAs }));
    items.push(buildStaticPageJsonLd({ route, canonicalUrl, title, description, image }));
  } else if (page === MARKETING_ROUTE_PAGES.geoCity || page === MARKETING_ROUTE_PAGES.geoRegion) {
    items.push(buildGeoJsonLd({ route, canonicalUrl, title, description, image, entity }));
  } else if (page === MARKETING_ROUTE_PAGES.venue) {
    items.push(buildVenueJsonLd({ route, entity, canonicalUrl, title, description, image }));
  } else if (page === MARKETING_ROUTE_PAGES.event) {
    items.push(buildEventJsonLd({ route, entity, canonicalUrl, title, description, image }));
  } else if (page === MARKETING_ROUTE_PAGES.host || page === MARKETING_ROUTE_PAGES.performer) {
    items.push(buildProfileJsonLd({ route, entity, canonicalUrl, title, description, image }));
  } else {
    items.push(buildStaticPageJsonLd({ route, canonicalUrl, title, description, image }));
  }

  const breadcrumbs = buildBreadcrumbs(route, entity, baseUrl);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbs);
  if (breadcrumbJsonLd) items.push(breadcrumbJsonLd);

  return items.filter(Boolean);
};

export const isIndexableMarketingPage = (route = {}) => !NOINDEX_PAGES.has(String(route?.page || ""));

export const buildSeoRouteRecord = (route = {}, options = {}) => {
  const normalizedRoute = {
    page: String(route?.page || MARKETING_ROUTE_PAGES.forFans),
    id: cleanText(route?.id),
    params: route?.params && typeof route.params === "object" ? route.params : {},
  };
  const baseUrl = normalizeBaseUrl(options?.baseUrl || MARKETING_SITE_ORIGIN);
  const entity = options?.entity && typeof options.entity === "object" ? options.entity : null;
  const canonicalUrl = toAbsoluteUrl(baseUrl, buildMarketingPath(normalizedRoute));
  const indexable = options?.indexable === undefined
    ? isIndexableMarketingPage(normalizedRoute)
    : !!options.indexable;
  const robots = indexable ? "index,follow,max-image-preview:large" : "noindex,nofollow";
  const image = buildSocialImage(normalizedRoute, entity, baseUrl);
  const title = buildTitle(normalizedRoute, entity);
  const description = buildDescription(normalizedRoute, entity);
  const ogType = normalizedRoute.page === MARKETING_ROUTE_PAGES.changelog ? "article" : "website";
  const jsonLd = buildJsonLd({
    route: normalizedRoute,
    canonicalUrl,
    title,
    description,
    image,
    entity,
    baseUrl,
    sameAs: options?.sameAs,
  });
  const routePath = buildMarketingPath(normalizedRoute);

  return {
    route: normalizedRoute,
    routePath,
    title,
    description,
    canonicalUrl,
    robots,
    ogType,
    siteName: MARKETING_SITE_NAME,
    image,
    jsonLd,
    indexable,
    sitemapImages: indexable && image?.url ? [image.url] : [],
  };
};

export const buildBrowserSeoRouteRecord = (route = {}, options = {}) =>
  buildSeoRouteRecord(route, {
    ...options,
    baseUrl: options?.baseUrl || (typeof window !== "undefined" ? window.location.origin : MARKETING_SITE_ORIGIN),
  });

export const buildDefaultSocialImage = (baseUrl = MARKETING_SITE_ORIGIN) => ({
  url: toAbsoluteUrl(baseUrl, STATIC_SOCIAL_CARD_PATHS.default),
  width: MARKETING_SOCIAL_IMAGE_WIDTH,
  height: MARKETING_SOCIAL_IMAGE_HEIGHT,
  alt: `${MARKETING_SITE_NAME} featured image`,
  path: STATIC_SOCIAL_CARD_PATHS.default,
});

export const getStaticSocialCardPath = (route = {}) =>
  STATIC_SOCIAL_CARD_PATHS[String(route?.page || "")] || STATIC_SOCIAL_CARD_PATHS.default;

export const buildMarketingSocialSlug = (route = {}, entity = null) => {
  const page = String(route?.page || MARKETING_ROUTE_PAGES.forFans).trim().toLowerCase();
  const suffix = cleanText(entity?.slug || entity?.id || route?.id)
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return suffix ? `${page}-${suffix}` : page;
};

export const getMarketingSocialCardTemplatePath = (route = {}) =>
  STATIC_SOCIAL_CARD_PATHS[String(route?.page || "")] || STATIC_SOCIAL_CARD_PATHS.default;

export const getMarketingBrandLogoUrl = (baseUrl = MARKETING_SITE_ORIGIN) =>
  toAbsoluteUrl(baseUrl, MARKETING_BRAND_BADGE_URL || MARKETING_BRAND_NEON_URL);
