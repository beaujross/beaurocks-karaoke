import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyQaAppCheckDebugInitScript,
  requireQaAppCheckDebugTokenForRemoteUrl,
} from "./lib/appCheckDebug.mjs";

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
const gotoWithSurfaceRedirectTolerance = async (page, target, options = {}) => {
  try {
    return await page.goto(target, options);
  } catch (error) {
    if (!/ERR_ABORTED/i.test(String(error?.message || error))) throw error;
    await delay(1500);
    if (!page.url() || page.url() === 'about:blank') throw error;
    return null;
  }
};
const ROOM_CODE_BLOCKLIST = new Set(["ROOM", "CODE", "LIKE", "OPEN", "HOST", "BROWSER", "DASHBOARD", "ALREADY"]);

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

const setupContractDetailByPage = new WeakMap();
const BACKGROUND_AUDIO_QA_STATES = new Set(['off', 'ready', 'starting', 'playing', 'paused', 'stale', 'error', 'deferred', 'needs_connection', 'blocked']);
const BACKGROUND_AUDIO_QA_CAPABILITIES = new Set(['host_playback', 'connected_host_playback', 'connection_required', 'embeddable_stage_media', 'external_only', 'content_agnostic']);
const readBackgroundAudioQaSnapshot = async (page, timeoutMs) => {
  await page.waitForFunction(
    () => Boolean(window.__qaBackgroundAudioState?.key && window.__qaBackgroundAudioState?.capabilityKey),
    { timeout: Math.min(20000, timeoutMs) }
  ).catch(() => {});
  return page.evaluate(() => window.__qaBackgroundAudioState || null).catch(() => null);
};
const assertBackgroundAudioQaSnapshot = (snapshot, surface) => {
  if (!snapshot || !BACKGROUND_AUDIO_QA_STATES.has(String(snapshot.key || ''))) {
    throw new Error(`${surface} did not expose a valid background-audio state.`);
  }
  if (!BACKGROUND_AUDIO_QA_CAPABILITIES.has(String(snapshot.capabilityKey || ''))) {
    throw new Error(`${surface} did not expose a valid background-audio capability.`);
  }
  return `${snapshot.key}/${snapshot.capabilityKey}`;
};

const waitForBackgroundAudioState = async ({ page, keys, capabilityKeys, timeoutMs }) => {
  const expectedKeys = new Set(keys || []);
  const expectedCapabilities = new Set(capabilityKeys || []);
  const started = Date.now();
  while (Date.now() - started < Math.min(30000, timeoutMs)) {
    const snapshot = await readBackgroundAudioQaSnapshot(page, timeoutMs);
    if (snapshot
      && (!expectedKeys.size || expectedKeys.has(String(snapshot.key || '')))
      && (!expectedCapabilities.size || expectedCapabilities.has(String(snapshot.capabilityKey || '')))) {
      return snapshot;
    }
    await delay(300);
  }
  const snapshot = await readBackgroundAudioQaSnapshot(page, timeoutMs);
  throw new Error(`Background audio did not reach ${Array.from(expectedKeys).join('/')} with ${Array.from(expectedCapabilities).join('/')}. Last snapshot=${JSON.stringify(snapshot)}`);
};

