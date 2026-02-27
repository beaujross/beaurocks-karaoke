const DEFAULT_BASE_URL = "https://beaurocks.app";
const DEFAULT_TIMEOUT_MS = 70000;
const DISCOVER_TEXT_PATTERN = /setlist live karaoke map|beaurocks karaoke setlist finder/i;

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEMO_FIREBASE_CONFIG = {
  apiKey: "demo-api-key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456",
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

const assertRoute = (urlText, { pathIncludes = "", legacyPage = "" } = {}) => {
  const parsed = new URL(urlText);
  const pathname = String(parsed.pathname || "").toLowerCase();
  const page = String(parsed.searchParams.get("page") || "").trim().toLowerCase();
  const mode = String(parsed.searchParams.get("mode") || "").trim().toLowerCase();
  const wantsPath = String(pathIncludes || "").trim().toLowerCase();
  const wantsLegacyPage = String(legacyPage || "").trim().toLowerCase();
  if (wantsPath && pathname.includes(wantsPath)) return;
  if (wantsLegacyPage && mode === "marketing" && page === wantsLegacyPage) return;
  throw new Error(
    `Expected route "${wantsPath || wantsLegacyPage}" but got "${parsed.pathname}${parsed.search}".`
  );
};

const loadMarketingDiscover = async (page, baseUrl, timeoutMs) => {
  await page.goto(`${baseUrl}/discover`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const mapHeading = page.getByText(DISCOVER_TEXT_PATTERN).first();
  if (await mapHeading.isVisible().catch(() => false)) return;

  const marketingButton = page.getByRole("button", { name: /View Marketing Site/i }).first();
  if (await marketingButton.isVisible().catch(() => false)) {
    await marketingButton.click({ force: true });
    await mapHeading.waitFor({ state: "visible", timeout: timeoutMs });
    return;
  }

  await page.goto(`${baseUrl}/?mode=marketing&page=discover`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await mapHeading.waitFor({ state: "visible", timeout: timeoutMs });
};

const loadMarketingRoute = async (page, baseUrl, { path, legacyPage }, timeoutMs) => {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const parsed = new URL(page.url());
  if (String(parsed.pathname || "").toLowerCase().includes(String(path || "").toLowerCase())) return;
  await page.goto(`${baseUrl}/?mode=marketing&page=${encodeURIComponent(legacyPage)}`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
};

const run = async () => {
  const args = process.argv.slice(2);
  const releaseGate = args.includes("--release-gate");
  const baseUrl = process.env.QA_BASE_URL || DEFAULT_BASE_URL;
  const timeoutMs = Math.max(25000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = !toBool(process.env.QA_HEADFUL, false);
  const checks = [];

  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.addInitScript((fallbackConfig) => {
    if (!window.__firebase_config) {
      window.__firebase_config = fallbackConfig;
    }
  }, DEMO_FIREBASE_CONFIG);
  const page = await context.newPage();

  try {
    await runCheck(checks, "discover_loads", async () => {
      await loadMarketingDiscover(page, baseUrl, timeoutMs);
      await page.getByText(DISCOVER_TEXT_PATTERN).first().waitFor({ state: "visible", timeout: timeoutMs });
      return "Discover loaded.";
    });

    await runCheck(checks, "rail_host_route", async () => {
      await page.getByRole("button", { name: /^(Host|For Hosts)$/i }).first().click({ force: true });
      await delay(350);
      assertRoute(page.url(), { pathIncludes: "/for-hosts", legacyPage: "for_hosts" });
      return page.url();
    });

    await runCheck(checks, "rail_venue_route", async () => {
      await page.getByRole("button", { name: /^(Venue Owner|For Venues|Venue Prestige)$/i }).first().click({ force: true });
      await delay(350);
      assertRoute(page.url(), { pathIncludes: "/for-venues", legacyPage: "for_venues" });
      return page.url();
    });

    await runCheck(checks, "rail_performer_route", async () => {
      await page.getByRole("button", { name: /^(Performer|For Performers|Performer Spotlight)$/i }).first().click({ force: true });
      await delay(350);
      assertRoute(page.url(), { pathIncludes: "/for-performers", legacyPage: "for_performers" });
      return page.url();
    });

    await runCheck(checks, "rail_fan_route", async () => {
      await page.getByRole("button", { name: /^(Fan|For Fans|For Guests|Guest Pass)$/i }).first().click({ force: true });
      await delay(350);
      assertRoute(page.url(), { pathIncludes: "/for-fans", legacyPage: "for_fans" });
      return page.url();
    });

    await runCheck(checks, "rail_join_route", async () => {
      await loadMarketingDiscover(page, baseUrl, timeoutMs);
      const joinByCode = page.getByRole("button", { name: /^Join(?: by)? Code$/i }).first();
      const inviteCode = page.getByRole("button", { name: /^Invite Code$/i }).first();
      if (await joinByCode.isVisible().catch(() => false)) {
        await joinByCode.click({ force: true });
      } else if (await inviteCode.isVisible().catch(() => false)) {
        await inviteCode.click({ force: true });
      } else {
        throw new Error("No Join/Invite code CTA visible on discover rail.");
      }
      await delay(350);
      assertRoute(page.url(), { pathIncludes: "/join", legacyPage: "join" });
      return page.url();
    });

    await runCheck(checks, "host_private_quick_start_auth_gate", async () => {
      await loadMarketingRoute(
        page,
        baseUrl,
        { path: "/for-hosts", legacyPage: "for_hosts" },
        timeoutMs
      );
      await delay(450);
      const createAccountHost = page.getByRole("button", {
        name: /Create Account To Launch|Create Host Account|Create Account To Create Private Session/i,
      }).first();
      if (await createAccountHost.isVisible().catch(() => false)) {
        await createAccountHost.click({ force: true });
      } else {
        const snapshot = await page.evaluate(() =>
          String(document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 420).trim()
        );
        throw new Error(`Host auth-gate CTA not visible at ${page.url()} :: ${snapshot}`);
      }
      await delay(500);
      const parsed = new URL(page.url());
      const intent = parsed.searchParams.get("intent") || "";
      const returnTo = parsed.searchParams.get("return_to") || "";
      if (!intent.includes("private_session_create") && !intent.includes("listing_submit")) {
        throw new Error(`Expected private_session_create or listing_submit intent, got "${intent}".`);
      }
      if (!returnTo) {
        throw new Error("Expected return_to query param after auth gate.");
      }
      return `intent=${intent}`;
    });

    await runCheck(checks, "submit_listing_auth_gate", async () => {
      await loadMarketingRoute(
        page,
        baseUrl,
        { path: "/submit", legacyPage: "submit" },
        timeoutMs
      );
      const submitForReview = page.getByRole("button", { name: /Submit For Review/i }).first();
      const createAccountToSubmit = page.getByRole("button", { name: /Create Account To Submit/i }).first();
      await delay(400);
      if (await submitForReview.isVisible().catch(() => false)) {
        await submitForReview.click({ force: true });
      } else {
        if (!(await createAccountToSubmit.isVisible().catch(() => false))) {
          await createAccountToSubmit.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
        }
        if (await createAccountToSubmit.isVisible().catch(() => false)) {
          await createAccountToSubmit.click({ force: true });
        } else {
          throw new Error(`No submit entry CTA visible at ${page.url()}.`);
        }
      }
      await delay(500);
      const parsed = new URL(page.url());
      const intent = parsed.searchParams.get("intent") || "";
      if (!intent.includes("listing_submit")) {
        throw new Error(`Expected intent=listing_submit but got "${intent}".`);
      }
      return `intent=${intent}`;
    });

    await runCheck(checks, "discover_inline_conversion_auth_gate_if_available", async () => {
      await loadMarketingDiscover(page, baseUrl, timeoutMs);
      await delay(1200);
      const quickRsvp = page.getByRole("button", { name: /Quick RSVP/i }).first();
      const claimVenue = page.getByRole("button", { name: /Claim Venue/i }).first();
      const createAccountInline = page.locator(".mk3-inline-conversions button", { hasText: /Create Account/i }).first();
      if (await quickRsvp.isVisible().catch(() => false)) {
        await quickRsvp.click({ force: true });
      } else if (await claimVenue.isVisible().catch(() => false)) {
        await claimVenue.click({ force: true });
      } else if (await createAccountInline.isVisible().catch(() => false)) {
        await createAccountInline.click({ force: true });
      } else {
        return "No inline conversion buttons visible in current dataset (skipped).";
      }
      await delay(500);
      const parsed = new URL(page.url());
      const intent = parsed.searchParams.get("intent") || "";
      if (!intent) {
        throw new Error("Expected intent query parameter after inline conversion click.");
      }
      return `intent=${intent}`;
    });
  } finally {
    await context.close();
    await browser.close();
  }

  const failed = checks.filter((item) => !item.pass);
  const output = {
    ok: failed.length === 0,
    releaseGate,
    baseUrl,
    timeoutMs,
    headless,
    failedCount: failed.length,
    checks,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(output, null, 2));

  if (releaseGate && failed.length > 0) {
    process.exit(1);
  }
  if (!releaseGate && failed.length > 0) {
    process.exit(1);
  }
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
