import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  delay,
  ensurePlaywright,
  runCheck,
  startStaticDistServer,
} from "./shared/playwrightQa.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");
const DEFAULT_TIMEOUT_MS = 90000;

const loadMarketingRoute = async (page, baseUrl, { path: routePath, legacyPage }, timeoutMs) => {
  await page.goto(`${baseUrl}${routePath}`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const parsed = new URL(page.url());
  if (String(parsed.pathname || "").toLowerCase().includes(String(routePath || "").toLowerCase())) return;
  await page.goto(`${baseUrl}/?mode=marketing&page=${encodeURIComponent(legacyPage)}`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
};

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || "").trim() !== "1";
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  const checks = [];
  let interceptedPayload = null;

  await page.route(/submitMarketingWaitlist/i, async (route) => {
    const request = route.request();
    if (request.method().toUpperCase() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type, x-firebase-gmpid, authorization, x-firebase-appcheck",
        },
        body: "",
      });
      return;
    }
    const body = request.postDataJSON?.() || {};
    interceptedPayload = body?.data || null;
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify({
        result: {
          ok: true,
          linePosition: 7,
          isNewSignup: true,
          message: "You are on the BeauRocks Host waitlist. We release only a few invitations at a time."
        },
      }),
    });
  });

  try {
    await runCheck(checks, "host_waitlist_page_loads", async () => {
      await loadMarketingRoute(page, server.baseUrl, { path: "/for-hosts", legacyPage: "for_hosts" }, timeoutMs);
      await page.getByRole("heading", { name: /host karaoke your way/i }).waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText(/new host applications are open/i).first().waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("$15/mo", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText("$150/yr", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
      return "for-hosts page loaded";
    });

    await runCheck(checks, "host_waitlist_form_submits", async () => {
      const form = page.locator(".mk3-host-application-form").first();
      await form.getByLabel(/^name$/i).fill("QA Host Waitlist");
      const emailInput = form.getByLabel(/email address/i);
      await emailInput.fill("qa-host-waitlist@beaurocks.app");
      const submitButton = form.getByRole("button", { name: /^Join the Host Waitlist$/i });
      await submitButton.click();
      await form.getByText(/on the BeauRocks Host waitlist/i).waitFor({ state: "visible", timeout: timeoutMs });
      if (!interceptedPayload) throw new Error("Waitlist callable payload was not captured.");
      if (String(interceptedPayload.email || "").toLowerCase() !== "qa-host-waitlist@beaurocks.app") {
        throw new Error(`Expected submitted email to match; got "${interceptedPayload.email || ""}".`);
      }
      if (String(interceptedPayload.useCase || "") !== "host_application") {
        throw new Error(`Expected host_application useCase; got "${interceptedPayload.useCase || ""}".`);
      }
      if (String(interceptedPayload.source || "") !== "for_hosts_limited_host_testing_2026") {
        throw new Error(`Expected for_hosts_limited_host_testing_2026 source; got "${interceptedPayload.source || ""}".`);
      }
      return JSON.stringify(interceptedPayload);
    });

    await runCheck(checks, "host_waitlist_form_recovers_after_submit", async () => {
      await delay(150);
      const buttonLabel = await page.locator(".mk3-host-application-form").first()
        .getByRole("button", { name: /^Join the Host Waitlist$/i })
        .textContent();
      if (!/join the host waitlist/i.test(String(buttonLabel || ""))) {
        throw new Error(`Expected submit button to return to idle label, got "${buttonLabel || ""}".`);
      }
      const bodyText = await page.locator("body").innerText();
      if (/host authentication finishes|marketing site explains the flow|host\.beaurocks\.app/i.test(bodyText)) {
        throw new Error("Internal Host routing language leaked into the public waitlist page.");
      }
      return "submit button returned to idle and public copy stayed customer-facing";
    });

    await runCheck(checks, "host_access_handoff_uses_customer_language", async () => {
      await loadMarketingRoute(page, server.baseUrl, { path: "/host-access", legacyPage: "host_access" }, timeoutMs);
      await page.getByText(/already invited/i).first().waitFor({ state: "visible", timeout: timeoutMs });
      const authBox = page.locator(".mk3-auth-box").first();
      await authBox.getByRole("button", { name: /continue to sign in|log in/i }).first().waitFor({ state: "visible", timeout: timeoutMs });
      await authBox.getByRole("button", { name: /join the host waitlist/i }).waitFor({ state: "visible", timeout: timeoutMs });
      const bodyText = await page.locator("body").innerText();
      if (/host authentication finishes|marketing site explains the flow|host\.beaurocks\.app|account-backed|unlock codes/i.test(bodyText)) {
        throw new Error("Internal Host routing or access language leaked into the sign-in handoff.");
      }
      return "Host access handoff stayed invitation-focused";
    });
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }

  const failed = checks.filter((entry) => !entry.pass);
  const prefix = "[qa:marketing-host-waitlist]";
  checks.forEach((entry) => {
    const marker = entry.pass ? "PASS" : "FAIL";
    console.log(`${prefix} ${marker} ${entry.name}${entry.detail ? ` :: ${entry.detail}` : ""}`);
  });
  if (failed.length > 0) {
    throw new Error(`${failed.length} host waitlist QA check(s) failed.`);
  }
};

main().catch((error) => {
  console.error(`[qa:marketing-host-waitlist] ${String(error?.message || error)}`);
  process.exitCode = 1;
});
