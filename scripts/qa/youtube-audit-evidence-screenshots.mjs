import fs from "node:fs/promises";
import path from "node:path";
import { ensurePlaywright } from "./shared/playwrightQa.mjs";

const OUTPUT_DIR = path.join(
  process.cwd(),
  "docs",
  "compliance",
  "evidence",
  "2026-07-06-youtube-audit",
);

const ROUTES = [
  {
    id: "terms",
    url: "https://beaurocks.app/karaoke/terms",
    title: "Terms of Service | BeauRocks Karaoke",
    requiredText: [
      "Terms of Service",
      "YouTube API Services",
      "YouTube Terms of Service",
      "Google Privacy Policy",
    ],
  },
  {
    id: "privacy",
    url: "https://beaurocks.app/karaoke/privacy",
    title: "Privacy Policy | BeauRocks Karaoke",
    requiredText: [
      "Privacy Policy",
      "YouTube API Services",
      "Google Privacy Policy",
    ],
  },
  {
    id: "data-deletion",
    url: "https://beaurocks.app/karaoke/data-deletion",
    title: "Data Deletion | BeauRocks Karaoke",
    requiredText: [
      "Data Deletion",
      "delete",
      "YouTube",
    ],
  },
];

const PROFILES = [
  {
    id: "desktop",
    viewport: { width: 1440, height: 1100 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  },
  {
    id: "mobile",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
];

const freezeMotion = async (page) => {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  }).catch(() => {});
};

const waitForBodyText = async (page, expectedText) => {
  const token = String(expectedText || "").trim().toLowerCase();
  await page.waitForFunction((needle) => {
    const text = String(document?.body?.innerText || "").toLowerCase();
    return text.includes(needle);
  }, token, { timeout: 30000 });
};

const run = async () => {
  const { chromium } = await ensurePlaywright();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });

  const manifest = {
    capturedAt: new Date().toISOString(),
    purpose: "YouTube API Services audit/quota-extension evidence",
    outputDir: OUTPUT_DIR,
    screenshots: [],
    pendingManualEvidence: [
      "Google Cloud Console YouTube Data API quota page for the live project",
      "Authenticated host YouTube search/index surface with disclosure",
      "Authenticated audience YouTube request/search surface",
      "Quota exhaustion fallback state",
      "Room Library Curator catalog health/status strip",
      "Host review flow showing Known backing suggestions",
      "Room permanent-delete path",
    ],
  };

  try {
    for (const profile of PROFILES) {
      const context = await browser.newContext({
        viewport: profile.viewport,
        isMobile: profile.isMobile,
        hasTouch: profile.hasTouch,
        deviceScaleFactor: profile.deviceScaleFactor,
      });

      try {
        const page = await context.newPage();
        for (const route of ROUTES) {
          const response = await page.goto(route.url, {
            waitUntil: "networkidle",
            timeout: 60000,
          });
          await freezeMotion(page);
          await waitForBodyText(page, route.requiredText[0]);

          const status = response?.status() || 0;
          const pageTitle = await page.title();
          const bodyText = await page.locator("body").innerText();
          const missingText = route.requiredText.filter((text) => (
            !bodyText.toLowerCase().includes(text.toLowerCase())
          ));

          if (status < 200 || status >= 300) {
            throw new Error(`${route.url} returned HTTP ${status}`);
          }
          if (pageTitle !== route.title) {
            throw new Error(`${route.url} title mismatch: expected "${route.title}", got "${pageTitle}"`);
          }
          if (missingText.length) {
            throw new Error(`${route.url} missing required text: ${missingText.join(", ")}`);
          }

          const filename = `${profile.id}-${route.id}.png`;
          const screenshotPath = path.join(OUTPUT_DIR, filename);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          manifest.screenshots.push({
            id: `${profile.id}-${route.id}`,
            route: route.id,
            profile: profile.id,
            url: route.url,
            status,
            title: pageTitle,
            path: screenshotPath,
            requiredText: route.requiredText,
          });
        }
      } finally {
        await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`YouTube audit evidence screenshots written to ${OUTPUT_DIR}`);
  console.log(`Manifest: ${manifestPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
