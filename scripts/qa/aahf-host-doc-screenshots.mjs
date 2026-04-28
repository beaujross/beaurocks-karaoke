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
const OUTPUT_DIR = path.join(repoRoot, "public", "print", "screenshots");
const DEFAULT_TIMEOUT_MS = 120000;

const waitForBodyText = async (page, expectedText, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const token = String(expectedText || "").trim().toLowerCase();
  if (!token) return;
  await page.waitForFunction((needle) => {
    const text = String(document?.body?.innerText || "").toLowerCase();
    return text.includes(needle);
  }, token, { timeout: timeoutMs });
};

const freezeMotion = async (page) => {
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

const captureHostScreenshot = async (browser, server, {
  fixtureId,
  outputName,
  expectedText,
  tabKey = "",
}) => {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${server.baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=${encodeURIComponent(fixtureId)}`, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT_MS,
  });
  await freezeMotion(page);
  await delay(2600);
  await page.keyboard.press("Escape").catch(() => {});
  if (tabKey) {
    const button = page.locator(`[data-host-tab="${tabKey}"]`).first();
    if (await button.count()) {
      await button.click({ force: true }).catch(() => {});
      await delay(700);
    }
  }
  await waitForBodyText(page, expectedText, DEFAULT_TIMEOUT_MS);
  await delay(400);
  await page.screenshot({ path: path.join(OUTPUT_DIR, outputName), fullPage: true });
  await context.close();
};

const captureAudienceScreenshot = async (browser, server, {
  fixtureId,
  outputName,
  expectedText,
}) => {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
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
  await freezeMotion(page);
  await waitForBodyText(page, expectedText, DEFAULT_TIMEOUT_MS);
  await delay(900);
  await page.screenshot({ path: path.join(OUTPUT_DIR, outputName), fullPage: true });
  await context.close();
};

const main = async () => {
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless, args: ["--disable-dev-shm-usage"] });

  try {
    await captureHostScreenshot(browser, server, {
      fixtureId: "run-of-show-console",
      outputName: "host-overview.png",
      expectedText: "House Introductions",
      tabKey: "run_of_show",
    });

    await captureHostScreenshot(browser, server, {
      fixtureId: "cohost-helper-catalog",
      outputName: "helper-catalog.png",
      expectedText: "Co-Host Helper Catalog",
    });

    await captureAudienceScreenshot(browser, server, {
      fixtureId: "streamlined-aahf-join",
      outputName: "singer-join.png",
      expectedText: "Pick the emoji that feels most you.",
    });

    await captureAudienceScreenshot(browser, server, {
      fixtureId: "streamlined-aahf-rules",
      outputName: "singer-rules.png",
      expectedText: "Agree and Continue",
    });

    await captureAudienceScreenshot(browser, server, {
      fixtureId: "streamlined-aahf-browse",
      outputName: "singer-browse.png",
      expectedText: "Search for your song",
    });

    await captureAudienceScreenshot(browser, server, {
      fixtureId: "streamlined-aahf-queue",
      outputName: "singer-queue.png",
      expectedText: "Up Next",
    });

    console.log(`Saved AAHF host doc screenshots to ${OUTPUT_DIR}`);
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
