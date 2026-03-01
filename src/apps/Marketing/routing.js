export const MARKETING_ROUTE_PAGES = {
  discover: "discover",
  demo: "demo",
  changelog: "changelog",
  hostAccess: "host_access",
  venue: "venue",
  event: "event",
  host: "host",
  performer: "performer",
  session: "session",
  profile: "profile",
  submit: "submit",
  admin: "admin",
  forHosts: "for_hosts",
  forVenues: "for_venues",
  forPerformers: "for_performers",
  forFans: "for_fans",
  join: "join",
  geoCity: "geo_city",
  geoRegion: "geo_region",
};

const QUERY_PARAM_KEYS = new Set([
  "intent",
  "targetType",
  "targetId",
  "next",
  "return_to",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "campaign_variant",
]);

const LEGACY_PAGE_TO_CANONICAL = {
  discover: { page: MARKETING_ROUTE_PAGES.discover },
  demo: { page: MARKETING_ROUTE_PAGES.demo },
  changelog: { page: MARKETING_ROUTE_PAGES.changelog },
  host_access: { page: MARKETING_ROUTE_PAGES.hostAccess },
  "host-access": { page: MARKETING_ROUTE_PAGES.hostAccess },
  venue: { page: MARKETING_ROUTE_PAGES.venue },
  event: { page: MARKETING_ROUTE_PAGES.event },
  host: { page: MARKETING_ROUTE_PAGES.host },
  performer: { page: MARKETING_ROUTE_PAGES.performer },
  session: { page: MARKETING_ROUTE_PAGES.session },
  profile: { page: MARKETING_ROUTE_PAGES.profile },
  submit: { page: MARKETING_ROUTE_PAGES.submit },
  admin: { page: MARKETING_ROUTE_PAGES.admin },
  for_hosts: { page: MARKETING_ROUTE_PAGES.forHosts },
  "for-hosts": { page: MARKETING_ROUTE_PAGES.forHosts },
  for_venues: { page: MARKETING_ROUTE_PAGES.forVenues },
  "for-venues": { page: MARKETING_ROUTE_PAGES.forVenues },
  for_performers: { page: MARKETING_ROUTE_PAGES.forPerformers },
  "for-performers": { page: MARKETING_ROUTE_PAGES.forPerformers },
  for_fans: { page: MARKETING_ROUTE_PAGES.forFans },
  "for-fans": { page: MARKETING_ROUTE_PAGES.forFans },
  join: { page: MARKETING_ROUTE_PAGES.join },
  geo_city: { page: MARKETING_ROUTE_PAGES.geoCity },
  geo_region: { page: MARKETING_ROUTE_PAGES.geoRegion },
};

const trimSlashes = (value = "") => String(value || "").replace(/^\/+|\/+$/g, "");
const lower = (value = "") => String(value || "").trim().toLowerCase();
const BASE_SEGMENT = (() => {
  if (typeof import.meta === "undefined" || !import.meta?.env?.BASE_URL) return "";
  return trimSlashes(String(import.meta.env.BASE_URL || ""));
})();

const safeToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const defaultRoute = () => ({ page: MARKETING_ROUTE_PAGES.discover, id: "", params: {} });

const stripBasePath = (pathname = "") => {
  const clean = `/${trimSlashes(pathname)}`;
  if (!BASE_SEGMENT) return clean;
  const basePrefix = `/${BASE_SEGMENT}`;
  if (clean === basePrefix) return "/";
  if (clean.startsWith(`${basePrefix}/`)) {
    return clean.slice(basePrefix.length) || "/";
  }
  return clean;
};

const applyBasePath = (pathname = "") => {
  const clean = `/${trimSlashes(pathname)}`;
  if (!BASE_SEGMENT) return clean;
  if (clean === "/") return `/${BASE_SEGMENT}/`;
  return `/${BASE_SEGMENT}${clean}`;
};

