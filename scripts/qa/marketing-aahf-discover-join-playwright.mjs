import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  delay,
  ensurePlaywright,
  runCheck,
  startStaticDistServer,
} from "./shared/playwrightQa.mjs";

const DEFAULT_TIMEOUT_MS = 70000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");

const AAHF_DISCOVER_ITEM = Object.freeze({
  id: "official_aahf_karaoke_kickoff_2026",
  key: "room_session:official_aahf_karaoke_kickoff_2026",
  listingType: "room_session",
  routePage: "session",
  sourceType: "official_registry",
  title: "AAHF Karaoke Kick-Off",
  subtitle: "Bainbridge Island Museum of Art, Bainbridge Island, WA",
  typeLabel: "room session",
  roomCode: "AAHF",
  imageUrl: "/images/marketing/CLEAN%201.png",
  imageFallbackUrls: ["/images/marketing/AAHF-KaraokeKickoff-Flyer%203.17%202x.png"],
  hostName: "DJ BeauRocks",
  timeLabel: "May 1, 7:00 PM",
  detailLine: "Official BeauRocks Room | Bainbridge Island Museum of Art",
  officialBadgeImageUrl: "/images/marketing/karaoke-kickoff-logo-simple.png",
  isOfficialBeauRocksListing: true,
  isOfficialBeauRocksRoom: true,
  isBeauRocksElevated: true,
  cadenceBadges: ["Tonight"],
  experience: {
    isBeauRocksPowered: true,
    capabilityBadges: ["Live join"],
    funBadges: ["Festival crowds"],
    storyLine: "Official BeauRocks kickoff room for the May 1 AAHF event.",
  },
  location: { lat: 47.62654, lng: -122.52197 },
});

const callableResponse = (result = {}) => ({
  result,
});

const authSignupResponse = Object.freeze({
  kind: "identitytoolkit#SignupNewUserResponse",
  idToken: "qa-id-token",
  refreshToken: "qa-refresh-token",
  expiresIn: "3600",
  localId: "qa-anon-user",
});

const secureTokenResponse = Object.freeze({
  access_token: "qa-access-token",
  expires_in: "3600",
  token_type: "Bearer",
  refresh_token: "qa-refresh-token",
  id_token: "qa-id-token",
  user_id: "qa-anon-user",
  project_id: DEFAULT_FIREBASE_RUNTIME_CONFIG.projectId,
});

const loadDiscover = async (page, baseUrl, timeoutMs) => {
  await page.goto(`${baseUrl}/discover`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const searchInput = page.locator('input[placeholder*="Host, venue, city, or vibe"]').first();
  await searchInput.waitFor({ state: "visible", timeout: timeoutMs });
  return searchInput;
};

const run = async () => {
  const timeoutMs = Math.max(25000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const checks = [];

  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR, port: 0 });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });

  await context.addInitScript((fallbackConfig) => {
    if (!window.__firebase_config) window.__firebase_config = fallbackConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);

  await context.route("**/identitytoolkit.googleapis.com/**/accounts:signUp**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authSignupResponse),
    });
  });

  await context.route("**/securetoken.googleapis.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(secureTokenResponse),
    });
  });

  await context.route("**/listDirectoryDiscover", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(callableResponse({
        ok: true,
        items: [AAHF_DISCOVER_ITEM],
        nextCursor: "",
        facets: {
          listingTypes: { room_session: 1, event: 0, venue: 0 },
          hostOptions: [],
          eventCadence: { recurring: 0, one_time: 1 },
        },
      })),
    });
  });

  await context.route("**/recordMarketingTelemetry", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(callableResponse({ ok: true })),
    });
  });

  const page = await context.newPage();

  try {
    await runCheck(checks, "discover_aahf_listing_routes_to_join", async () => {
      const searchInput = await loadDiscover(page, server.baseUrl, timeoutMs);
      await searchInput.fill("AAHF");
      await delay(500);

      const aahfCard = page.locator(".mk3-discover-card").filter({ hasText: /AAHF Karaoke Kick-Off/i }).first();
      await aahfCard.waitFor({ state: "visible", timeout: timeoutMs });

      const joinAction = aahfCard.getByRole("button", { name: /join room/i }).first();
      await joinAction.waitFor({ state: "visible", timeout: timeoutMs });
      await joinAction.click({ force: true });

      await page.waitForURL((url) => {
        const parsed = new URL(url.toString());
        const pathName = String(parsed.pathname || "").toLowerCase();
        const pageName = String(parsed.searchParams.get("page") || "").toLowerCase();
        const roomCode = String(parsed.searchParams.get("roomCode") || parsed.searchParams.get("room") || "").toUpperCase();
        return pathName.includes("/join/aahf")
          || (pageName === "join" && roomCode === "AAHF");
      }, { timeout: timeoutMs });

      const parsed = new URL(page.url());
      return `${parsed.pathname}${parsed.search}`;
    });
  } finally {
    await context.close();
    await browser.close();
    await server.stop().catch(() => {});
  }

  const failed = checks.filter((item) => !item.pass);
  console.log(JSON.stringify({
    ok: failed.length === 0,
    timeoutMs,
    checks,
    timestamp: new Date().toISOString(),
  }, null, 2));

  if (failed.length > 0) process.exit(1);
};

run().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
  }, null, 2));
  process.exit(1);
});
