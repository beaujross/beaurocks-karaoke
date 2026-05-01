import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import process from "node:process";
import sharp from "sharp";
import {
  buildMarketingPath,
  MARKETING_ROUTE_PAGES,
  parseMarketingRouteFromHref,
} from "../src/apps/Marketing/routing.js";
import {
  buildMarketingSocialSlug,
  buildSeoRouteRecord,
} from "../src/apps/Marketing/seoModel.js";
import {
  MARKETING_GEO_CITY_PRESETS,
  MARKETING_REGION_PRESETS,
} from "../src/apps/Marketing/geoPresets.js";
import {
  resolveListingImageCandidates,
  resolveProfileAvatarUrl,
} from "../src/apps/Marketing/pages/shared.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const trackedPublicDir = path.join(projectRoot, "public");
const require = createRequire(import.meta.url);

const ROUTE_DETAIL_PAGES = new Set([
  MARKETING_ROUTE_PAGES.venue,
  MARKETING_ROUTE_PAGES.event,
  MARKETING_ROUTE_PAGES.host,
  MARKETING_ROUTE_PAGES.performer,
]);

const PUBLIC_CORE_ROUTE_PAGES = [
  MARKETING_ROUTE_PAGES.discover,
  MARKETING_ROUTE_PAGES.changelog,
  MARKETING_ROUTE_PAGES.forHosts,
  MARKETING_ROUTE_PAGES.forVenues,
  MARKETING_ROUTE_PAGES.forPerformers,
  MARKETING_ROUTE_PAGES.forFans,
];

const REGION_ALIASES = Object.freeze({
  kitsap_wa: "wa_kitsap",
  seattle_wa: "wa_seattle",
  los_angeles_ca: "ca_los_angeles",
  new_york_ny: "ny_new_york",
});

const CARD_BACKGROUND_BY_PAGE = Object.freeze({
  [MARKETING_ROUTE_PAGES.discover]: "/images/marketing/app-landing-live.png",
  [MARKETING_ROUTE_PAGES.demo]: "/images/marketing/tv-surface-live.png",
  [MARKETING_ROUTE_PAGES.demoAuto]: "/images/marketing/app-landing-live.png",
  [MARKETING_ROUTE_PAGES.changelog]: "/images/marketing/CLEAN 1.png",
  [MARKETING_ROUTE_PAGES.forHosts]: "/images/marketing/BeauRocks-HostPanel.png",
  [MARKETING_ROUTE_PAGES.forVenues]: "/images/marketing/CLEAN 1.png",
  [MARKETING_ROUTE_PAGES.forPerformers]: "/images/marketing/BeauRocks-Audienceapp.png",
  [MARKETING_ROUTE_PAGES.forFans]: "/images/logo-library/beaurocks-logo-background.png",
  [MARKETING_ROUTE_PAGES.geoCity]: "/images/marketing/CLEAN 1.png",
  [MARKETING_ROUTE_PAGES.geoRegion]: "/images/marketing/CLEAN 1.png",
  [MARKETING_ROUTE_PAGES.venue]: "/images/marketing/CLEAN 1.png",
  [MARKETING_ROUTE_PAGES.event]: "/images/marketing/CLEAN 1.png",
  [MARKETING_ROUTE_PAGES.host]: "/images/marketing/BeauRocks-HostPanel.png",
  [MARKETING_ROUTE_PAGES.performer]: "/images/marketing/BeauRocks-Audienceapp.png",
  default: "/images/marketing/CLEAN 1.png",
});

const PAGE_KICKER = Object.freeze({
  [MARKETING_ROUTE_PAGES.discover]: "Discover",
  [MARKETING_ROUTE_PAGES.demo]: "Demo",
  [MARKETING_ROUTE_PAGES.demoAuto]: "Auto Demo",
  [MARKETING_ROUTE_PAGES.changelog]: "Changelog",
  [MARKETING_ROUTE_PAGES.forHosts]: "For Hosts",
  [MARKETING_ROUTE_PAGES.forVenues]: "For Venues",
  [MARKETING_ROUTE_PAGES.forPerformers]: "For Performers",
  [MARKETING_ROUTE_PAGES.forFans]: "Live Karaoke",
  [MARKETING_ROUTE_PAGES.geoCity]: "City Guide",
  [MARKETING_ROUTE_PAGES.geoRegion]: "Regional Guide",
  [MARKETING_ROUTE_PAGES.venue]: "Venue",
  [MARKETING_ROUTE_PAGES.event]: "Event",
  [MARKETING_ROUTE_PAGES.host]: "Host",
  [MARKETING_ROUTE_PAGES.performer]: "Performer",
});

const MARKETING_FAVICON_PATH = "/images/logo-library/bross-ent-favicon-1.png";
const MARKETING_APPLE_TOUCH_ICON_PATH = "/images/logo-library/bross-ent-favicon-1.png";
const MARKETING_LOGO_CARD_PATH = "/images/logo-library/bross-ent-favicon-1.png";
const MARKETING_SOCIAL_DIR = "images/social";
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

const loadEnvFileIntoProcess = (filename = "") => {
  const target = String(filename || "").trim();
  if (!target) return;
  const filePath = path.join(projectRoot, target);
  if (!fsSync.existsSync(filePath)) return;
  const raw = fsSync.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/g).forEach((line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eqIndex = normalized.indexOf("=");
    if (eqIndex <= 0) return;
    const key = normalized.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) return;
    let value = normalized.slice(eqIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, "\n");
    process.env[key] = value;
  });
};

