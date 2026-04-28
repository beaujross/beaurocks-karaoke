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

const runDirectArrivalFlow = async () => {
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
    await freezeMotion(page);
    await waitForBodyText(page, "Pick the emoji that feels most you.", DEFAULT_TIMEOUT_MS);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01-direct-arrival.png"), fullPage: true });

    await page.locator("[data-singer-join-name]").fill("Taylor QA");
    await page.locator("[data-singer-join-button]").click({ force: true });
    await waitForBodyText(page, "Agree and Continue", DEFAULT_TIMEOUT_MS);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02-rules.png"), fullPage: true });

    await page.locator("[data-singer-rules-checkbox]").check({ force: true });
    await page.locator("[data-singer-rules-confirm]").click({ force: true });
    await waitForBodyText(page, "Search for your song", DEFAULT_TIMEOUT_MS);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03-browse.png"), fullPage: true });

    const bodyText = String(await page.locator("body").innerText()).toLowerCase();
    if (bodyText.includes("requests") && bodyText.includes("tight 15")) {
      throw new Error("Classic audience shell markers are visible after direct arrival.");
    }
    if (!bodyText.includes("watch queue")) {
      throw new Error("Streamlined browse hero did not expose the queue CTA.");
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
      introHeadline: room?.runOfShowDirector?.items?.[0]?.presentationPlan?.headline || "",
      joinHeadline: room?.runOfShowDirector?.items?.find?.((item) => item?.title === "How To Join In")?.presentationPlan?.headline || "",
    };
    if (room?.audienceShellVariant !== "streamlined") {
      throw new Error(`Expected audienceShellVariant "streamlined", received ${JSON.stringify(room?.audienceShellVariant)}`);
    }
    return `variant=${room.audienceShellVariant}`;
  });

  await runCheck(checks, "live_room_takeover_copy_is_current", async () => {
    const room = summary.room?.audienceShellVariant ? await loadAahfRoomDoc() : await loadAahfRoomDoc();
    const items = Array.isArray(room?.runOfShowDirector?.items) ? room.runOfShowDirector.items : [];
    const requiredHeadlines = [
      "AAHF Karaoke Kick-Off",
      "Scan in. Join AAHF. Sing next.",
      "Keep AAHF singing",
      "Selfie Cam spotlight",
      "Take five. Stay loud.",
      "AAHF, thank you",
    ];
    const headlines = items.map((item) => String(item?.presentationPlan?.headline || "").trim()).filter(Boolean);
    const missing = requiredHeadlines.filter((headline) => !headlines.includes(headline));
    if (missing.length) {
      throw new Error(`Missing live AAHF takeover copy: ${missing.join(", ")}`);
    }
    return `${requiredHeadlines.length} headlines verified`;
  });

  await runCheck(checks, "direct_app_arrival_flow_smoke", async () => {
    const detail = await runDirectArrivalFlow();
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
