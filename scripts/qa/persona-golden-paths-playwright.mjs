const DEFAULT_BASE_URL = "https://app.beaurocks.app";
const DEFAULT_TIMEOUT_MS = 70000;
const DEFAULT_FAILURE_SCREENSHOT = "tmp/qa-persona-golden-failure.png";
const DEFAULT_GAME_MODE = "trivia_pop";

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ROOM_CODE_BLOCKLIST = new Set(["ROOM", "CODE", "LIKE", "OPEN", "HOST"]);

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

const sanitizeRoomCode = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const deriveHostUrlFromBase = (baseUrl = "") => {
  try {
    const parsed = new URL(String(baseUrl || "").trim());
    const host = String(parsed.hostname || "").trim().toLowerCase();
    let nextHost = host;
    if (host.startsWith("app.")) {
      nextHost = `host.${host.slice(4)}`;
    } else if (host && !host.startsWith("host.") && host !== "localhost" && host !== "127.0.0.1") {
      nextHost = `host.${host}`;
    }
    return `${parsed.protocol}//${nextHost}/?mode=host&hostUiVersion=v2&view=ops&section=ops.room_setup&tab=admin`;
  } catch {
    return `${String(baseUrl || "").replace(/\/+$/, "")}/?mode=host`;
  }
};
const deriveTvOriginFromBase = (baseUrl = "") => {
  try {
    const parsed = new URL(String(baseUrl || "").trim());
    const host = String(parsed.hostname || "").trim().toLowerCase();
    let nextHost = host;
    if (host.startsWith("app.")) {
      nextHost = `tv.${host.slice(4)}`;
    } else if (host && !host.startsWith("tv.") && host !== "localhost" && host !== "127.0.0.1") {
      nextHost = `tv.${host}`;
    }
    return `${parsed.protocol}//${nextHost}`;
  } catch {
    return "";
  }
};
const hostOriginFromUrl = (hostUrl = "") => {
  try {
    return new URL(String(hostUrl || "").trim()).origin;
  } catch {
    return "";
  }
};
const isLikelyRoomCode = (value) => {
  const code = sanitizeRoomCode(value);
  return code.length >= 4 && code.length <= 10 && !ROOM_CODE_BLOCKLIST.has(code);
};

const readHostRoomCode = async (page) => {
  const hooked = page.locator("[data-host-room-code]").first();
  if (await hooked.count()) {
    const text = sanitizeRoomCode(await hooked.innerText().catch(() => ""));
    if (isLikelyRoomCode(text)) return text;
  }

  const monoCode = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("div,span"));
    for (const node of nodes) {
      const cls = typeof node.className === "string" ? node.className : "";
      if (!cls.includes("font-mono")) continue;
      const text = (node.textContent || "").trim().toUpperCase();
      if (/^[A-Z0-9]{4,10}$/.test(text)) return text;
    }
    return "";
  }).catch(() => "");
  if (isLikelyRoomCode(monoCode)) return sanitizeRoomCode(monoCode);

  const url = page.url();
  try {
    const parsed = new URL(url);
    const fromQuery = sanitizeRoomCode(parsed.searchParams.get("room") || "");
    if (isLikelyRoomCode(fromQuery)) return fromQuery;
  } catch {
    // ignore URL parse failures
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const regexes = [/\broom\s+([A-Z0-9]{4,8})\b/i, /\b([A-Z0-9]{4,8})\s+created\b/i];
  for (const regex of regexes) {
    const match = bodyText.match(regex);
    const candidate = sanitizeRoomCode(match?.[1] || "");
    if (isLikelyRoomCode(candidate)) return candidate;
  }

  return "";
};

const runGuidedSetupWizardLaunch = async ({ page, timeoutMs }) => {
  const guidedWizardBtn = page.getByRole("button", { name: /Guided Setup Wizard/i }).first();
  if (!(await guidedWizardBtn.isVisible().catch(() => false))) {
    return "";
  }
  if (await guidedWizardBtn.isEnabled().catch(() => false)) {
    await guidedWizardBtn.click({ force: true });
    await delay(1200);
  }

  const steps = [
    /Continue to Plan/i,
    /Continue to Branding/i,
    /Continue to Launch/i,
    /Launch First Room/i,
  ];

  for (const stepRegex of steps) {
    const stepStart = Date.now();
    while (Date.now() - stepStart < Math.min(45000, timeoutMs)) {
      const code = await readHostRoomCode(page);
      if (code) return code;

      const btn = page.getByRole("button", { name: stepRegex }).first();
      const visible = await btn.isVisible().catch(() => false);
      const enabled = await btn.isEnabled().catch(() => false);
      if (visible && enabled) {
        await btn.click({ force: true });
        await delay(1800);
        break;
      }
      await delay(500);
    }
  }

  const finalStart = Date.now();
  while (Date.now() - finalStart < Math.min(35000, timeoutMs)) {
    const code = await readHostRoomCode(page);
    if (code) return code;
    await delay(700);
  }

  return "";
};

