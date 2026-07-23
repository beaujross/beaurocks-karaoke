import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  ensurePlaywright,
  startStaticDistServer,
} from "./shared/playwrightQa.mjs";

const DEFAULT_TIMEOUT_MS = 70000;
const TEXT_FLOOR_PX = 12;
const CONTROL_FLOOR_PX = 44;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const distDir = path.join(repoRoot, "dist");
const explicitBaseUrl = String(process.env.QA_BASE_URL || "").trim();
const timeoutMs = Math.max(25000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
const strict = String(process.env.QA_READABILITY_STRICT || "1").trim() !== "0";

const routes = [
  { label: "marketing-home", path: "/?mode=marketing&page=for_fans" },
  { label: "marketing-discover", path: "/discover" },
  { label: "marketing-charts", path: "/charts" },
  { label: "marketing-hosts", path: "/for-hosts" },
  { label: "marketing-venues", path: "/for-venues" },
  { label: "marketing-performers", path: "/for-performers" },
  { label: "marketing-join", path: "/join" },
  { label: "marketing-submit", path: "/submit" },
  { label: "marketing-host-access", path: "/host-access" },
  {
    label: "host-console",
    path: "/?room=DEMOAAHF&qaHostFixture=run-of-show-console",
    ready: "[data-host-qa-ready='true']",
  },
];

const summarizePage = async (page, route) => page.evaluate(
  ({ textFloorPx, controlFloorPx, scopeSelector }) => {
    const scope = document.querySelector(scopeSelector) || document.body;
    const visible = (element) => {
      if (!(element instanceof Element)) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const descriptor = (element) => {
      const classes = Array.from(element.classList || []).slice(0, 3).join(".");
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
    };

    const textNodes = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = cleanText(walker.currentNode.nodeValue);
      const parent = walker.currentNode.parentElement;
      if (!text || text.length < 2 || !parent || !visible(parent)) continue;
      if (parent.closest("svg, [aria-hidden='true'], script, style")) continue;
      const style = window.getComputedStyle(parent);
      textNodes.push({
        selector: descriptor(parent),
        text: text.slice(0, 90),
        px: Number.parseFloat(style.fontSize),
        color: style.color,
      });
    }

    const controls = Array.from(scope.querySelectorAll(
      "button, a[href], input:not([type='hidden']):not([type='checkbox']):not([type='radio']), select, textarea, summary, [role='button']",
    ))
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          selector: descriptor(element),
          text: cleanText(element.getAttribute("aria-label") || element.textContent).slice(0, 90),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          fontPx: Number.parseFloat(style.fontSize),
          clientWidth: Math.round(element.clientWidth),
          scrollWidth: Math.round(element.scrollWidth),
        };
      });

    const smallText = textNodes
      .filter((entry) => Number.isFinite(entry.px) && entry.px < textFloorPx)
      .sort((left, right) => left.px - right.px);
    const smallControls = controls
      .filter((entry) => entry.width < controlFloorPx || entry.height < controlFloorPx)
      .sort((left, right) => left.height - right.height || left.width - right.width);
    const smallControlText = controls
      .filter((entry) => Number.isFinite(entry.fontPx) && entry.fontPx < 14)
      .sort((left, right) => left.fontPx - right.fontPx);
    const clippedControls = controls
      .filter((entry) => entry.scrollWidth > entry.clientWidth + 2)
      .sort((left, right) => (right.scrollWidth - right.clientWidth) - (left.scrollWidth - left.clientWidth));
    const horizontalOverflowPx = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth || 0,
    ) - window.innerWidth;

    return {
      route: window.location.pathname + window.location.search,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      textNodeCount: textNodes.length,
      controlCount: controls.length,
      smallTextCount: smallText.length,
      smallControlCount: smallControls.length,
      smallControlTextCount: smallControlText.length,
      clippedControlCount: clippedControls.length,
      horizontalOverflowPx: Math.max(0, Math.round(horizontalOverflowPx)),
      smallText: smallText.slice(0, 12),
      smallControls: smallControls.slice(0, 12),
      smallControlText: smallControlText.slice(0, 12),
      clippedControls: clippedControls.slice(0, 12),
    };
  },
  {
    textFloorPx: TEXT_FLOOR_PX,
    controlFloorPx: CONTROL_FLOOR_PX,
    scopeSelector: route.label === "host-console" ? ".host-app" : ".mk3-site",
  },
);

const server = explicitBaseUrl ? null : await startStaticDistServer({ distDir, port: 0 });
const baseUrl = String(explicitBaseUrl || server?.baseUrl || "").replace(/\/+$/, "");
const { chromium } = await ensurePlaywright();
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of [
    { label: "desktop", width: 1440, height: 960 },
    { label: "mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    await context.addInitScript((firebaseConfig) => {
      if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const route of routes) {
      await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      if (route.ready) {
        await page.locator(route.ready).first().waitFor({ state: "visible", timeout: timeoutMs });
      } else {
        await page.locator(".mk3-site").first().waitFor({ state: "visible", timeout: timeoutMs });
      }
      await page.waitForTimeout(route.ready ? 1200 : 300);
      results.push({
        surface: route.label,
        viewport: viewport.label,
        ...(await summarizePage(page, route)),
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server?.stop();
}

for (const result of results) {
  console.log(JSON.stringify(result));
}

const violations = results.filter((result) => (
  result.smallTextCount > 0
  || result.smallControlCount > 0
  || result.smallControlTextCount > 0
  || result.clippedControlCount > 0
  || result.horizontalOverflowPx > 1
));

if (strict && violations.length > 0) {
  console.error(`Readability audit found ${violations.length} surface/viewport violations.`);
  process.exitCode = 1;
}
