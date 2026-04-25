import {
  delay,
  ensurePlaywright,
  runCheck,
  startStaticDistServer,
  waitForAnyVisible,
} from "./shared/playwrightQa.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://beaurocks.app";
const DEFAULT_TIMEOUT_MS = 70000;
const DISCOVER_TEXT_PATTERN = /see which rooms are already in motion tonight/i;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const DEMO_FIREBASE_CONFIG = {
  apiKey: "demo-api-key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456",
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

const loadGoldenPathRail = async (page, baseUrl, timeoutMs) => {
  await loadMarketingRoute(
    page,
    baseUrl,
    { path: "/submit", legacyPage: "submit" },
    timeoutMs,
  );
  await page.locator(".mk3-golden-rail").first().waitFor({ state: "visible", timeout: timeoutMs });
};

const clickFirstMarketingCta = async (page, locators, timeoutMs) => {
  const visibleLocator = await waitForAnyVisible(locators, timeoutMs);
  await visibleLocator.click({ force: true });
};

const run = async () => {
  const args = process.argv.slice(2);
  const releaseGate = args.includes("--release-gate");
  const explicitBaseUrl = String(process.env.QA_BASE_URL || "").trim();
  const useRemoteDefault = args.includes("--remote") || toBool(process.env.QA_RELEASE_REMOTE, false);
  const timeoutMs = Math.max(25000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = !toBool(process.env.QA_HEADFUL, false);
  const checks = [];

  const { chromium } = await ensurePlaywright();
  const server = !explicitBaseUrl && !useRemoteDefault
    ? await startStaticDistServer({ distDir: DIST_DIR, port: 0 })
    : null;
  const baseUrl = explicitBaseUrl || server?.baseUrl || DEFAULT_BASE_URL;
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
      await loadGoldenPathRail(page, baseUrl, timeoutMs);
      await clickFirstMarketingCta(page, [
        page.locator(".mk3-golden-rail").getByRole("button", { name: /^For Hosts$/i }).first(),
        page.locator(".mk3-golden-rail").getByRole("link", { name: /^For Hosts$/i }).first(),
      ], timeoutMs);
      await delay(350);
      assertRoute(page.url(), { pathIncludes: "/for-hosts", legacyPage: "for_hosts" });
      return page.url();
    });

    await runCheck(checks, "rail_venue_route", async () => {
      await loadGoldenPathRail(page, baseUrl, timeoutMs);
      await clickFirstMarketingCta(page, [
        page.locator(".mk3-golden-rail").getByRole("button", { name: /^For Venues$/i }).first(),
        page.locator(".mk3-golden-rail").getByRole("link", { name: /^For Venues$/i }).first(),
      ], timeoutMs);
      await delay(350);
      assertRoute(page.url(), { pathIncludes: "/for-venues", legacyPage: "for_venues" });
      return page.url();
    });

    await runCheck(checks, "rail_performer_route", async () => {
      await loadGoldenPathRail(page, baseUrl, timeoutMs);
      await clickFirstMarketingCta(page, [
        page.locator(".mk3-golden-rail").getByRole("button", { name: /^For Performers$/i }).first(),
        page.locator(".mk3-golden-rail").getByRole("link", { name: /^For Performers$/i }).first(),
      ], timeoutMs);
      await delay(350);
      assertRoute(page.url(), { pathIncludes: "/for-performers", legacyPage: "for_performers" });
      return page.url();
    });

    await runCheck(checks, "rail_overview_route", async () => {
      await loadGoldenPathRail(page, baseUrl, timeoutMs);
      await clickFirstMarketingCta(page, [
        page.locator(".mk3-golden-rail").getByRole("button", { name: /^Overview$/i }).first(),
        page.locator(".mk3-golden-rail").getByRole("link", { name: /^Overview$/i }).first(),
      ], timeoutMs);
      await delay(350);
      const parsed = new URL(page.url());
      const pathname = String(parsed.pathname || "").toLowerCase();
      if (pathname !== "/" && pathname !== "/for-fans") {
        throw new Error(`Expected fan route to resolve to "/" or "/for-fans", got "${parsed.pathname}${parsed.search}".`);
      }
      await page.getByText(/turn karaoke night into a room-wide party game/i).first().waitFor({ state: "visible", timeout: timeoutMs });
      return page.url();
    });

    await runCheck(checks, "rail_join_route", async () => {
      await loadGoldenPathRail(page, baseUrl, timeoutMs);
      const inviteCode = page.locator(".mk3-golden-rail").getByRole("button", { name: /^Join By Code$/i }).first();
      const inviteLink = page.locator(".mk3-golden-rail").getByRole("link", { name: /^Join By Code$/i }).first();
      await clickFirstMarketingCta(page, [inviteCode, inviteLink], timeoutMs);
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
      const createAccountHost = [
        page.getByRole("button", { name: /Already Approved\? Sign In/i }).first(),
        page.getByRole("link", { name: /Already Approved\? Sign In/i }).first(),
      ];
      const visibleCta = await waitForAnyVisible(createAccountHost, 5000).catch(() => null);
      if (visibleCta) {
        await visibleCta.click({ force: true });
      } else {
        const snapshot = await page.evaluate(() =>
          String(document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 420).trim()
        );
        throw new Error(`Host auth-gate CTA not visible at ${page.url()} :: ${snapshot}`);
      }
      await delay(500);
      const parsed = new URL(page.url());
      const intent = parsed.searchParams.get("intent") || "";
      const returnTo = parsed.searchParams.get("return_to") || parsed.searchParams.get("next") || "";
      if (!String(parsed.pathname || "").toLowerCase().includes("host-access")) {
        throw new Error(`Expected host-access route, got "${parsed.pathname}${parsed.search}".`);
      }
      if (!intent.includes("host_dashboard_resume") && !intent.includes("continue")) {
        throw new Error(`Expected host_dashboard_resume or continue intent, got "${intent}".`);
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
      const createAccountToSubmit = page.getByRole("button", { name: /Create BeauRocks Account/i }).first();
      const createAccountToSubmitLink = page.getByRole("link", { name: /Create BeauRocks Account/i }).first();
      await delay(400);
      const visibleSubmitCta = await waitForAnyVisible([
        createAccountToSubmit,
        createAccountToSubmitLink,
      ], 5000).catch(() => null);
      if (!visibleSubmitCta) {
        throw new Error(`No submit entry CTA visible at ${page.url()}.`);
      }
      await visibleSubmitCta.click({ force: true });
      await delay(500);
      const parsed = new URL(page.url());
      const intent = parsed.searchParams.get("intent") || "";
      if (!intent.includes("listing_submit")) {
        throw new Error(`Expected intent=listing_submit but got "${intent}".`);
      }
      return `intent=${intent}`;
    });

    await runCheck(checks, "discover_joinable_filter_cta", async () => {
      await loadMarketingDiscover(page, baseUrl, timeoutMs);
      await delay(1200);
      const cta = page.getByRole("button", { name: /Show Joinable Rooms/i }).first();
      await cta.waitFor({ state: "visible", timeout: timeoutMs });
      await cta.click({ force: true });
      await delay(500);
      const bodyText = await page.locator("body").innerText().catch(() => "");
      if (!/joinable by code|rooms open by code|join room/i.test(bodyText)) {
        throw new Error("Joinable-room CTA did not update discover state.");
      }
      return "Discover hero joinable-room CTA responded.";
    });
  } finally {
    await context.close();
    await browser.close();
    await server?.stop().catch(() => {});
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