loadEnvFileIntoProcess(".env");
loadEnvFileIntoProcess(".env.local");

const readEnv = (name = "", fallback = "") => {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  return String(value);
};

const readCliArg = (flag = "") => {
  const target = String(flag || "").trim();
  if (!target) return "";
  const index = process.argv.indexOf(target);
  if (index === -1) return "";
  return String(process.argv[index + 1] || "").trim();
};

const readEnvBool = (name, fallback = false) => {
  const raw = readEnv(name, "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
};

const trimSlashes = (value = "") => String(value || "").replace(/^\/+|\/+$/g, "");
const cleanText = (value = "", fallback = "") => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
};

const normalizeToken = (value = "") =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const canonicalizeRegionToken = (value = "") => {
  const token = normalizeToken(value);
  return REGION_ALIASES[token] || token;
};

const nowIso = () => new Date().toISOString();
const samePath = (left = "", right = "") => path.resolve(String(left || "")) === path.resolve(String(right || ""));
const readJsonFileIfExists = async (filePath = "") => {
  const target = cleanText(filePath);
  if (!target || !fsSync.existsSync(target)) return null;
  try {
    const raw = await fs.readFile(target, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const cleanBasePath = (() => {
  const raw = readEnv("BASE_URL", "/");
  const trimmed = trimSlashes(raw);
  return trimmed ? `/${trimmed}` : "";
})();

const withBasePath = (pathname = "/") => {
  const cleanPath = `/${trimSlashes(pathname)}`;
  if (!cleanBasePath) return cleanPath === "/" ? "/" : cleanPath;
  if (cleanPath === "/") return `${cleanBasePath}/`;
  return `${cleanBasePath}${cleanPath}`;
};

const readSiteUrl = () => {
  const raw = readEnv("SITE_URL", readEnv("VITE_SITE_URL", "https://beaurocks.app"));
  return cleanText(raw, "https://beaurocks.app").replace(/\/+$/, "");
};

const resolveOutputDir = () => {
  const raw = readCliArg("--output-dir") || readEnv("SITEMAP_OUTPUT_DIR", "public");
  const normalized = cleanText(raw, "public");
  return path.isAbsolute(normalized)
    ? normalized
    : path.join(projectRoot, normalized);
};

const loadFirebaseAdmin = () => {
  try {
    return require("firebase-admin");
  } catch {
    try {
      return require(path.join(projectRoot, "functions", "node_modules", "firebase-admin"));
    } catch {
      return null;
    }
  }
};

const parseServiceAccountPayload = (raw = "") => {
  const text = cleanText(raw);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const isServiceAccountPayload = (payload = null) => {
  if (!payload || typeof payload !== "object") return false;
  return String(payload.type || "").trim() === "service_account"
    && !!String(payload.client_email || "").trim()
    && !!String(payload.private_key || "").trim();
};

const loadServiceAccount = async () => {
  const inlinePayload = parseServiceAccountPayload(
    readEnv("SITEMAP_FIREBASE_SERVICE_ACCOUNT_JSON")
    || readEnv("FIREBASE_SERVICE_ACCOUNT_JSON")
    || readEnv("GOOGLE_SERVICE_ACCOUNT_JSON")
  );
  if (isServiceAccountPayload(inlinePayload)) return inlinePayload;

  const fileCandidates = [
    readEnv("SITEMAP_FIREBASE_SERVICE_ACCOUNT_FILE", "").trim(),
    readEnv("FIREBASE_SERVICE_ACCOUNT_FILE", "").trim(),
    readEnv("GOOGLE_SERVICE_ACCOUNT_FILE", "").trim(),
    readEnv("GOOGLE_APPLICATION_CREDENTIALS", "").trim(),
  ].filter(Boolean);

  for (const candidate of fileCandidates) {
    const serviceAccountPath = path.isAbsolute(candidate)
      ? candidate
      : path.join(projectRoot, candidate);
    try {
      const raw = await fs.readFile(serviceAccountPath, "utf8");
      const parsed = parseServiceAccountPayload(raw);
      if (isServiceAccountPayload(parsed)) return parsed;
    } catch {
      // Try the next credential source.
    }
  }
  return null;
};

const initializeFirebaseAdmin = async (admin) => {
  if (!admin || admin.apps.length) return;

  const explicitProjectId = readEnv("SITEMAP_FIREBASE_PROJECT_ID")
    || readEnv("GCLOUD_PROJECT")
    || readEnv("GOOGLE_CLOUD_PROJECT")
    || readEnv("FIREBASE_CONFIG_PROJECT_ID");
  const serviceAccount = await loadServiceAccount();

  if (serviceAccount && admin.credential?.cert) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      ...(explicitProjectId || serviceAccount.project_id
        ? { projectId: explicitProjectId || serviceAccount.project_id }
        : {}),
    });
    return;
  }

  if (explicitProjectId) {
    admin.initializeApp({ projectId: explicitProjectId });
    return;
  }

  admin.initializeApp();
};

const isListingPublic = (data = {}) => {
  const visibility = normalizeToken(data.visibility || "public");
  return !["private", "hidden", "invite-only", "invite_only", "unlisted", "draft"].includes(visibility);
};

const extractProfileRoles = (data = {}) => {
  const roles = new Set();
  const addRole = (value = "") => {
    const token = normalizeToken(value);
    if (token) roles.add(token);
  };
  (Array.isArray(data.roles) ? data.roles : []).forEach((entry) => addRole(entry));
  addRole(data.role);
  addRole(data.profileRole);
  addRole(data.profileType);
  addRole(data.type);
  if (data.isHost === true || data.hostApproved === true || data.hostEnabled === true) roles.add("host");
  if (data.isPerformer === true || data.performerApproved === true || data.performerEnabled === true) roles.add("performer");
  return roles;
};

const normalizeCityToken = (value = "") => normalizeToken(String(value || "").replace(/\s+/g, "-"));

const normalizeEntityRecord = (docSnap, listingType) => {
  const data = docSnap.data() || {};
  return {
    id: String(docSnap.id || "").trim(),
    listingType,
    ...data,
  };
};

const collectGeoTokens = (collection = [], regionTokens, cityPairs) => {
  collection.forEach((item) => {
    const region = canonicalizeRegionToken(item.region || item.regionToken || item.location?.region || "");
    if (region) regionTokens.add(region);
    const state = normalizeToken(item.state || item.stateCode || item.location?.state || item.geo?.state || "");
    const city = normalizeCityToken(item.city || item.location?.city || item.geo?.city || "");
    if (state && city) cityPairs.add(`${state}:${city}`);
  });
};

const loadRouteDataFromFirestore = async () => {
  const admin = loadFirebaseAdmin();
  if (!admin) {
    throw new Error("firebase-admin is unavailable. Install dependencies or provide functions/node_modules fallback.");
  }
  await initializeFirebaseAdmin(admin);
  const db = admin.firestore();

  const [venueSnapRaw, eventSnapRaw, sessionSnapRaw, profileSnapRaw] = await Promise.all([
    db.collection("venues").where("status", "==", "approved").limit(5000).get(),
    db.collection("karaoke_events").where("status", "==", "approved").limit(6000).get(),
    db.collection("room_sessions").where("status", "==", "approved").limit(6000).get(),
    db.collection("directory_profiles").where("status", "==", "approved").limit(4500).get(),
  ]);

  const venues = venueSnapRaw.docs
    .filter((docSnap) => isListingPublic(docSnap.data() || {}))
    .map((docSnap) => normalizeEntityRecord(docSnap, "venue"));
  const events = eventSnapRaw.docs
    .filter((docSnap) => isListingPublic(docSnap.data() || {}))
    .map((docSnap) => normalizeEntityRecord(docSnap, "event"));
  const sessions = sessionSnapRaw.docs
    .filter((docSnap) => isListingPublic(docSnap.data() || {}))
    .map((docSnap) => normalizeEntityRecord(docSnap, "room_session"));
  const profiles = profileSnapRaw.docs
    .filter((docSnap) => isListingPublic(docSnap.data() || {}))
    .map((docSnap) => ({
      ...normalizeEntityRecord(docSnap, "profile"),
      roles: Array.from(extractProfileRoles(docSnap.data() || {})),
    }));

  const hosts = profiles.filter((item) => item.roles.includes("host"));
  const performers = profiles.filter((item) => item.roles.includes("performer"));
  const regionTokens = new Set(["nationwide", ...MARKETING_REGION_PRESETS.map((item) => canonicalizeRegionToken(item.id))]);
  const cityPairs = new Set(
    MARKETING_GEO_CITY_PRESETS.map((item) => `${normalizeToken(item.state)}:${normalizeCityToken(item.city)}`)
  );

  collectGeoTokens(venues, regionTokens, cityPairs);
  collectGeoTokens(events, regionTokens, cityPairs);
  collectGeoTokens(sessions, regionTokens, cityPairs);
  collectGeoTokens(profiles, regionTokens, cityPairs);

  return {
    source: "firestore",
    generatedAt: nowIso(),
    counts: {
      venues: venues.length,
      events: events.length,
      sessions: sessions.length,
      profiles: profiles.length,
      hosts: hosts.length,
      performers: performers.length,
      regions: regionTokens.size,
      cities: cityPairs.size,
    },
    venues,
    events,
    sessions,
    profiles,
    hosts,
    performers,
    regionTokens: Array.from(regionTokens).filter(Boolean).sort(),
    cityPairs: Array.from(cityPairs)
      .filter(Boolean)
      .sort()
      .map((entry) => {
        const [state, city] = String(entry || "").split(":");
        return { state, city };
      }),
  };
};

const normalizeLegacyCityPairs = (entries = []) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const state = normalizeToken(entry.state || "");
      const city = normalizeCityToken(entry.city || "");
      if (!state || !city) return null;
      return { state, city };
    })
    .filter(Boolean);

