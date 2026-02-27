import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MARKETING_REGION_PRESETS, MARKETING_GEO_CITY_PRESETS } from "../src/apps/Marketing/geoPresets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const require = createRequire(import.meta.url);

const readEnv = (name = "", fallback = "") => {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  return String(value);
};

const readEnvBool = (name, fallback = false) => {
  const raw = readEnv(name, "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
};

const trimSlashes = (value = "") => String(value || "").replace(/^\/+|\/+$/g, "");
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
  const raw = readEnv("SITE_URL", readEnv("VITE_SITE_URL", "https://beaurocks.com"));
  return String(raw || "").trim().replace(/\/+$/, "");
};

const safeToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const toCitySlug = (value = "") => safeToken(String(value || "").replace(/\s+/g, "-"));

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

const toErrorMessage = (error) => String(error?.message || error || "unknown error").replace(/\s+/g, " ").trim();

const parseServiceAccountPayload = (raw = "") => {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const loadServiceAccount = async () => {
  const inlinePayload = parseServiceAccountPayload(
    readEnv("SITEMAP_FIREBASE_SERVICE_ACCOUNT_JSON")
    || readEnv("FIREBASE_SERVICE_ACCOUNT_JSON")
    || readEnv("GOOGLE_SERVICE_ACCOUNT_JSON")
  );
  if (inlinePayload) return inlinePayload;

  const relativeFile = readEnv("SITEMAP_FIREBASE_SERVICE_ACCOUNT_FILE", "").trim();
  if (!relativeFile) return null;
  const serviceAccountPath = path.isAbsolute(relativeFile)
    ? relativeFile
    : path.join(projectRoot, relativeFile);
  try {
    const raw = await fs.readFile(serviceAccountPath, "utf8");
    return parseServiceAccountPayload(raw);
  } catch {
    return null;
  }
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
  const visibility = safeToken(data.visibility || "public");
  return !["private", "hidden", "invite-only", "invite_only", "unlisted", "draft"].includes(visibility);
};

const resolveHostUid = (data = {}) => {
  const candidate = data.hostUid || data.hostId || data.ownerUid || data.ownerId || "";
  return safeToken(candidate);
};

const extractProfileRoles = (data = {}) => {
  const roles = new Set();
  const addRole = (value = "") => {
    const token = safeToken(value);
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

const resolveRegionToken = (data = {}) => safeToken(
  data.region
  || data.regionToken
  || data.location?.region
  || ""
);

const resolveStateToken = (data = {}) => safeToken(
  data.state
  || data.stateCode
  || data.location?.state
  || data.geo?.state
  || ""
);

const resolveCityToken = (data = {}) => toCitySlug(
  data.city
  || data.location?.city
  || data.geo?.city
  || ""
);

const loadManifestFromFirestore = async () => {
  const enabled = readEnvBool("SITEMAP_USE_FIRESTORE", true);
  if (!enabled) return { manifest: null, error: null };
  const admin = loadFirebaseAdmin();
  if (!admin) {
    return {
      manifest: null,
      error: new Error("firebase-admin is unavailable. Install dependency or provide functions/node_modules fallback."),
    };
  }
  try {
    await initializeFirebaseAdmin(admin);
    const db = admin.firestore();
    const [venueSnapRaw, eventSnapRaw, sessionSnapRaw, profileSnapRaw] = await Promise.all([
      db.collection("venues").where("status", "==", "approved").limit(5000).get(),
      db.collection("karaoke_events").where("status", "==", "approved").limit(6000).get(),
      db.collection("room_sessions").where("status", "==", "approved").limit(6000).get(),
      db.collection("directory_profiles").where("status", "==", "approved").limit(4500).get(),
    ]);

    const venueDocs = venueSnapRaw.docs.filter((docSnap) => isListingPublic(docSnap.data() || {}));
    const eventDocs = eventSnapRaw.docs.filter((docSnap) => isListingPublic(docSnap.data() || {}));
    const sessionDocs = sessionSnapRaw.docs.filter((docSnap) => isListingPublic(docSnap.data() || {}));
    const profileDocs = profileSnapRaw.docs.filter((docSnap) => isListingPublic(docSnap.data() || {}));

    const regionTokens = new Set(["nationwide"]);
    const geoCities = new Set();
    const detailRoutes = new Set();

    const consumeGeo = (data = {}) => {
      const region = resolveRegionToken(data);
      if (region) regionTokens.add(region);
      const state = resolveStateToken(data);
      const city = resolveCityToken(data);
      if (state && city) geoCities.add(`${state}:${city}`);
    };

    venueDocs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      consumeGeo(data);
      detailRoutes.add(`/venues/${encodeURIComponent(docSnap.id)}`);
    });
    eventDocs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      consumeGeo(data);
      detailRoutes.add(`/events/${encodeURIComponent(docSnap.id)}`);
      const hostUid = resolveHostUid(data);
      if (hostUid) detailRoutes.add(`/hosts/${encodeURIComponent(hostUid)}`);
    });
    sessionDocs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      consumeGeo(data);
      detailRoutes.add(`/sessions/${encodeURIComponent(docSnap.id)}`);
      const hostUid = resolveHostUid(data);
      if (hostUid) detailRoutes.add(`/hosts/${encodeURIComponent(hostUid)}`);
    });
    profileDocs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      consumeGeo(data);
      const roles = extractProfileRoles(data);
      if (roles.has("performer")) {
        detailRoutes.add(`/performers/${encodeURIComponent(docSnap.id)}`);
      }
      if (roles.has("host")) {
        detailRoutes.add(`/hosts/${encodeURIComponent(docSnap.id)}`);
      }
    });

    return {
      manifest: {
        source: "firestore",
        generatedAt: new Date().toISOString(),
        counts: {
          venues: venueDocs.length,
          events: eventDocs.length,
          sessions: sessionDocs.length,
          profiles: profileDocs.length,
          regions: regionTokens.size,
          cities: geoCities.size,
          detailRoutes: detailRoutes.size,
        },
        geoRegionTokens: Array.from(regionTokens).sort(),
        geoCityPairs: Array.from(geoCities).map((entry) => {
          const [state, city] = String(entry || "").split(":");
          return { state, city };
        }),
        detailRoutes: Array.from(detailRoutes).sort(),
      },
      error: null,
    };
  } catch (error) {
    return { manifest: null, error };
  }
};

