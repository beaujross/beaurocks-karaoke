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
const DEFAULT_TIMEOUT_MS = 90000;

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless });
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

  const checks = [];
  const pageErrors = [];
  let failure = null;

  try {
    page.on("pageerror", (error) => {
      pageErrors.push(String(error?.stack || error?.message || error));
    });

    await page.goto(`${server.baseUrl}/?mode=audience-qa&room=DEMOAAHF&qaAudienceFixture=streamlined-aahf-home`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await page.locator('[data-audience-qa-ready="true"]').waitFor({ state: "visible", timeout: timeoutMs });
    await delay(750);

    await runCheck(checks, "audience_streamlined_shell_loaded", async () => {
      const shell = await page.locator('[data-audience-qa-ready="true"]').getAttribute("data-audience-qa-shell-variant");
      if (shell !== "streamlined") throw new Error(`Expected streamlined shell, got ${shell}`);
      await page.getByText("Hey, Taylor Demo").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "streamlined audience shell rendered";
    });

    await runCheck(checks, "audience_event_profile_branding_applied", async () => {
      const root = page.locator('[data-audience-qa-ready="true"]').first();
      const eventProfile = await root.getAttribute("data-audience-qa-event-profile");
      const title = await root.getAttribute("data-audience-qa-brand-title");
      const primary = await root.getAttribute("data-audience-qa-brand-primary");
      const secondary = await root.getAttribute("data-audience-qa-brand-secondary");
      const accent = await root.getAttribute("data-audience-qa-brand-accent");
      if (eventProfile !== "aahf_2026_kickoff") throw new Error(`Unexpected event profile: ${eventProfile}`);
      if (title !== "AAHF Festival") throw new Error(`Unexpected brand title: ${title}`);
      if (primary !== "#E05A44" || secondary !== "#F4C94A" || accent !== "#8F2D2A") {
        throw new Error(`Unexpected brand colors: ${primary}, ${secondary}, ${accent}`);
      }
      await page.getByText("AAHF HOST").first().waitFor({ state: "visible", timeout: timeoutMs });
      return "AAHF audience event profile and room branding applied";
    });

    await runCheck(checks, "audience_no_page_errors", async () => {
      if (pageErrors.length) throw new Error(pageErrors[0]);
      return "no client-side runtime errors";
    });
  } catch (error) {
    failure = error;
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
  console.log("Audience event-profile QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