const loadLegacyManifestCache = async (outputDir) => {
  const candidates = [
    path.join(trackedPublicDir, "marketing-route-manifest.json"),
    path.join(outputDir, "marketing-route-manifest.json"),
  ];
  for (const candidate of candidates) {
    const parsed = await readJsonFileIfExists(candidate);
    if (!parsed || typeof parsed !== "object") continue;
    if (!Array.isArray(parsed.detailRoutes)) continue;
    return parsed;
  }
  return null;
};

const loadSeoManifestCache = async (outputDir) => {
  const candidates = [
    path.join(trackedPublicDir, "seo-route-manifest.json"),
    path.join(outputDir, "seo-route-manifest.json"),
  ];
  for (const candidate of candidates) {
    const parsed = await readJsonFileIfExists(candidate);
    if (!parsed || typeof parsed !== "object") continue;
    if (!Array.isArray(parsed.records) || !parsed.records.length) continue;
    return parsed;
  }
  return null;
};

const buildCachedRouteSpecsFromLegacyManifest = (manifest = {}) => {
  const specs = [];

  PUBLIC_CORE_ROUTE_PAGES.forEach((page) => {
    specs.push({ route: { page, id: "", params: {} }, entity: null });
  });

  (Array.isArray(manifest.geoRegionTokens) ? manifest.geoRegionTokens : []).forEach((regionToken) => {
    const route = parseMarketingRouteFromHref(buildMarketingPath({
      page: MARKETING_ROUTE_PAGES.geoRegion,
      id: regionToken,
      params: { regionToken },
    }));
    specs.push({ route, entity: { geoLabel: regionToken } });
  });

  normalizeLegacyCityPairs(manifest.geoCityPairs).forEach((entry) => {
    const route = parseMarketingRouteFromHref(buildMarketingPath({
      page: MARKETING_ROUTE_PAGES.geoCity,
      id: `${entry.state}:${entry.city}`,
      params: { state: entry.state, city: entry.city },
    }));
    specs.push({ route, entity: null });
  });

  (Array.isArray(manifest.detailRoutes) ? manifest.detailRoutes : []).forEach((routePath) => {
    const route = parseMarketingRouteFromHref(routePath);
    if (!route?.page) return;
    specs.push({ route, entity: null });
  });

  const deduped = new Map();
  specs.forEach((spec) => {
    const key = buildMarketingPath(spec.route);
    if (!deduped.has(key)) deduped.set(key, spec);
  });
  return Array.from(deduped.values());
};

