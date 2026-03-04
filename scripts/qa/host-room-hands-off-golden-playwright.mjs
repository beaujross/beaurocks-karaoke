const DEFAULT_ROOT_URL = "https://beaurocks.app";
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_FAILURE_SCREENSHOT = "tmp/qa-host-room-hands-off-failure.png";
const DEFAULT_SUPER_ADMIN_EMAIL = "hello@beauross.com";

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const parseEmailTokens = (value = "") =>
  String(value || "")
    .split(",")
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean);

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

const sanitizeRoomCode = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const isLikelyRoomCode = (value) => {
  const code = sanitizeRoomCode(value);
  return code.length >= 4 && code.length <= 10 && !ROOM_CODE_BLOCKLIST.has(code);
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

const deriveSurfaceOriginFromRoot = (rootUrl = "", surface = "app") => {
  try {
    const parsed = new URL(String(rootUrl || "").trim());
    const protocol = parsed.protocol || "https:";
    const hostname = String(parsed.hostname || "").trim().toLowerCase();
    const portPart = parsed.port ? `:${parsed.port}` : "";

    if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname || "localhost"}${portPart}`;
    }

    const labels = hostname.split(".");
    const knownSurface = new Set(["app", "host", "tv", "www"]);
    let domainLabels = labels;
    if (knownSurface.has(labels[0])) {
      domainLabels = labels.slice(1);
    }
    if (!domainLabels.length) {
      return `${protocol}//${hostname}${portPart}`;
    }
    return `${protocol}//${surface}.${domainLabels.join(".")}${portPart}`;
  } catch {
    return "";
  }
};

const deriveHostUrlFromRoot = (rootUrl = "") => {
  const hostOrigin = deriveSurfaceOriginFromRoot(rootUrl, "host");
  if (!hostOrigin) return `${String(rootUrl || "").replace(/\/+$/, "")}/?mode=host`;
  return `${hostOrigin}/?mode=host&hostUiVersion=v2&view=ops&section=ops.room_setup&tab=admin`;
};

const deriveHostAccessUrl = (rootUrl = "") => {
  const safeRoot = String(rootUrl || "").replace(/\/+$/, "");
  return `${safeRoot}/host-access`;
};

const readHostRoomCode = async (page) => {
  const hooked = page.locator("[data-host-room-code]").first();
  if (await hooked.count()) {
    const text = sanitizeRoomCode(await hooked.innerText().catch(() => ""));
    if (isLikelyRoomCode(text)) return text;
  }

  const monoCode = await page
    .evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("div,span"));
      for (const node of nodes) {
        const cls = typeof node.className === "string" ? node.className : "";
        if (!cls.includes("font-mono")) continue;
        const text = (node.textContent || "").trim().toUpperCase();
        if (/^[A-Z0-9]{4,10}$/.test(text)) return text;
      }
      return "";
    })
    .catch(() => "");
  if (isLikelyRoomCode(monoCode)) return sanitizeRoomCode(monoCode);

  try {
    const parsed = new URL(page.url());
    const fromQuery = sanitizeRoomCode(parsed.searchParams.get("room") || "");
    if (isLikelyRoomCode(fromQuery)) return fromQuery;
  } catch {
    // ignore
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

    const createPrimary = page.locator("[data-host-create-room-primary]").first();
    if (await createPrimary.count()) {
      const visible = await createPrimary.isVisible().catch(() => false);
      const enabled = await createPrimary.isEnabled().catch(() => false);
      if (visible && enabled && !createClicked) {
        await createPrimary.click({ force: true });
        createClicked = true;
        await delay(900);
      }
    }

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
      const visible = await quickStart.isVisible().catch(() => false);
      const enabled = await quickStart.isEnabled().catch(() => false);
      if (visible && enabled && !createClicked) {
        await quickStart.click({ force: true });
        createClicked = true;
        await delay(900);
      }
    }

    if (!createClicked && !guidedFlowAttempted) {
      guidedFlowAttempted = true;
      const guidedRoomCode = await runGuidedSetupWizardLaunch({ page, timeoutMs });
      if (guidedRoomCode) return guidedRoomCode;
    }

    const bodyText = String(await page.locator("body").innerText().catch(() => "")).toLowerCase();
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

