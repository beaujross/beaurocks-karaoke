import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  ensurePlaywright,
  startStaticDistServer,
} from './shared/playwrightQa.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(repoRoot, 'tmp', 'qa-host-prompt-session-responsive');
const viewports = [
  { id: 'phone', width: 390, height: 844 },
  { id: 'tablet', width: 768, height: 1024 },
  { id: 'landscape', width: 1024, height: 768 },
  { id: 'desktop', width: 1440, height: 960 },
];
const fixtures = [
  { id: 'trivia-draft', fixture: 'prompt-session-trivia-draft', expected: ['Save question set', 'Add question'] },
  { id: 'wyr-live', fixture: 'prompt-session-wyr-live', expected: ['Reveal', 'Pause', 'End session'] },
];

const inspectPanel = (panel) => panel.evaluate((root) => {
  const visible = (element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  };
  const controls = Array.from(root.querySelectorAll('button, input, select, textarea'))
    .filter(visible)
    .map((element) => {
      const ownRect = element.getBoundingClientRect();
      const targetRect = element.matches('input[type="radio"], input[type="checkbox"]')
        ? element.closest('label')?.getBoundingClientRect() || ownRect
        : ownRect;
      return {
        label: String(element.getAttribute('aria-label') || element.textContent || element.value || '').trim().slice(0, 80),
        width: Math.round(targetRect.width),
        height: Math.round(targetRect.height),
      };
    });
  const rect = root.getBoundingClientRect();
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentOverflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    panelOverflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
    panelOutsideViewportPx: Math.max(0, -rect.left) + Math.max(0, rect.right - window.innerWidth),
    undersizedControls: controls.filter((control) => control.width < 44 || control.height < 44),
  };
});

await fs.mkdir(outputDir, { recursive: true });
const server = await startStaticDistServer({ distDir: path.join(repoRoot, 'dist') });
const { chromium } = await ensurePlaywright();
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of viewports) {
    for (const fixture of fixtures) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript((firebaseConfig) => {
        if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
      }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
      const page = await context.newPage();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
      await page.goto(`${server.baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&tab=stage&view=queue&section=queue.live_run&qaHostFixture=${fixture.fixture}`, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      const panel = page.locator('[data-feature-id="prompt-night-session"]').first();
      await panel.waitFor({ state: 'visible', timeout: 45000 });
      for (const text of fixture.expected) {
        await panel.getByText(text, { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
      }
      const metrics = await inspectPanel(panel);
      const genericControlPads = await page.locator('[data-host-active-game-controlpad]').count();
      results.push({ viewport: viewport.id, state: fixture.id, genericControlPads, pageErrors, ...metrics });
      await page.screenshot({
        path: path.join(outputDir, `${viewport.id}-${fixture.id}.png`),
        fullPage: true,
      });
      await context.close();
    }
  }
} finally {
  await browser.close().catch(() => {});
  await server.stop().catch(() => {});
}

await fs.writeFile(path.join(outputDir, 'metrics.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
const failures = results.filter((result) => (
  result.documentOverflowPx > 1
  || result.panelOverflowPx > 1
  || result.panelOutsideViewportPx > 1
  || result.undersizedControls.length > 0
  || result.genericControlPads > 0
  || result.pageErrors.length > 0
));
if (failures.length) {
  throw new Error(`Prompt-session responsive QA found ${failures.length} failing states. See ${path.join(outputDir, 'metrics.json')}.`);
}
console.log(`Prompt-session responsive QA passed. Screenshots and metrics: ${outputDir}`);
