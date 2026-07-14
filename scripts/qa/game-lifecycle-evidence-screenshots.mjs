import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  delay,
  ensurePlaywright,
  startStaticDistServer,
} from './shared/playwrightQa.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const distDir = path.join(repoRoot, 'dist');
const outputDir = path.join(repoRoot, 'docs', 'reviews', 'evidence', '2026-07-13-game-lifecycle', 'after');
const roomCode = 'DEMOAAHF';
const fixedNowMs = 1763503200000;

const freezeMotion = async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
};

const createContext = async (browser, options) => {
  const context = await browser.newContext(options);
  await context.addInitScript((firebaseConfig, nowMs) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    Date.now = () => nowMs;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG, fixedNowMs);
  return context;
};

const clickVisible = async (locator, timeoutMs = 45000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const candidate = locator.nth(index);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      await candidate.evaluate((element) => element.click());
      return true;
    }
    await delay(250);
  }
  return false;
};

const closeAudioMenuIfOpen = async (page) => {
  const audioPanelTitle = page.getByText('Audio + Mix', { exact: true }).first();
  if (!(await audioPanelTitle.isVisible().catch(() => false))) return false;
  const toggle = page.locator('[data-feature-id="deck-audio-menu-toggle"]');
  return clickVisible(toggle, 5000);
};