const loadExistingManifest = async () => {
  const file = path.join(publicDir, "marketing-route-manifest.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const buildStaticManifest = () => ({
  source: "static",
  generatedAt: new Date().toISOString(),
  counts: {},
  geoRegionTokens: MARKETING_REGION_PRESETS
    .map((item) => safeToken(item.id || ""))
    .filter(Boolean),
  geoCityPairs: MARKETING_GEO_CITY_PRESETS
    .map((item) => ({ state: safeToken(item.state || ""), city: toCitySlug(item.city || "") }))
    .filter((item) => item.state && item.city),
  detailRoutes: [],
});

const resolveManifest = async () => {
  const strictFirestore = readEnvBool("SITEMAP_STRICT_FIRESTORE", false);
  const requireDetailRoutes = readEnvBool("SITEMAP_REQUIRE_DETAIL_ROUTES", false);
  const warnings = [];

  const live = await loadManifestFromFirestore();
  if (live?.manifest) {
    const detailRouteCount = Array.isArray(live.manifest.detailRoutes) ? live.manifest.detailRoutes.length : 0;
    if (requireDetailRoutes && detailRouteCount === 0) {
      throw new Error("SITEMAP_REQUIRE_DETAIL_ROUTES is enabled but Firestore manifest returned zero detail routes.");
    }
    return { manifest: live.manifest, warnings };
  }
  if (live?.error) {
    warnings.push(`Firestore sitemap source unavailable: ${toErrorMessage(live.error)}`);
  }
  if (strictFirestore) {
    throw new Error("SITEMAP_STRICT_FIRESTORE is enabled and live Firestore manifest could not be loaded.");
  }

  const existing = await loadExistingManifest();
  if (existing) {
    warnings.push("Using cached marketing-route-manifest.json fallback.");
    const cachedSourceBase = String(existing.source || "cached").replace(/(?:_cached)+$/g, "") || "cached";
    return {
      manifest: { ...existing, source: `${cachedSourceBase}_cached` },
      warnings,
    };
  }
  warnings.push("Using static preset fallback manifest with no dynamic detail routes.");
  return { manifest: buildStaticManifest(), warnings };
};

