import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildQaTvFixture, FIXED_QA_TV_NOW_MS } from "../../src/apps/TV/qaTvFixtures.js";
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
const ARTIFACT_DIR = path.join(repoRoot, "tmp", "qa-public-tv-reactions");
const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_PORT = 0;
const QA_ROOM_CODE = "DEMOAAHF";

const PROFILE_CASES = Object.freeze([
  { id: "room", label: "standard" },
  { id: "simple", label: "simple" },
]);

const REACTION_VARIANTS = Object.freeze([
  "reaction-stack-launch",
  "reaction-stack-prism",
  "reaction-stack-royal",
  "reaction-stack-blossom",
  "reaction-stack-cheers",
  "reaction-stack-ember",
  "reaction-stack-heart",
  "reaction-stack-applause",
]);

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const buildTvUrl = (baseUrl, roomCode, fixtureId, profileId) => {
  const params = new URLSearchParams({
    mode: "tv",
    room: roomCode,
    mkDemoEmbed: "1",
    qaTvFixture: fixtureId,
    tvExplore: "1",
    tvProfile: profileId,
  });
  return `${baseUrl}/?${params.toString()}`;
};

const waitFor = async (predicate, { timeoutMs = 20000, pollMs = 150, label = "condition" } = {}) => {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    if (await predicate()) return;
    await delay(pollMs);
  }
  throw new Error(`Timed out waiting for ${label}.`);
};

