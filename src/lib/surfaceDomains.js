const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MANAGED_HOST_SUFFIXES = [".web.app", ".firebaseapp.com"];
const RECOGNIZED_SUBDOMAINS = new Set(["www", "app", "host", "tv"]);

const normalizeOrigin = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const normalizePath = (value = "/") => {
  const token = String(value || "/").trim();
  const withLeadingSlash = token.startsWith("/") ? token : `/${token}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
};

const parseHostnameFromOrigin = (origin = "") => {
  try {
    return String(new URL(origin).hostname || "").trim().toLowerCase();
  } catch {
    return "";
  }
};

const readEnvOrigin = (key = "") => normalizeOrigin(import.meta.env?.[key] || "");

const isManagedHost = (hostname = "") => {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return false;
  return MANAGED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
};

const deriveRootDomain = (hostname = "") => {
  const host = String(hostname || "").trim().toLowerCase();
  const explicitRoot = String(import.meta.env?.VITE_ROOT_DOMAIN || "").trim().toLowerCase();
  if (explicitRoot) return explicitRoot.replace(/^\.+/, "");
  if (!host || LOCAL_HOSTS.has(host) || isManagedHost(host)) return host;

  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  if (RECOGNIZED_SUBDOMAINS.has(parts[0])) {
    return parts.slice(1).join(".");
  }
  return parts.slice(-2).join(".");
};

const resolveProtocol = (locationLike = null) => {
  const protocol = String(locationLike?.protocol || "").trim();
  if (protocol === "http:" || protocol === "https:") return protocol;
  return "https:";
};

const buildOrigin = (protocol = "https:", hostname = "") => {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return "";
  return `${protocol}//${host}`;
};

const getRuntimeLocation = (locationLike = null) => {
  if (locationLike) return locationLike;
  if (typeof window !== "undefined") return window.location;
  return null;
};

const resolveCurrentOrigin = ({ locationLike = null, protocol = "https:", hostname = "" } = {}) => {
  const origin = normalizeOrigin(locationLike?.origin || "");
  if (origin) return origin;
  return normalizeOrigin(buildOrigin(protocol, hostname));
};

const getDefaultOrigins = ({ hostname = "", protocol = "https:", currentOrigin = "" } = {}) => {
  if (!hostname) {
    return {
      marketing: currentOrigin,
      app: currentOrigin,
      host: currentOrigin,
      tv: currentOrigin,
    };
  }
  if (LOCAL_HOSTS.has(hostname) || isManagedHost(hostname)) {
    return {
      marketing: currentOrigin,
      app: currentOrigin,
      host: currentOrigin,
      tv: currentOrigin,
    };
  }
  const root = deriveRootDomain(hostname);
  if (!root) {
    return {
      marketing: currentOrigin,
      app: currentOrigin,
      host: currentOrigin,
      tv: currentOrigin,
    };
  }
  const marketingHost = hostname === root || hostname === `www.${root}` ? hostname : root;
  return {
    marketing: normalizeOrigin(buildOrigin(protocol, marketingHost)),
    app: normalizeOrigin(buildOrigin(protocol, `app.${root}`)),
    host: normalizeOrigin(buildOrigin(protocol, `host.${root}`)),
    tv: normalizeOrigin(buildOrigin(protocol, `tv.${root}`)),
  };
};

export const getBasePath = () => normalizePath(import.meta.env?.BASE_URL || "/");

export const getSurfaceOrigins = (locationLike = null) => {
  const runtimeLocation = getRuntimeLocation(locationLike);
  const hostname = String(runtimeLocation?.hostname || "").trim().toLowerCase();
  const protocol = resolveProtocol(runtimeLocation);
  const currentOrigin = resolveCurrentOrigin({
    locationLike: runtimeLocation,
    protocol,
    hostname,
  });

  const defaults = getDefaultOrigins({
    hostname,
    protocol,
    currentOrigin,
  });

  const marketing = readEnvOrigin("VITE_MARKETING_ORIGIN") || defaults.marketing || currentOrigin;
  const app = readEnvOrigin("VITE_APP_ORIGIN") || defaults.app || currentOrigin;
  const host = readEnvOrigin("VITE_HOST_ORIGIN") || defaults.host || currentOrigin;
  const tv = readEnvOrigin("VITE_TV_ORIGIN") || defaults.tv || currentOrigin;

  return { marketing, app, host, tv };
};

export const inferSurfaceFromHostname = (hostnameInput = "", locationLike = null) => {
  const hostname = String(hostnameInput || "").trim().toLowerCase();
  if (!hostname) return "";

  const origins = getSurfaceOrigins(locationLike);
  const byOriginMatch = [
    ["host", parseHostnameFromOrigin(origins.host)],
    ["tv", parseHostnameFromOrigin(origins.tv)],
    ["app", parseHostnameFromOrigin(origins.app)],
    ["marketing", parseHostnameFromOrigin(origins.marketing)],
  ];
  const matchedSurface = byOriginMatch.find((entry) => entry[1] && entry[1] === hostname)?.[0];
  if (matchedSurface) return matchedSurface;

  if (LOCAL_HOSTS.has(hostname) || isManagedHost(hostname)) return "app";

  const root = deriveRootDomain(hostname);
  if (!root) return "";
  if (hostname === root || hostname === `www.${root}`) return "marketing";
  if (hostname === `app.${root}`) return "app";
  if (hostname === `host.${root}`) return "host";
  if (hostname === `tv.${root}`) return "tv";
  return "";
};

export const getSurfaceBaseHref = (surface = "app", locationLike = null) => {
  const origins = getSurfaceOrigins(locationLike);
  const fallbackOrigin = origins.app || origins.marketing || "";
  const targetOrigin = normalizeOrigin(origins[surface] || fallbackOrigin || "");
  if (!targetOrigin) return getBasePath();
  return new URL(getBasePath(), `${targetOrigin}/`).toString();
};

export const buildSurfaceUrl = ({ surface = "app", path = "", params = {} } = {}, locationLike = null) => {
  const baseHref = getSurfaceBaseHref(surface, locationLike);
  const nextPath = String(path || "").trim();
  const url = nextPath ? new URL(nextPath, baseHref) : new URL(baseHref);

  if (params && typeof params === "object") {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
};
