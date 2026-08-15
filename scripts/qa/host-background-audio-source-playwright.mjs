import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  ensurePlaywright,
  startStaticDistServer,
} from './shared/playwrightQa.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const distDir = path.join(repoRoot, 'dist');
const outputDir = path.join(repoRoot, 'tmp', 'qa-host-background-audio-source');
const route = '/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=queue-overview-density&hostUiVersion=v2&view=stage&tab=stage';
const viewports = [
  { id: 'phone', width: 390, height: 844 },
  { id: 'tablet', width: 768, height: 1024 },
  { id: 'desktop', width: 1440, height: 960 },
];

await fs.mkdir(outputDir, { recursive: true });
const server = await startStaticDistServer({ distDir, port: 0 });
const { chromium } = await ensurePlaywright();
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript((firebaseConfig) => {
      if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${server.baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const audioToggle = page.locator('[data-feature-id="deck-audio-menu-toggle"]').first();
    await audioToggle.waitFor({ state: 'visible', timeout: 45000 });
    const manageButton = page.getByRole('button', { name: /Manage BG Library/i }).first();
    if (!(await manageButton.isVisible().catch(() => false))) {
      await audioToggle.click({ force: true });
    }
    await manageButton.waitFor({ state: 'visible', timeout: 15000 });
    await manageButton.click({ force: true });

    const backgroundTab = page.locator('[data-feature-id="host-media-library-tabs"] button')
      .filter({ hasText: /^Background/i })
      .first();
    await backgroundTab.waitFor({ state: 'visible', timeout: 20000 });
    await backgroundTab.click({ force: true });
    const selector = page.locator('[data-feature-id="background-audio-source-selector"]').first();
    await selector.waitFor({ state: 'visible', timeout: 20000 });
    await selector.scrollIntoViewIfNeeded();

    const metrics = await selector.evaluate((element) => {
      const buttons = Array.from(element.querySelectorAll('button')).map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: String(button.textContent || '').replace(/\s+/g, ' ').trim(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          pressed: button.getAttribute('aria-pressed'),
        };
      });
      return {
        viewportWidth: window.innerWidth,
        pageOverflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        selectorOverflowPx: Math.max(0, element.scrollWidth - element.clientWidth),
        buttons,
      };
    });
    if (metrics.pageOverflowPx > 1 || metrics.selectorOverflowPx > 1) {
      throw new Error(`${viewport.id} source selector overflowed: ${JSON.stringify(metrics)}`);
    }
    if (metrics.buttons.length !== 2 || metrics.buttons.some((button) => button.height < 44)) {
      throw new Error(`${viewport.id} source selector controls are incomplete or undersized: ${JSON.stringify(metrics)}`);
    }
    if (metrics.buttons.filter((button) => button.pressed === 'true').length !== 1) {
      throw new Error(`${viewport.id} source selector does not expose exactly one active source: ${JSON.stringify(metrics)}`);
    }
    results.push({ viewport: viewport.id, ...metrics });
    await page.screenshot({ path: path.join(outputDir, `${viewport.id}.png`), fullPage: true });
    await context.close();
  }
} finally {
  await browser.close().catch(() => {});
  await server.stop().catch(() => {});
}

await fs.writeFile(path.join(outputDir, 'metrics.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(`Host background source responsive QA passed: ${outputDir}`);
