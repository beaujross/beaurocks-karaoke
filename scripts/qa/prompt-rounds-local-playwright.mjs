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
const DEFAULT_TIMEOUT_MS = 90000;
const FIXED_NOW_MS = 1763503200000;

const waitForHostPromptRound = async (page, title, promptText, timeoutMs) => {
  await page.getByText("HOST CONTROLPAD").first().waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByText(title).first().waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByText(promptText).first().waitFor({ state: "visible", timeout: timeoutMs });
};

const gotoHostFixture = async (page, baseUrl, fixtureId, timeoutMs) => {
  await page.goto(`${baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=${encodeURIComponent(fixtureId)}`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await delay(2500);
};

const gotoAudienceFixture = async (page, baseUrl, fixtureId, timeoutMs) => {
  await page.goto(`${baseUrl}/?room=DEMOAAHF&qaAudienceFixture=${encodeURIComponent(fixtureId)}`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await delay(1800);
};

const gotoTvFixture = async (page, baseUrl, fixtureId, timeoutMs) => {
  await page.goto(`${baseUrl}/?mode=tv&room=DEMOAAHF&mkDemoEmbed=1&qaTvFixture=${encodeURIComponent(fixtureId)}`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await delay(1800);
};

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless });
  const hostContext = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const mobileContext = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const tvContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });

  for (const context of [hostContext, mobileContext, tvContext]) {
    await context.addInitScript((firebaseConfig, fixedNowMs) => {
      if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
      const originalDateNow = Date.now.bind(Date);
      Date.now = () => (Number.isFinite(fixedNowMs) && fixedNowMs > 0 ? fixedNowMs : originalDateNow());
    }, DEFAULT_FIREBASE_RUNTIME_CONFIG, FIXED_NOW_MS);
  }

  const checks = [];
  const pageErrors = [];
  let failure = null;

  const bindPageErrors = (page) => {
    page.on("pageerror", (error) => {
      pageErrors.push(String(error?.stack || error?.message || error));
    });
  };

  try {
    await runCheck(checks, "host_trivia_prompt_round_visible_and_toggleable", async () => {
      const page = await hostContext.newPage();
      bindPageErrors(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      try {
        await gotoHostFixture(page, server.baseUrl, "prompt-round-trivia-live", timeoutMs);
        await waitForHostPromptRound(page, "Trivia Pop Live", "Which anthem gets the room singing first?", timeoutMs);
        await page.locator("button").filter({ hasText: /REVEAL ANSWER/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.locator("button").filter({ hasText: /REVEAL NOW/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.locator("button").filter({ hasText: /AUTO-REVEAL ON/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
        const liveMode = await page.locator("[data-host-live-mode]").first().getAttribute("data-host-live-mode");
        if (liveMode !== "trivia_pop") {
          throw new Error(`Expected host live mode trivia_pop, got ${liveMode}`);
        }
        return "host trivia prompt round loaded with operator controls";
      } finally {
        await page.close().catch(() => {});
      }
    });

    await runCheck(checks, "host_wyr_prompt_round_visible_and_toggleable", async () => {
      const page = await hostContext.newPage();
      bindPageErrors(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      try {
        await gotoHostFixture(page, server.baseUrl, "prompt-round-wyr-live", timeoutMs);
        await waitForHostPromptRound(page, "Would You Rather Live", "Would you rather open with a power ballad or a crowd singalong?", timeoutMs);
        await page.locator("button").filter({ hasText: /REVEAL CROWD SPLIT/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.locator("button").filter({ hasText: /REVEAL NOW/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.locator("button").filter({ hasText: /AUTO-REVEAL ON/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
        const liveMode = await page.locator("[data-host-live-mode]").first().getAttribute("data-host-live-mode");
        if (liveMode !== "wyr") {
          throw new Error(`Expected host live mode wyr, got ${liveMode}`);
        }
        return "host would-you-rather prompt round loaded with operator controls";
      } finally {
        await page.close().catch(() => {});
      }
    });

    await runCheck(checks, "audience_trivia_prompt_round_visible", async () => {
      const page = await mobileContext.newPage();
      bindPageErrors(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      try {
        await gotoAudienceFixture(page, server.baseUrl, "streamlined-trivia-live", timeoutMs);
        await page.locator('[data-prompt-vote-player-view="trivia"]').first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.getByText("Trivia Challenge").first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.locator('[data-qa-choice="0"]').first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.getByText("Which anthem gets the room singing first?").first().waitFor({ state: "visible", timeout: timeoutMs });
        return "audience trivia prompt rendered with answer choices";
      } finally {
        await page.close().catch(() => {});
      }
    });

    await runCheck(checks, "audience_wyr_prompt_round_visible", async () => {
      const page = await mobileContext.newPage();
      bindPageErrors(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      try {
        await gotoAudienceFixture(page, server.baseUrl, "streamlined-wyr-live", timeoutMs);
        await page.locator('[data-prompt-vote-player-view="wyr"]').first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.getByText("WOULD YOU RATHER...").first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.locator('[data-wyr-choice="A"]').first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.locator('[data-wyr-choice="B"]').first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.getByText("Power ballad").first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.getByText("Crowd singalong").first().waitFor({ state: "visible", timeout: timeoutMs });
        return "audience would-you-rather prompt rendered with both sides";
      } finally {
        await page.close().catch(() => {});
      }
    });

    await runCheck(checks, "tv_trivia_prompt_round_visible", async () => {
      const page = await tvContext.newPage();
      bindPageErrors(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      try {
        await gotoTvFixture(page, server.baseUrl, "prompt-round-trivia-live", timeoutMs);
        await page.locator('[data-prompt-vote-tv-view="trivia"]').first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.getByText("TRIVIA TIME").first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.getByText("Which anthem gets the room singing first?").first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.getByText(/responses locked/i).first().waitFor({ state: "visible", timeout: timeoutMs });
        return "tv trivia prompt rendered";
      } finally {
        await page.close().catch(() => {});
      }
    });

    await runCheck(checks, "tv_wyr_prompt_round_visible", async () => {
      const page = await tvContext.newPage();
      bindPageErrors(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      try {
        await gotoTvFixture(page, server.baseUrl, "prompt-round-wyr-live", timeoutMs);
        await page.locator('[data-prompt-vote-tv-view="wyr"]').first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.getByText("WOULD YOU RATHER...").first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.getByText("Would you rather open with a power ballad or a crowd singalong?").first().waitFor({ state: "visible", timeout: timeoutMs });
        await page.getByText(/VOTE NOW ON YOUR PHONES!/i).first().waitFor({ state: "visible", timeout: timeoutMs });
        return "tv would-you-rather prompt rendered";
      } finally {
        await page.close().catch(() => {});
      }
    });

    await runCheck(checks, "prompt_round_pages_have_no_runtime_errors", async () => {
      if (pageErrors.length) throw new Error(pageErrors[0]);
      return "no client-side runtime errors";
    });
  } catch (error) {
    failure = error;
  } finally {
    await Promise.allSettled([
      hostContext.close(),
      mobileContext.close(),
      tvContext.close(),
      browser.close(),
    ]);
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
  console.log("Local prompt-round QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
