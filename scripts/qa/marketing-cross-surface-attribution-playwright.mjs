import {
  delay,
  ensurePlaywright,
  runCheck,
  startStaticDistServer,
} from "./shared/playwrightQa.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://beaurocks.app";
const DEFAULT_TIMEOUT_MS = 70000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");

const DEMO_FIREBASE_CONFIG = {
  apiKey: "demo-api-key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456",
};

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isManagedHost = (hostname = "") =>
  hostname.endsWith(".web.app") || hostname.endsWith(".firebaseapp.com");

const isLocalHost = (hostname = "") => {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
};

const deriveRootDomain = (hostname = "") => {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return "";
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || isManagedHost(host)) return host;
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  if (["www", "app", "host", "tv"].includes(parts[0])) {
    return parts.slice(1).join(".");
  }
  return parts.slice(-2).join(".");
};

const expectedHostnameForSurface = (baseHostname = "", surface = "app") => {
  const host = String(baseHostname || "").trim().toLowerCase();
  if (!host) return "";
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || isManagedHost(host)) return host;
  const root = deriveRootDomain(host);
  if (!root) return host;
  if (surface === "marketing") return root;
  return `${surface}.${root}`;
};

const sanitizeRoomCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");

const getPathWithQuery = (urlText = "") => {
  const parsed = new URL(urlText);
  return `${parsed.pathname}${parsed.search}`;
};

const getMarketingEvents = async (page) => page.evaluate(() => ({
  events: Array.isArray(window.__beaurocks_marketing_events) ? window.__beaurocks_marketing_events : [],
  telemetry: Array.isArray(window.__beaurocks_marketing_telemetry_queue) ? window.__beaurocks_marketing_telemetry_queue : [],
}));

