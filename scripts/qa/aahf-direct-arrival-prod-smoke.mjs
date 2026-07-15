import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import QRCode from "qrcode";
import {
  delay,
  ensurePlaywright,
  runCheck,
} from "./shared/playwrightQa.mjs";

const PROJECT_ID = "beaurocks-karaoke-v2";
const APP_ID = "bross-app";
const ROOM_CODE = "AAHF";
const DIRECT_APP_URL = `https://app.beaurocks.app/?room=${ROOM_CODE}`;
const HOSTING_URL = "https://beaurocks-karaoke-v2.web.app";
const QR_ASSET_PATH = path.join(process.cwd(), "public", "print", "aahf-kickoff-join-qr.svg");
const OUTPUT_DIR = path.join(process.cwd(), "tmp", "prod-aahf-direct-arrival-smoke");
const DEFAULT_TIMEOUT_MS = 120000;
const POST_RULES_TIMEOUT_MS = Number(process.env.AAHF_POST_RULES_TIMEOUT_MS || 30000);

const toJsonOrText = async (response) => {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const decodeFirestoreValue = (value) => {
  if (!value || typeof value !== "object") return undefined;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.booleanValue !== undefined) return !!value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue !== undefined) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if (value.mapValue !== undefined) {
    const decoded = {};
    for (const [key, nested] of Object.entries(value.mapValue.fields || {})) {
      decoded[key] = decodeFirestoreValue(nested);
    }
    return decoded;
  }
  return undefined;
};

const getAccessToken = () =>
  String(execSync("gcloud auth print-access-token", { encoding: "utf8" }) || "").trim();

const loadAahfRoomDoc = async () => {
  const accessToken = getAccessToken();
  const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/rooms/${ROOM_CODE}`;
  const response = await fetchWithTimeout(docUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 20000);
  const body = await toJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Firestore room fetch failed (${response.status}): ${JSON.stringify(body)}`);
  }
  const fields = body?.fields || {};
  const decoded = {};
  for (const [key, value] of Object.entries(fields)) decoded[key] = decodeFirestoreValue(value);
  return decoded;
};

const validateQrAsset = async () => {
  const actual = await fs.readFile(QR_ASSET_PATH, "utf8");
  const expected = await QRCode.toString(DIRECT_APP_URL, {
    type: "svg",
    width: 320,
    margin: 1,
    color: { dark: "#0f1728", light: "#ffffff" },
  });
  if (actual.trim() !== expected.trim()) {
    throw new Error("AAHF QR asset does not match the direct app arrival URL.");
  }
  return {
    qrAssetPath: QR_ASSET_PATH,
    target: DIRECT_APP_URL,
  };
};

const waitForBodyText = async (page, expectedText, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const token = String(expectedText || "").trim().toLowerCase();
  await page.waitForFunction((needle) => {
    const text = String(document?.body?.innerText || "").toLowerCase();
    return text.includes(needle);
  }, token, { timeout: timeoutMs });
};

