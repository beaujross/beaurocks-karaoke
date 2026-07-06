import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIXED_QA_HOST_NOW_MS } from "../../src/apps/Host/qaHostFixtures.js";
import { FIXED_QA_TV_NOW_MS } from "../../src/apps/TV/qaTvFixtures.js";
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  delay,
  ensurePlaywright,
  startStaticDistServer,
} from "./shared/playwrightQa.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");
const OUTPUT_DIR = path.join(
  repoRoot,
  "docs",
  "compliance",
  "evidence",
  "2026-07-06-youtube-product-audit",
);

const TIMEOUT_MS = Math.max(45000, Number(process.env.QA_TIMEOUT_MS || 90000));
const ROOM_CODE = "DEMOAAHF";
const AUDIENCE_ROOM_CODE = "DEMOAUD";

const freezeMotion = async (page) => {
  await page.emulateMedia({ reducedMotion: "reduce" }).catch(() => {});
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  }).catch(() => {});
};

const waitForText = async (page, text, timeout = TIMEOUT_MS) => {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout });
};

const assertPageText = async (page, requiredText = []) => {
  const bodyText = await page.locator("body").innerText({ timeout: TIMEOUT_MS });
  const normalizedBody = bodyText.toLowerCase();
  const missing = requiredText.filter((text) => !normalizedBody.includes(String(text).toLowerCase()));
  if (missing.length) {
    throw new Error(`Missing expected text: ${missing.join(", ")}`);
  }
};

const capturePage = async ({
  browser,
  server,
  id,
  surface,
  url,
  viewport,
  fixedNowMs,
  setup,
  requiredText,
  fullPage = true,
}) => {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((firebaseConfig, nowMs) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    const fixedNow = Number(nowMs || 0);
    if (Number.isFinite(fixedNow) && fixedNow > 0) {
      Date.now = () => fixedNow;
    }
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG, fixedNowMs || FIXED_QA_HOST_NOW_MS);

  const page = await context.newPage();
  const outputPath = path.join(OUTPUT_DIR, `${id}.png`);
  try {
    await page.goto(new URL(url, server.baseUrl).href, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    });
    await freezeMotion(page);
    await delay(1800);
    if (typeof setup === "function") await setup(page);
    await assertPageText(page, requiredText);
    await page.screenshot({ path: outputPath, fullPage });
    return {
      id,
      surface,
      url: new URL(url, server.baseUrl).href,
      path: outputPath,
      requiredText,
      status: "captured",
    };
  } catch (error) {
    const failurePath = path.join(OUTPUT_DIR, `${id}-failure.png`);
    await page.screenshot({ path: failurePath, fullPage: true }).catch(() => {});
    throw new Error(`${id} capture failed: ${String(error?.message || error)}; failure=${failurePath}`);
  } finally {
    await context.close().catch(() => {});
  }
};

