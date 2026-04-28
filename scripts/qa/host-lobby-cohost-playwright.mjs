import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIXED_QA_HOST_NOW_MS } from "../../src/apps/Host/qaHostFixtures.js";
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
const DEFAULT_TIMEOUT_MS = 120000;

const waitForLobbyWorkspace = async (page, timeoutMs) => {
  const lobbyTab = page.locator('[data-host-tab="lobby"]').first();
  await lobbyTab.waitFor({ state: "visible", timeout: timeoutMs });
  await lobbyTab.click({ force: true });
  await page.waitForFunction(() => {
    const root = document.querySelector(".host-app");
    return String(root?.getAttribute("data-host-active-tab") || "").trim() === "lobby";
  }, undefined, { timeout: timeoutMs });
  await page.getByText("Lobby Lineup", { exact: true }).first().waitFor({ state: "visible", timeout: timeoutMs });
};

const selectLobbyUser = async (page, userName, timeoutMs) => {
  const selectedStrip = page.locator("div").filter({
    has: page.getByText(new RegExp(`Selected:\\s*${userName}`, "i")).first(),
  }).first();
  if (!(await selectedStrip.isVisible().catch(() => false))) {
    const lineupButton = page.getByRole("button", { name: new RegExp(userName, "i") }).first();
    await lineupButton.waitFor({ state: "visible", timeout: timeoutMs });
    await lineupButton.click({ force: true });
  }
  await selectedStrip.waitFor({ state: "visible", timeout: timeoutMs });
  const selectedCard = page.locator('div[id^="lobby-user-card-"]').filter({
    has: page.getByText(userName, { exact: true }),
  }).first();
  await selectedCard.waitFor({ state: "visible", timeout: timeoutMs });
  return { selectedStrip, selectedCard };
};

const main = async () => {
  const timeoutMs = Math.max(45000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  await context.addInitScript((firebaseConfig, fixedNowMs) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    const originalDateNow = Date.now.bind(Date);
    Date.now = () => (Number.isFinite(fixedNowMs) && fixedNowMs > 0 ? fixedNowMs : originalDateNow());
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG, FIXED_QA_HOST_NOW_MS);

  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });

  const checks = [];
  let failure = null;
  const pageErrors = [];

  try {
    page.on("pageerror", (error) => {
      pageErrors.push(String(error?.stack || error?.message || error));
    });

    await page.goto(`${server.baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=run-of-show-console`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {});
    await delay(1200);
    await page.locator(".host-app").first().waitFor({ state: "visible", timeout: timeoutMs });

    await runCheck(checks, "host_lobby_fixture_loaded", async () => {
      await waitForLobbyWorkspace(page, timeoutMs);
      await page.getByText("Taylor", { exact: true }).first().waitFor({ state: "visible", timeout: timeoutMs });
      return "host fixture loaded the audience lobby workspace";
    });

    await runCheck(checks, "host_lobby_card_promotes_cohost", async () => {
      await waitForLobbyWorkspace(page, timeoutMs);
      const { selectedStrip, selectedCard } = await selectLobbyUser(page, "Taylor", timeoutMs);
      const makeFromCard = selectedCard.getByRole("button", { name: /^MAKE CO-HOST$/i }).first();
      await makeFromCard.waitFor({ state: "visible", timeout: timeoutMs });
      await makeFromCard.click({ force: true });
      await selectedStrip.getByRole("button", { name: /Remove Co-Host/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
      await selectedCard.getByText("CO-HOST", { exact: true }).first().waitFor({ state: "visible", timeout: timeoutMs });
      return "audience card overlay can promote the selected guest to co-host";
    });

    await runCheck(checks, "host_lobby_strip_removes_cohost", async () => {
      await waitForLobbyWorkspace(page, timeoutMs);
      const { selectedStrip, selectedCard } = await selectLobbyUser(page, "Taylor", timeoutMs);
      const removeFromStrip = selectedStrip.getByRole("button", { name: /Remove Co-Host/i }).first();
      await removeFromStrip.waitFor({ state: "visible", timeout: timeoutMs });
      await removeFromStrip.click({ force: true });
      await selectedStrip.getByRole("button", { name: /Make Co-Host/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
      await selectedCard.getByText("CO-HOST", { exact: true }).first().waitFor({ state: "hidden", timeout: timeoutMs });
      return "selected-user actions can remove the co-host role and clear the card badge";
    });

    await runCheck(checks, "host_lobby_no_page_errors", async () => {
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
  console.log("Host lobby co-host QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
