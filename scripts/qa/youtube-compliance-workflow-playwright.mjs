import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXED_QA_HOST_NOW_MS } from '../../src/apps/Host/qaHostFixtures.js';
import { FIXED_QA_TV_NOW_MS } from '../../src/apps/TV/qaTvFixtures.js';
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  delay,
  ensurePlaywright,
  startStaticDistServer,
} from './shared/playwrightQa.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const distDir = path.join(repoRoot, 'dist');
const timeoutMs = Math.max(45000, Number(process.env.QA_TIMEOUT_MS || 90000));
const roomCode = 'DEMOAAHF';

const openFixturePage = async ({ browser, server, pathName, nowMs, viewport }) => {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ firebaseConfig, fixedNowMs }) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    Date.now = () => Number(fixedNowMs);
  }, { firebaseConfig: DEFAULT_FIREBASE_RUNTIME_CONFIG, fixedNowMs: nowMs });
  const page = await context.newPage();
  const diagnostics = [];
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${String(error?.stack || error?.message || error)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`);
  });
  await page.goto(new URL(pathName, server.baseUrl).href, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  return { context, page, diagnostics };
};

const main = async () => {
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir });
  const browser = await chromium.launch({
    headless: String(process.env.QA_HEADFUL || '').trim() !== '1',
    args: ['--disable-dev-shm-usage'],
  });

  try {
    const host = await openFixturePage({
      browser,
      server,
      nowMs: FIXED_QA_HOST_NOW_MS,
      viewport: { width: 1440, height: 1100 },
      pathName: `/?mode=host&room=${roomCode}&mkDemoEmbed=1&qaHostFixture=run-of-show-console&hostUiVersion=v2&view=ops&section=ops.room_setup&tab=admin`,
    });
    try {
      await delay(1800);
      const playbackButton = host.page.getByRole('button', { name: /Open Media Setup|Media \+ Apple Music/i }).first();
      try {
        await playbackButton.waitFor({ state: 'visible', timeout: timeoutMs });
      } catch (error) {
        const visibleText = (await host.page.locator('body').innerText().catch(() => '')).slice(0, 1200);
        throw new Error(`Host playback navigation did not render. Visible text: ${visibleText}. Browser diagnostics: ${host.diagnostics.join(' | ')}`, { cause: error });
      }
      await playbackButton.click({ force: true });
      const curatorButton = host.page.locator('[data-feature-id="open-youtube-curator"]').first();
      await curatorButton.waitFor({ state: 'visible', timeout: timeoutMs });
      await curatorButton.evaluate((button) => button.click());

      await host.page.locator('[data-feature-id="youtube-workflow-explainer"]').waitFor({ state: 'visible', timeout: timeoutMs });
      const libraryItems = host.page.locator('[data-feature-id="youtube-room-library-item"]');
      await libraryItems.first().waitFor({ state: 'visible', timeout: timeoutMs });
      if (await libraryItems.count() < 2) throw new Error('Expected at least two deterministic YouTube room-library items.');

      const bodyText = (await host.page.locator('body').innerText()).toLowerCase();
      for (const expected of [
        '1. search',
        '2. verify',
        '3. play',
        'verified for public tv',
        'known verified backing',
        'playlist index',
        'add performance',
        'open on youtube',
      ]) {
        if (!bodyText.includes(expected)) throw new Error(`Host compliance surface is missing: ${expected}`);
      }
      if (await host.page.locator('[data-feature-id="youtube-playlist-qa-tools"]').count()) {
        throw new Error('Internal YouTube QA controls must stay hidden in the normal host fixture.');
      }
    } finally {
      await host.context.close().catch(() => {});
    }

    const tv = await openFixturePage({
      browser,
      server,
      nowMs: FIXED_QA_TV_NOW_MS,
      viewport: { width: 1440, height: 900 },
      pathName: `/?mode=tv&room=${roomCode}&mkDemoEmbed=1&qaTvFixture=youtube-audit-performance`,
    });
    try {
      await tv.page.getByText('Dreams', { exact: false }).first().waitFor({ state: 'visible', timeout: timeoutMs });
      await tv.page.getByText('Alex Rivers', { exact: false }).first().waitFor({ state: 'visible', timeout: timeoutMs });
      await delay(1200);
      await tv.page.locator('iframe[src*="youtube.com/embed/"]').first().waitFor({ state: 'attached', timeout: timeoutMs });
    } finally {
      await tv.context.close().catch(() => {});
    }

    console.log('YouTube compliance workflow passed: host search/verify/play guidance, explicit readiness, hidden QA controls, and Public TV embed.');
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exitCode = 1;
});