const buildUrlEntries = (manifest = null) => {
  const nowIso = new Date().toISOString();
  const resolved = manifest && typeof manifest === "object" ? manifest : buildStaticManifest();
  const core = [
    { path: "/discover", changefreq: "hourly", priority: "1.0" },
    { path: "/for-hosts", changefreq: "daily", priority: "0.9" },
    { path: "/for-venues", changefreq: "daily", priority: "0.9" },
    { path: "/for-performers", changefreq: "daily", priority: "0.8" },
    { path: "/for-fans", changefreq: "daily", priority: "0.8" },
    { path: "/join", changefreq: "weekly", priority: "0.3" },
    { path: "/karaoke/nationwide", changefreq: "daily", priority: "0.8" },
  ];
  const geoByRegion = (Array.isArray(resolved.geoRegionTokens) ? resolved.geoRegionTokens : [])
    .map((id) => safeToken(id))
    .filter(Boolean)
    .map((id) => ({ path: `/karaoke/${id}`, changefreq: "daily", priority: "0.7" }));
  const geoByCity = (Array.isArray(resolved.geoCityPairs) ? resolved.geoCityPairs : [])
    .map((item) => ({
      state: safeToken(item.state || ""),
      city: toCitySlug(item.city || ""),
    }))
    .filter((item) => item.state && item.city)
    .map((item) => ({
      path: `/karaoke/us/${item.state}/${item.city}`,
      changefreq: "daily",
      priority: "0.8",
    }));
  const detailRoutes = (Array.isArray(resolved.detailRoutes) ? resolved.detailRoutes : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .map((entry) => ({
      path: entry.startsWith("/") ? entry : `/${entry}`,
      changefreq: "daily",
      priority: "0.6",
    }));

  const unique = new Map();
  [...core, ...geoByRegion, ...geoByCity, ...detailRoutes].forEach((entry) => {
    const route = withBasePath(entry.path || "/");
    if (unique.has(route)) return;
    unique.set(route, {
      locPath: route,
      lastmod: nowIso,
      changefreq: entry.changefreq || "weekly",
      priority: entry.priority || "0.5",
    });
  });
  return Array.from(unique.values());
};

const buildSitemapXml = (siteUrl, entries = []) => {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  entries.forEach((entry) => {
    const loc = `${siteUrl}${entry.locPath}`;
    lines.push("  <url>");
    lines.push(`    <loc>${loc}</loc>`);
    lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    lines.push(`    <priority>${entry.priority}</priority>`);
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

const run = async () => {
  const siteUrl = readSiteUrl();
  const { manifest, warnings } = await resolveManifest();
  warnings.forEach((line) => {
    process.stderr.write(`[seo:sitemap] ${line}\n`);
  });
  const entries = buildUrlEntries(manifest);
  const sitemapXml = buildSitemapXml(siteUrl, entries);
  const robotsTxt = buildRobotsTxt(siteUrl);
  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(
    path.join(publicDir, "marketing-route-manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
  await fs.writeFile(path.join(publicDir, "sitemap.xml"), sitemapXml, "utf8");
  await fs.writeFile(path.join(publicDir, "robots.txt"), robotsTxt, "utf8");
  process.stdout.write(
    `Generated sitemap.xml (${entries.length} urls), robots.txt, and marketing-route-manifest.json from ${manifest.source || "unknown"} for ${siteUrl}\n`
  );
};

run().catch((error) => {
  console.error("Failed to generate sitemap/robots.");
  console.error(error);
  process.exit(1);
});
