const DEFAULT_BASE_URL = "https://beaurocks.com";
const DEFAULT_TIMEOUT_MS = 70000;

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isManagedHost = (hostname = "") =>
  hostname.endsWith(".web.app") || hostname.endsWith(".firebaseapp.com");

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

const ensurePlaywright = async () => {
  try {
    return await import("playwright");
  } catch (error) {
    const message = String(error?.message || error);
    throw new Error(
      `Playwright is not installed (${message}). Run: npm install && npm run qa:admin:prod:install`
    );
  }
};

const runCheck = async (checks, name, fn) => {
  try {
    const detail = await fn();
    checks.push({ name, pass: true, detail: detail || "" });
    return true;
  } catch (error) {
    checks.push({ name, pass: false, detail: String(error?.message || error) });
    return false;
  }
};

const sanitizeRoomCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 12);

const getPathWithQuery = (urlText = "") => {
  const parsed = new URL(urlText);
  return `${parsed.pathname}${parsed.search}`;
};

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
    await runCheck(checks, "legacy_redirect_marketing_path", async () => {
      await page.goto(`${baseUrl}/marketing`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await delay(450);
      const parsed = new URL(page.url());
      assert(!/^\/marketing(?:\/|$)/i.test(parsed.pathname), `Expected /marketing legacy path to redirect, got ${page.url()}`);
      assert(parsed.pathname === "/for-fans", `Expected canonical /for-fans route, got ${parsed.pathname}`);
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
      const utmSource = "qa_root_cutover";
      const utmMedium = "paid";
      const utmCampaign = "root_marketing_cutover";
      const utmContent = "hero_entry";
      await page.goto(
        `${baseUrl}/for-fans?utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}&utm_content=${encodeURIComponent(utmContent)}`,
        { waitUntil: "domcontentloaded", timeout: timeoutMs }
      );
      const cta = page.locator(".mk3-home-primary-cta button").first();
      await cta.waitFor({ state: "visible", timeout: timeoutMs });
      await cta.click({ force: true });
      await delay(700);

      const parsed = new URL(page.url());
      assert(parsed.pathname === "/host-access", `Expected host-access after conversion CTA, got ${parsed.pathname}`);
      assert(parsed.searchParams.get("utm_source") === utmSource, "Expected utm_source to persist into host-access route.");
      assert(parsed.searchParams.get("utm_medium") === utmMedium, "Expected utm_medium to persist into host-access route.");
      assert(parsed.searchParams.get("utm_campaign") === utmCampaign, "Expected utm_campaign to persist into host-access route.");
      assert(!!parsed.searchParams.get("utm_content"), "Expected utm_content to be present for attribution.");

      const payload = await page.evaluate(() => ({
        events: Array.isArray(window.__beaurocks_marketing_events) ? window.__beaurocks_marketing_events : [],
        telemetry: Array.isArray(window.__beaurocks_marketing_telemetry_queue) ? window.__beaurocks_marketing_telemetry_queue : [],
      }));
      const conversionEvent = [...payload.events].reverse().find((entry) => entry?.name === "mk_home_launch_cta_click");
      assert(!!conversionEvent, "Missing mk_home_launch_cta_click conversion event.");
      assert(conversionEvent?.params?.utm_source === utmSource, "Conversion event missing utm_source attribution.");
      assert(conversionEvent?.params?.utm_medium === utmMedium, "Conversion event missing utm_medium attribution.");
      assert(conversionEvent?.params?.utm_campaign === utmCampaign, "Conversion event missing utm_campaign attribution.");

      const pageViewEvent = [...payload.events].reverse().find((entry) => entry?.name === "mk_page_view_host_access");
      assert(!!pageViewEvent, "Missing mk_page_view_host_access event after conversion.");

      const telemetryEvent = [...payload.telemetry].reverse().find((entry) => entry?.name === "mk_home_launch_cta_click");
      assert(!!telemetryEvent, "Missing telemetry queue entry for mk_home_launch_cta_click.");
      assert(!!String(telemetryEvent?.sessionId || "").trim(), "Telemetry conversion event missing sessionId.");

      return `event=${conversionEvent.name}; route=${parsed.pathname}`;
    });

    await runCheck(checks, "cross_surface_links_demo_audience_host_tv", async () => {
      await page.goto(
        `${baseUrl}/demo?utm_source=qa_cross_surface&utm_medium=qa&utm_campaign=root_marketing_cutover&utm_content=demo_launch`,
        { waitUntil: "domcontentloaded", timeout: timeoutMs }
      );
      await page.locator(".mk3-demo-launch-row").first().waitFor({ state: "visible", timeout: timeoutMs });

      const roomInput = page.locator(".mk3-demo-launch-row input").first();
      await roomInput.fill("QAXS123");
      await delay(300);
      const normalizedRoom = sanitizeRoomCode(await roomInput.inputValue());
      assert(!!normalizedRoom, "Expected a normalized demo room code.");

      const audienceHref = await page.getByRole("link", { name: /^Open Audience$/i }).first().getAttribute("href");
      const tvHref = await page.getByRole("link", { name: /^Open Public TV$/i }).first().getAttribute("href");
      const hostHref = await page.getByRole("link", { name: /^Open Host Deck$/i }).first().getAttribute("href");
      assert(!!audienceHref && !!tvHref && !!hostHref, "Expected all cross-surface launch links in demo launch row.");

      const audienceUrl = new URL(audienceHref);
      const tvUrl = new URL(tvHref);
      const hostUrl = new URL(hostHref);
      assert(audienceUrl.searchParams.get("room") === normalizedRoom, "Audience launch link missing normalized room query.");
      assert(tvUrl.searchParams.get("room") === normalizedRoom, "TV launch link missing normalized room query.");
      assert(hostUrl.searchParams.get("room") === normalizedRoom, "Host launch link missing normalized room query.");
      assert(tvUrl.searchParams.get("mode") === "tv", "TV launch link missing mode=tv.");
      assert(hostUrl.searchParams.get("mode") === "host", "Host launch link missing mode=host.");
      assert(!["tv", "host"].includes((audienceUrl.searchParams.get("mode") || "").toLowerCase()), "Audience launch link should not route to tv/host mode.");

      const baseHost = new URL(baseUrl).hostname;
      const expectedAudienceHost = expectedHostnameForSurface(baseHost, "app");
      const expectedTvHost = expectedHostnameForSurface(baseHost, "tv");
      const expectedHostHost = expectedHostnameForSurface(baseHost, "host");
      assert(audienceUrl.hostname === expectedAudienceHost, `Audience host mismatch. expected=${expectedAudienceHost} got=${audienceUrl.hostname}`);
      assert(tvUrl.hostname === expectedTvHost, `TV host mismatch. expected=${expectedTvHost} got=${tvUrl.hostname}`);
      assert(hostUrl.hostname === expectedHostHost, `Host host mismatch. expected=${expectedHostHost} got=${hostUrl.hostname}`);

      const validateSurfaceLoad = async (label, href, expectations = {}) => {
        const child = await context.newPage();
        try {
          const response = await child.goto(href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
          const status = Number(response?.status?.() || 0);
          assert(status === 0 || status < 400, `${label} surface load failed with HTTP ${status}`);
          const parsed = new URL(child.url());
          if (expectations.mode) {
            assert(parsed.searchParams.get("mode") === expectations.mode, `${label} surface expected mode=${expectations.mode}.`);
          }
          if (expectations.room) {
            assert(parsed.searchParams.get("room") === expectations.room, `${label} surface expected room=${expectations.room}.`);
          }
        } finally {
          await child.close();
        }
      };

      await validateSurfaceLoad("Audience", audienceHref, { room: normalizedRoom });
      await validateSurfaceLoad("Public TV", tvHref, { room: normalizedRoom, mode: "tv" });
      await validateSurfaceLoad("Host", hostHref, { room: normalizedRoom, mode: "host" });

      return `aud=${audienceUrl.hostname} tv=${tvUrl.hostname} host=${hostUrl.hostname}`;
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
  const baseUrl = process.env.QA_BASE_URL || DEFAULT_BASE_URL;
  const timeoutMs = Math.max(25000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = !toBool(process.env.QA_HEADFUL, false);

  const playwright = await ensurePlaywright();
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