const routeForPathTokens = (parts = []) => {
  if (!Array.isArray(parts) || !parts.length) return null;

  if (parts[0] === "discover") return { page: MARKETING_ROUTE_PAGES.discover, id: "", params: {} };
  if (parts[0] === "demo") return { page: MARKETING_ROUTE_PAGES.demo, id: "", params: {} };
  if (parts[0] === "changelog") return { page: MARKETING_ROUTE_PAGES.changelog, id: "", params: {} };
  if (parts[0] === "host-access") return { page: MARKETING_ROUTE_PAGES.hostAccess, id: "", params: {} };
  if (parts[0] === "for-hosts") return { page: MARKETING_ROUTE_PAGES.forHosts, id: "", params: {} };
  if (parts[0] === "for-venues") return { page: MARKETING_ROUTE_PAGES.forVenues, id: "", params: {} };
  if (parts[0] === "for-performers") return { page: MARKETING_ROUTE_PAGES.forPerformers, id: "", params: {} };
  if (parts[0] === "for-fans") return { page: MARKETING_ROUTE_PAGES.forFans, id: "", params: {} };
  if (parts[0] === "hosts" && parts[1]) return { page: MARKETING_ROUTE_PAGES.host, id: parts[1], params: {} };
  if (parts[0] === "venues" && parts[1]) return { page: MARKETING_ROUTE_PAGES.venue, id: parts[1], params: {} };
  if (parts[0] === "events" && parts[1]) return { page: MARKETING_ROUTE_PAGES.event, id: parts[1], params: {} };
  if (parts[0] === "sessions" && parts[1]) return { page: MARKETING_ROUTE_PAGES.session, id: parts[1], params: {} };
  if (parts[0] === "performers" && parts[1]) return { page: MARKETING_ROUTE_PAGES.performer, id: parts[1], params: {} };
  if (parts[0] === "profile") return { page: MARKETING_ROUTE_PAGES.profile, id: "", params: {} };
  if (parts[0] === "submit") return { page: MARKETING_ROUTE_PAGES.submit, id: "", params: {} };
  if (parts[0] === "admin" && (!parts[1] || parts[1] === "moderation")) {
    return { page: MARKETING_ROUTE_PAGES.admin, id: "", params: {} };
  }
  if (parts[0] === "join") {
    const roomCode = String(parts[1] || "").trim().toUpperCase();
    return { page: MARKETING_ROUTE_PAGES.join, id: roomCode, params: { roomCode } };
  }
  if (parts[0] === "karaoke" && parts[1] === "us" && parts[2] && parts[3]) {
    return {
      page: MARKETING_ROUTE_PAGES.geoCity,
      id: `${parts[2]}:${parts[3]}`,
      params: {
        state: lower(parts[2]),
        city: lower(parts[3]),
      },
    };
  }
  if (parts[0] === "karaoke" && parts[1]) {
    return {
      page: MARKETING_ROUTE_PAGES.geoRegion,
      id: lower(parts[1]),
      params: { regionToken: lower(parts[1]) },
    };
  }
  return null;
};

const appendQueryParamsToRoute = (route = {}, search = "") => {
  const params = new URLSearchParams(search || "");
  const routeParams = { ...(route.params || {}) };
  QUERY_PARAM_KEYS.forEach((key) => {
    if (!params.has(key)) return;
    const value = String(params.get(key) || "").trim();
    if (!value) return;
    routeParams[key] = value;
  });
  return {
    ...route,
    params: routeParams,
  };
};