const pauseAnimations = async (page) => {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation-play-state: paused !important;
        transition: none !important;
      }
    `,
  });
};

const getBodyText = async (page) => String(await page.locator("body").innerText().catch(() => ""));

const verifyReactionScenario = async ({ page, profileLabel }) => {
  await waitFor(
    async () => (await page.locator(".reaction-stack").count()) >= 8,
    { label: "reaction stack" },
  );

  const bodyText = await getBodyText(page);
  if (!bodyText.includes("🌸")) {
    throw new Error("Expected blossom emoji to render for the legacy money reaction.");
  }

  const classNames = await page.locator(".reaction-stack").evaluateAll((nodes) => nodes.map((node) => node.className));
  for (const expectedClass of REACTION_VARIANTS) {
    if (!classNames.some((name) => String(name || "").includes(expectedClass))) {
      throw new Error(`Missing reaction motion class ${expectedClass}.`);
    }
  }

  if (profileLabel === "simple") {
    await waitFor(
      async () => (await page.locator(".reaction-nameplate").count()) >= 8,
      { label: "simple reaction nameplates" },
    );
    const simpleText = await getBodyText(page);
    if (!simpleText.includes("Avery")) {
      throw new Error("Expected simple TV profile to keep sender attribution visible.");
    }
    if ((await page.locator(".reaction-type-chip").count()) !== 0) {
      throw new Error("Simple TV profile should not render the heavier reaction type chips.");
    }
    return;
  }

  await waitFor(
    async () => (await page.locator(".reaction-type-chip").count()) >= 8,
    { label: "standard reaction type chips" },
  );
  const normalizedBodyText = bodyText.toLowerCase();
  if (!normalizedBodyText.includes("bloom") || !normalizedBodyText.includes("royal")) {
    throw new Error("Expected standard TV profile to show themed reaction labels.");
  }
};

const verifySupportHostScenario = async ({ page }) => {
  await waitFor(
    async () => (await getBodyText(page)).toLowerCase().includes("dj beau made it rain"),
    { label: "host make-it-rain overlay" },
  );
  if ((await page.locator(".bonus-drop-burst-money").count()) < 1) {
    throw new Error("Expected the host bonus drop to use the money-rain fullscreen treatment.");
  }
  if ((await page.locator(".bonus-drop-rainfield").count()) < 1) {
    throw new Error("Expected the host make-it-rain overlay to render the rainfield.");
  }
};

const verifySupportPurchaseScenario = async ({ page }) => {
  await waitFor(
    async () => (await getBodyText(page)).toLowerCase().includes("maya boosted the room"),
    { label: "purchase celebration overlay" },
  );
  const bodyText = await getBodyText(page);
  if (!bodyText.includes("$25.00")) {
    throw new Error("Expected the donation purchase overlay to show the purchase amount.");
  }
  if ((await page.locator(".bonus-drop-burst-money").count()) < 1) {
    throw new Error("Expected the purchase celebration to use the money-rain fullscreen treatment.");
  }
  if ((await page.locator(".bonus-drop-rainfield").count()) < 1) {
    throw new Error("Expected the purchase celebration overlay to render the rainfield.");
  }
};

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const requestedPort = process.env.QA_PORT;
  const port = requestedPort === undefined ? DEFAULT_PORT : Math.max(3000, Number(requestedPort || DEFAULT_PORT));
  const headless = !["1", "true", "yes", "on"].includes(String(process.env.QA_HEADFUL || "").trim().toLowerCase());
  const { chromium } = await ensurePlaywright();

  await ensureDir(ARTIFACT_DIR);

  const server = await startStaticDistServer({ distDir: DIST_DIR, port });
  const browser = await chromium.launch({ headless });
  const checks = [];

  const record = (name, pass, detail) => {
    checks.push({ name, pass, detail });
  };

  try {
    for (const profile of PROFILE_CASES) {
      const fixture = buildQaTvFixture("reaction-showcase", { roomCode: QA_ROOM_CODE, nowMs: FIXED_QA_TV_NOW_MS });
      if (!fixture) throw new Error("Missing reaction-showcase QA fixture.");

      const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
      await context.addInitScript((firebaseConfig, fixedNowMs) => {
        if (!window.__firebase_config) {
          window.__firebase_config = firebaseConfig;
        }
        const frozenNow = Number(fixedNowMs || Date.now());
        Date.now = () => frozenNow;
      }, DEFAULT_FIREBASE_RUNTIME_CONFIG, FIXED_QA_TV_NOW_MS);

      const page = await context.newPage();
      await page.goto(buildTvUrl(server.baseUrl, QA_ROOM_CODE, "reaction-showcase", profile.id), {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      await verifyReactionScenario({ page, profileLabel: profile.label });
      await delay(500);
      await pauseAnimations(page);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `reactions-${profile.label}.png`), fullPage: true });
      record(`reactions-${profile.label}`, true, "reaction showcase verified");
      await context.close();
    }

    for (const profile of PROFILE_CASES) {
      const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
      await context.addInitScript((firebaseConfig, fixedNowMs) => {
        if (!window.__firebase_config) {
          window.__firebase_config = firebaseConfig;
        }
        const frozenNow = Number(fixedNowMs || Date.now());
        Date.now = () => frozenNow;
      }, DEFAULT_FIREBASE_RUNTIME_CONFIG, FIXED_QA_TV_NOW_MS);

      const page = await context.newPage();
      await page.goto(buildTvUrl(server.baseUrl, QA_ROOM_CODE, "support-host-rain", profile.id), {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      await verifySupportHostScenario({ page });
      await delay(250);
      await pauseAnimations(page);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `support-host-${profile.label}.png`), fullPage: true });
      record(`support-host-${profile.label}`, true, "host money-rain verified");
      await context.close();
    }

    for (const profile of PROFILE_CASES) {
      const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
      await context.addInitScript((firebaseConfig, fixedNowMs) => {
        if (!window.__firebase_config) {
          window.__firebase_config = firebaseConfig;
        }
        const frozenNow = Number(fixedNowMs || Date.now());
        Date.now = () => frozenNow;
      }, DEFAULT_FIREBASE_RUNTIME_CONFIG, FIXED_QA_TV_NOW_MS);

      const page = await context.newPage();
      await page.goto(buildTvUrl(server.baseUrl, QA_ROOM_CODE, "support-purchase-rain", profile.id), {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      await verifySupportPurchaseScenario({ page });
      await delay(250);
      await pauseAnimations(page);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `support-purchase-${profile.label}.png`), fullPage: true });
      record(`support-purchase-${profile.label}`, true, "purchase money-rain verified");
      await context.close();
    }
  } catch (error) {
    record("public-tv-reactions", false, String(error?.message || error));
    console.error(`Public TV reactions QA failed: ${String(error?.stack || error?.message || error)}`);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }

  for (const entry of checks) {
    console.log(`${entry.pass ? "PASS" : "FAIL"} ${entry.name}: ${entry.detail}`);
  }

  if (!checks.some((entry) => entry.pass === false)) {
    console.log(`Artifacts saved to ${ARTIFACT_DIR}`);
  }
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
