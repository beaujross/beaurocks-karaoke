import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  ensurePlaywright,
  startStaticDistServer,
} from "./shared/playwrightQa.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const distDir = path.join(repoRoot, "dist");
const outputDir = path.join(repoRoot, "tmp", "qa-host-room-setup-responsive");

const viewports = Object.freeze([
  { id: "phone", width: 390, height: 844 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "landscape", width: 1024, height: 768 },
  { id: "desktop", width: 1440, height: 960 },
  { id: "wide", width: 1600, height: 1000 },
]);

const route = "/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=room-manager&hostUiVersion=v2";

const inspectSetup = async (page, state) => page.locator('[data-launch-core-setup="true"]').evaluate((scope, nextState) => {
  const visible = (element) => {
    if (!(element instanceof Element)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  };
  const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const smallText = [];
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const parent = walker.currentNode.parentElement;
    const text = cleanText(walker.currentNode.nodeValue);
    if (!parent || !text || !visible(parent) || parent.closest("[aria-hidden='true']")) continue;
    const fontPx = Number.parseFloat(window.getComputedStyle(parent).fontSize);
    if (Number.isFinite(fontPx) && fontPx < 12) smallText.push({ text: text.slice(0, 80), fontPx });
  }
  const smallControls = Array.from(scope.querySelectorAll("button, input, select, summary"))
    .filter(visible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        text: cleanText(element.getAttribute("aria-label") || element.textContent).slice(0, 80),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    })
    .filter((control) => control.width < 44 || control.height < 44);
  return {
    state: nextState,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    smallText,
    smallControls,
  };
}, state);

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
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${server.baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const shell = page.locator('[data-host-workspace-shell="room-setup"]').first();
    await shell.waitFor({ state: "visible", timeout: 45000 });
    await page.getByRole("tab", { name: /Create Room/i }).click();
    const setup = page.locator('[data-launch-core-setup="true"]').first();
    await setup.waitFor({ state: "visible", timeout: 30000 });

    results.push({ viewport: viewport.id, ...(await inspectSetup(page, "collapsed")) });
    await page.screenshot({
      path: path.join(outputDir, `${viewport.id}-collapsed.png`),
      fullPage: true,
    });

    await setup.getByRole("button", { name: /Fine-tune/i }).click();
    await setup.getByText("Queue rules", { exact: true }).waitFor({ state: "visible" });
    results.push({ viewport: viewport.id, ...(await inspectSetup(page, "expanded")) });
    await page.screenshot({
      path: path.join(outputDir, `${viewport.id}-expanded.png`),
      fullPage: true,
    });
    await context.close();
  }
} finally {
  await browser.close().catch(() => {});
  await server.stop().catch(() => {});
}

await fs.writeFile(
  path.join(outputDir, "metrics.json"),
  `${JSON.stringify(results, null, 2)}\n`,
  "utf8",
);

const failures = results.filter((result) => (
  result.horizontalOverflowPx > 1
  || result.smallText.length > 0
  || result.smallControls.length > 0
));

if (failures.length) {
  throw new Error(`Room Setup responsive QA found ${failures.length} failing viewport states. See ${path.join(outputDir, "metrics.json")}.`);
}

console.log(`Room Setup responsive QA passed. Screenshots and metrics: ${outputDir}`);
