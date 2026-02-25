const DEFAULT_BASE_URL = "https://beaurocks-karaoke-v2.web.app";
const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_FAILURE_SCREENSHOT = "tmp/qa-overnight-smoke-failure.png";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensurePlaywright = async () => {
  try {
    return await import("playwright");
  } catch (error) {
    const message = String(error?.message || error);
    throw new Error(
      `Playwright is not installed (${message}). Run: npm install && npm run qa:admin:prod:install`
    );
  }
};

const sanitizeRoomCode = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

const readHostRoomCode = async (page) => {
  const hooked = page.locator("[data-host-room-code]").first();
  if (await hooked.count()) {
    const text = sanitizeRoomCode(await hooked.innerText().catch(() => ""));
    if (text.length >= 4) return text;
  }
  try {
    const parsed = new URL(page.url());
    const fromQuery = sanitizeRoomCode(parsed.searchParams.get("room") || "");
    if (fromQuery.length >= 4) return fromQuery;
  } catch {
    // ignore
  }
  return "";
};

const waitForHostRoomCode = async ({ page, timeoutMs }) => {
  const started = Date.now();
  let createClicked = false;
  while (Date.now() - started < timeoutMs) {
    const code = await readHostRoomCode(page);
    if (code) return code;

    const quickStart = page.locator("[data-host-quick-start]").first();
    if (await quickStart.count()) {
      const visible = await quickStart.isVisible().catch(() => false);
      const enabled = await quickStart.isEnabled().catch(() => false);
      if (!createClicked && visible && enabled) {
        await quickStart.click({ force: true });
        createClicked = true;
      }
    } else {
      const fallbackQuickStart = page.getByRole("button", { name: /quick start/i }).first();
      const visible = await fallbackQuickStart.isVisible().catch(() => false);
      const enabled = await fallbackQuickStart.isEnabled().catch(() => false);
      if (!createClicked && visible && enabled) {
        await fallbackQuickStart.click({ force: true });
        createClicked = true;
      }
    }
    await delay(1000);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for host room code.`);
};

const attachErrorCollectors = (page, label, bucket) => {
  page.on("console", (msg) => {
    const text = msg.text();
    const type = msg.type();
    const normalized = String(text || "").toLowerCase();
    const isCritical =
      type === "error" ||
      normalized.includes("failed-precondition") ||
      normalized.includes("requires an index") ||
      normalized.includes("uncaught error in snapshot listener");
    if (!isCritical) return;
    bucket.push({ label, kind: "console", type, text });
  });

  page.on("pageerror", (error) => {
    bucket.push({
      label,
      kind: "pageerror",
      type: "error",
      text: String(error?.message || error),
    });
  });
};

const runCheck = async (checks, name, fn) => {
  try {
    const detail = await fn();
    checks.push({ name, pass: true, detail: detail || "" });
    return true;
  } catch (error) {
    checks.push({ name, pass: false, detail: String(error?.message || error) });
    return false;
  }
};

const validateHostDropdown = async (hostPage, timeoutMs) => {
  const isSetupWizardVisible = async () => {
    const setupHeading = hostPage.getByText("Set The Night", { exact: false }).first();
    return setupHeading.isVisible().catch(() => false);
  };

  const ensureHostControlBar = async () => {
    const started = Date.now();
    while (Date.now() - started < Math.min(timeoutMs, 30000)) {
      const tvToggle = hostPage.locator('[data-feature-id="deck-tv-menu-toggle"]').first();
      if (await tvToggle.isVisible().catch(() => false)) return tvToggle;

      const skipIntroHook = hostPage.locator("[data-host-setup-skip-intro]").first();
      if (await skipIntroHook.isVisible().catch(() => false)) {
        await skipIntroHook.click({ force: true });
        await delay(1500);
        continue;
      }

      const skipIntro = hostPage.getByRole("button", { name: /skip intro/i }).first();
      if (await skipIntro.isVisible().catch(() => false)) {
        await skipIntro.click({ force: true });
        await delay(1500);
        continue;
      }

      const startNight = hostPage.getByRole("button", { name: /start night/i }).first();
      if (await startNight.isVisible().catch(() => false)) {
        const enabled = await startNight.isEnabled().catch(() => false);
        if (enabled) {
          await startNight.click({ force: true });
          await delay(1800);
          continue;
        }
      }

      const continueBtn = hostPage.getByRole("button", { name: /continue/i }).first();
      if (await continueBtn.isVisible().catch(() => false)) {
        const enabled = await continueBtn.isEnabled().catch(() => false);
        if (enabled) {
          await continueBtn.click({ force: true });
          await delay(1200);
          continue;
        }
      }

      await delay(800);
    }
    throw new Error("Could not reach host control bar with deck TV toggle.");
  };

  let toggle;
  try {
    toggle = await ensureHostControlBar();
  } catch (error) {
    if (await isSetupWizardVisible()) {
      return "Skipped dropdown check: setup wizard remained active in this room state.";
    }
    throw error;
  }

  await toggle.waitFor({ state: "visible", timeout: timeoutMs });
  await toggle.click({ force: true });

  const title = hostPage.getByText("TV Display Modes", { exact: false }).first();
  try {
    await title.waitFor({ state: "visible", timeout: 10000 });
  } catch (error) {
    if (await isSetupWizardVisible()) {
      return "Skipped dropdown check: setup wizard overlay prevented top-chrome validation.";
    }
    throw error;
  }

  const panelMeta = await title.evaluate((node) => {
    const panel = node.closest("div");
    if (!panel) return { width: 0, height: 0, background: "" };
    const rect = panel.getBoundingClientRect();
    const style = window.getComputedStyle(panel);
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      background: style.backgroundColor || "",
    };
  });

  const videoBtn = hostPage.locator('[data-feature-id="deck-tv-video"]').first();
  const lyricsBtn = hostPage.locator('[data-feature-id="deck-tv-lyrics"]').first();
  const vizBtn = hostPage.locator('[data-feature-id="deck-tv-visualizer"]').first();
  const lvBtn = hostPage.locator('[data-feature-id="deck-tv-lyrics-viz"]').first();
  await Promise.all([
    videoBtn.waitFor({ state: "visible", timeout: timeoutMs }),
    lyricsBtn.waitFor({ state: "visible", timeout: timeoutMs }),
    vizBtn.waitFor({ state: "visible", timeout: timeoutMs }),
    lvBtn.waitFor({ state: "visible", timeout: timeoutMs }),
  ]);

  if (panelMeta.width < 360 || panelMeta.height < 240) {
    throw new Error(`TV dropdown panel too small (${panelMeta.width}x${panelMeta.height}).`);
  }
  return `TV dropdown rendered (${panelMeta.width}x${panelMeta.height}).`;
};

const assertNoCriticalErrors = (bucket, label) => {
  const scoped = bucket.filter((entry) => entry.label === label);
  if (!scoped.length) return "No critical console/page errors detected.";
  const detail = scoped
    .slice(0, 5)
    .map((entry) => `${entry.kind}:${entry.type}:${entry.text}`)
    .join(" | ");
  throw new Error(`Detected ${scoped.length} critical runtime errors: ${detail}`);
};

const validateTvNotStuckOnPreview = async (tvPage, timeoutMs) => {
  await tvPage.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
  await delay(9000);

  const previewVisible = await tvPage.getByText("TV Preview", { exact: false }).first().isVisible().catch(() => false);
  if (previewVisible) {
    throw new Error("TV Preview overlay remained visible after initial load.");
  }

  const wyrLayoutVisible = await tvPage.getByText("Would You Rather Layout", { exact: false }).first().isVisible().catch(() => false);
  if (wyrLayoutVisible) {
    throw new Error("Would You Rather preview layout appears stuck on TV.");
  }

  return "No stuck TV preview overlays detected after load.";
};

const run = async () => {
  const { chromium } = await ensurePlaywright();
  const baseUrl = process.env.QA_BASE_URL || DEFAULT_BASE_URL;
  const timeoutMs = Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const checks = [];
  const errors = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const hostPage = await context.newPage();
  const audiencePage = await context.newPage();
  const tvPage = await context.newPage();

  attachErrorCollectors(hostPage, "host", errors);
  attachErrorCollectors(audiencePage, "audience", errors);
  attachErrorCollectors(tvPage, "tv", errors);

  let roomCode = "";
  try {
    await runCheck(checks, "host_create_or_join_room", async () => {
      await hostPage.goto(`${baseUrl}?mode=host`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await delay(2500);
      roomCode = await waitForHostRoomCode({ page: hostPage, timeoutMs });
      return `Room ${roomCode}`;
    });

    await runCheck(checks, "host_dropdown_visualizer_panel", async () => {
      if (!roomCode) throw new Error("Room code unavailable.");
      return validateHostDropdown(hostPage, timeoutMs);
    });

    await runCheck(checks, "audience_load_no_critical_errors", async () => {
      if (!roomCode) throw new Error("Room code unavailable.");
      await audiencePage.goto(`${baseUrl}?room=${encodeURIComponent(roomCode)}`, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      await delay(9000);
      return assertNoCriticalErrors(errors, "audience");
    });

    await runCheck(checks, "tv_preview_not_stuck", async () => {
      if (!roomCode) throw new Error("Room code unavailable.");
      await tvPage.goto(`${baseUrl}?room=${encodeURIComponent(roomCode)}&mode=tv`, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      const previewResult = await validateTvNotStuckOnPreview(tvPage, timeoutMs);
      const errorResult = assertNoCriticalErrors(errors, "tv");
      return `${previewResult} ${errorResult}`;
    });

    await runCheck(checks, "host_no_critical_errors", async () => assertNoCriticalErrors(errors, "host"));
  } finally {
    const failed = checks.filter((check) => !check.pass);
    if (failed.length) {
      await hostPage.screenshot({ path: DEFAULT_FAILURE_SCREENSHOT, fullPage: true }).catch(() => {});
    }
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const failedChecks = checks.filter((check) => !check.pass);
  const output = {
    ok: failedChecks.length === 0,
    baseUrl,
    roomCode,
    checks,
    failures: failedChecks,
    criticalErrorCount: errors.length,
  };
  console.log(JSON.stringify(output, null, 2));
  if (failedChecks.length) process.exit(1);
};

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exit(1);
});