const ensureHostControlBar = async ({ page, timeoutMs }) => {
  const started = Date.now();
  while (Date.now() - started < Math.min(timeoutMs, 50000)) {
    const toggle = page.locator('[data-feature-id="deck-automation-menu-toggle"]').first();
    if (await toggle.isVisible().catch(() => false)) {
      return "Host control bar ready.";
    }

    const skipIntroHook = page.locator("[data-host-setup-skip-intro]").first();
    if (await skipIntroHook.isVisible().catch(() => false)) {
      await skipIntroHook.click({ force: true });
      await delay(1500);
      continue;
    }

    const skipIntro = page.getByRole("button", { name: /skip intro/i }).first();
    if (await skipIntro.isVisible().catch(() => false)) {
      await skipIntro.click({ force: true });
      await delay(1500);
      continue;
    }

    const startNight = page.getByRole("button", { name: /start night/i }).first();
    if (await startNight.isVisible().catch(() => false)) {
      const enabled = await startNight.isEnabled().catch(() => false);
      if (enabled) {
        await startNight.click({ force: true });
        await delay(1800);
        continue;
      }
    }

    const continueBtn = page.getByRole("button", { name: /continue/i }).first();
    if (await continueBtn.isVisible().catch(() => false)) {
      const enabled = await continueBtn.isEnabled().catch(() => false);
      if (enabled) {
        await continueBtn.click({ force: true });
        await delay(1200);
        continue;
      }
    }

    await delay(700);
  }
  throw new Error("Could not reach host top chrome controls.");
};

const gotoHostAccessAndLogin = async ({ page, rootUrl, email, password, timeoutMs }) => {
  const candidates = [
    deriveHostAccessUrl(rootUrl),
    `${String(rootUrl || "").replace(/\/+$/, "")}/?mode=marketing&page=host_access`,
  ];

  let loaded = false;
  for (const target of candidates) {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await delay(1200);
    const hasHostAuthHeading = await page.getByText(/Host Login \+ Room Manager/i).first().isVisible().catch(() => false);
    if (hasHostAuthHeading) {
      loaded = true;
      break;
    }
  }
  if (!loaded) {
    throw new Error(`Could not load host access route from root url "${rootUrl}".`);
  }

  const signOut = page.getByRole("button", { name: /sign out/i }).first();
  if (await signOut.isVisible().catch(() => false)) {
    await signOut.click({ force: true });
    await delay(900);
  }

  const authForm = page.locator("form").first();
  await authForm.waitFor({ state: "visible", timeout: timeoutMs });

  const signInModeBtn = authForm.locator(".mk3-toggle-row button").filter({ hasText: /^Log In$/i }).first();
  if (await signInModeBtn.isVisible().catch(() => false)) {
    await signInModeBtn.click({ force: true });
  }

  const emailInput = authForm.getByLabel(/Email/i).first();
  const passwordInput = authForm.getByLabel(/Password/i).first();
  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submitButton = authForm.locator('button[type="submit"]').first();
  await submitButton.click({ force: true });

  const loginSucceeded = await Promise.race([
    page
      .getByText(/Signed in as/i)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs })
      .then(() => true)
      .catch(() => false),
    page
      .getByRole("button", { name: /sign out/i })
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs })
      .then(() => true)
      .catch(() => false),
  ]);

  if (!loginSucceeded) {
    const bodyText = String(await page.locator("body").innerText().catch(() => ""));
    const snippet = bodyText.replace(/\s+/g, " ").slice(0, 300);
    throw new Error(`Login did not complete on root host access flow. Snippet="${snippet}"`);
  }
  return `Logged in as ${email}.`;
};

const ensureAutomationMenuOpen = async (page, timeoutMs) => {
  const toggle = page.locator('[data-feature-id="deck-automation-menu-toggle"]').first();
  await toggle.waitFor({ state: "visible", timeout: timeoutMs });
  await toggle.click({ force: true });
  await page.getByText(/Queue handoff, media continuity, and room guardrails/i).first().waitFor({ state: "visible", timeout: timeoutMs });
};

