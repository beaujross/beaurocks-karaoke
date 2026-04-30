import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const OUTPUT_DIR = path.join(repoRoot, "artifacts", "qa", "cohost-experience");
const DEFAULT_TIMEOUT_MS = 90000;
const waitForBodyText = async (page, expectedText, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const token = String(expectedText || "").trim().toLowerCase();
  if (!token) return;
  await page.waitForFunction((needle) => {
    const text = String(document?.body?.innerText || "").toLowerCase();
    return text.includes(needle);
  }, token, { timeout: timeoutMs });
};

const captureMobile = async (browser, server, targetPath, fixtureId, expectedLabel, { transient = false } = {}) => {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${server.baseUrl}/?mode=mobile&room=DEMOAAHF&qaAudienceFixture=${encodeURIComponent(fixtureId)}`, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT_MS,
  });
  await delay(5000);
  if (transient) {
    await waitForBodyText(page, expectedLabel, 2500);
    await delay(120);
  } else {
    await waitForBodyText(page, expectedLabel, DEFAULT_TIMEOUT_MS);
    await delay(300);
  }
  await page.screenshot({ path: targetPath, fullPage: true });
  await context.close();
};

const captureMobileReactionPolicy = async (browser, server, outputDir) => {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${server.baseUrl}/?mode=mobile&room=DEMOAAHF&qaAudienceFixture=cohost-unlimited-reactions`, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT_MS,
  });
  await delay(5000);
  await waitForBodyText(page, "Co-Host Signals", DEFAULT_TIMEOUT_MS);
  const fireButton = page.locator('[data-feature-id="reaction-fire-button"]').first();
  await fireButton.scrollIntoViewIfNeeded();
  await delay(500);
  await page.screenshot({ path: path.join(outputDir, "audience-cohost-unlimited-reactions.png"), fullPage: true });
  await fireButton.click({ force: true });
  await page.getByText(/1\.[0-9]s/, { exact: false }).first().waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT_MS });
  await delay(120);
  await page.screenshot({ path: path.join(outputDir, "audience-cohost-reaction-cooldown.png"), fullPage: true });
  await context.close();
};

const captureMobileApplauseCooldown = async (browser, server, outputDir) => {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${server.baseUrl}/?mode=mobile&room=DEMOAAHF&qaAudienceFixture=applause-cooldown`, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT_MS,
  });
  await delay(5000);
  await waitForBodyText(page, "APPLAUSE METER!", DEFAULT_TIMEOUT_MS);
  const clapButton = page.locator('[data-feature-id="applause-clap-button"]').first();
  await clapButton.click({ force: true });
  await page.getByText("Clap cooldown", { exact: false }).first().waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT_MS });
  await delay(120);
  await page.screenshot({ path: path.join(outputDir, "audience-applause-cooldown.png"), fullPage: true });
  await context.close();
};

const captureHost = async (browser, server, targetPath, url, { tabKey = "", expectedLabel = "" } = {}) => {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT_MS,
  });
  await delay(2500);
  await page.keyboard.press("Escape").catch(() => {});
  await delay(120);
  await page.keyboard.press("Escape").catch(() => {});
  if (tabKey) {
    const tabButton = page.locator(`[data-host-tab="${tabKey}"]`).first();
    if (await tabButton.count()) {
      await tabButton.click({ force: true }).catch(() => {});
      await delay(500);
    }
  }
  if (expectedLabel && String(expectedLabel).toLowerCase().includes("co-host credit policy")) {
    const monetizationButton = page.getByRole("button", { name: /tips \+ boosts/i }).first();
    if (await monetizationButton.count()) {
      await monetizationButton.click({ force: true }).catch(() => {});
      await delay(800);
    }
  }
  if (expectedLabel) {
    await waitForBodyText(page, expectedLabel, DEFAULT_TIMEOUT_MS).catch(() => {});
  }
  await delay(1200);
  await page.screenshot({ path: targetPath, fullPage: true });
  await context.close();
};

const captureHostHelperCatalog = async (browser, server, targetPath, url) => {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT_MS,
  });
  await delay(2500);
  await page.locator('[data-host-helper-shell="true"]').first().waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT_MS });
  await waitForBodyText(page, "Co-Host Helper Catalog", 5000).catch(() => {});
  await delay(1200);
  await page.screenshot({ path: targetPath, fullPage: true });
  await context.close();
};

const main = async () => {
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const server = await startStaticDistServer({ distDir: DIST_DIR });

  try {
    const hostBase = `${server.baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1`;
    const stableBrowser = await chromium.launch({ headless, args: ["--disable-dev-shm-usage"] });
    await captureMobile(
      stableBrowser,
      server,
      path.join(OUTPUT_DIR, "audience-crowd-song-faceoff.png"),
      "crowd-song-faceoff",
      "Audience Song Face-Off",
    );
    await captureHost(
      stableBrowser,
      server,
      path.join(OUTPUT_DIR, "host-cohost-queue-faceoff.png"),
      `${hostBase}&qaHostFixture=cohost-queue-faceoff`,
      { tabKey: "stage", expectedLabel: "Co-Host Song Face-Off" },
    );
    await captureHostHelperCatalog(
      stableBrowser,
      server,
      path.join(OUTPUT_DIR, "host-cohost-helper-catalog.png"),
      `${hostBase}&qaHostFixture=cohost-helper-catalog`,
    ).catch((error) => {
      console.warn(`Skipping helper catalog screenshot: ${String(error?.message || error)}`);
    });
    await captureHost(
      stableBrowser,
      server,
      path.join(OUTPUT_DIR, "host-cohost-credit-policy-settings.png"),
      `${hostBase}&qaHostFixture=cohost-credit-policy-settings`,
      { tabKey: "admin", expectedLabel: "Co-host credit policy" },
    );
    await captureMobileReactionPolicy(stableBrowser, server, OUTPUT_DIR);
    await captureMobileApplauseCooldown(stableBrowser, server, OUTPUT_DIR);

    const hostRunOfShowContext = await stableBrowser.newContext({
      viewport: { width: 1600, height: 1200 },
      deviceScaleFactor: 1,
    });
    await hostRunOfShowContext.addInitScript((firebaseConfig) => {
      if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
    const hostRunOfShowPage = await hostRunOfShowContext.newPage();
    await hostRunOfShowPage.emulateMedia({ reducedMotion: "reduce" });
    await hostRunOfShowPage.goto(`${hostBase}&qaHostFixture=cohost-queue-faceoff`, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_TIMEOUT_MS,
    });
    await delay(3000);
    await hostRunOfShowPage.locator('[data-host-tab="run_of_show"]').first().click({ force: true });
    await delay(1000);
    await hostRunOfShowPage.screenshot({
      path: path.join(OUTPUT_DIR, "host-run-of-show-faceoff-panel.png"),
      fullPage: true,
    });
    await hostRunOfShowContext.close();
    await stableBrowser.close();

    const transientBrowser = await chromium.launch({ headless, args: ["--disable-dev-shm-usage"] });
    await captureMobile(
      transientBrowser,
      server,
      path.join(OUTPUT_DIR, "audience-cohost-song-faceoff.png"),
      "cohost-song-faceoff",
      "Co-Host Song Face-Off",
      { transient: true },
    );
    await transientBrowser.close();

    console.log(`Saved co-host screenshots to ${OUTPUT_DIR}`);
  } finally {
    await server.stop().catch(() => {});
  }
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