const main = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({
    headless: String(process.env.QA_HEADFUL || "").trim() !== "1",
    args: ["--disable-dev-shm-usage"],
  });
  const screenshots = [];

  try {
    screenshots.push(await capturePage({
      browser,
      server,
      id: "host-youtube-add-panel",
      surface: "host",
      viewport: { width: 1440, height: 1100 },
      fixedNowMs: FIXED_QA_HOST_NOW_MS,
      url: `/?mode=host&room=${ROOM_CODE}&mkDemoEmbed=1&qaHostFixture=run-of-show-console`,
      setup: async (page) => {
        await page.locator('[data-host-tab="stage"]').first().click({ force: true });
        await page.locator('[data-feature-id="queue-surface-tab-add-desktop"]').first().waitFor({ state: "visible", timeout: TIMEOUT_MS });
        await page.locator('[data-feature-id="queue-surface-tab-add-desktop"]').first().click({ force: true });
        await waitForText(page, "Search YouTube");
      },
      requiredText: ["YouTube", "Any YouTube", "Search YouTube", "Karaoke"],
    }));

    screenshots.push(await capturePage({
      browser,
      server,
      id: "host-room-library-curator",
      surface: "host",
      viewport: { width: 1440, height: 1100 },
      fixedNowMs: FIXED_QA_HOST_NOW_MS,
      url: `/?mode=host&room=${ROOM_CODE}&mkDemoEmbed=1&qaHostFixture=run-of-show-console&hostUiVersion=v2&view=ops&section=ops.room_setup&tab=admin`,
      setup: async (page) => {
        await waitForText(page, "Admin Workspace");
        const mediaButton = page.getByRole("button", { name: /Screens \+ Playback/i }).first();
        await mediaButton.waitFor({ state: "visible", timeout: TIMEOUT_MS });
        await mediaButton.click({ force: true });
        await waitForText(page, "Apple Music background");
        const curatorButton = page.getByRole("button", { name: /Open Curator/i }).first();
        await curatorButton.waitFor({ state: "visible", timeout: TIMEOUT_MS });
        await curatorButton.click({ force: true });
        await waitForText(page, "Room Library Curator");
      },
      requiredText: [
        "Room Library Curator",
        "YouTube API Services",
        "YouTube Terms of Service",
        "Google Privacy Policy",
        "searches left",
      ],
    }));

    screenshots.push(await capturePage({
      browser,
      server,
      id: "audience-youtube-search",
      surface: "audience",
      viewport: { width: 390, height: 844 },
      fixedNowMs: FIXED_QA_HOST_NOW_MS,
      url: `/?mode=mobile&room=${AUDIENCE_ROOM_CODE}&mkDemoEmbed=1&qaAudienceFixture=youtube-audit-search`,
      setup: async (page) => {
        await waitForText(page, "YouTube Search");
      },
      requiredText: [
        "YouTube Search",
        "Karaoke",
        "Any YouTube",
        "YouTube API Services",
        "YouTube Terms of Service",
        "Google Privacy Policy",
      ],
    }));

    screenshots.push(await capturePage({
      browser,
      server,
      id: "audience-youtube-url-paste",
      surface: "audience",
      viewport: { width: 390, height: 844 },
      fixedNowMs: FIXED_QA_HOST_NOW_MS,
      url: `/?mode=mobile&room=${AUDIENCE_ROOM_CODE}&mkDemoEmbed=1&qaAudienceFixture=youtube-audit-paste`,
      setup: async (page) => {
        await waitForText(page, "Advanced Backing Link");
        const addLinkButton = page.getByRole("button", { name: /Add Link/i }).first();
        if (await addLinkButton.isVisible().catch(() => false)) {
          await addLinkButton.click({ force: true });
        }
        await page.getByPlaceholder("Paste YouTube URL").first().waitFor({ state: "visible", timeout: TIMEOUT_MS });
      },
      requiredText: ["Paste a YouTube link", "Dreams", "Fleetwood Mac", "Advanced Backing Link"],
    }));

    screenshots.push(await capturePage({
      browser,
      server,
      id: "tv-youtube-performance",
      surface: "tv",
      viewport: { width: 1440, height: 900 },
      fixedNowMs: FIXED_QA_TV_NOW_MS,
      url: `/?mode=tv&room=${ROOM_CODE}&mkDemoEmbed=1&qaTvFixture=youtube-audit-performance`,
      requiredText: ["Dreams", "Alex Rivers"],
      fullPage: false,
    }));

    screenshots.push(await capturePage({
      browser,
      server,
      id: "tv-apple-background",
      surface: "tv",
      viewport: { width: 1440, height: 900 },
      fixedNowMs: FIXED_QA_TV_NOW_MS,
      url: `/?mode=tv&room=${ROOM_CODE}&mkDemoEmbed=1&qaTvFixture=apple-audit-background`,
      requiredText: ["Apple Music Background", "Fourth of July Background", "Auto-DJ background playlist"],
      fullPage: false,
    }));
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }

  const manifest = {
    capturedAt: new Date().toISOString(),
    purpose: "YouTube API Services audit/quota-extension product evidence",
    source: "deterministic QA fixtures rendered from the built dist artifact",
    outputDir: OUTPUT_DIR,
    screenshots,
    remainingLiveEvidence: [
      "Google Cloud Console YouTube Data API quota page for the live project",
      "Authenticated production host session for the live audit room, if reviewers request live-room evidence",
      "Quota exhaustion fallback state from a real exhausted/cooldown condition or controlled production test",
      "Room permanent-delete path from a live test room",
    ],
  };
  const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`YouTube audit product evidence screenshots written to ${OUTPUT_DIR}`);
  console.log(`Manifest: ${manifestPath}`);
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exitCode = 1;
});
