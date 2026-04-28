import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  delay,
  ensurePlaywright,
  startStaticDistServer,
} from "./shared/playwrightQa.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const DEFAULT_TIMEOUT_MS = 90000;
const DIST_DIR = path.join(repoRoot, "dist");
const BASELINE_DIR = path.join(repoRoot, "tests", "visual-baselines", "audience-aahf-branding");
const ARTIFACT_DIR = path.join(repoRoot, "tmp", "qa-audience-aahf-branding");
const FIXED_QA_NOW_MS = 1777687200000;

const FIXTURES = Object.freeze([
  {
    id: "join",
    fixtureId: "streamlined-aahf-join",
    viewport: { width: 430, height: 932 },
    assertions: async (page, timeoutMs) => {
      await page.getByText("Powered by: BeauRocks Karaoke").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Pick the emoji that feels most you.").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("No BeauRocks email is required for AAHF tonight.").first().waitFor({ state: "visible", timeout: timeoutMs });
    },
  },
  {
    id: "about-modal",
    fixtureId: "streamlined-aahf-join-about",
    viewport: { width: 430, height: 932 },
    assertions: async (page, timeoutMs) => {
      await page.getByText("AAHF Festival runs on BeauRocks Karaoke.").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Powered by: BeauRocks Karaoke").first().waitFor({ state: "visible", timeout: timeoutMs });
    },
  },
  {
    id: "access-modal",
    fixtureId: "streamlined-aahf-join-access",
    viewport: { width: 430, height: 932 },
    assertions: async (page, timeoutMs) => {
      await page.getByText("Continue with Email").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Support AAHF Festival").first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Send Email Link").first().waitFor({ state: "visible", timeout: timeoutMs });
    },
  },
]);

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const comparePngFiles = async (actualPath, baselinePath) => {
  const actual = await sharp(actualPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const baseline = await sharp(baselinePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (
    actual.info.width !== baseline.info.width
    || actual.info.height !== baseline.info.height
    || actual.info.channels !== baseline.info.channels
  ) {
    throw new Error(
      `Baseline dimensions changed: actual ${actual.info.width}x${actual.info.height} vs baseline ${baseline.info.width}x${baseline.info.height}.`
    );
  }

  let diffPixels = 0;
  const totalPixels = actual.info.width * actual.info.height;
  for (let index = 0; index < actual.data.length; index += 4) {
    const rDiff = Math.abs(actual.data[index] - baseline.data[index]);
    const gDiff = Math.abs(actual.data[index + 1] - baseline.data[index + 1]);
    const bDiff = Math.abs(actual.data[index + 2] - baseline.data[index + 2]);
    const aDiff = Math.abs(actual.data[index + 3] - baseline.data[index + 3]);
    if (rDiff > 10 || gDiff > 10 || bDiff > 10 || aDiff > 10) diffPixels += 1;
  }

  const mismatchPct = (diffPixels / totalPixels) * 100;
  if (mismatchPct > 0.25) {
    throw new Error(`Visual mismatch ${mismatchPct.toFixed(3)}% exceeded 0.25% threshold.`);
  }
  return mismatchPct;
};

const buildAudienceUrl = (baseUrl, roomCode, fixtureId) =>
  `${baseUrl}/?room=${encodeURIComponent(roomCode)}&qaAudienceFixture=${encodeURIComponent(fixtureId)}`;

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

const main = async () => {
  const args = process.argv.slice(2);
  const updateBaselines = args.includes("--update-baselines");
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();

  await ensureDir(BASELINE_DIR);
  await ensureDir(ARTIFACT_DIR);

  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript((firebaseConfig, fixedNowMs) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    let seed = 123456789;
    Math.random = () => {
      seed = (1664525 * seed + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const frozenNow = Number(fixedNowMs || Date.now());
    Date.now = () => frozenNow;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG, FIXED_QA_NOW_MS);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });

  const checks = [];
  const pageErrors = [];
  let failure = null;

  try {
    page.on("pageerror", (error) => {
      pageErrors.push(String(error?.stack || error?.message || error));
    });

    for (const fixture of FIXTURES) {
      await page.setViewportSize(fixture.viewport);
      await page.goto(buildAudienceUrl(server.baseUrl, "DEMOAAHF", fixture.fixtureId), {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      await freezeMotion(page);
      await fixture.assertions(page, timeoutMs);
      await delay(900);

      const artifactPath = path.join(ARTIFACT_DIR, `${fixture.id}.png`);
      const baselinePath = path.join(BASELINE_DIR, `${fixture.id}.png`);
      await page.screenshot({ path: artifactPath });

      if (updateBaselines) {
        await fs.copyFile(artifactPath, baselinePath);
        checks.push({ name: fixture.id, pass: true, detail: "baseline updated" });
        continue;
      }

      await fs.access(baselinePath);
      const mismatchPct = await comparePngFiles(artifactPath, baselinePath);
      checks.push({
        name: fixture.id,
        pass: true,
        detail: `matched baseline (${mismatchPct.toFixed(3)}% mismatch)`,
      });
    }

    if (pageErrors.length) {
      throw new Error(pageErrors[0]);
    }
  } catch (error) {
    failure = error;
    try {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "failure-full-page.png"), fullPage: true });
    } catch {
      // ignore screenshot failures
    }
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }

  const summary = checks.map((entry) => `${entry.pass ? "PASS" : "FAIL"} ${entry.name}: ${entry.detail}`).join("\n");
  if (summary) console.log(summary);
  if (failure) {
    console.error(`Audience AAHF branding visual QA failed: ${String(failure?.message || failure)}`);
    process.exitCode = 1;
    return;
  }
  console.log(updateBaselines ? "Baselines updated." : "Audience AAHF branding visual QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
