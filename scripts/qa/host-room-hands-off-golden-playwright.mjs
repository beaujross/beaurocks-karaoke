import {
  extractRoomCodeFromUrl,
  isLikelyRoomCode,
  sanitizeRoomCode,
} from "./lib/roomCode.js";
import {
  applyQaAppCheckDebugInitScript,
  requireQaAppCheckDebugTokenForRemoteUrl,
} from "./lib/appCheckDebug.mjs";

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
  const hostOrigin = deriveSurfaceOriginFromRoot(rootUrl, "host");
  if (hostOrigin) {
    return `${hostOrigin}/host-access`;
  }
  const safeRoot = String(rootUrl || "").replace(/\/+$/, "");
  return `${safeRoot}/host-access`;
};

const advanceHostLaunchUi = async (page) => {
  const actions = [
    { locator: page.locator("[data-host-setup-skip-intro]").first(), delayMs: 1500 },
    { locator: page.getByRole("button", { name: /skip intro/i }).first(), delayMs: 1500 },
    { locator: page.getByRole("button", { name: /start night/i }).first(), delayMs: 1800 },
    { locator: page.getByRole("button", { name: /continue/i }).first(), delayMs: 1200 },
  ];

  for (const action of actions) {
    const visible = await action.locator.isVisible().catch(() => false);
    if (!visible) continue;
    const enabled = await action.locator.isEnabled().catch(() => false);
    if (!enabled) continue;
    await action.locator.click({ force: true });
    await delay(action.delayMs);
    return true;
  }

  return false;
};