const normalizeCachedSeoRecord = (record = {}, baseUrl = readSiteUrl()) => {
  const route = record?.route?.page
    ? {
      page: String(record.route.page || "").trim(),
      id: cleanText(record.route.id),
      params: record.route.params && typeof record.route.params === "object" ? record.route.params : {},
    }
    : parseMarketingRouteFromHref(record.routePath || "/");
  const baseRecord = buildSeoRouteRecord(route, { baseUrl });
  const robots = cleanText(record.robots, baseRecord.robots);
  const imageInput = record?.image && typeof record.image === "object" ? record.image : {};
  const imagePath = cleanText(
    imageInput.path,
    cleanText(imageInput.url).startsWith(baseUrl)
      ? cleanText(imageInput.url).slice(baseUrl.length)
      : baseRecord.image.path
  );
  const imageUrl = cleanText(
    imageInput.url,
    imagePath
      ? `${baseUrl}${imagePath.startsWith("/") ? imagePath : `/${imagePath}`}`
      : baseRecord.image.url
  );
  const indexable = robots.toLowerCase().includes("noindex") ? false : (record.indexable !== false && baseRecord.indexable);

  return {
    ...baseRecord,
    route,
    routePath: buildMarketingPath(route),
    title: cleanText(record.title, baseRecord.title),
    description: cleanText(record.description, baseRecord.description),
    canonicalUrl: cleanText(record.canonicalUrl, baseRecord.canonicalUrl),
    robots,
    ogType: cleanText(record.ogType, baseRecord.ogType),
    siteName: cleanText(record.siteName, baseRecord.siteName),
    image: {
      ...baseRecord.image,
      url: imageUrl || baseRecord.image.url,
      width: Number(imageInput.width || baseRecord.image.width || MARKETING_SOCIAL_IMAGE_WIDTH),
      height: Number(imageInput.height || baseRecord.image.height || MARKETING_SOCIAL_IMAGE_HEIGHT),
      alt: cleanText(imageInput.alt, baseRecord.image.alt),
      path: imagePath || baseRecord.image.path,
    },
    jsonLd: Array.isArray(record.jsonLd) && record.jsonLd.length ? record.jsonLd : baseRecord.jsonLd,
    indexable,
    sitemapImages: indexable && imageUrl ? [imageUrl] : [],
  };
};

const summarizeRouteDataFromRecords = (records = [], source = "seo_cache") => {
  const byPage = records.reduce((acc, record) => {
    const page = String(record?.route?.page || "").trim();
    if (!page) return acc;
    acc[page] = (acc[page] || 0) + 1;
    return acc;
  }, {});
  const regionTokens = new Set();
  const cityPairs = new Set();
  records.forEach((record) => {
    const page = String(record?.route?.page || "").trim();
    if (page === MARKETING_ROUTE_PAGES.geoRegion) {
      const token = canonicalizeRegionToken(record?.route?.params?.regionToken || record?.route?.id || "");
      if (token) regionTokens.add(token);
    }
    if (page === MARKETING_ROUTE_PAGES.geoCity) {
      const state = normalizeToken(record?.route?.params?.state || "");
      const city = normalizeCityToken(record?.route?.params?.city || "");
      if (state && city) cityPairs.add(`${state}:${city}`);
    }
  });

  return {
    source,
    generatedAt: nowIso(),
    counts: {
      totalRoutes: records.length,
      detailRoutes: records.filter((record) => ROUTE_DETAIL_PAGES.has(record?.route?.page)).length,
      byPage,
    },
    regionTokens: Array.from(regionTokens).sort(),
    cityPairs: Array.from(cityPairs).sort().map((entry) => {
      const [state, city] = String(entry || "").split(":");
      return { state, city };
    }),
  };
};