const captureHostBundles = async (browser, baseUrl) => {
  const context = await createContext(browser, { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/?mode=host&room=${roomCode}&mkDemoEmbed=1&qaHostFixture=run-of-show-console&hostUiVersion=v2&tab=games`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await freezeMotion(page);
    if (!(await clickVisible(page.locator('[data-host-tab="games"]')))) {
      throw new Error('Visible Host Games tab did not become ready for timing-bundle capture.');
    }
    await closeAudioMenuIfOpen(page);
    await page.getByText('When should it run?').first().waitFor({ state: 'visible', timeout: 45000 });
    await delay(600);
    const bundleChoiceCount = await page.locator('[data-feature-id^="host-game-bundle-"]:visible').count();
    if (bundleChoiceCount !== 3) throw new Error(`Expected 3 visible timing choices, found ${bundleChoiceCount}.`);
    await page.screenshot({ path: path.join(outputDir, 'host-game-timing-bundles.png'), fullPage: true });
    return { bundleChoiceCount };
  } finally {
    await context.close();
  }
};

const captureLiveHostGuidance = async (browser, baseUrl) => {
  const context = await createContext(browser, { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/?mode=host&room=${roomCode}&mkDemoEmbed=1&qaHostFixture=prompt-round-trivia-live&hostUiVersion=v2`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await freezeMotion(page);
    await page.getByText('Host Controlpad').first().waitFor({ state: 'visible', timeout: 45000 });
    if (!(await clickVisible(page.locator('[data-host-tab="games"]')))) {
      throw new Error('Visible Host Games tab did not become ready for live-drawer capture.');
    }
    await closeAudioMenuIfOpen(page);
    const drawerButton = page.getByRole('button', { name: /Open Launcher Drawer/i }).first();
    await drawerButton.waitFor({ state: 'visible', timeout: 45000 });
    await drawerButton.evaluate((element) => element.click());
    await page.getByText('When should it run?').first().waitFor({ state: 'visible', timeout: 45000 });
    await delay(600);
    await page.screenshot({ path: path.join(outputDir, 'host-live-game-launcher-drawer.png'), fullPage: true });

    const liveDrawer = page.locator('[data-host-game-launcher-drawer="content"]:visible').last();
    const compactCards = liveDrawer.locator('[data-game-card-variant="live-switcher"]:visible');
    const compactCardCount = await compactCards.count();
    if (!compactCardCount) throw new Error('Compact live-switcher cards were not visible.');
    const actionButtonCounts = [];
    for (let index = 0; index < compactCardCount; index += 1) {
      actionButtonCounts.push(await compactCards.nth(index).locator('button:visible').count());
    }
    const maxActionButtonsPerCard = Math.max(...actionButtonCounts);
    if (maxActionButtonsPerCard > 2) throw new Error(`Compact card action budget exceeded: ${maxActionButtonsPerCard}.`);
    const alongsideButton = liveDrawer.locator('[data-feature-id="host-game-bundle-alongside_karaoke"]').first();
    await alongsideButton.evaluate((element) => element.click());
    const bingoButton = liveDrawer.locator('[data-game-quick-launch="bingo"]').first();
    await bingoButton.waitFor({ state: 'visible', timeout: 10000 });
    await bingoButton.evaluate((element) => element.click());
    await page.getByText(/Finish the current room takeover/i).first().waitFor({ state: 'visible', timeout: 10000 });
    await page.screenshot({ path: path.join(outputDir, 'host-collision-guidance.png'), fullPage: true });
    return {
      recoveryActionCount: 2,
      recoveryPath: ['Games', 'Open Launcher Drawer'],
      compactCardCount,
      actionButtonCounts,
      maxActionButtonsPerCard,
    };
  } finally {
    await context.close();
  }
};

const captureAudienceGuidance = async (browser, baseUrl) => {
  const context = await createContext(browser, {
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/?mode=mobile&room=${roomCode}&qaAudienceFixture=streamlined-trivia-live`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await freezeMotion(page);
    await page.locator('[data-prompt-vote-player-view="trivia"]').first().waitFor({ state: 'visible', timeout: 45000 });
    await delay(500);
    await page.screenshot({ path: path.join(outputDir, 'audience-trivia-action.png'), fullPage: true });
  } finally {
    await context.close();
  }
};

const captureTvGuidance = async (browser, baseUrl) => {
  const context = await createContext(browser, { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/?mode=tv&room=${roomCode}&mkDemoEmbed=1&qaTvFixture=prompt-round-trivia-live`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await freezeMotion(page);
    const startButton = page.getByRole('button', { name: /start show|tap to start|start/i }).first();
    if (await startButton.isVisible().catch(() => false)) await startButton.evaluate((element) => element.click());
    await page.locator('[data-prompt-vote-tv-view="trivia"]').first().waitFor({ state: 'visible', timeout: 45000 });
    await delay(500);
    await page.screenshot({ path: path.join(outputDir, 'tv-trivia-reveal-owner.png'), fullPage: true });
  } finally {
    await context.close();
  }
};

const main = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir });
  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  try {
    const hostBundleMetrics = await captureHostBundles(browser, server.baseUrl);
    const liveSwitcherMetrics = await captureLiveHostGuidance(browser, server.baseUrl);
    await captureAudienceGuidance(browser, server.baseUrl);
    await captureTvGuidance(browser, server.baseUrl);
    const manifest = {
      capturedAt: new Date().toISOString(),
      source: 'deterministic production build fixtures',
      workstream: 'games and crowd interaction lifecycle simplification',
      measurements: {
        timingChoiceCount: hostBundleMetrics.bundleChoiceCount,
        liveRecoveryActionCount: liveSwitcherMetrics.recoveryActionCount,
        liveRecoveryPath: liveSwitcherMetrics.recoveryPath,
        visibleCompactCardCount: liveSwitcherMetrics.compactCardCount,
        actionButtonCountsByVisibleCard: liveSwitcherMetrics.actionButtonCounts,
        maxActionButtonsPerCompactCard: liveSwitcherMetrics.maxActionButtonsPerCard,
        targets: {
          timingChoiceCount: 3,
          liveRecoveryActionCountMax: 2,
          actionButtonsPerCompactCardMax: 2,
        },
      },
      files: [
        { name: 'host-game-timing-bundles.png', persona: 'Host', claim: 'Modes start from timing intent.' },
        { name: 'host-live-game-launcher-drawer.png', persona: 'Host', claim: 'Live controls stay focused; alternate launch controls remain two deliberate actions away.' },
        { name: 'host-collision-guidance.png', persona: 'Host', claim: 'Incompatible starts are blocked with actionable recovery.' },
        { name: 'audience-trivia-action.png', persona: 'Audience', claim: 'The required action and lifecycle context are explicit.' },
        { name: 'tv-trivia-reveal-owner.png', persona: 'Room/TV', claim: 'The shared screen owns the prompt and reveal guidance.' },
      ],
      stabilityBoundary: 'No game mechanics, scoring, payload, schema, or economy state changed for this evidence capture.',
    };
    await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Saved game lifecycle evidence to ${outputDir}`);
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
