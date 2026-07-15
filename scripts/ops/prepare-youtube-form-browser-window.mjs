import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.join("=")];
  }),
);

const port = Number(args.port || 0);
const scenario = String(args.scenario || "").trim();
const url = String(args.url || "").trim();
const findText = String(args["find-text"] || "").trim();

if (!port || !scenario || !url) {
  throw new Error("Expected --port, --scenario, and --url.");
}

const timeoutMs = 90_000;
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);

try {
  const context = browser.contexts()[0];
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.emulateMedia({ reducedMotion: "reduce" }).catch(() => {});

  if (scenario === "tv-player") {
    await page.getByText("Dreams", { exact: false }).first().waitFor({ state: "visible", timeout: timeoutMs });
    await page.getByText("Alex Rivers", { exact: false }).first().waitFor({ state: "visible", timeout: timeoutMs });
    const youtubeFrames = page.locator('iframe[src*="youtube.com/embed/"]');
    await youtubeFrames.first().waitFor({ state: "visible", timeout: timeoutMs });
    await youtubeFrames.evaluateAll((frames) => {
      for (const frame of frames) {
        const playerUrl = new URL(frame.src.replace("yt_demo_backing_01", "WPt-FVlp2Pw"));
        playerUrl.searchParams.set("autoplay", "0");
        playerUrl.searchParams.set("controls", "1");
        playerUrl.searchParams.delete("start");
        frame.src = playerUrl.toString();
      }
    });
    await page.waitForTimeout(6_000);
  } else if (scenario === "host-curator" || scenario === "host-curator-fallback") {
    await page.getByText("Admin Workspace", { exact: false }).first().waitFor({ state: "visible", timeout: timeoutMs });
    const mediaButton = page.getByRole("button", { name: /Screens \+ Playback/i }).first();
    await mediaButton.waitFor({ state: "visible", timeout: timeoutMs });
    await mediaButton.click({ force: true });
    await page.getByText("Apple Music background", { exact: false }).first().waitFor({ state: "visible", timeout: timeoutMs });
    const curatorButton = page.locator('[data-feature-id="open-youtube-curator"]').first();
    await curatorButton.waitFor({ state: "visible", timeout: timeoutMs });
    await curatorButton.click({ force: true });
    await page.getByText("Room Library Curator", { exact: false }).first().waitFor({ state: "visible", timeout: timeoutMs });

    if (scenario === "host-curator-fallback") {
      const readiness = page.locator('[data-feature-id="youtube-event-readiness"]').first();
      await readiness.waitFor({ state: "visible", timeout: timeoutMs });
      await readiness.scrollIntoViewIfNeeded();
    }
  }

  if (findText) {
    const target = page.getByText(findText, { exact: false }).first();
    await target.waitFor({ state: "visible", timeout: timeoutMs });
    await target.scrollIntoViewIfNeeded();
  }

  await page.waitForTimeout(2_000);
  const originalTitle = await page.title();
  await page.evaluate((title) => {
    document.title = `BeauRocks Evidence | ${title}`;
  }, originalTitle);
  await page.bringToFront();
} finally {
  // The PowerShell wrapper captures the actual Chrome window after this process
  // exits, so intentionally leave the CDP-launched browser open here.
}

// Drop the CDP socket without sending Browser.close; the wrapper still needs
// the real browser window for its OS-level capture.
process.exit(0);