const runDirectArrivalFlow = async ({ requiresAccount = false } = {}) => {
  const { chromium } = await ensurePlaywright();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await page.goto(DIRECT_APP_URL, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT_MS });
    await waitForBodyText(page, "Pick the emoji that feels most you.", DEFAULT_TIMEOUT_MS);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01-direct-arrival.png"), fullPage: true });

    await page.locator("[data-singer-join-name]").fill("Taylor QA");
    await page.locator("[data-singer-join-button]").click({ force: true });
    await waitForBodyText(page, "Agree and Continue", DEFAULT_TIMEOUT_MS);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02-rules.png"), fullPage: true });

    await page.locator("[data-singer-rules-checkbox]").check({ force: true });
    await page.locator("[data-singer-rules-confirm]").click({ force: true });
    // Force the same full-page layout pass used by the saved evidence before
    // asserting the responsive mobile shell. Headless Chromium can otherwise
    // defer the below-the-fold shell until a capture or scroll occurs.
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03-post-rules-layout.png"), fullPage: true });
    try {
      const deadlineMs = Date.now() + POST_RULES_TIMEOUT_MS;
      let settled = false;
      while (Date.now() < deadlineMs && !settled) {
        const renderedText = String(await page.locator("body").innerText().catch(() => ""))
          .replace(/\s+/g, " ")
          .toLowerCase();
        settled = requiresAccount
          ? renderedText.includes("requires a beaurocks account")
          : (await page.locator('[data-feature-id="singer-nav-songs"]').count()) > 0
            || renderedText.includes("view songs")
            || renderedText.includes("add song")
            || renderedText.includes("search for your first song")
            || renderedText.includes("search for your song");
        if (!settled) await page.waitForTimeout(750);
      }
      if (!settled) throw new Error("Timed out waiting for the post-rules surface.");
    } catch (error) {
      await page.screenshot({ path: path.join(OUTPUT_DIR, "03-post-rules-timeout.png"), fullPage: true });
      const diagnosticText = String(await page.locator("body").innerText().catch(() => ""))
        .replace(/\s+/g, " ")
        .trim();
      const normalizedDiagnosticText = diagnosticText.toLowerCase();
      const paintedSurfaceIsReady = requiresAccount
        ? normalizedDiagnosticText.includes("requires a beaurocks account")
        : (normalizedDiagnosticText.includes("view songs") || normalizedDiagnosticText.includes("add song"))
          && normalizedDiagnosticText.includes("queue");
      if (!paintedSurfaceIsReady) {
        throw new Error("Post-rules state did not settle: " + diagnosticText.slice(0, 800), { cause: error });
      }
    }

    const bodyText = String(await page.locator("body").innerText())
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (requiresAccount) {
      if (!bodyText.includes("requires a beaurocks account")) {
        throw new Error("Account-required room did not enforce the BeauRocks account gate after rules acceptance.");
      }
      await page.screenshot({ path: path.join(OUTPUT_DIR, "03-account-gate.png"), fullPage: true });
      return {
        outputDir: OUTPUT_DIR,
        directAppUrl: DIRECT_APP_URL,
        outcome: "account_gate_enforced",
      };
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03-browse.png"), fullPage: true });
    if (!(bodyText.includes("add song") || bodyText.includes("view songs"))) {
      throw new Error("Streamlined browse surface did not expose the song browser after direct arrival.");
    }
    if (!bodyText.includes("queue")) {
      throw new Error("Streamlined browse surface did not expose the queue CTA after direct arrival.");
    }

    return {
      outputDir: OUTPUT_DIR,
      directAppUrl: DIRECT_APP_URL,
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
};

const run = async () => {
  const checks = [];
  const summary = {
    roomCode: ROOM_CODE,
    directAppUrl: DIRECT_APP_URL,
    hostingUrl: HOSTING_URL,
    screenshotDir: OUTPUT_DIR,
  };

  await runCheck(checks, "qr_asset_points_to_direct_app_arrival", async () => {
    const detail = await validateQrAsset();
    summary.qr = detail;
    return `${detail.target}`;
  });

  await runCheck(checks, "live_room_config_is_streamlined", async () => {
    const room = await loadAahfRoomDoc();
    summary.room = {
      audienceShellVariant: room?.audienceShellVariant || "",
      audienceAccessMode: room?.eventCredits?.audienceAccessMode || "",
      joinAccessMode: room?.audienceJoinPolicy?.accessMode || "",
      timedLobbyEnabled: !!room?.eventCredits?.timedLobbyEnabled,
      timedLobbyPoints: Number(room?.eventCredits?.timedLobbyPoints || 0) || 0,
      timedLobbyIntervalMin: Number(room?.eventCredits?.timedLobbyIntervalMin || 0) || 0,
      timedLobbyMaxPerGuest: Number(room?.eventCredits?.timedLobbyMaxPerGuest || 0) || 0,
      generalAdmissionPoints: Number(room?.eventCredits?.generalAdmissionPoints || 0) || 0,
      customEmojiAccess: room?.audienceFeatureAccess?.features?.customEmoji || "",
      premiumReactionsAccess: room?.audienceFeatureAccess?.features?.premiumReactions || "",
      introHeadline: room?.runOfShowDirector?.items?.[0]?.presentationPlan?.headline || "",
      joinHeadline: room?.runOfShowDirector?.items?.find?.((item) => item?.title === "How To Join In")?.presentationPlan?.headline || "",
    };
    if (room?.audienceShellVariant !== "streamlined") {
      throw new Error(`Expected audienceShellVariant "streamlined", received ${JSON.stringify(room?.audienceShellVariant)}`);
    }
    if (room?.eventCredits?.audienceAccessMode !== "account") {
      throw new Error(`Expected audienceAccessMode "account", received ${JSON.stringify(room?.eventCredits?.audienceAccessMode)}`);
    }
    if (room?.audienceFeatureAccess?.features?.customEmoji !== "open" || room?.audienceFeatureAccess?.features?.premiumReactions !== "open") {
      throw new Error("Expected AAHF audience feature access to keep custom emoji and premium reactions open.");
    }
    if (room?.eventCredits?.timedLobbyEnabled !== true) {
      throw new Error("Expected AAHF timed lobby credits to be enabled.");
    }
    return `variant=${room.audienceShellVariant}`;
  });

  await runCheck(checks, "historical_aahf_takeover_copy_snapshot", async () => {
    const room = await loadAahfRoomDoc();
    const items = Array.isArray(room?.runOfShowDirector?.items) ? room.runOfShowDirector.items : [];
    const historicalHeadlines = [
      "AAHF Karaoke Kick-Off",
      "Scan in. Join AAHF. Sing next.",
      "Keep AAHF singing",
      "Selfie Cam spotlight",
      "Take five. Stay loud.",
      "AAHF, thank you",
    ];
    const headlines = items.map((item) => String(item?.presentationPlan?.headline || "").trim()).filter(Boolean);
    const missing = historicalHeadlines.filter((headline) => !headlines.includes(headline));
    summary.historicalTakeoverCopy = {
      expectedCount: historicalHeadlines.length,
      presentCount: historicalHeadlines.length - missing.length,
      missing,
    };
    if (missing.length) {
      return `Historical AAHF copy drift allowed (${missing.length} missing).`;
    }
    return `${historicalHeadlines.length} historical headlines still present`;
  });

  await runCheck(checks, "direct_app_arrival_flow_smoke", async () => {
    const detail = await runDirectArrivalFlow({
      requiresAccount: summary.room?.joinAccessMode === "account_required",
    });
    summary.productionFlow = detail;
    return detail.outputDir;
  });

  const failed = checks.filter((item) => !item.pass);
  const result = {
    ok: failed.length === 0,
    failedCount: failed.length,
    checks,
    summary,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(result, null, 2));
  if (failed.length) process.exit(1);
};

run().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.stack || error?.message || error),
  }, null, 2));
  process.exit(1);
});