const parseLegacyQueryRoute = (search = "") => {
  const params = new URLSearchParams(search || "");
  const mode = lower(params.get("mode"));
  const hasLegacyPage = params.has("page");
  if (mode && mode !== "marketing") return null;
  if (!hasLegacyPage && mode !== "marketing") return null;
  const page = lower(params.get("page") || "discover");
  const mapped = LEGACY_PAGE_TO_CANONICAL[page];
  if (!mapped) return defaultRoute();
  const id = String(
    params.get("id")
    || params.get("uid")
    || params.get("venueId")
    || params.get("eventId")
    || params.get("sessionId")
    || params.get("hostUid")
    || params.get("performerUid")
    || ""
  ).trim();
  const base = {
    page: mapped.page,
    id: id || "",
    params: {},
    isLegacyQuery: true,
  };
  if (mapped.page === MARKETING_ROUTE_PAGES.join) {
    const roomCode = String(params.get("roomCode") || params.get("room") || id || "").trim().toUpperCase();
    return {
      ...base,
      id: roomCode,
      params: roomCode ? { roomCode } : {},
    };
  }
  if (mapped.page === MARKETING_ROUTE_PAGES.geoRegion) {
    const regionToken = safeToken(params.get("regionToken") || id || "");
    return {
      ...base,
      id: regionToken,
      params: regionToken ? { regionToken } : {},
    };
  }
  if (mapped.page === MARKETING_ROUTE_PAGES.geoCity) {
    const state = safeToken(params.get("state") || "");
    const city = safeToken(params.get("city") || "");
    const [idStateRaw = "", idCityRaw = ""] = String(id || "").split(":");
    const idState = safeToken(idStateRaw);
    const idCity = safeToken(idCityRaw);
    const resolvedState = state || idState;
    const resolvedCity = city || idCity;
    return {
      ...base,
      id: resolvedState && resolvedCity ? `${resolvedState}:${resolvedCity}` : "",
      params: {
        ...(resolvedState ? { state: resolvedState } : {}),
        ...(resolvedCity ? { city: resolvedCity } : {}),
      },
    };
  }
  return {
    ...base,
  };
};

export const parseMarketingRouteFromLocation = (locationLike = null) => {
  const pathname = stripBasePath(String(locationLike?.pathname || "/"));
  const search = String(locationLike?.search || "");
  const pathTokens = trimSlashes(pathname).split("/").filter(Boolean).map((token) => lower(token));
  const legacyRoute = parseLegacyQueryRoute(search);

  if (pathTokens[0] === "marketing") {
    const childRoute = routeForPathTokens(pathTokens.slice(1)) || defaultRoute();
    if (legacyRoute && pathTokens.length <= 1) {
      return appendQueryParamsToRoute(legacyRoute, search);
    }
    return appendQueryParamsToRoute(childRoute, search);
  }

  const pathRoute = routeForPathTokens(pathTokens);
  if (pathRoute) return appendQueryParamsToRoute(pathRoute, search);
  if (legacyRoute) return appendQueryParamsToRoute(legacyRoute, search);

  return appendQueryParamsToRoute(defaultRoute(), search);
};

export const parseMarketingRouteFromHref = (href = "") => {
  const raw = String(href || "").trim();
  if (!raw) return defaultRoute();
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://example.com";
    const url = new URL(raw, base);
    return parseMarketingRouteFromLocation({
      pathname: url.pathname,
      search: url.search,
    });
  } catch {
    return defaultRoute();
  }
};