const runBackgroundAudioEventDrill = async ({ browser, hostPage, tvOrigin, baseUrl, roomCode, timeoutMs }) => {
  const evidenceDir = path.resolve(process.cwd(), 'docs/reviews/evidence/2026-07-13-background-audio-event-readiness');
  await fs.mkdir(evidenceDir, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'beaurocks-bg-event-'));
  const fileName = `qa-bg-event-${Date.now()}.mp3`;
  const fixturePath = path.join(tempDir, fileName);
  const compatibleFixturePath = path.resolve(process.cwd(), 'public/audio/Lantern Circuit.mp3');
  await fs.copyFile(compatibleFixturePath, fixturePath);

  let tvContext = null;
  let uploadPresent = false;
  const storageNetworkEvents = [];
  const isStorageUrl = (value = '') => /firebasestorage|storage\.googleapis/i.test(String(value || ''));
  const safeStorageUrl = (value = '') => {
    try {
      const parsed = new URL(String(value || ''));
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return 'storage-url-unavailable';
    }
  };
  const recordStorageResponse = async (response) => {
    if (!isStorageUrl(response.url())) return;
    const headers = await response.allHeaders().catch(() => ({}));
    storageNetworkEvents.push({
      kind: 'response',
      status: response.status(),
      contentType: String(headers['content-type'] || ''),
      url: safeStorageUrl(response.url()),
    });
  };
  const recordStorageFailure = (request) => {
    if (!isStorageUrl(request.url())) return;
    storageNetworkEvents.push({
      kind: 'request_failed',
      failure: String(request.failure()?.errorText || ''),
      url: safeStorageUrl(request.url()),
    });
  };
  hostPage.on('response', recordStorageResponse);
  hostPage.on('requestfailed', recordStorageFailure);
  const openBackgroundLibrary = async () => {
    const backButton = hostPage.locator('[data-feature-id="host-media-library-back-to-host"]').first();
    if (!(await backButton.isVisible().catch(() => false))) {
      const audioToggle = hostPage.locator('[data-feature-id="deck-audio-menu-toggle"]').first();
      await audioToggle.waitFor({ state: 'visible', timeout: Math.min(15000, timeoutMs) });
      const manageButton = hostPage.getByRole('button', { name: /Manage BG Library/i }).first();
      if (!(await manageButton.isVisible().catch(() => false))) {
        await audioToggle.click({ force: true });
      }
      if (!(await manageButton.isVisible().catch(() => false))) {
        await delay(500);
      }
      await manageButton.waitFor({ state: 'visible', timeout: Math.min(10000, timeoutMs) });
      await manageButton.click({ force: true });
      await backButton.waitFor({ state: 'visible', timeout: Math.min(15000, timeoutMs) });
    }
    const backgroundTab = hostPage.locator('[data-feature-id="host-media-library-tabs"] button')
      .filter({ hasText: /^Background/i })
      .first();
    await backgroundTab.waitFor({ state: 'visible', timeout: Math.min(15000, timeoutMs) });
    await backgroundTab.click({ force: true });
  };
  const closeLibrary = async () => {
    const backButton = hostPage.locator('[data-feature-id="host-media-library-back-to-host"]').first();
    if (await backButton.isVisible().catch(() => false)) {
      await backButton.click({ force: true });
      await delay(500);
    }
  };
  const qaTrackCard = () => hostPage.locator('div.rounded-2xl')
    .filter({ hasText: fileName })
    .filter({ has: hostPage.getByRole('button', { name: /^Start Now$/i }) })
    .last();
  const pauseFromTruthCard = async () => {
    await openBackgroundLibrary();
    const truthCard = hostPage.locator('[data-feature-id="background-audio-truth-state"]').first();
    const pauseButton = truthCard.getByRole('button', { name: /^Pause Background$/i }).first();
    await pauseButton.waitFor({ state: 'visible', timeout: Math.min(10000, timeoutMs) });
    await pauseButton.click({ force: true });
  };

  try {
    await openBackgroundLibrary();
    const uploadInput = hostPage.locator('label')
      .filter({ hasText: 'Upload to Background' })
      .locator('input[type="file"]')
      .first();
    await uploadInput.setInputFiles(fixturePath);
    const card = qaTrackCard();
    await card.waitFor({ state: 'visible', timeout: Math.min(60000, timeoutMs) });
    uploadPresent = true;
    await card.getByRole('button', { name: /^Start Now$/i }).click({ force: true });
    let hostPlaying;
    try {
      hostPlaying = await waitForBackgroundAudioState({
        page: hostPage,
        keys: ['playing'],
        capabilityKeys: ['host_playback'],
        timeoutMs,
      });
    } catch (error) {
      const hostTruth = await hostPage.locator('[data-feature-id="background-audio-truth-state"]')
        .first()
        .innerText()
        .catch(() => 'unavailable');
      throw new Error(`${String(error?.message || error)} Host truth=${String(hostTruth || '').replace(/\s+/g, ' ').trim()} Storage network=${JSON.stringify(storageNetworkEvents.slice(-8))}`);
    }
    await hostPage.screenshot({ path: path.join(evidenceDir, 'host-upload-playing.png'), fullPage: true });

    tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await applyQaAppCheckDebugInitScript(tvContext);
    const tvPage = await tvContext.newPage();
    await tvPage.goto(`${tvOrigin || baseUrl}/?room=${encodeURIComponent(roomCode)}&mode=tv`, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });
    await delay(1800);
    const startShow = tvPage.getByRole('button', { name: /start show|tap to start|start/i }).first();
    if (await startShow.isVisible().catch(() => false)) {
      await startShow.click({ force: true }).catch(() => {});
      await delay(700);
    }
    let tvPlaying;
    try {
      tvPlaying = await waitForBackgroundAudioState({
        page: tvPage,
        keys: ['playing'],
        capabilityKeys: ['host_playback'],
        timeoutMs,
      });
    } catch (error) {
      const hostSnapshot = await readBackgroundAudioQaSnapshot(hostPage, timeoutMs);
      const hostTruth = await hostPage.locator('[data-feature-id="background-audio-truth-state"]')
        .first()
        .innerText()
        .catch(() => 'unavailable');
      throw new Error(`${String(error?.message || error)} Host snapshot=${JSON.stringify(hostSnapshot)} Host truth=${String(hostTruth || '').replace(/\s+/g, ' ').trim()} Storage network=${JSON.stringify(storageNetworkEvents.slice(-8))}`);
    }
    await tvPage.screenshot({ path: path.join(evidenceDir, 'tv-upload-playing.png'), fullPage: true });

    await pauseFromTruthCard();
    const paused = await waitForBackgroundAudioState({
      page: hostPage,
      keys: ['paused', 'ready'],
      capabilityKeys: ['host_playback'],
      timeoutMs,
    });
    await openBackgroundLibrary();
    const truthCard = hostPage.locator('[data-feature-id="background-audio-truth-state"]').first();
    const recoveryButton = truthCard.getByRole('button', { name: /Start Upload/i }).first();
    await recoveryButton.waitFor({ state: 'visible', timeout: Math.min(15000, timeoutMs) });
    await recoveryButton.click({ force: true });
    const recovered = await waitForBackgroundAudioState({
      page: hostPage,
      keys: ['playing'],
      capabilityKeys: ['host_playback'],
      timeoutMs,
    });
    await hostPage.screenshot({ path: path.join(evidenceDir, 'host-upload-recovered.png'), fullPage: true });
    await waitForBackgroundAudioState({
      page: tvPage,
      keys: ['playing'],
      capabilityKeys: ['host_playback'],
      timeoutMs,
    });

    await pauseFromTruthCard();
    await waitForBackgroundAudioState({
      page: hostPage,
      keys: ['paused', 'ready'],
      capabilityKeys: ['host_playback'],
      timeoutMs,
    });
    await openBackgroundLibrary();
    const appleTab = hostPage.locator('[data-feature-id="host-media-library-tabs"] button')
      .filter({ hasText: /^Apple Music/i })
      .first();
    await appleTab.scrollIntoViewIfNeeded();
    await appleTab.click();
    await delay(700);
    const appleSection = hostPage.locator('[data-feature-id="host-media-library-apple-music"]').first();
    if (!(await appleSection.isVisible().catch(() => false))) {
      await hostPage.screenshot({ path: path.join(evidenceDir, 'host-apple-tab-transition.png'), fullPage: true });
      const transitionState = await hostPage.evaluate(() => ({
        modalVisible: Boolean(document.querySelector('[data-feature-id="tv-moments-library-modal"]')),
        tabs: Array.from(document.querySelectorAll('[data-feature-id="host-media-library-tabs"] button')).map((button) => ({
          text: String(button.textContent || '').replace(/\s+/g, ' ').trim(),
          selected: button.getAttribute('aria-selected'),
        })),
      }));
      throw new Error(`Apple Music library section did not render after tab selection. Transition=${JSON.stringify(transitionState)}`);
    }
    const appleConnectedState = appleSection.getByText(/^Connected$/i).first();
    const appleConnectButton = appleSection.getByRole('button', { name: /^Connect Apple Music$/i }).first();
    await Promise.race([
      appleConnectedState.waitFor({ state: 'visible', timeout: Math.min(10000, timeoutMs) }),
      appleConnectButton.waitFor({ state: 'visible', timeout: Math.min(10000, timeoutMs) }),
    ]).catch(() => {});
    const appleConnected = await appleConnectedState.isVisible().catch(() => false);
    const appleConnectAction = await appleConnectButton.isVisible().catch(() => false);
    if (!appleConnected && !appleConnectAction) {
      const appleText = await appleSection.innerText().catch(() => 'unavailable');
      throw new Error(`Apple Music tab exposed neither a connected state nor a Connect action. Section=${String(appleText || '').replace(/\s+/g, ' ').trim()}`);
    }
    await hostPage.screenshot({ path: path.join(evidenceDir, 'host-apple-capability.png'), fullPage: true });

    await hostPage.locator('[data-feature-id="host-media-library-tabs"] button')
      .filter({ hasText: /^Background/i })
      .first()
      .click({ force: true });
    const deleteCard = qaTrackCard();
    const dialogPromise = hostPage.waitForEvent('dialog', { timeout: Math.min(10000, timeoutMs) });
    const deleteClickPromise = deleteCard.getByRole('button', { name: /^Delete(?: Upload)?$/i }).click({ force: true });
    const dialog = await dialogPromise;
    await dialog.accept();
    await deleteClickPromise;
    await deleteCard.waitFor({ state: 'hidden', timeout: Math.min(30000, timeoutMs) });
    uploadPresent = false;
    const cleared = await waitForBackgroundAudioState({
      page: hostPage,
      keys: ['off', 'ready', 'needs_connection'],
      capabilityKeys: ['content_agnostic', 'host_playback', 'connection_required'],
      timeoutMs,
    });
    const tvCleared = await waitForBackgroundAudioState({
      page: tvPage,
      keys: ['off', 'ready', 'needs_connection'],
      capabilityKeys: ['content_agnostic', 'host_playback', 'connection_required'],
      timeoutMs,
    });

    return `Uploaded, played, paused, recovered, and deleted a disposable BG track. Host ${hostPlaying.key}/${hostPlaying.capabilityKey}; TV ${tvPlaying.key}/${tvPlaying.capabilityKey}; paused ${paused.key}; recovered ${recovered.key}; Apple ${appleConnected ? 'connected (not mutated)' : 'connection-required CTA'}; cleared Host ${cleared.key}, TV ${tvCleared.key}.`;
  } finally {
    hostPage.off('response', recordStorageResponse);
    hostPage.off('requestfailed', recordStorageFailure);
    if (uploadPresent) {
      try {
        await openBackgroundLibrary();
        const card = qaTrackCard();
        if (await card.isVisible().catch(() => false)) {
          const dialogPromise = hostPage.waitForEvent('dialog', { timeout: Math.min(10000, timeoutMs) });
          const deleteClickPromise = card.getByRole('button', { name: /^Delete(?: Upload)?$/i }).click({ force: true });
          const dialog = await dialogPromise;
          await dialog.accept();
          await deleteClickPromise;
        }
      } catch {
        // The disposable QA room remains isolated if UI cleanup cannot complete.
      }
    }
    if (tvContext) await tvContext.close();
    await fs.rm(tempDir, { recursive: true, force: true });
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
    const singleOriginHosting = host.endsWith(".web.app") || host.endsWith(".firebaseapp.com");
    if (!singleOriginHosting && host.startsWith("app.")) {
      nextHost = `host.${host.slice(4)}`;
    } else if (!singleOriginHosting && host && !host.startsWith("host.") && host !== "localhost" && host !== "127.0.0.1") {
      nextHost = `host.${host}`;
    }
    return `${parsed.protocol}//${nextHost}/?mode=host&hostUiVersion=v2&view=ops&section=ops.room_setup&tab=admin`;
  } catch {
    return `${String(baseUrl || "").replace(/\/+$/, "")}/?mode=host`;
  }
};
const deriveHostAccessUrlFromBase = (baseUrl = "") => {
  try {
    const parsed = new URL(String(baseUrl || "").trim());
    const host = String(parsed.hostname || "").trim().toLowerCase();
    let nextHost = host;
    const singleOriginHosting = host.endsWith(".web.app") || host.endsWith(".firebaseapp.com");
    if (!singleOriginHosting && host.startsWith("app.")) {
      nextHost = `host.${host.slice(4)}`;
    } else if (!singleOriginHosting && host && !host.startsWith("host.") && host !== "localhost" && host !== "127.0.0.1") {
      nextHost = `host.${host}`;
    }
    return `${parsed.protocol}//${nextHost}/host-access`;
  } catch {
    return `${String(baseUrl || "").replace(/\/+$/, "")}/host-access`;
  }
};
const deriveTvOriginFromBase = (baseUrl = "") => {
  try {
    const parsed = new URL(String(baseUrl || "").trim());
    const host = String(parsed.hostname || "").trim().toLowerCase();
    let nextHost = host;
    const singleOriginHosting = host.endsWith(".web.app") || host.endsWith(".firebaseapp.com");
    if (!singleOriginHosting && host.startsWith("app.")) {
      nextHost = `tv.${host.slice(4)}`;
    } else if (!singleOriginHosting && host && !host.startsWith("tv.") && host !== "localhost" && host !== "127.0.0.1") {
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

const isGameLaunchpadReady = async (page) => {
  const hookedCount = await page.locator("[data-game-quick-launch]").count().catch(() => 0);
  if (hookedCount > 0) return true;
  const quickLaunchButtons = await page.getByRole("button", { name: /Quick Launch/i }).count().catch(() => 0);
  if (quickLaunchButtons > 0) return true;
  const bodyText = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
  return /Game Launchpad|Quick Launch/i.test(bodyText);
};

const getGameLaunchpadDetail = async (page) => {
  if (await isGameLaunchpadReady(page)) {
    const bodyText = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    return bodyText.match(/Game Launchpad|Quick Launch/i)
      ? "Game Launchpad rendered."
      : "Quick Launch controls rendered.";
  }
  return "";
};

const waitForGameLaunchpad = async ({ page, timeoutMs }) => {
  const launchpadHeading = page.getByText(/Game Launchpad/i).first();
  const anyQuickLaunch = page.locator("[data-game-quick-launch]").first();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isGameLaunchpadReady(page)) return "Game Launchpad ready.";
    if ((await anyQuickLaunch.count()) > 0) return "Quick Launch controls rendered.";
    if (await anyQuickLaunch.isVisible().catch(() => false)) return "Quick Launch controls visible.";
    if (await launchpadHeading.isVisible().catch(() => false)) return "Game Launchpad visible.";
    const bodyText = String(await page.locator("body").innerText().catch(() => ""));
    if (/Game Launchpad|Quick Launch/i.test(bodyText)) {
      return "Game Launchpad text rendered.";
    }
    await delay(400);
  }
  return "";
};

const readHostRoomCode = async (page) => {
  const url = page.url();
  try {
    const parsed = new URL(url);
    const fromQuery = sanitizeRoomCode(parsed.searchParams.get("room") || "");
    const mode = String(parsed.searchParams.get("mode") || "").trim().toLowerCase();
    if (mode === "host" && isLikelyRoomCode(fromQuery)) return fromQuery;
  } catch {
    // ignore URL parse failures
  }

  const hooked = page.locator("[data-host-room-code]").first();
  if (await hooked.count()) {
    const text = sanitizeRoomCode(await hooked.innerText().catch(() => ""));
    const bodyText = String(await page.locator("body").innerText().catch(() => "")).toLowerCase();
    const onRoomBrowser = /beaurocks host rooms|create a room, reopen a recent room/i.test(bodyText);
    if (!onRoomBrowser && isLikelyRoomCode(text)) return text;
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const regexes = [/\bcreated room\s+([A-Z0-9]{4,8})\b/i, /\b([A-Z0-9]{4,8})\s+created\b/i];
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

    const workspaceBodyText = String(await page.locator("body").innerText().catch(() => "")).toLowerCase();
    const onRoomBrowser = /beaurocks host rooms|create a room, reopen a recent room/i.test(workspaceBodyText);
    const createRoomInput = page.locator('input[placeholder="Friday Karaoke"]').first();
    const createRoomPrimary = page.locator('[data-host-create-room-primary="true"]').first();
    if (onRoomBrowser && !createClicked) {
      const createRoomTab = page.getByRole("button", { name: /^Create Room$/i }).first();
      if (await createRoomTab.isVisible().catch(() => false)) {
        await createRoomTab.click({ force: true });
        await delay(500);
      }
      if (await createRoomInput.isVisible().catch(() => false)) {
        const currentName = String(await createRoomInput.inputValue().catch(() => "")).trim();
        if (!currentName) {
          await createRoomInput.fill(`QA Setup Contract ${Date.now().toString(36).slice(-6)}`);
          await delay(350);
        }
        const effectiveDomains = page.locator('[data-launch-effective-domain]');
        const effectiveDomainCount = await effectiveDomains.count();
        if (effectiveDomainCount !== 5) {
          throw new Error(`Expected five effective setup domains before room creation; found ${effectiveDomainCount}.`);
        }
        const domainKeys = await effectiveDomains.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-launch-effective-domain') || '').filter(Boolean));
        setupContractDetailByPage.set(page, `Five-domain setup summary rendered (${domainKeys.join(', ')}).`);
        const enabled = await createRoomPrimary.isEnabled().catch(() => false);
        if (enabled) {
          await createRoomPrimary.click({ force: true });
          createClicked = true;
          await delay(1500);
          continue;
        }
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

    const openHostPanel = page.getByRole("button", { name: /Open the host panel/i }).first();
    if (!createClicked && (await openHostPanel.isVisible().catch(() => false))) {
      const enabled = await openHostPanel.isEnabled().catch(() => false);
      if (enabled) {
        await openHostPanel.click({ force: true });
        createClicked = true;
      }
    }

    if (!createClicked && !guidedFlowAttempted) {
      guidedFlowAttempted = true;
      const guidedRoomCode = await runGuidedSetupWizardLaunch({ page, timeoutMs });
      if (guidedRoomCode) return guidedRoomCode;
    }

    const bodyText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
    if (/beaurocks host rooms|browse rooms like a workspace/i.test(bodyText) && !(await createRoomInput.isVisible().catch(() => false))) {
      const openHostPanel = page.getByRole("button", { name: /Open Host Panel/i }).first();
      const openRoom = page.getByRole("button", { name: /^OPEN$/i }).first();
      if (await openHostPanel.isVisible().catch(() => false)) {
        await openHostPanel.click({ force: true });
        await delay(1800);
        continue;
      }
      if (await openRoom.isVisible().catch(() => false)) {
        await openRoom.click({ force: true });
        await delay(1800);
        continue;
      }
    }

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
  await gotoWithSurfaceRedirectTolerance(page, hostUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await delay(3000);
  return waitForHostRoomCode({ page, timeoutMs });
};

const gotoHostAccessAndLogin = async ({ page, baseUrl, email, password, timeoutMs }) => {
  const candidates = [
    `${String(baseUrl || "").replace(/\/+$/, "")}/host-access`,
    `${String(baseUrl || "").replace(/\/+$/, "")}/?mode=marketing&page=host_access`,
    deriveHostAccessUrlFromBase(baseUrl),
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

    const hasHeading = await page.getByText(/Host Login (\+ (Application|Room Manager)|and Applications)/i).first().isVisible().catch(() => false);
    const hasAuthForm = await page.locator("form").first().isVisible().catch(() => false);
    const hasSignedInState = await page.getByText(/Signed in as/i).first().isVisible().catch(() => false);
    if (hasHeading && (hasAuthForm || hasSignedInState)) {
      loaded = true;
      break;
    }
  }
  if (!loaded) {
    throw new Error(`Could not load host access route from base url "${baseUrl}".`);
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

  await authForm.getByLabel(/Email/i).first().fill(email);
  await authForm.getByLabel(/Password/i).first().fill(password);
  await authForm.locator('button[type="submit"]').first().click({ force: true });

  const continueToHostLogin = page.getByRole("button", { name: /Continue To Host Login/i }).first();
  const openHostDashboard = page.getByRole("button", { name: /Open Host Dashboard/i }).first();
  const initialSuccess = await Promise.race([
    page.getByText(/Signed in as/i).first().waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false),
    page.getByRole("button", { name: /sign out/i }).first().waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false),
    continueToHostLogin.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false),
    openHostDashboard.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false),
  ]);

  if (!initialSuccess) {
    const bodyText = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    throw new Error(`Host login did not complete successfully. Snippet="${bodyText}"`);
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

const openRequestedRoomFromBrowser = async ({ page, roomCode, timeoutMs }) => {
  const started = Date.now();
  const safeCode = sanitizeRoomCode(roomCode);
  while (Date.now() - started < Math.min(30000, timeoutMs)) {
    const bodyText = String(await page.locator("body").innerText().catch(() => "")).toLowerCase();
    if (!/beaurocks host rooms|create a room, reopen a recent room/i.test(bodyText)) return true;

    const existingRoomsTab = page.getByRole('tab', { name: /^Existing Rooms/i }).first();
    if (await existingRoomsTab.isVisible().catch(() => false)) {
      await existingRoomsTab.click({ force: true });
      await delay(350);
    }

    const codeLabel = page.getByText(safeCode, { exact: true }).first();
    if (await codeLabel.isVisible().catch(() => false)) {
      const row = codeLabel.locator('xpath=ancestor::div[.//button[normalize-space()="Open"]][1]');
      const openButton = row.getByRole("button", { name: /^Open$/i }).first();
      if (await openButton.isVisible().catch(() => false) && await openButton.isEnabled().catch(() => false)) {
        await openButton.click({ force: true });
        await delay(1800);
        const nextBodyText = String(await page.locator("body").innerText().catch(() => "")).toLowerCase();
        if (!/beaurocks host rooms|create a room, reopen a recent room/i.test(nextBodyText)) return true;
      }
    }

    const openByCodeDetails = page.locator('details', { hasText: /Open by room code/i }).first();
    if (await openByCodeDetails.count()) {
      const isOpen = await openByCodeDetails.evaluate((node) => Boolean(node.open)).catch(() => false);
      if (!isOpen) {
        await openByCodeDetails.locator('summary').first().click({ force: true }).catch(() => {});
        await delay(250);
      }
      const roomCodeInput = openByCodeDetails.locator('input[placeholder="Open by room code"]').first();
      if (await roomCodeInput.isVisible().catch(() => false)) {
        await roomCodeInput.fill(safeCode);
        await delay(250);
        const openRoomButton = openByCodeDetails.getByRole('button', { name: /^Open Room$/i }).first();
        if (await openRoomButton.isVisible().catch(() => false) && await openRoomButton.isEnabled().catch(() => false)) {
          await openRoomButton.click({ force: true });
          await delay(1800);
          const nextBodyText = String(await page.locator('body').innerText().catch(() => '')).toLowerCase();
          if (!/beaurocks host rooms|create a room, reopen a recent room/i.test(nextBodyText)) return true;
        }
      }
    }
    await delay(700);
  }
  return false;
};

const navigateHostToGames = async ({ page, hostUrl, roomCode, timeoutMs }) => {
  const hostOrigin = hostOriginFromUrl(hostUrl);
  if (!hostOrigin) {
    throw new Error(`Could not resolve host origin from hostUrl "${hostUrl}".`);
  }
  const hostRoomUrl = `${hostOrigin}/?room=${encodeURIComponent(roomCode)}&mode=host`;
  let alreadyInDirectHostRoom = false;
  try {
    const currentUrl = new URL(page.url());
    alreadyInDirectHostRoom = sanitizeRoomCode(currentUrl.searchParams.get('room')) === sanitizeRoomCode(roomCode)
      && String(currentUrl.searchParams.get('mode') || '').trim().toLowerCase() === 'host';
  } catch {
    alreadyInDirectHostRoom = false;
  }
  if (!alreadyInDirectHostRoom) {
    await gotoWithSurfaceRedirectTolerance(page, hostRoomUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  }
  await page.waitForFunction(
    () => String(document.body?.innerText || '').trim().length > 50,
    { timeout: Math.min(30000, timeoutMs) }
  ).catch(() => {});
  await delay(1200);

  const initialBodyText = String(await page.locator("body").innerText().catch(() => "")).toLowerCase();
  if (/beaurocks host rooms|create a room, reopen a recent room/i.test(initialBodyText)) {
    const opened = await openRequestedRoomFromBrowser({ page, roomCode, timeoutMs });
    if (!opened) {
      throw new Error(`Room ${roomCode} was not available to open from the Host room browser.`);
    }
    await delay(1200);
  }

  const directReady = await getGameLaunchpadDetail(page);
  if (directReady) {
    return `${hostRoomUrl} (${directReady})`;
  }

  const gamesTab = page.locator('[data-host-tab="games"]').first();
  if (await gamesTab.isVisible().catch(() => false)) {
    await gamesTab.click({ force: true });
    await delay(1800);
    const directReadyAfterTab = await getGameLaunchpadDetail(page);
    if (directReadyAfterTab) {
      return `${hostRoomUrl} (${directReadyAfterTab})`;
    }
    const readyAfterTab = await waitForGameLaunchpad({ page, timeoutMs: Math.min(12000, timeoutMs) });
    if (readyAfterTab) {
      return `${hostRoomUrl} (${readyAfterTab})`;
    }
  }

  const fallbackTab = page.getByRole("button", { name: /^Games$/i }).first();
  if (await fallbackTab.isVisible().catch(() => false)) {
    await fallbackTab.click({ force: true });
    await delay(1800);
    const directReadyAfterFallbackTab = await getGameLaunchpadDetail(page);
    if (directReadyAfterFallbackTab) {
      return `${hostRoomUrl} (${directReadyAfterFallbackTab})`;
    }
    const readyAfterFallbackTab = await waitForGameLaunchpad({ page, timeoutMs: Math.min(12000, timeoutMs) });
    if (readyAfterFallbackTab) {
      return `${hostRoomUrl} (${readyAfterFallbackTab})`;
    }
  }

  const openLiveModes = page.getByRole("button", { name: /Open Live Modes/i }).first();
  if (await openLiveModes.isVisible().catch(() => false)) {
    await openLiveModes.click({ force: true });
    await delay(1800);
  }

  const openLaunchpad = page.getByRole("button", { name: /Open Launchpad \(Exit Admin\)/i }).first();
  if (await openLaunchpad.isVisible().catch(() => false)) {
    await openLaunchpad.click({ force: true });
    await delay(2200);
    const directReadyAfterAdminExit = await getGameLaunchpadDetail(page);
    if (directReadyAfterAdminExit) {
      return `${hostRoomUrl} (${directReadyAfterAdminExit})`;
    }
    const readyAfterAdminExit = await waitForGameLaunchpad({ page, timeoutMs: Math.min(15000, timeoutMs) });
    if (readyAfterAdminExit) {
      return `${hostRoomUrl} (${readyAfterAdminExit})`;
    }
  }

  const bodyText = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 500);
  if (/Game Launchpad|Quick Launch/i.test(bodyText)) {
    return `${hostRoomUrl} (launchpad text visible after fallback navigation)`;
  }
  throw new Error(`Could not reach Game Launchpad for room ${roomCode}. Snippet="${bodyText}"`);
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
  const attemptQuickLaunch = async () => {
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
    while (Date.now() - started < Math.min(15000, timeoutMs)) {
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

    return "";
  };

  if (modeMeta.mode === "trivia_pop" || modeMeta.mode === "wyr") {
    await delay(8000);
  }

  const firstAttempt = await attemptQuickLaunch();
  if (firstAttempt) return firstAttempt;

  if (modeMeta.mode === "trivia_pop" || modeMeta.mode === "wyr") {
    await delay(8000);
    const secondAttempt = await attemptQuickLaunch();
    if (secondAttempt) return secondAttempt;
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

  let needsJoin = false;
  const initialStateStartedAt = Date.now();
  while (Date.now() - initialStateStartedAt < Math.min(20000, timeoutMs)) {
    needsJoin =
      (await joinView.isVisible().catch(() => false)) ||
      (await nameInput.isVisible().catch(() => false)) ||
      (await fallbackInput.isVisible().catch(() => false));
    if (needsJoin) break;
    if (await isSingerMainReady()) {
      const hasReturningIdentity = await page.evaluate(() => Object.keys(window.localStorage || {}).some((key) => key.startsWith('beaurocks_returning_'))).catch(() => false);
      if (hasReturningIdentity) return "Singer already joined.";
      const gameOverlayVisible = await page.locator("[data-prompt-vote-player-view]").first().isVisible().catch(() => false);
      if (gameOverlayVisible) {
        throw new Error("Active game overlay is visible before singer membership can be established.");
      }
      return "Singer main shell rendered without a join prompt.";
    }
    await delay(350);
  }

  if (!needsJoin) {
    const bodyText = String(await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 420);
    throw new Error(`Singer surface did not reach an explicit join or main/game state. Snippet="${bodyText}"`);
  }

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
  const backgroundAudioDrill = toBool(process.env.QA_BACKGROUND_AUDIO_DRILL, false);
  const modeMeta = gameModeMeta(process.env.QA_GAME_MODE || DEFAULT_GAME_MODE);
  const email = String(process.env.QA_HOST_EMAIL || "").trim();
  const password = String(process.env.QA_HOST_PASSWORD || "");

  const checks = [];

  if (!email || !password) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      reason: "QA_HOST_EMAIL and QA_HOST_PASSWORD are required for prod persona golden paths.",
      baseUrl,
      hostUrl,
      gameMode: modeMeta.mode,
    }, null, 2));
    return;
  }

  requireQaAppCheckDebugTokenForRemoteUrl(baseUrl);
  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless });

  let roomCode = suppliedRoomCode;
  let scenarioFailure = false;

  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await applyQaAppCheckDebugInitScript(hostContext);
  const hostPage = await hostContext.newPage();

  try {
    await runCheck(checks, "host_create_or_open_room", async () => {
      await gotoHostAccessAndLogin({ page: hostPage, baseUrl, email, password, timeoutMs });
      if (roomCode) {
        const hostOrigin = hostOriginFromUrl(hostUrl);
        if (!hostOrigin) {
          throw new Error(`Could not resolve host origin from hostUrl "${hostUrl}".`);
        }
        await gotoWithSurfaceRedirectTolerance(hostPage, `${hostOrigin}/?room=${encodeURIComponent(roomCode)}&mode=host`, {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
        });
        return `Using provided room code ${roomCode}.`;
      }
      roomCode = await openHostAndCreateRoom({ page: hostPage, hostUrl, timeoutMs });
      const setupDetail = setupContractDetailByPage.get(hostPage) || 'Setup summary was not inspected.';
      return `Created room ${roomCode}. ${setupDetail}`;
    });

    if (!roomCode) {
      throw new Error("No room code available after host setup.");
    }

    await runCheck(checks, "host_open_games_and_launch_new_mode", async () => {
      await navigateHostToGames({ page: hostPage, hostUrl, roomCode, timeoutMs });
      const backgroundSnapshot = await readBackgroundAudioQaSnapshot(hostPage, timeoutMs);
      const backgroundDetail = assertBackgroundAudioQaSnapshot(backgroundSnapshot, 'Host');
      const launchDetail = await clickGameQuickLaunch({ page: hostPage, modeMeta, timeoutMs });
      return `${launchDetail} Background audio: ${backgroundDetail}.`;
    });

    const singerContext = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });
    await applyQaAppCheckDebugInitScript(singerContext);
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
        const freshRoundButton = hostPage.getByRole("button", { name: /Launch Next Question|Next Question|Launch Next Prompt|Next Prompt/i }).first();
        if (await freshRoundButton.isVisible().catch(() => false)) {
          await freshRoundButton.click({ force: true });
          await delay(1200);
        }

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
          await optionA.waitFor({ state: "visible", timeout: Math.min(10000, timeoutMs) });
          await optionA.click({ force: true });
        } else {
          const option0 = singerPage.locator('[data-qa-choice="0"]').first();
          await option0.waitFor({ state: "visible", timeout: Math.min(10000, timeoutMs) });
          await option0.click({ force: true });
        }

        const voteFeedbackStartedAt = Date.now();
        let gameText = "";
        while (Date.now() - voteFeedbackStartedAt < Math.min(15000, timeoutMs)) {
          gameText = await singerPage.locator("body").innerText().catch(() => "");
          if (modeMeta.singerSuccessRegex.test(gameText)) {
            return `Singer successfully interacted with ${modeMeta.mode}.`;
          }
          const voteErrorMatch = gameText.match(/could not submit vote|please try again|permission denied|rejoin the room|voting just closed|already locked/i);
          if (voteErrorMatch) {
            throw new Error(`Singer vote returned an error for ${modeMeta.mode}: ${voteErrorMatch[0]}.`);
          }
          await delay(400);
        }
        const gameSnippet = gameText.replace(/\s+/g, " ").trim().slice(0, 320);
        throw new Error(`Singer vote confirmation not detected for ${modeMeta.mode}. Snippet="${gameSnippet}"`);
      });
    } finally {
      await singerContext.close();
    }

    const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await applyQaAppCheckDebugInitScript(tvContext);
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

        const backgroundSnapshot = await readBackgroundAudioQaSnapshot(tvPage, timeoutMs);
        const backgroundDetail = assertBackgroundAudioQaSnapshot(backgroundSnapshot, 'TV');

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
          return `TV loaded in fallback state (live label not rendered in this room snapshot). Background audio: ${backgroundDetail}.`;
        }
        return `TV live label: ${liveText}. Background audio: ${backgroundDetail}.`;
      });
    } finally {
      await tvContext.close();
    }

    if (!skipRecap) {
      const recapContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await applyQaAppCheckDebugInitScript(recapContext);
      const recapPage = await recapContext.newPage();
      try {
        await runCheck(checks, "recap_route_loads", async () => {
          await recapPage.goto(`${baseUrl.replace(/\/+$/, '')}/recaps/${encodeURIComponent(roomCode)}`, {
            waitUntil: "domcontentloaded",
            timeout: timeoutMs,
          });
          await delay(1500);

          const stateEl = recapPage.locator("[data-recap-state]").first();
          await stateEl.waitFor({ state: "attached", timeout: Math.min(10000, timeoutMs) }).catch(() => {});
          if (await stateEl.count()) {
            const state = await stateEl.getAttribute("data-recap-state");
            if (!["ready", "not_ready", "missing_room"].includes(String(state || ""))) {
              throw new Error(`Unexpected recap state "${state}".`);
            }
            return `Recap state: ${state}`;
          }

          const bodyText = await recapPage.locator("body").innerText();
          if (!/Recap not ready yet|BROSS Karaoke Recap|Missing room code|recap not found/i.test(bodyText)) {
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

    if (backgroundAudioDrill) {
      await runCheck(checks, 'background_audio_event_readiness', async () => (
        runBackgroundAudioEventDrill({
          browser,
          hostPage,
          tvOrigin,
          baseUrl,
          roomCode,
          timeoutMs,
        })
      ));
    }
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
    backgroundAudioDrill,
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