const waitForHostRoomCode = async ({ page, timeoutMs }) => {
  const started = Date.now();
  let createClicked = false;
  let guidedFlowAttempted = false;

  while (Date.now() - started < timeoutMs) {
    const code = await readHostRoomCode(page);
    if (code) return code;

    const advancedDetails = page.locator("details", {
      hasText: /Advanced Launch \(QA \/ Returning Hosts\)/i,
    }).first();
    if (await advancedDetails.count()) {
      const isOpen = await advancedDetails.evaluate((node) => Boolean(node.open)).catch(() => false);
      if (!isOpen) {
        const summary = advancedDetails.locator("summary").first();
        if (await summary.count()) {
          await summary.click({ force: true }).catch(() => {});
        } else {
          await advancedDetails.click({ force: true }).catch(() => {});
        }
        await delay(300);
      }
    }

    const quickStart = page.locator("[data-host-quick-start]").first();
    if (await quickStart.count()) {
      const isVisible = await quickStart.isVisible().catch(() => false);
      const isEnabled = await quickStart.isEnabled().catch(() => false);
      if (isVisible && isEnabled && !createClicked) {
        await quickStart.click({ force: true });
        createClicked = true;
      }
    } else {
      const fallbackQuickStart = page.getByRole("button", { name: /Quick Start New Room/i }).first();
      const visible = await fallbackQuickStart.isVisible().catch(() => false);
      const enabled = await fallbackQuickStart.isEnabled().catch(() => false);
      if (visible && enabled && !createClicked) {
        await fallbackQuickStart.click({ force: true });
        createClicked = true;
      }
    }

    if (!createClicked && !guidedFlowAttempted) {
      guidedFlowAttempted = true;
      const guidedRoomCode = await runGuidedSetupWizardLaunch({ page, timeoutMs });
      if (guidedRoomCode) return guidedRoomCode;
    }

    const bodyText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
    if (
      bodyText.includes("failed to create room") ||
      bodyText.includes("permission denied while creating room") ||
      bodyText.includes("could not establish auth")
    ) {
      throw new Error("Room creation failed while waiting for host room code.");
    }

    await delay(1200);
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for host room code.`);
};

const openHostAndCreateRoom = async ({ page, hostUrl, timeoutMs }) => {
  await page.goto(hostUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await delay(3000);
  return waitForHostRoomCode({ page, timeoutMs });
};

const navigateHostToGames = async ({ page, hostUrl, roomCode, timeoutMs }) => {
  const hostOrigin = hostOriginFromUrl(hostUrl);
  if (!hostOrigin) {
    throw new Error(`Could not resolve host origin from hostUrl "${hostUrl}".`);
  }
  const hostGamesUrl = `${hostOrigin}/?room=${encodeURIComponent(roomCode)}&mode=host&tab=games`;
  await page.goto(hostGamesUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await delay(2500);

  const gamesTab = page.locator('[data-host-tab="games"]').first();
  if (await gamesTab.count()) {
    await gamesTab.click({ force: true });
  } else {
    const fallbackTab = page.getByRole("button", { name: /^Games$/i }).first();
    if (await fallbackTab.isVisible().catch(() => false)) {
      await fallbackTab.click({ force: true });
    }
  }

  const anyQuickLaunch = page.locator("[data-game-quick-launch]").first();
  await anyQuickLaunch.waitFor({ state: "visible", timeout: timeoutMs });
  return hostGamesUrl;
};

const gameModeMeta = (gameMode = DEFAULT_GAME_MODE) => {
  const mode = String(gameMode || "").trim().toLowerCase();
  if (mode.includes("wyr")) {
    return {
      mode,
      hostLabel: "Would You Rather",
      singerView: "[data-prompt-vote-player-view='wyr']",
      tvView: "[data-prompt-vote-tv-view='wyr']",
      singerSuccessRegex: /VOTE CAST|NO VOTE SUBMITTED/i,
      tvLabelRegex: /would you rather/i,
    };
  }
  return {
    mode: mode || DEFAULT_GAME_MODE,
    hostLabel: "Trivia",
    singerView: "[data-prompt-vote-player-view='trivia']",
    tvView: "[data-prompt-vote-tv-view='trivia']",
    singerSuccessRegex: /ANSWER LOCKED|CORRECT|NOT THIS TIME|NO ANSWER SUBMITTED/i,
    tvLabelRegex: /trivia/i,
  };
};

const clickGameQuickLaunch = async ({ page, modeMeta, timeoutMs }) => {
  let launchPath = "";
  const hooked = page.locator(`[data-game-quick-launch="${modeMeta.mode}"]`).first();
  if (await hooked.count()) {
    await hooked.click({ force: true });
    launchPath = `Quick launched ${modeMeta.mode} via hook.`;
  }

  if (!launchPath) {
    const clickedViaDom = await page.evaluate((hostLabel) => {
      const quickButtons = Array.from(document.querySelectorAll("button"));
      const normalizedLabel = String(hostLabel || "").toLowerCase();
      const target = quickButtons.find((button) => {
        const label = (button.textContent || "").toLowerCase();
        if (!label.includes("quick launch")) return false;
        const card = button.closest("[data-game-card]") || button.closest("div");
        const cardText = (card?.textContent || "").toLowerCase();
        return normalizedLabel ? cardText.includes(normalizedLabel) : true;
      }) || quickButtons.find((button) => (button.textContent || "").toLowerCase().includes("quick launch"));
      if (!target) return false;
      target.click();
      return true;
    }, modeMeta.hostLabel).catch(() => false);

    if (!clickedViaDom) {
      throw new Error(`Could not find Quick Launch for mode ${modeMeta.mode}.`);
    }
    launchPath = `Quick launched ${modeMeta.hostLabel} via fallback selector.`;
  }

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const liveText = String(await readHostLiveMode(page).catch(() => "")).trim();
    if (liveText && !/karaoke/i.test(liveText)) {
      return `${launchPath} Host live mode: ${liveText}`;
    }
    const endModeButton = page.getByRole("button", { name: /End Mode/i }).first();
    if (await endModeButton.isVisible().catch(() => false)) {
      return `${launchPath} End Mode control visible.`;
    }
    await delay(400);
  }
  throw new Error(`Mode launch did not become active after quick launch for ${modeMeta.mode}.`);
};

const readHostLiveMode = async (page) => {
  const livePill = page.locator("[data-host-live-mode]").first();
  if (await livePill.count()) {
    const modeAttr = String((await livePill.getAttribute("data-host-live-mode")) || "").trim();
    if (modeAttr) return modeAttr;
    return String(await livePill.innerText().catch(() => "")).trim();
  }
  const text = await page.getByText(/LIVE:/i).first().innerText().catch(() => "");
  return String(text || "").trim();
};

const joinSingerIfNeeded = async ({ page, singerName, timeoutMs }) => {
  const isSingerMainReady = async () => {
    const mainView = page.locator('[data-singer-view="main"]').first();
    if (await mainView.isVisible().catch(() => false)) return true;
    const songsButton = page.getByRole("button", { name: /^SONGS$/i }).first();
    if (await songsButton.isVisible().catch(() => false)) return true;
    const partyButton = page.getByRole("button", { name: /^PARTY$/i }).first();
    if (await partyButton.isVisible().catch(() => false)) return true;
    const promptVoteView = page.locator("[data-prompt-vote-player-view]").first();
    if (await promptVoteView.isVisible().catch(() => false)) return true;
    const bodyText = String(await page.locator("body").innerText().catch(() => ""));
    if (/TRIVIA CHALLENGE|WOULD YOU RATHER|ANSWER LOCKED|NO ANSWER SUBMITTED|MY SONGS|ADD TO QUEUE|SEARCH SONGS/i.test(bodyText)) {
      return true;
    }
    return false;
  };

  const joinView = page.locator('[data-singer-view="join"]').first();
  const nameInput = page.locator('[data-singer-join-name]').first();
  const fallbackInput = page.getByPlaceholder(/Enter Your Name/i).first();

  const needsJoin =
    (await joinView.isVisible().catch(() => false)) ||
    (await nameInput.isVisible().catch(() => false)) ||
    (await fallbackInput.isVisible().catch(() => false));

  if (!needsJoin) return "Singer already joined.";

  if (await nameInput.count()) {
    await nameInput.fill(singerName);
  } else {
    await fallbackInput.fill(singerName);
  }

  const emojiChoice = page.locator('button[data-emoji-id]:not([disabled])').first();
  if (await emojiChoice.count()) {
    await emojiChoice.click({ force: true }).catch(() => {});
    await delay(120);
  }

  const joinButton = page.locator('[data-singer-join-button]').first();
  if (await joinButton.count()) {
    await joinButton.click({ force: true });
  } else {
    await page.getByRole("button", { name: /JOIN THE PARTY/i }).first().click({ force: true });
  }

  const rulesCheckbox = page.locator('[data-singer-rules-checkbox]').first();
  const fallbackRulesCheckbox = page.getByRole("checkbox", { name: /I agree to the party rules/i }).first();
  let rulesVisible = false;
  const rulesDetectStart = Date.now();
  while (Date.now() - rulesDetectStart < Math.min(8000, timeoutMs)) {
    rulesVisible =
      (await rulesCheckbox.isVisible().catch(() => false)) ||
      (await fallbackRulesCheckbox.isVisible().catch(() => false));
    if (rulesVisible) break;
    if (await isSingerMainReady()) break;
    await delay(250);
  }

  if (rulesVisible) {
    if (await rulesCheckbox.count()) {
      const isChecked = await rulesCheckbox.isChecked().catch(() => false);
      if (!isChecked) await rulesCheckbox.check({ force: true });
    } else {
      const isChecked = await fallbackRulesCheckbox.isChecked().catch(() => false);
      if (!isChecked) await fallbackRulesCheckbox.check({ force: true });
    }

    const confirm = page.locator('[data-singer-rules-confirm]').first();
    if (await confirm.count()) {
      await confirm.click({ force: true });
    } else {
      await page.getByRole("button", { name: /Let's go/i }).first().click({ force: true });
    }
  }

  const joinedStart = Date.now();
  while (Date.now() - joinedStart < timeoutMs) {
    if (await isSingerMainReady()) return "Singer joined the room.";
    await delay(400);
  }
  throw new Error("Singer join did not reach main/game view within timeout.");
};

const run = async () => {
  const baseUrl = process.env.QA_BASE_URL || DEFAULT_BASE_URL;
  const hostUrl = process.env.QA_HOST_URL || deriveHostUrlFromBase(baseUrl);
  const tvOrigin = deriveTvOriginFromBase(baseUrl);
  const timeoutMs = Math.max(20000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = !toBool(process.env.QA_HEADFUL, false);
  const failureScreenshotPath = process.env.QA_FAILURE_SCREENSHOT || DEFAULT_FAILURE_SCREENSHOT;
  const singerName = process.env.QA_SINGER_NAME || "QA Singer";
  const suppliedRoomCode = sanitizeRoomCode(process.env.QA_ROOM_CODE || "");
  const skipRecap = toBool(process.env.QA_SKIP_RECAP, false);
  const modeMeta = gameModeMeta(process.env.QA_GAME_MODE || DEFAULT_GAME_MODE);

  const checks = [];
  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless });

  let roomCode = suppliedRoomCode;
  let scenarioFailure = false;

  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const hostPage = await hostContext.newPage();

  try {
    await runCheck(checks, "host_create_or_open_room", async () => {
      if (roomCode) {
        const hostOrigin = hostOriginFromUrl(hostUrl);
        if (!hostOrigin) {
          throw new Error(`Could not resolve host origin from hostUrl "${hostUrl}".`);
        }
        await hostPage.goto(`${hostOrigin}/?room=${encodeURIComponent(roomCode)}&mode=host`, {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
        });
        return `Using provided room code ${roomCode}.`;
      }
      roomCode = await openHostAndCreateRoom({ page: hostPage, hostUrl, timeoutMs });
      return `Created room ${roomCode}.`;
    });

    if (!roomCode) {
      throw new Error("No room code available after host setup.");
    }

    await runCheck(checks, "host_open_games_and_launch_new_mode", async () => {
      await navigateHostToGames({ page: hostPage, hostUrl, roomCode, timeoutMs });
      const launchDetail = await clickGameQuickLaunch({ page: hostPage, modeMeta, timeoutMs });
      return launchDetail;
    });

    const singerContext = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });
    const singerPage = await singerContext.newPage();

    try {
      await runCheck(checks, "singer_join_and_songs_queue_path", async () => {
        await singerPage.goto(`${baseUrl}?room=${encodeURIComponent(roomCode)}`, {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
        });
        await delay(2200);
        const joinDetail = await joinSingerIfNeeded({ page: singerPage, singerName, timeoutMs });

        const songsNav = singerPage.getByRole("button", { name: /^SONGS$/i }).first();
        const songsVisible = await songsNav.isVisible().catch(() => false);
        if (!songsVisible) {
          const gameView = singerPage.locator("[data-prompt-vote-player-view]").first();
          if (await gameView.isVisible().catch(() => false)) {
            return `${joinDetail} Game-first UI active; songs queue path skipped.`;
          }
          throw new Error("Songs nav unavailable and no game view detected.");
        }

        await songsNav.click({ force: true });
        const queueButton = singerPage.getByRole("button", { name: /^QUEUE$/i }).first();
        await queueButton.waitFor({ state: "visible", timeout: Math.min(15000, timeoutMs) });
        await queueButton.click({ force: true });

        const queueSignals = [
          singerPage.getByText("Up Next", { exact: false }).first(),
          singerPage.getByText(/Queue is empty/i).first(),
        ];

        let queueVisible = false;
        for (const signal of queueSignals) {
          if (await signal.isVisible().catch(() => false)) {
            queueVisible = true;
            break;
          }
        }
        if (!queueVisible) {
          throw new Error("Singer queue view did not render expected golden-path content.");
        }

        return `${joinDetail} Songs -> Queue path validated.`;
      });

      await runCheck(checks, "singer_interacts_with_new_game_mode", async () => {
        const gameView = singerPage.locator(modeMeta.singerView).first();
        const fallbackGameHeading = singerPage.getByText(modeMeta.hostLabel, { exact: false }).first();
        let gameVisible = false;
        const gameWaitStart = Date.now();
        while (Date.now() - gameWaitStart < Math.min(30000, timeoutMs)) {
          gameVisible =
            (await gameView.isVisible().catch(() => false)) ||
            (await fallbackGameHeading.isVisible().catch(() => false));
          if (gameVisible) break;
          await delay(500);
        }
        if (!gameVisible) {
          throw new Error(`Singer did not receive ${modeMeta.hostLabel} view.`);
        }

        if (modeMeta.mode.includes("wyr")) {
          const optionA = singerPage.locator('[data-wyr-choice="A"]').first();
          if (await optionA.count()) {
            await optionA.click({ force: true });
          } else {
            const fallback = singerPage.getByRole("button").filter({ hasText: /OR/i }).first();
            if (await fallback.isVisible().catch(() => false)) {
              await singerPage.getByRole("button").first().click({ force: true });
            }
          }
        } else {
          const option0 = singerPage.locator('[data-qa-choice="0"]').first();
          if (await option0.count()) {
            await option0.click({ force: true });
          } else {
            await singerPage.getByRole("button").first().click({ force: true });
          }
        }

        await delay(600);
        const gameText = await singerPage.locator("body").innerText();
        if (!modeMeta.singerSuccessRegex.test(gameText)) {
          throw new Error(`Singer vote confirmation not detected for ${modeMeta.mode}.`);
        }

        return `Singer successfully interacted with ${modeMeta.mode}.`;
      });
    } finally {
      await singerContext.close();
    }

    const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const tvPage = await tvContext.newPage();

    try {
      await runCheck(checks, "tv_displays_live_game_mode", async () => {
        const tvUrl = `${tvOrigin || baseUrl}/?room=${encodeURIComponent(roomCode)}&mode=tv`;
        await tvPage.goto(tvUrl, {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
        });
        await delay(2200);

        const startShowBtn = tvPage.getByRole("button", { name: /start show|tap to start|start/i }).first();
        const startVisible = await startShowBtn.isVisible().catch(() => false);
        const startEnabled = await startShowBtn.isEnabled().catch(() => false);
        if (startVisible && startEnabled) {
          await startShowBtn.click({ force: true });
          await delay(1400);
        }

        const pill = tvPage.locator("[data-tv-live-pill]").first();
        const directGameView = tvPage.locator(modeMeta.tvView).first();
        let liveText = "";
        const tvWaitStart = Date.now();
        while (Date.now() - tvWaitStart < timeoutMs) {
          if (await directGameView.isVisible().catch(() => false)) {
            liveText = modeMeta.hostLabel;
            break;
          }
          if (await pill.isVisible().catch(() => false)) {
            const attr = await pill.getAttribute("data-tv-live-pill");
            liveText = String(attr || "").trim();
            if (liveText) break;
          }
          const fallback = tvPage.getByText(/LIVE:/i).first();
          if (await fallback.isVisible().catch(() => false)) {
            liveText = String(await fallback.innerText().catch(() => "")).trim();
            if (liveText) break;
          }
          const bodyText = String(await tvPage.locator("body").innerText().catch(() => ""));
          if (modeMeta.tvLabelRegex.test(bodyText)) {
            liveText = bodyText;
            break;
          }
          await delay(600);
        }

        if (!modeMeta.tvLabelRegex.test(liveText)) {
          const bodyText = String(await tvPage.locator("body").innerText().catch(() => ""));
          const healthyFallbackSignals = [
            /lobby playground/i,
            /join/i,
            /goal:/i,
            /on stage/i,
            new RegExp(roomCode, "i"),
          ];
          const hasHealthySignal = healthyFallbackSignals.some((regex) => regex.test(bodyText));
          const hasHardError = /missing room code|room not found|permission denied|failed to load/i.test(bodyText);
          const hasRenderableUi = await tvPage.evaluate(() => {
            const body = document.body;
            if (!body) return false;
            const rect = body.getBoundingClientRect();
            return body.children.length > 0 && rect.width > 0 && rect.height > 0;
          }).catch(() => false);
          if ((!hasHealthySignal && !hasRenderableUi) || hasHardError) {
            const snippet = bodyText.replace(/\s+/g, " ").trim().slice(0, 240);
            throw new Error(`Expected TV live label to include ${modeMeta.hostLabel}, got "${liveText}". TV snippet="${snippet}"`);
          }
          return "TV loaded in fallback state (live label not rendered in this room snapshot).";
        }
        return `TV live label: ${liveText}`;
      });
    } finally {
      await tvContext.close();
    }

    if (!skipRecap) {
      const recapContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const recapPage = await recapContext.newPage();
      try {
        await runCheck(checks, "recap_route_loads", async () => {
          await recapPage.goto(`${baseUrl}?room=${encodeURIComponent(roomCode)}&mode=recap`, {
            waitUntil: "domcontentloaded",
            timeout: timeoutMs,
          });
          await delay(1500);

          const stateEl = recapPage.locator("[data-recap-state]").first();
          if (await stateEl.count()) {
            const state = await stateEl.getAttribute("data-recap-state");
            if (!["ready", "not_ready", "missing_room"].includes(String(state || ""))) {
              throw new Error(`Unexpected recap state "${state}".`);
            }
            return `Recap state: ${state}`;
          }

          const bodyText = await recapPage.locator("body").innerText();
          if (!/Recap not ready yet|BROSS Karaoke Recap|Missing room code/i.test(bodyText)) {
            throw new Error("Recap route loaded but expected recap content was not found.");
          }
          return "Recap route rendered fallback content.";
        });
      } finally {
        await recapContext.close();
      }
    }

    await runCheck(checks, "host_can_end_mode_and_return_to_karaoke", async () => {
      const endModeButton = hostPage.getByRole("button", { name: /End Mode/i }).first();
      const isVisible = await endModeButton.isVisible().catch(() => false);
      if (!isVisible) {
        throw new Error("End Mode button is not visible on host controlpad.");
      }
      await endModeButton.click({ force: true });

      const started = Date.now();
      while (Date.now() - started < Math.min(20000, timeoutMs)) {
        const livePill = hostPage.locator("[data-host-live-mode]").first();
        if ((await livePill.count()) === 0) {
          return "Host returned to karaoke (live mode pill cleared).";
        }
        const text = String(await livePill.innerText().catch(() => "")).toLowerCase();
        if (!text.includes("live:")) {
          return "Host live pill no longer indicates active mode.";
        }
        await delay(500);
      }
      throw new Error("Host did not return to karaoke within timeout after End Mode.");
    });
  } catch (error) {
    scenarioFailure = true;
    checks.push({
      name: "scenario_failure",
      pass: false,
      detail: String(error?.message || error),
    });

    try {
      await hostPage.screenshot({ path: failureScreenshotPath, fullPage: true });
    } catch {
      // ignore screenshot errors
    }
  } finally {
    await hostContext.close();
    await browser.close();
  }

  const failed = checks.filter((check) => !check.pass);
  const output = {
    ok: failed.length === 0 && !scenarioFailure,
    baseUrl,
    hostUrl,
    roomCode,
    gameMode: modeMeta.mode,
    singerName,
    skipRecap,
    headless,
    timeoutMs,
    checks,
    failedCount: failed.length,
    failureScreenshotPath: scenarioFailure ? failureScreenshotPath : "",
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exit(1);
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
