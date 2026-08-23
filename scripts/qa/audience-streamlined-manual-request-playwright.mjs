import path from "node:path";
import fs from "node:fs/promises";
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
const ARTIFACT_DIR = path.join(repoRoot, "tmp", "qa-audience-streamlined");
const DEFAULT_TIMEOUT_MS = 90000;

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
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
  const checks = [];
  const pageErrors = [];
  let failure = null;

  try {
    page.on("pageerror", (error) => {
      pageErrors.push(String(error?.stack || error?.message || error));
    });
    await page.goto(
      `${server.baseUrl}/?room=DEMOAUD&qaAudienceFixture=streamlined-browse`,
      { waitUntil: "domcontentloaded", timeout: timeoutMs },
    );
    const singerRoot = page.locator('[data-singer-view="main"]').first();
    const singerReady = await singerRoot
      .waitFor({ state: "visible", timeout: Math.min(timeoutMs, 15000) })
      .then(() => true)
      .catch(() => false);
    if (!singerReady) {
      const bodyText = String(await page.locator("body").innerText().catch(() => ""))
        .replace(/\s+/g, " ")
        .slice(0, 500);
      throw new Error(
        `Real SingerApp fixture did not reach joined main state. url=${page.url()} body=${bodyText || "(empty)"} pageError=${pageErrors[0] || "(none)"}`,
      );
    }
    await delay(500);

    await runCheck(checks, "singer_app_streamlined_shell_confirmed", async () => {
      const shellVariant = await singerRoot.getAttribute("data-singer-shell-variant");
      if (shellVariant !== "streamlined") {
        throw new Error(`Expected real SingerApp streamlined shell, got ${shellVariant || "(empty)"}.`);
      }
      return "real SingerApp fixture reports streamlined shell";
    });

    await runCheck(checks, "singer_app_wallet_and_reaction_deck_are_persistent", async () => {
      const wallet = page.locator('[data-feature-id="audience-wallet-balances"]:visible').first();
      const deck = page.locator('[data-feature-id="persistent-audience-reaction-deck"]:visible').first();
      await wallet.waitFor({ state: "visible", timeout: timeoutMs });
      await deck.waitFor({ state: "visible", timeout: timeoutMs });
      const walletText = String(await wallet.innerText()).replace(/\s+/g, " ");
      if (!walletText.includes("PTS") || !walletText.includes("BB")) {
        throw new Error(`Audience wallet did not expose Points and BeauBucks. text=${walletText}`);
      }
      if ((await deck.getAttribute("data-reactions-active")) !== "true") {
        throw new Error("Performing fixture should expose an active persistent reaction deck.");
      }
      if ((await deck.getAttribute("data-reaction-layout")) !== "grid") {
        throw new Error("Party should use the large voting grid layout.");
      }
      const reactionButton = deck.locator('[data-reaction-deck-type]').first();
      const reactionBox = await reactionButton.boundingBox();
      if (!reactionBox || reactionBox.height < 130 || reactionBox.width < 150) {
        throw new Error(`Party voting emojis are smaller than the intended grid target: ${JSON.stringify(reactionBox)}`);
      }
      await page.locator('[data-feature-id="audience-fame-entry"]:visible').first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "active-deck-430x932.png"), fullPage: false });
      return "Points, BeauBucks, and the active voting loadout stay visible in the shared shell";
    });

    await runCheck(checks, "singer_app_stage_position_stable_between_tabs", async () => {
      const stage = page.locator('[data-feature-id="singer-current-performance-card"]:visible').first();
      const primaryNav = page.locator('[data-feature-id="audience-primary-stage-nav"]:visible').first();
      await stage.waitFor({ state: "visible", timeout: timeoutMs });
      await primaryNav.waitFor({ state: "visible", timeout: timeoutMs });
      const songsStageGap = await page.evaluate(() => {
        const stageElement = document.querySelector('[data-feature-id="singer-current-performance-card"]');
        const navElement = document.querySelector('[data-feature-id="audience-primary-stage-nav"]');
        return stageElement.getBoundingClientRect().top - navElement.getBoundingClientRect().bottom;
      });

      const partyNav = page.locator('[data-feature-id="singer-nav-party"]:visible').first();
      await partyNav.click({ force: true });
      await delay(150);
      const partyStageGap = await page.evaluate(() => {
        const stageElement = document.querySelector('[data-feature-id="singer-current-performance-card"]');
        const navElement = document.querySelector('[data-feature-id="audience-primary-stage-nav"]');
        return stageElement.getBoundingClientRect().top - navElement.getBoundingClientRect().bottom;
      });

      const songsNav = page.locator('[data-feature-id="singer-nav-songs"]:visible').first();
      await songsNav.click({ force: true });
      await delay(150);
      if (Math.abs(partyStageGap - songsStageGap) > 1) {
        throw new Error(`Stage gap changed ${Math.abs(partyStageGap - songsStageGap)}px between Songs and Party.`);
      }
      return "shared stage keeps the same vertical position between Party and Songs";
    });

    await runCheck(checks, "singer_app_streamlined_manual_request_reachable", async () => {
      const songsNav = page.locator('[data-feature-id="singer-nav-songs"]:visible').first();
      await songsNav.waitFor({ state: "visible", timeout: timeoutMs });
      const songsSelected = await songsNav.getAttribute("aria-selected");
      if (songsSelected !== "true") {
        throw new Error(`Expected streamlined SONGS/Browse state to be selected; got ${songsSelected || "(empty)"}.`);
      }

      const manualEntry = page.locator('[data-feature-id="singer-manual-request-open"]:visible').first();
      const manualEntryReady = await manualEntry
        .waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5000) })
        .then(() => true)
        .catch(() => false);
      if (!manualEntryReady) {
        const allManualEntryCount = await page
          .locator('[data-feature-id="singer-manual-request-open"]')
          .count()
          .catch(() => 0);
        const bodyText = String(await page.locator("body").innerText().catch(() => ""))
          .replace(/\s+/g, " ")
          .slice(0, 900);
        throw new Error(
          `Streamlined SONGS did not expose visible Manual entry. allHookCount=${allManualEntryCount} body=${bodyText || "(empty)"}`,
        );
      }
      const manualEntryEnabled = await manualEntry.isEnabled().catch(() => false);
      if (!manualEntryEnabled) {
        throw new Error("Streamlined Manual entry action is visible but disabled in the joined Browse fixture.");
      }
      await manualEntry.click({ force: true });

      const songTitleInput = page
        .locator('[data-feature-id="singer-request-song-title"]:visible')
        .first();
      const composerReady = await songTitleInput
        .waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5000) })
        .then(() => true)
        .catch(() => false);
      if (!composerReady) {
        const bodyText = String(await page.locator("body").innerText().catch(() => ""))
          .replace(/\s+/g, " ")
          .slice(0, 1200);
        throw new Error(
          `Manual entry action clicked but composer did not open. body=${bodyText || "(empty)"}`,
        );
      }
      await songTitleInput.fill("QA Streamlined Manual Song");
      const value = await songTitleInput.inputValue();
      if (value !== "QA Streamlined Manual Song") {
        throw new Error(`Manual request composer did not retain input; got "${value}".`);
      }
      return "streamlined SONGS opens a writable manual request composer";
    });

    await runCheck(checks, "singer_app_streamlined_tight15_reachable", async () => {
      await page.goto(
        `${server.baseUrl}/?room=DEMOAUD&qaAudienceFixture=streamlined-browse`,
        { waitUntil: "domcontentloaded", timeout: timeoutMs },
      );
      await singerRoot.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 15000) });
      await delay(250);

      const duplicateTight15DiscoveryCount = await page
        .locator('[data-feature-id="audience-tight15-discovery"]:visible')
        .count();
      if (duplicateTight15DiscoveryCount !== 0) {
        throw new Error("Streamlined Songs should expose Tight 15 through its tab only.");
      }

      const tight15Nav = page
        .locator('[data-feature-id="audience-tight15-nav"]:visible')
        .first();
      await tight15Nav.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5000) });
      await tight15Nav.click({ force: true });

      const tight15Library = page
        .locator('[data-feature-id="audience-tight15-library"]:visible')
        .first();
      await tight15Library.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5000) });

      const accountGate = page
        .locator('[data-feature-id="audience-tight15-account-gate"]:visible')
        .first();
      await accountGate.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5000) });
      const gateText = String(await accountGate.innerText()).replace(/\s+/g, " ");
      if (!gateText.includes("5,000 PTS")) {
        throw new Error(`Tight 15 account gate did not disclose its reward. text=${gateText}`);
      }
      return "streamlined SONGS reveals Tight 15 and its account-backed save path";
    });

    await runCheck(checks, "singer_app_between_round_reactions_remain_visible_and_editable", async () => {
      await page.goto(
        `${server.baseUrl}/?room=DEMOAUD&qaAudienceFixture=streamlined-aahf-party-ready`,
        { waitUntil: "domcontentloaded", timeout: timeoutMs },
      );
      await singerRoot.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 15000) });
      const deck = page.locator('[data-feature-id="persistent-audience-reaction-deck"]:visible').first();
      await deck.waitFor({ state: "visible", timeout: timeoutMs });
      if ((await deck.getAttribute("data-reactions-active")) !== "false") {
        throw new Error("Between-song fixture should keep its voting loadout visible but inactive.");
      }
      if ((await deck.getAttribute("data-reaction-layout")) !== "grid") {
        throw new Error("Between-song Party should preserve the large voting grid.");
      }
      const reactionButtons = deck.locator('[data-reaction-deck-type]');
      if ((await reactionButtons.count()) < 4) throw new Error("Expected at least four visible voting emojis between songs.");
      if (!(await reactionButtons.first().isDisabled())) throw new Error("Between-song emoji taps should remain disabled until voting is live.");
      if ((await reactionButtons.count()) === 4) {
        const fifthSlot = deck.locator('[data-feature-id="reaction-deck-unlock-slot-5"]:visible').first();
        await fifthSlot.waitFor({ state: "visible", timeout: timeoutMs });
        const fifthSlotText = String(await fifthSlot.innerText()).replace(/\s+/g, " ");
        if (!/Unlock a 5th voting emoji/i.test(fifthSlotText)) throw new Error(`Fifth-slot CTA is unclear: ${fifthSlotText}`);
      }
      const editButton = deck.locator('[data-feature-id="edit-voting-emojis"]').first();
      if (!(await editButton.isEnabled())) throw new Error("Voting loadout Edit should remain enabled between songs.");
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "between-songs-deck-430x932.png"), fullPage: false });
      await editButton.click({ force: true });
      await page.locator('[data-feature-id="reaction-emoji-library-toggle"]:visible').first().waitFor({ state: "visible", timeout: timeoutMs });
      return "inactive emoji buttons preserve placement and open their loadout editor between songs";
    });

    await runCheck(checks, "singer_app_avatar_storefront_is_responsive_and_priced", async () => {
      await page.goto(
        `${server.baseUrl}/?room=DEMOAUD&qaAudienceFixture=streamlined-aahf-join`,
        { waitUntil: "domcontentloaded", timeout: timeoutMs },
      );
      const joinView = page.locator('[data-singer-view="join"]:visible').first();
      await joinView.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 15000) });
      const paidOffers = joinView.locator('[data-avatar-offer-currency="points"], [data-avatar-offer-currency="beaubucks"]');
      if ((await paidOffers.count()) < 2) throw new Error("Avatar carousel should visibly merchandise both Points and BeauBucks offers.");
      if ((await joinView.locator('[data-feature-id="avatar-storefront-jump-nav"]').count()) !== 0) {
        throw new Error("Avatar price-category shortcuts should be removed from the join flow.");
      }
      await joinView.locator('[data-avatar-offer-currency="beaubucks"]').last().scrollIntoViewIfNeeded();
      await delay(500);
      const carouselMetrics = await joinView.locator('.emoji-carousel:visible').first().evaluate((node) => ({
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
      }));
      const beauBucksOfferBoxes = await joinView.locator('[data-avatar-offer-currency="beaubucks"]').evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, width: box.width };
      }));
      const visibleBeauBucksOffer = beauBucksOfferBoxes.some((box) => box.x < 430 && box.x + box.width > 0);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "join-avatar-storefront-430x932.png"), fullPage: false });
      if (!visibleBeauBucksOffer) {
        throw new Error(`Swiping to the end did not bring a premium avatar price into view. metrics=${JSON.stringify(carouselMetrics)} offers=${JSON.stringify(beauBucksOfferBoxes.slice(0, 3))}`);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) throw new Error(`Avatar join picker causes ${overflow}px of horizontal overflow.`);
      return "join avatar picker shows currency prices without horizontal overflow";
    });

    await runCheck(checks, "singer_app_streamlined_no_page_errors", async () => {
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
  console.log("SingerApp streamlined manual-request QA passed.");
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
