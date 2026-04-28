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
const OUTPUT_DIR = path.join(repoRoot, "public", "print", "screenshots", "review");
const DEFAULT_TIMEOUT_MS = 90000;

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
  });
};

const captureHostComparison = async ({ browser, baseUrl, fixtureId, roomCode, outputName, timeoutMs }) => {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    await page.goto(`${baseUrl}/?room=${encodeURIComponent(roomCode)}&qaHostFixture=${encodeURIComponent(fixtureId)}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await freezeMotion(page);
    await delay(1500);
    await page.locator('[data-host-qa-ready="true"]').first().waitFor({ state: "visible", timeout: timeoutMs });
    const openBoard = page.getByRole("button", { name: /OPEN BOARD/i }).first();
    if (await openBoard.isVisible().catch(() => false)) {
      await openBoard.click({ force: true });
      await delay(600);
    }
    const board = page.locator('[data-run-of-show-director-surface="true"]').first();
    await board.screenshot({ path: path.join(OUTPUT_DIR, outputName) });
    const boardHeadingPx = await page.getByText("SHOW CONVEYOR").first().evaluate((node) => {
      return Number.parseFloat(window.getComputedStyle(node).fontSize || "0");
    });
    const issueHeadingPx = await page.getByText("OPEN ISSUES").first().evaluate((node) => {
      return Number.parseFloat(window.getComputedStyle(node).fontSize || "0");
    });
    return {
      fixtureId,
      outputName,
      boardHeadingPx,
      issueHeadingPx,
    };
  } finally {
    await context.close().catch(() => {});
  }
};

const waitForBodyTexts = async ({ page, expectedTexts, timeoutMs }) => {
  const startedAt = Date.now();
  let lastBodyText = "";
  while ((Date.now() - startedAt) < timeoutMs) {
    lastBodyText = String(await page.locator("body").innerText().catch(() => "")).slice(0, 1600);
    const lowered = lastBodyText.toLowerCase();
    if (expectedTexts.every((text) => lowered.includes(String(text || "").toLowerCase()))) {
      return;
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for text: ${expectedTexts.join(", ")} :: ${lastBodyText}`);
};

const captureTvComparison = async ({ browser, baseUrl, fixtureId, roomCode, expectedTexts, outputName, timeoutMs }) => {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    await page.goto(`${baseUrl}/?mode=tv&room=${encodeURIComponent(roomCode)}&mkDemoEmbed=1&qaTvFixture=${encodeURIComponent(fixtureId)}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await freezeMotion(page);
    await delay(2500);
    await waitForBodyTexts({ page, expectedTexts, timeoutMs });
    const tv = page.locator(".public-tv").first();
    await tv.waitFor({ state: "visible", timeout: timeoutMs });
    await tv.screenshot({ path: path.join(OUTPUT_DIR, outputName) });
    const headline = page.locator("[data-tv-takeover-headline]").first();
    const headlinePx = await headline.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).fontSize || "0"));
    const subhead = page.locator("[data-tv-takeover-subhead]").first();
    const subheadPx = await subhead.isVisible().catch(() => false)
      ? await subhead.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).fontSize || "0"))
      : 0;
    return {
      fixtureId,
      outputName,
      headlinePx,
      subheadPx,
    };
  } finally {
    await context.close().catch(() => {});
  }
};

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const { chromium } = await ensurePlaywright();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const server = await startStaticDistServer({ distDir: DIST_DIR, port: 0 });
  const browser = await chromium.launch({ headless: String(process.env.QA_HEADFUL || "").trim() !== "1" });

  try {
    const metrics = {
      generatedAt: new Date().toISOString(),
      host: [],
      tv: [],
    };

    metrics.host.push(await captureHostComparison({
      browser,
      baseUrl: server.baseUrl,
      fixtureId: "run-of-show-console-generic",
      roomCode: "DEMOBR",
      outputName: "host-run-of-show-generic.png",
      timeoutMs,
    }));

    metrics.host.push(await captureHostComparison({
      browser,
      baseUrl: server.baseUrl,
      fixtureId: "run-of-show-console",
      roomCode: "DEMOAAHF",
      outputName: "host-run-of-show-aahf.png",
      timeoutMs,
    }));

    metrics.tv.push(await captureTvComparison({
      browser,
      baseUrl: server.baseUrl,
      fixtureId: "generic-preview-intro",
      roomCode: "DEMOBR",
      expectedTexts: ["Preview Mode", "Intro", "Welcome To BeauRocks"],
      outputName: "tv-intro-generic.png",
      timeoutMs,
    }));

    metrics.tv.push(await captureTvComparison({
      browser,
      baseUrl: server.baseUrl,
      fixtureId: "preview-intro",
      roomCode: "DEMOAAHF",
      expectedTexts: ["Preview Mode", "Intro", "Welcome To AAHF"],
      outputName: "tv-intro-aahf.png",
      timeoutMs,
    }));

    metrics.tv.push(await captureTvComparison({
      browser,
      baseUrl: server.baseUrl,
      fixtureId: "generic-live-announcement",
      roomCode: "DEMOBR",
      expectedTexts: ["House Announcement", "Karaoke Starts In Five", "Show graphics live on Public TV"],
      outputName: "tv-announcement-generic.png",
      timeoutMs,
    }));

    metrics.tv.push(await captureTvComparison({
      browser,
      baseUrl: server.baseUrl,
      fixtureId: "live-announcement",
      roomCode: "DEMOAAHF",
      expectedTexts: ["House Announcement", "Talent Showcase Starts In Five", "Show graphics live on Public TV"],
      outputName: "tv-announcement-aahf.png",
      timeoutMs,
    }));

    await fs.writeFile(
      path.join(OUTPUT_DIR, "visual-review-metrics.json"),
      `${JSON.stringify(metrics, null, 2)}\n`,
      "utf8",
    );

    console.log(`Saved AAHF visual review screenshots to ${OUTPUT_DIR}`);
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