const buildRouteSpecs = (routeData = {}) => {
  const staticRoutes = PUBLIC_CORE_ROUTE_PAGES.map((page) => ({
    route: { page, id: "", params: {} },
    entity: {
      pageType: page,
      ...(page === MARKETING_ROUTE_PAGES.forFans
        ? { socialCardAlt: "BeauRocks Karaoke neon logo with microphone over a retro stage grid." }
        : {}),
    },
  }));
  const geoRoutes = [
    ...routeData.regionTokens.map((regionToken) => ({
      route: { page: MARKETING_ROUTE_PAGES.geoRegion, id: regionToken, params: { regionToken } },
      entity: { geoLabel: MARKETING_REGION_PRESETS.find((item) => canonicalizeRegionToken(item.id) === regionToken)?.label || "" },
    })),
    ...routeData.cityPairs.map((entry) => ({
      route: {
        page: MARKETING_ROUTE_PAGES.geoCity,
        id: `${entry.state}:${entry.city}`,
        params: { state: entry.state, city: entry.city },
      },
      entity: {},
    })),
  ];
  const detailRoutes = [
    ...routeData.venues.map((entity) => ({
      route: { page: MARKETING_ROUTE_PAGES.venue, id: entity.id, params: {} },
      entity,
    })),
    ...routeData.events.map((entity) => ({
      route: { page: MARKETING_ROUTE_PAGES.event, id: entity.id, params: {} },
      entity,
    })),
    ...routeData.hosts.map((entity) => ({
      route: { page: MARKETING_ROUTE_PAGES.host, id: entity.id, params: {} },
      entity,
    })),
    ...routeData.performers.map((entity) => ({
      route: { page: MARKETING_ROUTE_PAGES.performer, id: entity.id, params: {} },
      entity,
    })),
  ];

  const allSpecs = [...staticRoutes, ...geoRoutes, ...detailRoutes];
  const deduped = new Map();
  allSpecs.forEach((spec) => {
    const key = buildMarketingPath(spec.route);
    if (!deduped.has(key)) deduped.set(key, spec);
  });
  return Array.from(deduped.values());
};

const escapeHtml = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const wrapText = (value = "", maxChars = 34, maxLines = 3) => {
  const words = cleanText(value).split(" ").filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
};

const isPlaceholderImage = (value = "") => {
  const token = cleanText(value).toLowerCase();
  if (!token) return true;
  return token.includes("venue-location-fallback")
    || token.includes("beaurocks-logo")
    || token.includes("bross-ent-favicon")
    || token.includes("logo-library")
    || token.endsWith(".svg");
};

const localPathForPublicAsset = (assetPath = "", outputDir = trackedPublicDir) => {
  const token = cleanText(assetPath);
  if (!token.startsWith("/")) return "";
  const distCandidate = path.join(outputDir, trimSlashes(token));
  if (fsSync.existsSync(distCandidate)) return distCandidate;
  const publicCandidate = path.join(trackedPublicDir, trimSlashes(token));
  if (fsSync.existsSync(publicCandidate)) return publicCandidate;
  return "";
};