export const buildMarketingPath = ({ page = MARKETING_ROUTE_PAGES.discover, id = "", params = {} } = {}) => {
  const safeId = String(id || "").trim();
  if (page === MARKETING_ROUTE_PAGES.discover) return applyBasePath("/discover");
  if (page === MARKETING_ROUTE_PAGES.demo) return applyBasePath("/demo");
  if (page === MARKETING_ROUTE_PAGES.changelog) return applyBasePath("/changelog");
  if (page === MARKETING_ROUTE_PAGES.hostAccess) return applyBasePath("/host-access");
  if (page === MARKETING_ROUTE_PAGES.forHosts) return applyBasePath("/for-hosts");
  if (page === MARKETING_ROUTE_PAGES.forVenues) return applyBasePath("/for-venues");
  if (page === MARKETING_ROUTE_PAGES.forPerformers) return applyBasePath("/for-performers");
  if (page === MARKETING_ROUTE_PAGES.forFans) return applyBasePath("/for-fans");
  if (page === MARKETING_ROUTE_PAGES.host && safeId) return applyBasePath(`/hosts/${encodeURIComponent(safeId)}`);
  if (page === MARKETING_ROUTE_PAGES.venue && safeId) return applyBasePath(`/venues/${encodeURIComponent(safeId)}`);
  if (page === MARKETING_ROUTE_PAGES.event && safeId) return applyBasePath(`/events/${encodeURIComponent(safeId)}`);
  if (page === MARKETING_ROUTE_PAGES.session && safeId) return applyBasePath(`/sessions/${encodeURIComponent(safeId)}`);
  if (page === MARKETING_ROUTE_PAGES.performer && safeId) return applyBasePath(`/performers/${encodeURIComponent(safeId)}`);
  if (page === MARKETING_ROUTE_PAGES.profile) return applyBasePath("/profile");
  if (page === MARKETING_ROUTE_PAGES.submit) return applyBasePath("/submit");
  if (page === MARKETING_ROUTE_PAGES.admin) return applyBasePath("/admin/moderation");
  if (page === MARKETING_ROUTE_PAGES.join) {
    const roomCode = String(params.roomCode || safeId || "").trim().toUpperCase();
    if (roomCode) return applyBasePath(`/join/${encodeURIComponent(roomCode)}`);
    return applyBasePath("/join");
  }
  if (page === MARKETING_ROUTE_PAGES.geoCity) {
    const state = safeToken(params.state || "");
    const city = safeToken(params.city || "");
    if (state && city) return applyBasePath(`/karaoke/us/${encodeURIComponent(state)}/${encodeURIComponent(city)}`);
  }
  if (page === MARKETING_ROUTE_PAGES.geoRegion) {
    const token = safeToken(params.regionToken || safeId || "");
    if (token) return applyBasePath(`/karaoke/${encodeURIComponent(token)}`);
  }
  return applyBasePath("/discover");
};

export const buildMarketingSearch = ({ params = {} } = {}) => {
  const query = new URLSearchParams();
  const source = params && typeof params === "object" ? params : {};
  QUERY_PARAM_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(source, key)) return;
    const value = String(source[key] || "").trim();
    if (!value) return;
    query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
};

export const buildMarketingUrl = (route = {}) => {
  const path = buildMarketingPath(route);
  const search = buildMarketingSearch(route);
  return `${path}${search}`;
};

export const buildLegacyMarketingQuery = ({ page = MARKETING_ROUTE_PAGES.discover, id = "" } = {}) => {
  const params = new URLSearchParams();
  params.set("mode", "marketing");
  const pageMap = {
    [MARKETING_ROUTE_PAGES.discover]: "discover",
    [MARKETING_ROUTE_PAGES.demo]: "demo",
    [MARKETING_ROUTE_PAGES.changelog]: "changelog",
    [MARKETING_ROUTE_PAGES.hostAccess]: "host_access",
    [MARKETING_ROUTE_PAGES.venue]: "venue",
    [MARKETING_ROUTE_PAGES.event]: "event",
    [MARKETING_ROUTE_PAGES.host]: "host",
    [MARKETING_ROUTE_PAGES.performer]: "performer",
    [MARKETING_ROUTE_PAGES.session]: "session",
    [MARKETING_ROUTE_PAGES.profile]: "profile",
    [MARKETING_ROUTE_PAGES.submit]: "submit",
    [MARKETING_ROUTE_PAGES.admin]: "admin",
    [MARKETING_ROUTE_PAGES.forHosts]: "for_hosts",
    [MARKETING_ROUTE_PAGES.forVenues]: "for_venues",
    [MARKETING_ROUTE_PAGES.forPerformers]: "for_performers",
    [MARKETING_ROUTE_PAGES.forFans]: "for_fans",
    [MARKETING_ROUTE_PAGES.join]: "join",
    [MARKETING_ROUTE_PAGES.geoCity]: "geo_city",
    [MARKETING_ROUTE_PAGES.geoRegion]: "geo_region",
  };
  params.set("page", pageMap[page] || "discover");
  if (id) params.set("id", id);
  return `${applyBasePath("/")}?${params.toString()}`;
};

export const isMarketingPath = (pathname = "") => {
  const parts = trimSlashes(stripBasePath(pathname)).split("/").filter(Boolean).map((token) => lower(token));
  if (!parts.length) return false;
  if (parts[0] === "karaoke" && parts[1] === "terms") return false;
  if (parts[0] === "marketing") return true;
  return !!routeForPathTokens(parts);
};
