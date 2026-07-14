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
const outputDir = path.join(repoRoot, 'docs', 'reviews', 'evidence', '2026-07-12-program-progress', 'after');
const roomCode = 'DEMOAAHF';

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

const createHostPage = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  return { context, page };
};

const captureRoomSetup = async (browser, baseUrl) => {
  const { context, page } = await createHostPage(browser);
  try {
    await page.goto(`${baseUrl}/?mode=host&room=${roomCode}&mkDemoEmbed=1&qaHostFixture=run-of-show-console&hostUiVersion=v2&view=ops&section=ops.room_setup&tab=admin`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await freezeMotion(page);
    await page.getByText('Admin Workspace').first().waitFor({ state: 'visible', timeout: 45000 });
    await delay(1600);
    await page.screenshot({ path: path.join(outputDir, 'host-room-setup.png'), fullPage: true });
  } finally {
    await context.close();
  }
};

const captureCatalog = async (browser, baseUrl) => {
  const { context, page } = await createHostPage(browser);
  try {
    await page.goto(`${baseUrl}/?mode=host&room=${roomCode}&mkDemoEmbed=1&qaHostFixture=cohost-helper-catalog`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await freezeMotion(page);
    await page.getByText('Co-Host Helper Catalog').first().waitFor({ state: 'visible', timeout: 45000 });
    await delay(1200);
    await page.screenshot({ path: path.join(outputDir, 'host-catalog-browse.png'), fullPage: true });
  } finally {
    await context.close();
  }
};

const captureGameBundles = async (browser, baseUrl) => {
  const { context, page } = await createHostPage(browser);
  try {
    await page.goto(`${baseUrl}/?mode=host&room=${roomCode}&mkDemoEmbed=1&qaHostFixture=run-of-show-console&hostUiVersion=v2&tab=games`, {
      waitUntil: 'domcontentloaded', timeout: 120000,
    });
    await freezeMotion(page);
    const gamesButton = page.locator('[data-host-tab="games"]').first();
    await gamesButton.waitFor({ state: 'visible', timeout: 45000 });
    await gamesButton.click({ force: true });
    await page.getByText('When should it run?').first().waitFor({ state: 'visible', timeout: 45000 });
    await delay(1200);
    await page.screenshot({ path: path.join(outputDir, 'host-game-bundles.png'), fullPage: true });
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
    await captureRoomSetup(browser, server.baseUrl);
    await captureCatalog(browser, server.baseUrl);
    await captureGameBundles(browser, server.baseUrl);
    const manifest = {
      capturedAt: new Date().toISOString(),
      source: 'deterministic production build fixture',
      viewport: { width: 1440, height: 1000 },
      files: ['host-room-setup.png', 'host-catalog-browse.png', 'host-game-bundles.png'],
    };
    await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Saved program progress evidence to ${outputDir}`);
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
