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

const trimSlashes = (value = "") => String(value || "").replace(/^\/+|\/+$/g, "");
const cleanBasePath = (() => {
  const raw = process.env.BASE_URL || "/";
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
  const raw = process.env.SITE_URL || process.env.VITE_SITE_URL || "https://beaurocks.com";
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

const loadManifestFromFirestore = async () => {
  const enabled = String(process.env.SITEMAP_USE_FIRESTORE || "true").trim().toLowerCase() !== "false";
  if (!enabled) return null;
  const admin = loadFirebaseAdmin();
  if (!admin) return null;
  try {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    const db = admin.firestore();
    const [venueSnap, eventSnap, sessionSnap, profileSnap] = await Promise.all([
      db.collection("venues").where("status", "==", "approved").limit(3000).get(),
      db.collection("karaoke_events").where("status", "==", "approved").limit(3500).get(),
      db.collection("room_sessions")
        .where("status", "==", "approved")
        .where("visibility", "==", "public")
        .limit(3500)
        .get(),
      db.collection("directory_profiles").where("status", "==", "approved").limit(2500).get(),
    ]);

    const regionTokens = new Set(["nationwide"]);
    const geoCities = new Set();
    const detailRoutes = new Set();

    const consumeGeo = (data = {}) => {
      const region = safeToken(data.region || "");
      if (region) regionTokens.add(region);
      const state = safeToken(data.state || "");
      const city = toCitySlug(data.city || "");
      if (state && city) geoCities.add(`${state}:${city}`);
    };

    venueSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      consumeGeo(data);
      detailRoutes.add(`/venues/${encodeURIComponent(docSnap.id)}`);
    });
    eventSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      consumeGeo(data);
      detailRoutes.add(`/events/${encodeURIComponent(docSnap.id)}`);
      const hostUid = safeToken(data.hostUid || "");
      if (hostUid) detailRoutes.add(`/hosts/${encodeURIComponent(hostUid)}`);
    });
    sessionSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      consumeGeo(data);
      detailRoutes.add(`/sessions/${encodeURIComponent(docSnap.id)}`);
      const hostUid = safeToken(data.hostUid || "");
      if (hostUid) detailRoutes.add(`/hosts/${encodeURIComponent(hostUid)}`);
    });
    profileSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      consumeGeo(data);
      const roles = Array.isArray(data.roles) ? data.roles.map((entry) => safeToken(entry)) : [];
      if (roles.includes("performer")) {
        detailRoutes.add(`/performers/${encodeURIComponent(docSnap.id)}`);
      }
      if (roles.includes("host")) {
        detailRoutes.add(`/hosts/${encodeURIComponent(docSnap.id)}`);
      }
    });

    return {
      source: "firestore",
      generatedAt: new Date().toISOString(),
      counts: {
        venues: venueSnap.size,
        events: eventSnap.size,
        sessions: sessionSnap.size,
        profiles: profileSnap.size,
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
    };
  } catch {
    return null;
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
  const live = await loadManifestFromFirestore();
  if (live) return live;
  const existing = await loadExistingManifest();
  if (existing) return { ...existing, source: `${existing.source || "cached"}_cached` };
  return buildStaticManifest();
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
  const manifest = await resolveManifest();
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