const buttonStateText = async (button) =>
  String(await button.innerText().catch(() => "")).trim().toLowerCase();

const ensureToggleOn = async ({ button, timeoutMs, allowArmed = false }) => {
  const isOnText = (text) => /\bon\b/.test(text) || (allowArmed && /\barmed\b/.test(text));
  const isOffText = (text) => /\boff\b/.test(text);

  const initialText = await buttonStateText(button);
  if (isOnText(initialText)) return `already_on (${initialText})`;

  if (!isOffText(initialText) && !allowArmed) {
    await button.click({ force: true });
  } else if (isOffText(initialText)) {
    await button.click({ force: true });
  }

  const started = Date.now();
  while (Date.now() - started < Math.min(10000, timeoutMs)) {
    const nextText = await buttonStateText(button);
    if (isOnText(nextText)) return `toggled_on (${nextText})`;
    await delay(250);
  }
  throw new Error(`Toggle did not reach ON state. Final text="${await buttonStateText(button)}"`);
};

const joinSingerIfNeeded = async ({ page, singerName, timeoutMs }) => {
  const isSingerMainReady = async () => {
    const mainView = page.locator('[data-singer-view="main"]').first();
    if (await mainView.isVisible().catch(() => false)) return true;
    const songsButton = page.getByRole("button", { name: /^SONGS$/i }).first();
    if (await songsButton.isVisible().catch(() => false)) return true;
    const partyButton = page.getByRole("button", { name: /^PARTY$/i }).first();
    if (await partyButton.isVisible().catch(() => false)) return true;
    const bodyText = String(await page.locator("body").innerText().catch(() => ""));
    if (/MY SONGS|ADD TO QUEUE|SEARCH SONGS|REQUEST SONG/i.test(bodyText)) {
      return true;
    }
    return false;
  };

  const joinView = page.locator('[data-singer-view="join"]').first();
  const nameInput = page.locator("[data-singer-join-name]").first();
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

  const emojiChoice = page.locator("button[data-emoji-id]:not([disabled])").first();
  if (await emojiChoice.count()) {
    await emojiChoice.click({ force: true }).catch(() => {});
    await delay(120);
  }

  const joinButton = page.locator("[data-singer-join-button]").first();
  if (await joinButton.count()) {
    await joinButton.click({ force: true });
  } else {
    await page.getByRole("button", { name: /JOIN THE PARTY/i }).first().click({ force: true });
  }

  const rulesCheckbox = page.locator("[data-singer-rules-checkbox]").first();
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

    const confirm = page.locator("[data-singer-rules-confirm]").first();
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
  throw new Error("Singer join did not reach main view within timeout.");
};

const extractAudienceJoinUrl = async ({ hostPage, roomCode, fallbackAudienceOrigin }) => {
  const sharePanel = hostPage.locator("[data-host-share-launch]").first();
  if (await sharePanel.count()) {
    const panelText = String(await sharePanel.innerText().catch(() => ""));
    const urlMatch = panelText.match(/https?:\/\/[^\s]+/i);
    if (urlMatch?.[0]) {
      return urlMatch[0].replace(/[),.;]+$/, "");
    }
  }
  return `${fallbackAudienceOrigin}?room=${encodeURIComponent(roomCode)}`;
};

const readTvQueueCount = async (tvPage) => {
  const bodyText = String(await tvPage.locator("body").innerText().catch(() => ""));
  const queueMatch = bodyText.match(/Queue:\s*(\d+)\s*songs/i);
  if (queueMatch?.[1]) return Number(queueMatch[1]);
  const fullMatch = bodyText.match(/FULL QUEUE\s*\((\d+)\)/i);
  if (fullMatch?.[1]) return Number(fullMatch[1]);
  return -1;
};

const waitForTvQueueCountAtLeast = async ({ tvPage, minimum, timeoutMs }) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const count = await readTvQueueCount(tvPage);
    if (count >= minimum) return count;
    await delay(700);
  }
  throw new Error(`TV queue count did not reach ${minimum} within timeout.`);
};

