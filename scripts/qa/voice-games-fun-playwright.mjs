import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  delay,
  ensurePlaywright,
  runCheck,
  startStaticDistServer,
} from "./shared/playwrightQa.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");
const ARTIFACT_DIR = path.join(repoRoot, "tmp", "qa-voice-games-fun");
const DEFAULT_TIMEOUT_MS = 90000;
const FIXED_QA_NOW_MS = 1777687200000;

const FIXTURES = Object.freeze([
  {
    id: "flappy_bird",
    title: "Flappy Bird",
    liveTexts: [
      /Burst above 22% to flap/i,
      /Hold above 42% for shield assist/i,
      /WATCHING LIVE FEED/i,
    ],
    chips: [/Lives\s+4/i, /Flap\s+22%/i, /Shield\s+42%/i],
  },
  {
    id: "vocal_challenge",
    title: "Vocal Challenge",
    liveTexts: [
      /Close notes still score, so keep singing\./i,
      /Longer round, softer scoring floor/i,
      /Round Time/i,
    ],
    chips: [/Default round\s+45s/i, /Default difficulty\s+easy/i, /Guide tone\s+on/i],
  },
  {
    id: "riding_scales",
    title: "Riding Scales",
    liveTexts: [
      /Close notes count, so keep going\./i,
      /Next miss gets a replay buffer/i,
      /Strikes:\s*1\/5/i,
    ],
    chips: [/Default round\s+45s/i, /Max strikes\s+5/i, /Round reward\s+50 pts/i],
  },
]);

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
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
  });
};

const dismissRulesOverlay = async (panel, timeoutMs) => {
  const continueText = panel.getByText("Tap to continue").first();
  const isVisible = await continueText.isVisible().catch(() => false);
  if (!isVisible) return;
  await continueText.click({ force: true });
  await continueText.waitFor({ state: "hidden", timeout: timeoutMs });
};

const waitForPanelPattern = async (panel, pattern, timeoutMs) => {
  const startedAt = Date.now();
  let lastText = "";
  while ((Date.now() - startedAt) < timeoutMs) {
    lastText = String(await panel.innerText().catch(() => ""));
    if (pattern.test(lastText)) return;
    await delay(200);
  }
  throw new Error(`Timed out waiting for pattern ${pattern} in panel text: ${lastText.slice(0, 500)}`);
};

const buildHarnessUrl = (baseUrl, roomCode) =>
  `${baseUrl}/?mode=voice-games-qa&room=${encodeURIComponent(roomCode)}`;

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();

  await ensureDir(ARTIFACT_DIR);

  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1600, height: 2400 } });
  await context.addInitScript((firebaseConfig, fixedNowMs) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
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

    await page.goto(buildHarnessUrl(server.baseUrl, "DEMOVOICE"), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await freezeMotion(page);

    await runCheck(checks, "voice_games_harness_loaded", async () => {
      await page.locator("[data-voice-games-qa-ready='true']").waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("Voice Games Fun Pass").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "local voice game harness rendered";
    });

    for (const fixture of FIXTURES) {
      const panel = page.locator(`[data-voice-game-qa-panel="${fixture.id}"]`).first();
      await runCheck(checks, `${fixture.id}_rules_and_live_copy`, async () => {
        await panel.scrollIntoViewIfNeeded();
        await panel.waitFor({ state: "visible", timeout: timeoutMs });
        await panel.getByText(fixture.title).first().waitFor({ state: "visible", timeout: timeoutMs });
        for (const chipPattern of fixture.chips) {
          await waitForPanelPattern(panel, chipPattern, timeoutMs);
        }
        await dismissRulesOverlay(panel, timeoutMs);
        for (const livePattern of fixture.liveTexts) {
          await waitForPanelPattern(panel, livePattern, timeoutMs);
        }
        return "rules overlay and live tuned cues rendered";
      });
    }

    await runCheck(checks, "voice_games_no_page_errors", async () => {
      if (pageErrors.length) throw new Error(pageErrors[0]);
      return "no client-side runtime errors";
    });
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

  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }

  if (failure || checks.some((entry) => !entry.pass)) {
    if (failure) console.error(String(failure?.stack || failure?.message || failure));
    process.exitCode = 1;
    return;
  }

  console.log("Voice games fun QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
