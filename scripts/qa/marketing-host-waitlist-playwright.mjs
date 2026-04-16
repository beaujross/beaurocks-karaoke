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
          message: "Host access request received. Queue position: #7. Next steps: we notify BeauRocks admins and email you when reviewed."
        },
      }),
    });
  });

  try {
    await runCheck(checks, "host_waitlist_page_loads", async () => {
      await loadMarketingRoute(page, server.baseUrl, { path: "/for-hosts", legacyPage: "for_hosts" }, timeoutMs);
      await page.getByRole("heading", { name: /join the beaurocks host waitlist/i }).waitFor({ state: "visible", timeout: timeoutMs });
      await page.getByText(/approved hosts only/i).first().waitFor({ state: "visible", timeout: timeoutMs });
      return "for-hosts page loaded";
    });

    await runCheck(checks, "host_waitlist_form_submits", async () => {
      const form = page.locator(".mk3-host-application-form").first();
      const emailInput = form.getByLabel(/email address/i);
      await emailInput.fill("qa-host-waitlist@beaurocks.app");
      const submitButton = form.getByRole("button", { name: /^Join Host Waitlist$/i });
      await submitButton.click();
      await form.getByText(/queue position: #7/i).waitFor({ state: "visible", timeout: timeoutMs });
      if (!interceptedPayload) throw new Error("Waitlist callable payload was not captured.");
      if (String(interceptedPayload.email || "").toLowerCase() !== "qa-host-waitlist@beaurocks.app") {
        throw new Error(`Expected submitted email to match; got "${interceptedPayload.email || ""}".`);
      }
      if (String(interceptedPayload.useCase || "") !== "host_application") {
        throw new Error(`Expected host_application useCase; got "${interceptedPayload.useCase || ""}".`);
      }
      if (String(interceptedPayload.source || "") !== "for_hosts_early_access_2026") {
        throw new Error(`Expected for_hosts_early_access_2026 source; got "${interceptedPayload.source || ""}".`);
      }
      return JSON.stringify(interceptedPayload);
    });

    await runCheck(checks, "host_waitlist_form_recovers_after_submit", async () => {
      await delay(150);
      const buttonLabel = await page.locator(".mk3-host-application-form").first()
        .getByRole("button", { name: /^Join Host Waitlist$/i })
        .textContent();
      if (!/join host waitlist/i.test(String(buttonLabel || ""))) {
        throw new Error(`Expected submit button to return to idle label, got "${buttonLabel || ""}".`);
      }
      return "submit button returned to idle";
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