const runProfile = async ({
  playwright,
  profile,
  baseUrl,
  timeoutMs,
  headless,
}) => {
  const checks = [];
  const browser = await playwright[profile.browser].launch({ headless });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    ...(profile.context || {}),
  });
  await context.addInitScript((fallbackConfig) => {
    if (!window.__firebase_config) {
      window.__firebase_config = fallbackConfig;
    }
  }, DEMO_FIREBASE_CONFIG);
  const page = await context.newPage();

  try {
    await runCheck(checks, "legacy_marketing_path_renders_fan_entry", async () => {
      await page.goto(`${baseUrl}/marketing`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.waitForTimeout(1200);
      const parsed = new URL(page.url());
      assert(
        parsed.pathname === "/host-access" || parsed.pathname === "/for-fans" || parsed.pathname === "/marketing",
        `Expected /marketing legacy path to land on a current entry surface, got ${page.url()}`,
      );
      const visibleEntry = await Promise.any([
        page.getByText(/turn karaoke night into a room-wide party game/i).first().waitFor({ state: "visible", timeout: timeoutMs }).then(() => "fans"),
        page.getByText(/join the beaurocks host waitlist/i).first().waitFor({ state: "visible", timeout: timeoutMs }).then(() => "host"),
        page.getByText(/host login and applications/i).first().waitFor({ state: "visible", timeout: timeoutMs }).then(() => "host_access"),
      ]).catch(() => null);
      assert(!!visibleEntry, "Expected a current entry headline on the /marketing legacy path.");
      return getPathWithQuery(page.url());
    });

    await runCheck(checks, "legacy_redirect_query_mode_marketing", async () => {
      const legacyUrl = `${baseUrl}/?mode=marketing&page=for_hosts&utm_source=qa_redirect`;
      await page.goto(legacyUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await delay(650);
      const parsed = new URL(page.url());
      assert(parsed.pathname === "/for-hosts", `Expected canonical /for-hosts route, got ${parsed.pathname}`);
      assert(!parsed.searchParams.has("mode"), "Expected mode query param to be removed from canonical URL.");
      assert(!parsed.searchParams.has("page"), "Expected page query param to be removed from canonical URL.");
      assert(parsed.searchParams.get("utm_source") === "qa_redirect", "Expected UTM attribution params to survive canonical redirect.");
      return getPathWithQuery(page.url());
    });

    await runCheck(checks, "root_conversion_attribution_events", async () => {
      if (isLocalHost(new URL(baseUrl).hostname)) {
        return "Skipped on localhost static host; root path resolves through the app shell locally.";
      }
      const isolated = await context.newPage();
      try {
      const utmSource = "qa_root_cutover";
      const utmMedium = "paid";
      const utmCampaign = "root_marketing_cutover";
      const utmContent = "hero_entry";
      await isolated.goto(
        `${baseUrl}/for-fans?utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}&utm_content=${encodeURIComponent(utmContent)}`,
        { waitUntil: "domcontentloaded", timeout: timeoutMs }
      );
      const cta = isolated.getByRole("button", { name: /Explore Live Nights/i }).first();
      await cta.waitFor({ state: "visible", timeout: timeoutMs });
      await cta.click({ force: true });
      await delay(700);

      const parsed = new URL(isolated.url());
      assert(parsed.pathname === "/discover", `Expected discover after fan conversion CTA, got ${parsed.pathname}`);

      const payload = await getMarketingEvents(isolated);
      const conversionEvent = [...payload.events].reverse().find((entry) => entry?.name === "mk_persona_cta_click");
      assert(!!conversionEvent, "Missing mk_persona_cta_click conversion event.");
      assert(conversionEvent?.params?.cta === "hero_discover", `Expected hero_discover CTA, got ${conversionEvent?.params?.cta || ""}`);

      const pageViewEvent = [...payload.events].reverse().find((entry) => entry?.name === "mk_page_view_discover");
      assert(!!pageViewEvent, "Missing mk_page_view_discover event after conversion.");

      const telemetryEvent = [...payload.telemetry].reverse().find((entry) => entry?.name === "mk_persona_cta_click");
      assert(!!telemetryEvent, "Missing telemetry queue entry for mk_persona_cta_click.");
      assert(!!String(telemetryEvent?.sessionId || "").trim(), "Telemetry conversion event missing sessionId.");

      return `event=${conversionEvent.name}; route=${parsed.pathname}`;
      } finally {
        await isolated.close();
      }
    });

    await runCheck(checks, "legacy_demo_routes_canonicalize_to_overview", async () => {
      if (isLocalHost(new URL(baseUrl).hostname)) {
        return "Skipped on localhost static host; legacy demo aliases are only enforced on hosted domains.";
      }
      const isolated = await context.newPage();
      try {
      const demoUrl = `${baseUrl}/auto-demo?utm_source=qa_cross_surface&utm_medium=qa&utm_campaign=root_marketing_cutover&utm_content=demo_launch`;
      await isolated.goto(demoUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await isolated.getByText(/turn karaoke night into a room-wide party game/i).first().waitFor({ state: "visible", timeout: timeoutMs });
      const parsed = new URL(isolated.url());
      assert(parsed.pathname === "/", `Expected /auto-demo to canonicalize to /, got ${parsed.pathname}${parsed.search}`);
      assert(parsed.searchParams.get("utm_source") === "qa_cross_surface", "Expected UTM params to survive demo-route canonicalization.");
      return getPathWithQuery(isolated.url());
      } finally {
        await isolated.close();
      }
    });
  } finally {
    await context.close();
    await browser.close();
  }

  const failed = checks.filter((item) => !item.pass);
  return {
    profileId: profile.id,
    browser: profile.browser,
    failedCount: failed.length,
    checks,
  };
};

const run = async () => {
  const args = process.argv.slice(2);
  const releaseGate = args.includes("--release-gate");
  const explicitBaseUrl = String(process.env.QA_BASE_URL || "").trim();
  const useRemoteDefault = releaseGate;
  const timeoutMs = Math.max(25000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = !toBool(process.env.QA_HEADFUL, false);

  const playwright = await ensurePlaywright();
  const server = !explicitBaseUrl && !useRemoteDefault
    ? await startStaticDistServer({ distDir: DIST_DIR, port: 0 })
    : null;
  const baseUrl = explicitBaseUrl || server?.baseUrl || DEFAULT_BASE_URL;
  const profiles = [
    {
      id: "desktop_chromium",
      browser: "chromium",
      context: {
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      id: "android_chromium",
      browser: "chromium",
      context: {
        ...playwright.devices["Pixel 7"],
      },
    },
    {
      id: "ios_safari_webkit",
      browser: "webkit",
      context: {
        ...playwright.devices["iPhone 14"],
      },
    },
  ];

  const profileResults = [];
  for (const profile of profiles) {
    const result = await runProfile({
      playwright,
      profile,
      baseUrl,
      timeoutMs,
      headless,
    });
    profileResults.push(result);
  }

  const failedCount = profileResults.reduce((sum, result) => sum + Number(result.failedCount || 0), 0);
  const output = {
    ok: failedCount === 0,
    releaseGate,
    baseUrl,
    timeoutMs,
    headless,
    failedCount,
    profileResults,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(output, null, 2));

  await server?.stop().catch(() => {});
  if (failedCount > 0) process.exit(1);
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