const loadRemoteBuffer = async (url) => {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const loadBufferForImage = async (imagePath = "", outputDir = trackedPublicDir) => {
  const token = cleanText(imagePath);
  if (!token) return null;
  if (token.startsWith("/")) {
    const resolved = localPathForPublicAsset(token, outputDir);
    if (!resolved) return null;
    return fs.readFile(resolved);
  }
  if (/^https?:\/\//i.test(token)) {
    try {
      return await loadRemoteBuffer(token.replace(/^http:\/\//i, "https://"));
    } catch {
      return null;
    }
  }
  return null;
};

const getCardBackgroundCandidates = (route = {}, entity = null) => {
  const page = String(route?.page || "");
  const candidates = [];
  if (entity && ROUTE_DETAIL_PAGES.has(page)) {
    const listingType = page === MARKETING_ROUTE_PAGES.host
      ? "host"
      : page === MARKETING_ROUTE_PAGES.performer
        ? "performer"
        : page;
    resolveListingImageCandidates(entity, listingType, { includeFallback: false })
      .filter((url) => !isPlaceholderImage(url))
      .forEach((url) => candidates.push(url));
    const avatar = resolveProfileAvatarUrl(entity);
    if (avatar && !isPlaceholderImage(avatar)) candidates.push(avatar);
  }
  candidates.push(CARD_BACKGROUND_BY_PAGE[page] || CARD_BACKGROUND_BY_PAGE.default);
  return candidates.filter(Boolean);
};

const buildCardOverlaySvg = ({
  title = "",
  description = "",
  kicker = "",
  logoUrl = "",
}) => {
  const titleLines = wrapText(title, 30, 3);
  const descriptionLines = wrapText(description, 54, 3);
  const titleMarkup = titleLines
    .map((line, index) => `<text x="72" y="${240 + (index * 72)}" font-size="58" font-weight="700" fill="#f7f8fb">${escapeHtml(line)}</text>`)
    .join("");
  const descriptionMarkup = descriptionLines
    .map((line, index) => `<text x="72" y="${480 + (index * 34)}" font-size="28" font-weight="400" fill="#d9deeb">${escapeHtml(line)}</text>`)
    .join("");

  return Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mkCardOverlay" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#05060a" stop-opacity="0.78"/>
          <stop offset="55%" stop-color="#090b12" stop-opacity="0.58"/>
          <stop offset="100%" stop-color="#111630" stop-opacity="0.86"/>
        </linearGradient>
      </defs>
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#mkCardOverlay)"/>
      <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="none" stroke="rgba(255,255,255,0.08)"/>
      <rect x="72" y="72" rx="18" ry="18" width="220" height="48" fill="rgba(255,255,255,0.12)"/>
      <text x="92" y="104" font-size="24" font-weight="600" fill="#ffd27c" letter-spacing="0.06em">${escapeHtml(kicker)}</text>
      ${titleMarkup}
      ${descriptionMarkup}
      <text x="72" y="584" font-size="24" font-weight="600" fill="#8ff0ff" letter-spacing="0.08em">BEAUROCKS KARAOKE</text>
      ${logoUrl ? `<image href="${escapeHtml(logoUrl)}" x="1020" y="54" width="116" height="116" preserveAspectRatio="xMidYMid meet" />` : ""}
    </svg>
  `);
};

const buildForFansCardOverlaySvg = ({
  title = "",
  description = "",
}) => {
  const titleLines = wrapText(title, 28, 2);
  const descriptionLines = wrapText(description, 58, 2);
  const titleMarkup = titleLines
    .map((line, index) => `<text x="72" y="${480 + (index * 52)}" font-size="44" font-weight="700" fill="#f8fbff">${escapeHtml(line)}</text>`)
    .join("");
  const descriptionMarkup = descriptionLines
    .map((line, index) => `<text x="72" y="${584 + (index * 28)}" font-size="24" font-weight="500" fill="#d6def2">${escapeHtml(line)}</text>`)
    .join("");

  return Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mkHomeShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#02030a" stop-opacity="0.02"/>
          <stop offset="60%" stop-color="#050611" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="#04050d" stop-opacity="0.84"/>
        </linearGradient>
        <linearGradient id="mkHomePanel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(12,16,30,0.74)"/>
          <stop offset="100%" stop-color="rgba(27,9,44,0.86)"/>
        </linearGradient>
      </defs>
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#mkHomeShade)"/>
      <rect x="48" y="390" rx="28" ry="28" width="740" height="196" fill="url(#mkHomePanel)" stroke="rgba(255,255,255,0.12)"/>
      <text x="72" y="438" font-size="22" font-weight="700" fill="#8ff0ff" letter-spacing="0.1em">BEAUROCKS KARAOKE</text>
      ${titleMarkup}
      ${descriptionMarkup}
    </svg>
  `);
};

const createSocialCard = async ({ route = {}, entity = null, routeRecord = null, outputDir = trackedPublicDir }) => {
  const preferredImagePath = cleanText(routeRecord?.image?.path || routeRecord?.image?.url || "");
  const candidates = [
    ...(preferredImagePath ? [preferredImagePath] : []),
    ...getCardBackgroundCandidates(route, entity),
  ];
  let backgroundBuffer = null;
  for (const candidate of candidates) {
    backgroundBuffer = await loadBufferForImage(candidate, outputDir);
    if (backgroundBuffer) break;
  }

  const fallbackBackground = await loadBufferForImage(CARD_BACKGROUND_BY_PAGE.default, outputDir);
  const logoPath = localPathForPublicAsset(MARKETING_LOGO_CARD_PATH, outputDir);
  const logoBuffer = logoPath ? await fs.readFile(logoPath) : null;

  const resolvedRouteRecord = routeRecord || buildSeoRouteRecord(route, {
    baseUrl: readSiteUrl(),
    entity,
  });
  const slug = buildMarketingSocialSlug(route, entity);
  const publicCardPath = `/${MARKETING_SOCIAL_DIR}/${slug}.png`;
  const filePath = path.join(outputDir, trimSlashes(publicCardPath));
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const overlay = route.page === MARKETING_ROUTE_PAGES.forFans
    ? buildForFansCardOverlaySvg({
      title: resolvedRouteRecord.title.replace(/\s*\|\s*BeauRocks.*$/, ""),
      description: resolvedRouteRecord.description,
    })
    : buildCardOverlaySvg({
      title: resolvedRouteRecord.title.replace(/\s*\|\s*BeauRocks.*$/, ""),
      description: resolvedRouteRecord.description,
      kicker: PAGE_KICKER[String(route.page || "")] || "BeauRocks",
      logoUrl: logoBuffer ? `data:image/png;base64,${logoBuffer.toString("base64")}` : "",
    });

  const background = backgroundBuffer || fallbackBackground;
  const image = sharp(background)
    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover" });

  if (route.page === MARKETING_ROUTE_PAGES.forFans) {
    image.modulate({ brightness: 0.95, saturation: 1.08 });
  } else {
    image.modulate({ brightness: 0.82, saturation: 1.05 }).blur(1);
  }

  await image
    .composite([
      { input: overlay, top: 0, left: 0 },
    ])
    .png()
    .toFile(filePath);

  return publicCardPath;
};

const buildRouteHtml = (templateHtml = "", routeRecord = {}) => {
  const jsonLdText = JSON.stringify(routeRecord.jsonLd).replace(/</g, "\\u003c");
  const headTags = [
    `    <title>${escapeHtml(routeRecord.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(routeRecord.description)}" />`,
    `    <meta name="robots" content="${escapeHtml(routeRecord.robots)}" />`,
    `    <meta property="og:type" content="${escapeHtml(routeRecord.ogType)}" />`,
    `    <meta property="og:title" content="${escapeHtml(routeRecord.title)}" />`,
    `    <meta property="og:description" content="${escapeHtml(routeRecord.description)}" />`,
    `    <meta property="og:url" content="${escapeHtml(routeRecord.canonicalUrl)}" />`,
    `    <meta property="og:site_name" content="${escapeHtml(routeRecord.siteName)}" />`,
    `    <meta property="og:image" content="${escapeHtml(routeRecord.image?.url || "")}" />`,
    `    <meta property="og:image:width" content="${escapeHtml(routeRecord.image?.width || "")}" />`,
    `    <meta property="og:image:height" content="${escapeHtml(routeRecord.image?.height || "")}" />`,
    `    <meta property="og:image:alt" content="${escapeHtml(routeRecord.image?.alt || "")}" />`,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    `    <meta name="twitter:title" content="${escapeHtml(routeRecord.title)}" />`,
    `    <meta name="twitter:description" content="${escapeHtml(routeRecord.description)}" />`,
    `    <meta name="twitter:image" content="${escapeHtml(routeRecord.image?.url || "")}" />`,
    `    <link rel="canonical" href="${escapeHtml(routeRecord.canonicalUrl)}" />`,
    `    <link rel="icon" type="image/png" href="${MARKETING_FAVICON_PATH}" />`,
    `    <link rel="apple-touch-icon" href="${MARKETING_APPLE_TOUCH_ICON_PATH}" />`,
    `    <script type="application/ld+json">${jsonLdText}</script>`,
  ].join("\n");

  const routePayloadScript = `    <script>window.__MARKETING_PRERENDER_ROUTE__=${JSON.stringify(routeRecord.route)};</script>`;
  const sanitizedTemplate = templateHtml
    .replace(/<title>.*?<\/title>\s*/i, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/i, "")
    .replace(/<meta\s+name="robots"[^>]*>\s*/i, "")
    .replace(/<meta\s+property="og:site_name"[^>]*>\s*/i, "")
    .replace(/<link\s+rel="icon"[^>]*>\s*/i, "")
    .replace(/<link\s+rel="apple-touch-icon"[^>]*>\s*/i, "");
  const injectedHead = sanitizedTemplate.replace("</head>", `${headTags}\n${routePayloadScript}\n  </head>`);
  return injectedHead;
};

const writePrerenderedHtml = async ({ templateHtml = "", routeRecord = {}, outputDir = trackedPublicDir }) => {
  const routePath = String(routeRecord.routePath || "").trim();
  if (!routePath || routePath === "/") return;
  const destination = path.join(outputDir, trimSlashes(routePath), "index.html");
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, buildRouteHtml(templateHtml, routeRecord), "utf8");
};

const buildSitemapXml = (siteUrl, records = []) => {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">');
  records
    .filter((record) => record.indexable)
    .forEach((record) => {
      lines.push("  <url>");
      lines.push(`    <loc>${record.canonicalUrl}</loc>`);
      lines.push(`    <lastmod>${record.lastmod}</lastmod>`);
      lines.push("    <changefreq>daily</changefreq>");
      lines.push(`    <priority>${record.priority}</priority>`);
      (Array.isArray(record.sitemapImages) ? record.sitemapImages : []).forEach((imageUrl) => {
        lines.push("    <image:image>");
        lines.push(`      <image:loc>${imageUrl}</image:loc>`);
        lines.push("    </image:image>");
      });
      lines.push("  </url>");
    });
  lines.push("</urlset>");
  lines.push("");
  return lines.join("\n");
};

const buildRobotsTxt = (siteUrl) => {
  const sitemapUrl = `${siteUrl}${withBasePath("/sitemap.xml")}`;
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${sitemapUrl}`,
    "",
  ].join("\n");
};

const getRoutePriority = (page = "") => {
  if (page === MARKETING_ROUTE_PAGES.discover) return "1.0";
  if (page === MARKETING_ROUTE_PAGES.forHosts || page === MARKETING_ROUTE_PAGES.forVenues) return "0.9";
  if (page === MARKETING_ROUTE_PAGES.forFans || page === MARKETING_ROUTE_PAGES.forPerformers) return "0.8";
  if (page === MARKETING_ROUTE_PAGES.geoCity || page === MARKETING_ROUTE_PAGES.geoRegion) return "0.8";
  if (page === MARKETING_ROUTE_PAGES.changelog) return "0.5";
  return "0.6";
};

const buildLegacyManifest = (routeData = {}, records = []) => ({
  source: routeData.source || "firestore",
  generatedAt: routeData.generatedAt || nowIso(),
  counts: {
    ...(routeData.counts || {}),
    detailRoutes: records.filter((record) => ROUTE_DETAIL_PAGES.has(record.route.page)).length,
  },
  geoRegionTokens: routeData.regionTokens || [],
  geoCityPairs: routeData.cityPairs || [],
  detailRoutes: records
    .filter((record) => ROUTE_DETAIL_PAGES.has(record.route.page))
    .map((record) => record.routePath)
    .sort(),
});

const buildSeoManifest = (routeData = {}, records = []) => ({
  source: routeData.source || "firestore",
  generatedAt: routeData.generatedAt || nowIso(),
  counts: routeData.counts || {},
  records,
});

const syncTrackedSeoCache = async ({
  outputDir,
  legacyManifest,
  seoManifest,
  sitemapXml,
  robotsTxt,
} = {}) => {
  if (samePath(outputDir, trackedPublicDir)) return;
  await fs.writeFile(path.join(trackedPublicDir, "marketing-route-manifest.json"), JSON.stringify(legacyManifest, null, 2), "utf8");
  await fs.writeFile(path.join(trackedPublicDir, "seo-route-manifest.json"), JSON.stringify(seoManifest, null, 2), "utf8");
  await fs.writeFile(path.join(trackedPublicDir, "sitemap.xml"), sitemapXml, "utf8");
  await fs.writeFile(path.join(trackedPublicDir, "robots.txt"), robotsTxt, "utf8");
};

const run = async () => {
  const siteUrl = readSiteUrl();
  const outputDir = resolveOutputDir();
  const templatePath = fsSync.existsSync(path.join(outputDir, "index.html"))
    ? path.join(outputDir, "index.html")
    : path.join(projectRoot, "index.html");
  const templateHtml = await fs.readFile(templatePath, "utf8");

  let routeData = null;
  let routeSpecs = [];
  let cachedRecords = [];
  try {
    routeData = await loadRouteDataFromFirestore();
    routeSpecs = buildRouteSpecs(routeData);
  } catch (error) {
    const seoCache = await loadSeoManifestCache(outputDir);
    if (seoCache?.records?.length) {
      cachedRecords = seoCache.records.map((record) => normalizeCachedSeoRecord(record, siteUrl));
      routeData = summarizeRouteDataFromRecords(cachedRecords, seoCache.source || "seo_manifest_cache");
      process.stdout.write(
        `SEO generator: Firestore unavailable, using cached seo-route-manifest.json with ${cachedRecords.length} records.\n`
      );
    } else {
      const legacyCache = await loadLegacyManifestCache(outputDir);
      if (!legacyCache) throw error;
      routeData = {
        source: legacyCache.source || "legacy_manifest_cache",
        generatedAt: nowIso(),
        counts: legacyCache.counts || {},
        regionTokens: Array.isArray(legacyCache.geoRegionTokens) ? legacyCache.geoRegionTokens : [],
        cityPairs: normalizeLegacyCityPairs(legacyCache.geoCityPairs),
      };
      routeSpecs = buildCachedRouteSpecsFromLegacyManifest(legacyCache);
      process.stdout.write(
        `SEO generator: Firestore unavailable, using cached marketing-route-manifest.json with ${routeSpecs.length} routes.\n`
      );
    }
  }

  const records = [];
  if (cachedRecords.length) {
    for (const cachedRecord of cachedRecords) {
      const socialCardPath = await createSocialCard({
        route: cachedRecord.route,
        entity: {
          socialCardPath: cachedRecord.image?.path || "",
          socialCardAlt: cachedRecord.image?.alt || "",
          id: cachedRecord.route?.id || "",
        },
        routeRecord: cachedRecord,
        outputDir,
      });
      records.push({
        ...cachedRecord,
        image: {
          ...(cachedRecord.image || {}),
          path: socialCardPath,
          url: `${siteUrl}${socialCardPath}`,
        },
        sitemapImages: cachedRecord.indexable ? [`${siteUrl}${socialCardPath}`] : [],
        lastmod: nowIso(),
        priority: getRoutePriority(cachedRecord.route.page),
      });
    }
  } else {
    for (const spec of routeSpecs) {
      const socialCardPath = await createSocialCard({
        route: spec.route,
        entity: spec.entity,
        outputDir,
      });
      const record = buildSeoRouteRecord(spec.route, {
        baseUrl: siteUrl,
        entity: {
          ...(spec.entity || {}),
          socialCardPath,
        },
      });
      records.push({
        ...record,
        lastmod: nowIso(),
        priority: getRoutePriority(record.route.page),
      });
    }
  }

  const legacyManifest = buildLegacyManifest(routeData, records);
  const seoManifest = buildSeoManifest(routeData, records);
  const sitemapXml = buildSitemapXml(siteUrl, records);
  const robotsTxt = buildRobotsTxt(siteUrl);

  await fs.writeFile(path.join(outputDir, "marketing-route-manifest.json"), JSON.stringify(legacyManifest, null, 2), "utf8");
  await fs.writeFile(path.join(outputDir, "seo-route-manifest.json"), JSON.stringify(seoManifest, null, 2), "utf8");
  await fs.writeFile(path.join(outputDir, "sitemap.xml"), sitemapXml, "utf8");
  await fs.writeFile(path.join(outputDir, "robots.txt"), robotsTxt, "utf8");
  await syncTrackedSeoCache({
    outputDir,
    legacyManifest,
    seoManifest,
    sitemapXml,
    robotsTxt,
  });

  for (const record of records) {
    await writePrerenderedHtml({
      templateHtml,
      routeRecord: record,
      outputDir,
    });
  }

  process.stdout.write(
    `Generated marketing SEO assets in ${path.relative(projectRoot, outputDir) || "."}: ${records.length} prerendered routes, ${records.length} social cards, sitemap.xml, robots.txt, seo-route-manifest.json\n`
  );
};

run().catch((error) => {
  console.error("Failed to generate marketing SEO assets.");
  console.error(error);
  process.exit(1);
});