const readHostRoomCode = async (page) => {
  const hooked = page.locator("[data-host-room-code]").first();
  if (await hooked.count()) {
    const text = sanitizeRoomCode(await hooked.innerText().catch(() => ""));
    if (isLikelyRoomCode(text)) return text;
  }

  const fromPageUrl = extractRoomCodeFromUrl(page.url());
  if (fromPageUrl) return fromPageUrl;

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
  let lastCreateAttemptAt = 0;
  let guidedFlowAttempted = false;

  while (Date.now() - started < timeoutMs) {
    const code = await readHostRoomCode(page);
    if (code) return code;

    const createPrimaryCandidates = [
      page.locator("[data-host-create-room-primary]").first(),
      page.getByRole("button", { name: /Create \+ Open Host Panel/i }).first(),
      page.getByRole("button", { name: /^Create Room$/i }).first(),
    ];
    for (const createPrimary of createPrimaryCandidates) {
      if (!(await createPrimary.count().catch(() => 0))) continue;
      const visible = await createPrimary.isVisible().catch(() => false);
      const enabled = await createPrimary.isEnabled().catch(() => false);
      if (visible && enabled && (Date.now() - lastCreateAttemptAt) > 5000) {
        await createPrimary.click({ force: true });
        lastCreateAttemptAt = Date.now();
        await delay(1200);
        break;
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

    const quickStartCandidates = [
      page.locator("[data-host-quick-start]").first(),
      page.getByRole("button", { name: /Open$/i }).first(),
    ];
    for (const quickStart of quickStartCandidates) {
      if (!(await quickStart.count().catch(() => 0))) continue;
      const visible = await quickStart.isVisible().catch(() => false);
      const enabled = await quickStart.isEnabled().catch(() => false);
      if (visible && enabled && (Date.now() - lastCreateAttemptAt) > 5000) {
        await quickStart.click({ force: true });
        lastCreateAttemptAt = Date.now();
        await delay(1200);
        break;
      }
    }

    if (!lastCreateAttemptAt && !guidedFlowAttempted) {
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

    const advanced = await advanceHostLaunchUi(page);
    if (advanced) {
      continue;
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

    if (await advanceHostLaunchUi(page)) {
      continue;
    }

    await delay(700);
  }
  throw new Error("Could not reach host top chrome controls.");
};

const gotoHostAccessAndLogin = async ({ page, rootUrl, email, password, timeoutMs }) => {
  const safeRoot = String(rootUrl || "").replace(/\/+$/, "");
  const candidates = [
    `${safeRoot}/host-access`,
    `${safeRoot}/?mode=marketing&page=host_access`,
    deriveHostAccessUrl(rootUrl),
  ];

  let loaded = false;
  for (const target of candidates) {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await delay(1200);

    const handoffButton = page.getByRole("button", { name: /Continue To Host Login/i }).first();
    if (await handoffButton.isVisible().catch(() => false)) {
      await Promise.allSettled([
        page.waitForURL(/host\./i, { timeout: Math.min(20000, timeoutMs) }),
        handoffButton.click({ force: true }),
      ]);
      await delay(1500);
    }

    const hasHostAuthHeading = await page
      .getByText(/Host Login (\+ (Application|Room Manager)|and Applications)/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasAuthForm = await page.locator("form").first().isVisible().catch(() => false);
    const hasSignedInState = await page.getByText(/Signed in as/i).first().isVisible().catch(() => false);
    if (hasHostAuthHeading && (hasAuthForm || hasSignedInState)) {
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

  const continueToHostLogin = page.getByRole("button", { name: /Continue To Host Login/i }).first();
  const openHostDashboard = page.getByRole("button", { name: /Open Host Dashboard/i }).first();
  const initialSuccess = await Promise.race([
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
    continueToHostLogin.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false),
    openHostDashboard.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false),
  ]);

  if (!initialSuccess) {
    const bodyText = String(await page.locator("body").innerText().catch(() => ""));
    const snippet = bodyText.replace(/\s+/g, " ").slice(0, 300);
    throw new Error(`Login did not complete on root host access flow. Snippet="${snippet}"`);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await continueToHostLogin.isVisible().catch(() => false)) {
      await Promise.allSettled([
        page.waitForURL(/host\./i, { timeout: Math.min(20000, timeoutMs) }),
        continueToHostLogin.click({ force: true }),
      ]);
      await delay(1500);
      continue;
    }
    break;
  }
  return `Logged in as ${email}.`;
};

const ensureAutomationMenuOpen = async (page, timeoutMs) => {
  const toggle = page.locator('[data-feature-id="deck-automation-menu-toggle"]').first();
  await toggle.waitFor({ state: "visible", timeout: timeoutMs });
  const automationHint = page
    .getByText(/Live toggles stay here so you can tune pacing without leaving the host panel/i)
    .first();
  if (await automationHint.isVisible().catch(() => false)) {
    return;
  }
  await toggle.click({ force: true });
  await automationHint.waitFor({ state: "visible", timeout: timeoutMs });
};

const buttonStateText = async (button) =>
  String(await button.innerText().catch(() => "")).trim().toLowerCase();

const escapeRegExp = (value = "") => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const ensureHostQueueAddWorkspaceOpen = async ({ page, timeoutMs }) => {
  const addPanel = page.locator('[data-feature-id="panel-add-to-queue"]').first();
  if (await addPanel.isVisible().catch(() => false)) {
    return "Add workspace already open.";
  }

  const queueTab = page.locator('[data-host-tab="stage"]').first();
  if (await queueTab.isVisible().catch(() => false)) {
    await queueTab.click({ force: true });
    await delay(800);
  }

  const addWorkspaceButtons = [
    page.locator('[data-feature-id="queue-surface-tab-add-desktop"]').first(),
    page.locator('[data-feature-id="queue-surface-tab-add"]').first(),
  ];
  for (const button of addWorkspaceButtons) {
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.click({ force: true });
    await addPanel.waitFor({ state: "visible", timeout: timeoutMs });
    return "Opened queue add workspace.";
  }

  await addPanel.waitFor({ state: "visible", timeout: timeoutMs });
  return "Add workspace visible without tab change.";
};

const ensureHostQueueListWorkspaceOpen = async ({ page, timeoutMs }) => {
  const queuePanel = page.locator('[data-feature-id="panel-queue-list"]').first();
  if (!(await queuePanel.isVisible().catch(() => false))) {
    const queueTab = page.locator('[data-host-tab="stage"]').first();
    if (await queueTab.isVisible().catch(() => false)) {
      await queueTab.click({ force: true });
      await delay(800);
    }

    const queueWorkspaceButtons = [
      page.locator('[data-feature-id="queue-surface-tab-queue-desktop"]').first(),
      page.locator('[data-feature-id="queue-surface-tab-queue"]').first(),
    ];
    for (const button of queueWorkspaceButtons) {
      if (!(await button.isVisible().catch(() => false))) continue;
      await button.click({ force: true });
      await queuePanel.waitFor({ state: "visible", timeout: timeoutMs });
      break;
    }
  }

  await queuePanel.waitFor({ state: "visible", timeout: timeoutMs });
  const expanded = String(await queuePanel.getAttribute("aria-expanded").catch(() => "")).trim().toLowerCase();
  if (expanded === "false") {
    await queuePanel.click({ force: true });
    await delay(700);
  }
  return "Queue workspace open.";
};

const joinSingerIfNeeded = async ({ page, singerName, timeoutMs }) => {
  const isSingerMainReady = async () => {
    const mainView = page.locator('[data-singer-view="main"]').first();
    if (await mainView.isVisible().catch(() => false)) return true;
    const songsButton = page.getByRole("button", { name: /^SONGS$/i }).first();
    if (await songsButton.isVisible().catch(() => false)) return true;
    const partyButton = page.getByRole("button", { name: /^PARTY$/i }).first();
    if (await partyButton.isVisible().catch(() => false)) return true;
    return false;
  };

  const joinView = page.locator('[data-singer-view="join"]').first();
  const nameInput = page.locator("[data-singer-join-name]").first();
  const fallbackInput = page.getByPlaceholder(/Enter Your Name/i).first();
  const joinButton = page.locator("[data-singer-join-button]").first();

  const settleStart = Date.now();
  while (Date.now() - settleStart < Math.min(10000, timeoutMs)) {
    const joinVisible =
      (await joinView.isVisible().catch(() => false)) ||
      (await nameInput.isVisible().catch(() => false)) ||
      (await fallbackInput.isVisible().catch(() => false)) ||
      (await joinButton.isVisible().catch(() => false));
    if (joinVisible || (await isSingerMainReady())) {
      break;
    }
    await delay(300);
  }

  const needsJoin =
    (await joinView.isVisible().catch(() => false)) ||
    (await nameInput.isVisible().catch(() => false)) ||
    (await fallbackInput.isVisible().catch(() => false)) ||
    (await joinButton.isVisible().catch(() => false));

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

const waitForTvSongOrQueueState = async ({ tvPage, minimumQueueCount, songTitle, timeoutMs }) => {
  const started = Date.now();
  const songPattern = new RegExp(escapeRegExp(songTitle), "i");
  let lastCount = -1;
  while (Date.now() - started < timeoutMs) {
    const bodyText = String(await tvPage.locator("body").innerText().catch(() => ""));
    lastCount = await readTvQueueCount(tvPage);
    if (songPattern.test(bodyText)) {
      return { matched: "song", queueCount: lastCount };
    }
    if (lastCount >= minimumQueueCount) {
      return { matched: "queue", queueCount: lastCount };
    }
    await delay(700);
  }
  throw new Error(
    `TV did not surface "${songTitle}" or reach queue count ${minimumQueueCount} within timeout (lastQueue=${lastCount}).`
  );
};

const waitForAudiencePopTriviaCard = async ({ audiencePage, timeoutMs }) => {
  const started = Date.now();
  const standaloneSheet = audiencePage.locator('[data-feature-id="pop-trivia-standalone-sheet"]').first();
  const inlineCard = audiencePage.locator('[data-feature-id="pop-trivia-card"]').first();
  const compactPattern = /(answer trivia|trivia live)/i;
  while (Date.now() - started < timeoutMs) {
    if (await standaloneSheet.isVisible().catch(() => false)) return standaloneSheet;
    if (await inlineCard.isVisible().catch(() => false)) return inlineCard;
    const bodyText = String(await audiencePage.locator("body").innerText().catch(() => ""));
    if (compactPattern.test(bodyText)) {
      const expandTrigger = audiencePage.getByText(/Tap to expand/i).first();
      if (await expandTrigger.isVisible().catch(() => false)) {
        await expandTrigger.click({ force: true }).catch(() => {});
        await delay(600);
        continue;
      }
    }
    await delay(700);
  }
  const bodyText = String(await audiencePage.locator("body").innerText().catch(() => ""));
  throw new Error(`Audience pop trivia card did not render. Snippet="${bodyText.replace(/\s+/g, " ").slice(0, 220)}"`);
};

const waitForHostNowPerforming = async ({ hostPage, songTitle, timeoutMs }) => {
  const normalizedSongTitle = String(songTitle || "").trim();
  if (!normalizedSongTitle) {
    throw new Error("Host performance song title is required.");
  }
  const started = Date.now();
  const card = hostPage.locator('[data-feature-id="host-now-performing-card"]').first();
  const titlePattern = new RegExp(escapeRegExp(normalizedSongTitle), "i");
  const activePattern = /(now performing|now playing|current performance)/i;
  while (Date.now() - started < timeoutMs) {
    const visible = await card.isVisible().catch(() => false);
    if (visible) {
      const cardText = String(await card.innerText().catch(() => ""));
      if (titlePattern.test(cardText)) {
        return cardText.replace(/\s+/g, " ").slice(0, 220);
      }
    }
    const bodyText = String(await hostPage.locator("body").innerText().catch(() => ""));
    if (titlePattern.test(bodyText) && activePattern.test(bodyText)) {
      return bodyText.replace(/\s+/g, " ").slice(0, 220);
    }
    await delay(700);
  }
  const bodyText = String(await hostPage.locator("body").innerText().catch(() => ""));
  throw new Error(
    `Host did not show active performance for "${normalizedSongTitle}". Snippet="${bodyText.replace(/\s+/g, " ").slice(0, 220)}"`
  );
};

const waitForAudienceCurrentPerformance = async ({ audiencePage, songTitle, timeoutMs }) => {
  const normalizedSongTitle = String(songTitle || "").trim();
  if (!normalizedSongTitle) {
    throw new Error("Audience performance song title is required.");
  }
  const started = Date.now();
  const card = audiencePage.locator('[data-feature-id="singer-current-performance-card"]').first();
  const titlePattern = new RegExp(escapeRegExp(normalizedSongTitle), "i");
  const activePattern = /(now performing|live track|pop-up trivia)/i;
  while (Date.now() - started < timeoutMs) {
    const visible = await card.isVisible().catch(() => false);
    if (visible) {
      const cardText = String(await card.innerText().catch(() => ""));
      if (titlePattern.test(cardText)) {
        return cardText.replace(/\s+/g, " ").slice(0, 220);
      }
    }
    const bodyText = String(await audiencePage.locator("body").innerText().catch(() => ""));
    if (titlePattern.test(bodyText) && activePattern.test(bodyText)) {
      return bodyText.replace(/\s+/g, " ").slice(0, 220);
    }
    await delay(700);
  }
  const bodyText = String(await audiencePage.locator("body").innerText().catch(() => ""));
  throw new Error(
    `Audience did not show active performance for "${normalizedSongTitle}". Snippet="${bodyText.replace(/\s+/g, " ").slice(0, 220)}"`
  );
};

const waitForAudienceRequestEntry = async ({ audiencePage, songTitle, timeoutMs }) => {
  const normalizedSongTitle = String(songTitle || "").trim();
  if (!normalizedSongTitle) {
    throw new Error("Audience request song title is required.");
  }
  const started = Date.now();
  const titlePattern = new RegExp(escapeRegExp(normalizedSongTitle), "i");
  while (Date.now() - started < timeoutMs) {
    const requestRow = audiencePage
      .locator('[data-feature-id="singer-my-requests-panel"]')
      .getByText(normalizedSongTitle, { exact: false })
      .first();
    if (await requestRow.isVisible().catch(() => false)) {
      return `My Requests shows ${normalizedSongTitle}.`;
    }
    const bodyText = String(await audiencePage.locator("body").innerText().catch(() => ""));
    if (titlePattern.test(bodyText) && /(just added|queue|up next|host review|unverified backing)/i.test(bodyText)) {
      return `Audience surface shows ${normalizedSongTitle}.`;
    }
    await delay(500);
  }
  const bodyText = String(await audiencePage.locator("body").innerText().catch(() => ""));
  throw new Error(
    `Audience request "${normalizedSongTitle}" did not appear in My Requests. Snippet="${bodyText.replace(/\s+/g, " ").slice(0, 220)}"`
  );
};

const waitForTvPopTriviaCard = async ({ tvPage, timeoutMs, minimumAnswersLocked = 0 }) => {
  const started = Date.now();
  const card = tvPage.locator('[data-feature-id="tv-pop-trivia-overlay"]').first();
  while (Date.now() - started < timeoutMs) {
    const visible = await card.isVisible().catch(() => false);
    if (visible) {
      const cardText = String(await card.innerText().catch(() => ""));
      const match = cardText.match(/(\d+)\s+answers locked/i);
      const answersLocked = Number(match?.[1] || 0);
      if (answersLocked >= minimumAnswersLocked) {
        return { card, answersLocked, cardText };
      }
    }
    const bodyText = String(await tvPage.locator("body").innerText().catch(() => ""));
    if (/(trivia live|answer now|seconds left)/i.test(bodyText)) {
      const match = bodyText.match(/(\d+)\s+answers locked/i);
      const answersLocked = Number(match?.[1] || 0);
      if (answersLocked >= minimumAnswersLocked) {
        return { card: tvPage.locator("body").first(), answersLocked, cardText: bodyText };
      }
    }
    await delay(700);
  }
  const bodyText = String(await tvPage.locator("body").innerText().catch(() => ""));
  throw new Error(`TV pop trivia card did not render. Snippet="${bodyText.replace(/\s+/g, " ").slice(0, 220)}"`);
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
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      reason: "QA_HOST_EMAIL and QA_HOST_PASSWORD are required for root-domain host login testing.",
      rootUrl,
      hostUrl,
    }, null, 2));
    return;
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

  requireQaAppCheckDebugTokenForRemoteUrl(rootUrl);

  let hostSongTitle = "";
  const audienceSongTitle = `QAAUD${Date.now().toString().slice(-5)}`;
  const audienceArtist = "QA Audience Artist";
  const hostSearchQuery = "Sweet Caroline";

  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless });

  let roomCode = "";
  let joinUrl = "";
  let tvQueueBaseline = 0;
  let scenarioFailure = false;

  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await applyQaAppCheckDebugInitScript(hostContext);
  const hostPage = await hostContext.newPage();
  const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await applyQaAppCheckDebugInitScript(tvContext);
  const tvPage = await tvContext.newPage();
  const audienceContext = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
  });
  await applyQaAppCheckDebugInitScript(audienceContext);
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

      const autoPlayButton = hostPage.getByRole("button", { name: /Auto Stage Playback/i }).first();
      const autoBgButton = hostPage.getByRole("button", { name: /Auto BG Music/i }).first();
      const autoDjButton = hostPage.getByRole("button", { name: /Auto DJ/i }).first();
      const autoLyricsButton = hostPage.getByRole("button", { name: /Auto Lyrics/i }).first();
      const popTriviaButton = hostPage.getByRole("button", { name: /Pop Trivia/i }).first();

      await Promise.all([
        autoPlayButton.waitFor({ state: "visible", timeout: timeoutMs }),
        autoBgButton.waitFor({ state: "visible", timeout: timeoutMs }),
        autoDjButton.waitFor({ state: "visible", timeout: timeoutMs }),
        autoLyricsButton.waitFor({ state: "visible", timeout: timeoutMs }),
        popTriviaButton.waitFor({ state: "visible", timeout: timeoutMs }),
      ]);

      const autoPlayDetail = await ensureToggleOn({ button: autoPlayButton, timeoutMs });
      const autoBgDetail = await ensureToggleOn({ button: autoBgButton, timeoutMs });
      const autoDjDetail = await ensureToggleOn({ button: autoDjButton, timeoutMs });
      const autoLyricsDetail = await ensureToggleOn({ button: autoLyricsButton, timeoutMs, allowArmed: true });
      const popTriviaDetail = await ensureToggleOn({ button: popTriviaButton, timeoutMs });

      return `Auto-play=${autoPlayDetail}; bg=${autoBgDetail}; autoDj=${autoDjDetail}; lyrics=${autoLyricsDetail}; popTrivia=${popTriviaDetail}`;
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
      await ensureHostQueueAddWorkspaceOpen({ page: hostPage, timeoutMs });

      const searchInput = hostPage.getByPlaceholder(/Search songs/i).first();
      await searchInput.waitFor({ state: "visible", timeout: timeoutMs });

      const quickAddCheckbox = hostPage.locator('.host-autocomplete-shell input[type="checkbox"]').first();
      if (await quickAddCheckbox.isVisible().catch(() => false)) {
        const isChecked = await quickAddCheckbox.isChecked().catch(() => true);
        if (!isChecked) {
          await quickAddCheckbox.click({ force: true });
          await delay(250);
        }
      }

      await searchInput.fill(hostSearchQuery);
      await delay(1800);

      const firstResultRow = hostPage.locator('.host-autocomplete-result-row').first();
      await firstResultRow.waitFor({ state: "visible", timeout: timeoutMs });
      await firstResultRow.click({ force: true });

      const quickAddNotice = hostPage.getByText(/^Queued:/i).first();
      await quickAddNotice.waitFor({ state: "visible", timeout: timeoutMs });
      const noticeText = String(await quickAddNotice.innerText().catch(() => "")).trim();
      const queuedTitleMatch = noticeText.match(/^Queued:\s*(.+)$/im);
      hostSongTitle = String(queuedTitleMatch?.[1] || "").trim();
      if (!hostSongTitle) {
        throw new Error(`Could not determine host quick-add song title from notice: ${noticeText || "(empty)"}`);
      }

      await ensureHostQueueListWorkspaceOpen({ page: hostPage, timeoutMs });
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
      const tvState = await waitForTvSongOrQueueState({
        tvPage,
        minimumQueueCount: tvQueueBaseline + 1,
        songTitle: hostSongTitle,
        timeoutMs,
      });
      return `TV matched via ${tvState.matched}; queue=${tvState.queueCount}.`;
    });

    await runCheck(checks, "host_request_transitions_to_active_performance", async () =>
      waitForHostNowPerforming({
        hostPage,
        songTitle: hostSongTitle,
        timeoutMs: Math.min(timeoutMs, 90000),
      })
    );

    await runCheck(checks, "audience_surface_shows_active_performance", async () =>
      waitForAudienceCurrentPerformance({
        audiencePage,
        songTitle: hostSongTitle,
        timeoutMs: Math.min(timeoutMs, 90000),
      })
    );

    await runCheck(checks, "audience_pop_trivia_renders_and_accepts_answer", async () => {
      const triviaCard = await waitForAudiencePopTriviaCard({
        audiencePage,
        timeoutMs: Math.min(timeoutMs, 90000),
      });
      const optionBeforeExpand = triviaCard
        .locator('[data-feature-id="pop-trivia-sheet-option-0"], [data-feature-id="pop-trivia-option-0"]')
        .first();
      if (!(await optionBeforeExpand.isVisible().catch(() => false))) {
        const expandTrigger = audiencePage.getByText(/Tap to expand/i).first();
        if (await expandTrigger.isVisible().catch(() => false)) {
          await expandTrigger.click({ force: true });
          await delay(600);
        }
      }
      const firstOption = triviaCard
        .locator('[data-feature-id="pop-trivia-sheet-option-0"], [data-feature-id="pop-trivia-option-0"]')
        .first();
      await firstOption.waitFor({ state: "visible", timeout: timeoutMs });
      await firstOption.click({ force: true });
      await audiencePage.getByText(/Answer locked/i).first().waitFor({ state: "visible", timeout: timeoutMs });
      const cardText = String(await triviaCard.innerText().catch(() => ""));
      return cardText.replace(/\s+/g, " ").slice(0, 180);
    });

    await runCheck(checks, "tv_pop_trivia_renders_after_audience_answer", async () => {
      const triviaState = await waitForTvPopTriviaCard({
        tvPage,
        timeoutMs: Math.min(timeoutMs, 90000),
        minimumAnswersLocked: 1,
      });
      return triviaState.cardText.replace(/\s+/g, " ").slice(0, 180);
    });

    await runCheck(checks, "audience_adds_song_request", async () => {
      const hidePopTriviaButton = audiencePage.getByRole("button", { name: /Hide pop-up trivia/i }).first();
      if (await hidePopTriviaButton.isVisible().catch(() => false)) {
        await hidePopTriviaButton.click({ force: true }).catch(() => {});
        await delay(500);
      }

      const getSongTitleInput = () => audiencePage.locator('[data-feature-id="singer-request-song-title"]').first();
      const getArtistInput = () => audiencePage.locator('[data-feature-id="singer-request-artist"]').first();
      const songTitleInput = getSongTitleInput();
      const artistInput = getArtistInput();

      if (!(await songTitleInput.isVisible().catch(() => false))) {
        const songsNav = audiencePage.locator('[data-feature-id="singer-nav-songs"]').first();
        const fallbackSongsNav = audiencePage.getByRole("button", { name: /^SONGS$/i }).first();
        const activeSongsNav = await songsNav.isVisible().catch(() => false)
          ? songsNav
          : fallbackSongsNav;
        await activeSongsNav.waitFor({ state: "visible", timeout: timeoutMs });
        await activeSongsNav.click({ force: true });
        await delay(600);
      }
      if (!(await getSongTitleInput().isVisible().catch(() => false))) {
        const requestsTab = audiencePage.locator('[data-feature-id="singer-requests-tab"]').first();
        const fallbackRequestsTab = audiencePage.getByRole("button", { name: /^REQUESTS$/i }).first();
        const activeRequestsTab = await requestsTab.isVisible().catch(() => false)
          ? requestsTab
          : fallbackRequestsTab;
        if (await activeRequestsTab.isVisible().catch(() => false)) {
          await activeRequestsTab.click({ force: true });
          await delay(600);
        }
      }
      if (!(await getSongTitleInput().isVisible().catch(() => false))) {
        const manualEntryButtons = [
          audiencePage.getByRole("button", { name: /Type it manually/i }).first(),
          audiencePage.getByRole("button", { name: /Manual Entry/i }).first(),
        ];
        let manualButtonClicked = false;
        for (const button of manualEntryButtons) {
          if (!(await button.isVisible().catch(() => false))) continue;
          await button.click({ force: true });
          manualButtonClicked = true;
          await delay(700);
          if (await getSongTitleInput().isVisible().catch(() => false)) break;
        }
        if (!manualButtonClicked) {
          throw new Error("Audience request composer could not be opened from the current SONGS view.");
        }
      }
      await getSongTitleInput().waitFor({ state: "visible", timeout: timeoutMs });
      await getSongTitleInput().fill(audienceSongTitle);
      await getArtistInput().fill(audienceArtist);

      const sendRequestButton = audiencePage.locator('[data-feature-id="singer-request-submit"]').first();
      const fallbackSendRequestButton = audiencePage.getByRole("button", { name: /SEND REQUEST/i }).first();
      const activeSendRequestButton = await sendRequestButton.isVisible().catch(() => false)
        ? sendRequestButton
        : fallbackSendRequestButton;
      await activeSendRequestButton.scrollIntoViewIfNeeded().catch(() => {});
      await activeSendRequestButton.click({ timeout: timeoutMs });
      const requestSentToast = audiencePage.getByText(/Request Sent!/i).first();
      await Promise.race([
        requestSentToast.waitFor({ state: "visible", timeout: timeoutMs }).catch(() => null),
        waitForAudienceRequestEntry({
          audiencePage,
          songTitle: audienceSongTitle,
          timeoutMs,
        }),
      ]);
      await waitForAudienceRequestEntry({
        audiencePage,
        songTitle: audienceSongTitle,
        timeoutMs,
      });
      return `Audience requested ${audienceSongTitle}.`;
    });

    await runCheck(checks, "host_queue_contains_host_and_audience_requests", async () => {
      await ensureHostQueueListWorkspaceOpen({ page: hostPage, timeoutMs });
      const needsReviewToggle = hostPage.getByRole("button", { name: /Needs Review/i }).first();
      if (await needsReviewToggle.isVisible().catch(() => false)) {
        const expanded = await needsReviewToggle.getAttribute("aria-expanded").catch(() => null);
        if (expanded !== "true") {
          await needsReviewToggle.click({ force: true }).catch(() => {});
          await delay(350);
        }
      }
      const hostSongVisible = await hostPage.getByText(hostSongTitle, { exact: false }).first().isVisible().catch(() => false);
      const audienceSongSignal = hostPage.getByText(audienceSongTitle, { exact: false }).first();
      const audienceSongVisible = await audienceSongSignal
        .waitFor({ state: "visible", timeout: timeoutMs })
        .then(() => true)
        .catch(() => false);
      if (!hostSongVisible || !audienceSongVisible) {
        throw new Error(
          `Host queue did not show both songs (hostVisible=${hostSongVisible}, audienceVisible=${audienceSongVisible}).`
        );
      }
      return `${hostSongTitle} + ${audienceSongTitle} visible on host queue.`;
    });

    await runCheck(checks, "public_tv_sync_after_audience_request", async () => {
      const tvState = await waitForTvSongOrQueueState({
        tvPage,
        minimumQueueCount: Math.max(tvQueueBaseline + 1, 1),
        songTitle: audienceSongTitle,
        timeoutMs,
      });
      return `TV matched via ${tvState.matched}; queue=${tvState.queueCount}.`;
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
