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
const OUTPUT_DIR = path.join(repoRoot, "tmp", "qa-host-settings-review");

const VIEWPORTS = Object.freeze([
  { id: "mid-desktop", width: 1280, height: 900 },
  { id: "wide-desktop", width: 1600, height: 1000 },
]);

const HOST_ROOM_CODE = "DEMOAAHF";
const HOST_FIXTURE_ID = "run-of-show-console";
const TV_FIXTURE_ID = "preview-intro";

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const freezeMotion = async (page) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
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
  });
};

const ensureDetailsOpen = async (page, label) => {
  const details = page.locator("details").filter({
    has: page.getByText(label, { exact: false }),
  }).first();
  await details.waitFor({ state: "visible", timeout: 30000 });
  await details.evaluate((node) => { node.open = true; }).catch(() => {});
  return details;
};

const gotoHostSetup = async (page, baseUrl, viewport) => {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(
    `${baseUrl}/?mode=host&room=${encodeURIComponent(HOST_ROOM_CODE)}&mkDemoEmbed=1&qaHostFixture=${encodeURIComponent(HOST_FIXTURE_ID)}&hostUiVersion=v2&view=ops&section=ops.room_setup&tab=admin`,
    {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    },
  );
  await freezeMotion(page);
  await delay(2200);

  await page.getByText("Admin Workspace").first().waitFor({ state: "visible", timeout: 45000 });
  await delay(1200);
  const audioMenuPanel = page.getByText("Audio + Mix").first();
  if (await audioMenuPanel.isVisible().catch(() => false)) {
    await page.locator('[data-feature-id="deck-audio-menu-toggle"]').first().click({ force: true }).catch(() => {});
    await delay(250);
  }

  await ensureDetailsOpen(page, "Guest Flow + Audience Settings");
  await ensureDetailsOpen(page, "Screens + Overlays");
  const nightSetupRailButton = page.getByRole("button", { name: /Night Setup/i }).first();
  if (await nightSetupRailButton.isVisible().catch(() => false)) {
    await nightSetupRailButton.click({ force: true }).catch(() => {});
    await delay(250);
  }
  await delay(400);
  await page.getByText("Operating style").first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Crowd mode").first().waitFor({ state: "visible", timeout: 30000 });
};

const gotoTvFixture = async (page, baseUrl, viewport) => {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(
    `${baseUrl}/?mode=tv&room=${encodeURIComponent(HOST_ROOM_CODE)}&mkDemoEmbed=1&qaTvFixture=${encodeURIComponent(TV_FIXTURE_ID)}`,
    {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    },
  );
  await freezeMotion(page);
  await delay(2200);
  const overlay = page.locator(".public-tv").first();
  await overlay.waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Welcome To AAHF").first().waitFor({ state: "visible", timeout: 30000 });
  return overlay;
};

const main = async () => {
  await ensureDir(OUTPUT_DIR);
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewport of VIEWPORTS) {
      const hostContext = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      await hostContext.addInitScript((firebaseConfig, fixedNowMs) => {
        if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
        Date.now = () => fixedNowMs;
      }, DEFAULT_FIREBASE_RUNTIME_CONFIG, FIXED_QA_HOST_NOW_MS);
      const hostPage = await hostContext.newPage();
      await gotoHostSetup(hostPage, server.baseUrl, viewport);
      await hostPage.screenshot({
        path: path.join(OUTPUT_DIR, `host-panel-${viewport.id}.png`),
        fullPage: true,
      });
      await hostContext.close();

      const tvContext = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      await tvContext.addInitScript((firebaseConfig, fixedNowMs) => {
        if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
        Date.now = () => fixedNowMs;
      }, DEFAULT_FIREBASE_RUNTIME_CONFIG, FIXED_QA_TV_NOW_MS);
      const tvPage = await tvContext.newPage();
      const overlay = await gotoTvFixture(tvPage, server.baseUrl, viewport);
      await overlay.screenshot({
        path: path.join(OUTPUT_DIR, `public-tv-${viewport.id}.png`),
      });
      await tvContext.close();
    }
    console.log(`Saved host settings review screenshots to ${OUTPUT_DIR}`);
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