const run = async () => {
  const rootUrl = process.env.QA_ROOT_URL || process.env.QA_BASE_URL || DEFAULT_ROOT_URL;
  const hostUrl = process.env.QA_HOST_URL || deriveHostUrlFromRoot(rootUrl);
  const audienceOrigin = process.env.QA_AUDIENCE_URL || deriveSurfaceOriginFromRoot(rootUrl, "app");
  const tvOrigin = process.env.QA_TV_URL || deriveSurfaceOriginFromRoot(rootUrl, "tv");
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = !toBool(process.env.QA_HEADFUL, false);
  const failureScreenshotPath = process.env.QA_FAILURE_SCREENSHOT || DEFAULT_FAILURE_SCREENSHOT;
  const hostEmail = String(process.env.QA_HOST_EMAIL || "").trim();
  const hostPassword = String(process.env.QA_HOST_PASSWORD || "");
  const singerName = process.env.QA_SINGER_NAME || "QA Audience";
  const checks = [];

  const normalizedHostEmail = hostEmail.toLowerCase();
  const allowSuperAdmin = toBool(process.env.QA_ALLOW_SUPERADMIN, false);
  const blockedEmails = new Set([
    ...parseEmailTokens(process.env.SUPER_ADMIN_EMAILS || DEFAULT_SUPER_ADMIN_EMAIL),
    ...parseEmailTokens(process.env.QA_BLOCKED_HOST_EMAILS || ""),
  ]);
  const explicitlyAllowedEmails = new Set(parseEmailTokens(process.env.QA_ALLOWED_HOST_EMAILS || ""));

  if (!hostEmail || !hostPassword) {
    throw new Error("QA_HOST_EMAIL and QA_HOST_PASSWORD are required for root-domain host login testing.");
  }
  if (explicitlyAllowedEmails.size > 0 && !explicitlyAllowedEmails.has(normalizedHostEmail)) {
    throw new Error(
      `QA_HOST_EMAIL "${hostEmail}" is not in QA_ALLOWED_HOST_EMAILS. Use a dedicated low-privilege QA host account.`
    );
  }
  if (!allowSuperAdmin && blockedEmails.has(normalizedHostEmail)) {
    throw new Error(
      `QA_HOST_EMAIL "${hostEmail}" matches blocked/super-admin policy. Use a dedicated QA account or set QA_ALLOW_SUPERADMIN=1 only for break-glass use.`
    );
  }

  const hostSongTitle = `QAHOST${Date.now().toString().slice(-5)}`;
  const audienceSongTitle = `QAAUD${Date.now().toString().slice(-5)}`;
  const hostArtist = "QA Host Artist";
  const audienceArtist = "QA Audience Artist";

  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless });

  let roomCode = "";
  let joinUrl = "";
  let tvQueueBaseline = 0;
  let scenarioFailure = false;

  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const hostPage = await hostContext.newPage();
  const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tvPage = await tvContext.newPage();
  const audienceContext = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
  });
  const audiencePage = await audienceContext.newPage();

  try {
    await runCheck(checks, "host_login_from_root_domain", async () =>
      gotoHostAccessAndLogin({
        page: hostPage,
        rootUrl,
        email: hostEmail,
        password: hostPassword,
        timeoutMs,
      })
    );

    await runCheck(checks, "host_create_new_room", async () => {
      await hostPage.goto(hostUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await delay(2500);
      roomCode = await waitForHostRoomCode({ page: hostPage, timeoutMs });
      if (!roomCode) throw new Error("No room code found after host room creation.");
      return `Created room ${roomCode}.`;
    });

    if (!roomCode) throw new Error("Room code unavailable; cannot continue scenario.");

    await runCheck(checks, "host_enable_all_core_automations", async () => {
      await ensureHostControlBar({ page: hostPage, timeoutMs });
      await ensureAutomationMenuOpen(hostPage, timeoutMs);

      const autoPlayButton = hostPage.getByRole("button", { name: /Auto-Play Media/i }).first();
      const autoBgButton = hostPage.locator('[data-feature-id="deck-auto-bg-music-toggle"]').first();
      const autoDjButton = hostPage.locator('[data-feature-id="deck-auto-dj-queue-toggle"]').first();
      const autoLyricsButton = hostPage.locator('[data-feature-id="deck-auto-lyrics-queue-toggle"]').first();

      await Promise.all([
        autoPlayButton.waitFor({ state: "visible", timeout: timeoutMs }),
        autoBgButton.waitFor({ state: "visible", timeout: timeoutMs }),
        autoDjButton.waitFor({ state: "visible", timeout: timeoutMs }),
        autoLyricsButton.waitFor({ state: "visible", timeout: timeoutMs }),
      ]);

      const autoPlayDetail = await ensureToggleOn({ button: autoPlayButton, timeoutMs });
      const autoBgDetail = await ensureToggleOn({ button: autoBgButton, timeoutMs });
      const autoDjDetail = await ensureToggleOn({ button: autoDjButton, timeoutMs });
      const autoLyricsDetail = await ensureToggleOn({ button: autoLyricsButton, timeoutMs, allowArmed: true });

      return `Auto-play=${autoPlayDetail}; bg=${autoBgDetail}; autoDj=${autoDjDetail}; lyrics=${autoLyricsDetail}`;
    });

    await runCheck(checks, "host_share_link_available", async () => {
      joinUrl = await extractAudienceJoinUrl({
        hostPage,
        roomCode,
        fallbackAudienceOrigin: audienceOrigin,
      });
      if (!joinUrl || !joinUrl.includes("room=")) {
        throw new Error(`Could not resolve audience join URL for room ${roomCode}.`);
      }
      return joinUrl;
    });

    await runCheck(checks, "public_tv_loads_and_shows_qr_and_room_code", async () => {
      const tvUrl = `${tvOrigin}?room=${encodeURIComponent(roomCode)}&mode=tv`;
      await tvPage.goto(tvUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await delay(2400);

      const startShowBtn = tvPage.getByRole("button", { name: /start show|tap to start|start/i }).first();
      const startVisible = await startShowBtn.isVisible().catch(() => false);
      const startEnabled = await startShowBtn.isEnabled().catch(() => false);
      if (startVisible && startEnabled) {
        await startShowBtn.click({ force: true });
        await delay(1300);
      }

      await tvPage.getByText(new RegExp(roomCode, "i")).first().waitFor({ state: "visible", timeout: timeoutMs });
      const qr = tvPage.locator('img[alt="QR"], img[alt="Join QR"]').first();
      await qr.waitFor({ state: "visible", timeout: timeoutMs });
      tvQueueBaseline = Math.max(0, await readTvQueueCount(tvPage));
      return `TV loaded with room code ${roomCode}. Baseline queue=${tvQueueBaseline}.`;
    });

    await runCheck(checks, "audience_joins_via_join_url", async () => {
      await audiencePage.goto(joinUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await delay(2000);
      const joinDetail = await joinSingerIfNeeded({
        page: audiencePage,
        singerName,
        timeoutMs,
      });
      return `${joinDetail} joinUrl=${joinUrl}`;
    });

    await runCheck(checks, "host_adds_song_request", async () => {
      const stageTab = hostPage.locator('[data-host-tab="stage"]').first();
      if (await stageTab.isVisible().catch(() => false)) {
        await stageTab.click({ force: true });
        await delay(800);
      }

      const addPanelToggle = hostPage.locator('[data-feature-id="panel-add-to-queue"]').first();
      await addPanelToggle.waitFor({ state: "visible", timeout: timeoutMs });

      const hostSongInput = hostPage.getByPlaceholder("Song").first();
      if (!(await hostSongInput.isVisible().catch(() => false))) {
        await addPanelToggle.click({ force: true });
      }
      await hostSongInput.waitFor({ state: "visible", timeout: timeoutMs });

      await hostSongInput.fill(hostSongTitle);
      await hostPage.getByPlaceholder("Artist").first().fill(hostArtist);
      const urlInput = hostPage.getByPlaceholder(/Paste a YouTube\/local URL or YouTube playlist URL/i).first();
      await urlInput.waitFor({ state: "visible", timeout: timeoutMs });
      const addToQueueBtn = urlInput.locator("xpath=following-sibling::button[1]");
      await addToQueueBtn.click({ force: true });

      const queueToggle = hostPage.locator('[data-feature-id="panel-queue-list"]').first();
      await queueToggle.waitFor({ state: "visible", timeout: timeoutMs });
      const queueSignal = hostPage.getByText(hostSongTitle, { exact: false }).first();
      const queueVisible = await queueSignal
        .waitFor({ state: "visible", timeout: timeoutMs })
        .then(() => true)
        .catch(() => false);

      if (!queueVisible) {
        throw new Error(`Host-added song "${hostSongTitle}" did not appear in queue.`);
      }
      return `Queued ${hostSongTitle}.`;
    });

    await runCheck(checks, "public_tv_sync_after_host_request", async () => {
      const updated = await waitForTvQueueCountAtLeast({
        tvPage,
        minimum: tvQueueBaseline + 1,
        timeoutMs,
      });
      const tvBody = String(await tvPage.locator("body").innerText().catch(() => ""));
      if (!new RegExp(hostSongTitle, "i").test(tvBody)) {
        throw new Error(`TV queue count updated to ${updated}, but host song "${hostSongTitle}" is not visible.`);
      }
      return `TV queue=${updated} after host request.`;
    });

    await runCheck(checks, "audience_adds_song_request", async () => {
      const songsNav = audiencePage.getByRole("button", { name: /^SONGS$/i }).first();
      await songsNav.waitFor({ state: "visible", timeout: timeoutMs });
      await songsNav.click({ force: true });
      await audiencePage.getByRole("button", { name: /^REQUESTS$/i }).first().click({ force: true });

      const songTitleInput = audiencePage.getByPlaceholder("Song Title").first();
      const artistInput = audiencePage.getByPlaceholder("Artist").first();
      await songTitleInput.waitFor({ state: "visible", timeout: timeoutMs });
      await songTitleInput.fill(audienceSongTitle);
      await artistInput.fill(audienceArtist);

      await audiencePage.getByRole("button", { name: /SEND REQUEST/i }).first().click({ force: true });
      await audiencePage.getByText(audienceSongTitle, { exact: false }).first().waitFor({ state: "visible", timeout: timeoutMs });
      return `Audience requested ${audienceSongTitle}.`;
    });

    await runCheck(checks, "host_queue_contains_host_and_audience_requests", async () => {
      const hostSongVisible = await hostPage.getByText(hostSongTitle, { exact: false }).first().isVisible().catch(() => false);
      const audienceSongVisible = await hostPage.getByText(audienceSongTitle, { exact: false }).first().isVisible().catch(() => false);
      if (!hostSongVisible || !audienceSongVisible) {
        throw new Error(
          `Host queue did not show both songs (hostVisible=${hostSongVisible}, audienceVisible=${audienceSongVisible}).`
        );
      }
      return `${hostSongTitle} + ${audienceSongTitle} visible on host queue.`;
    });

    await runCheck(checks, "public_tv_sync_after_audience_request", async () => {
      const updated = await waitForTvQueueCountAtLeast({
        tvPage,
        minimum: tvQueueBaseline + 2,
        timeoutMs,
      });
      const tvBody = String(await tvPage.locator("body").innerText().catch(() => ""));
      if (!new RegExp(audienceSongTitle, "i").test(tvBody)) {
        throw new Error(
          `TV queue count updated to ${updated}, but audience song "${audienceSongTitle}" is not visible.`
        );
      }
      return `TV queue=${updated} after audience request.`;
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
    await audienceContext.close().catch(() => {});
    await tvContext.close().catch(() => {});
    await hostContext.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const failed = checks.filter((check) => !check.pass);
  const output = {
    ok: failed.length === 0 && !scenarioFailure,
    rootUrl,
    hostUrl,
    audienceOrigin,
    tvOrigin,
    roomCode,
    joinUrl,
    hostSongTitle,
    audienceSongTitle,
    timeoutMs,
    headless,
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
