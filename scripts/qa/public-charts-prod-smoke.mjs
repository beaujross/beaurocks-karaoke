#!/usr/bin/env node
import process from "node:process";
import { ensurePlaywright } from "./shared/playwrightQa.mjs";

const BASE_URL = String(process.env.QA_BASE_URL || "https://beaurocks.app").replace(/\/$/, "");
const TIMEOUT_MS = 70_000;
const profiles = [
  { id: "desktop", viewport: { width: 1440, height: 960 } },
  { id: "mobile", viewport: { width: 390, height: 844 } },
];
const checks = [];
const assert = (condition, detail) => {
  if (!condition) throw new Error(detail);
};

const { chromium } = await ensurePlaywright();
const browser = await chromium.launch({ headless: true });
try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: profile.viewport });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
    try {
      await page.goto(BASE_URL + "/charts?qa=launch_v1", {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUT_MS,
      });
      await page.getByRole("heading", {
        name: /the room makes the score\. your account makes the charts/i,
      }).waitFor({ state: "visible", timeout: TIMEOUT_MS });
      const tabs = page.getByRole("navigation", { name: "Leaderboard views" });
      for (const label of ["Global", "Songs", "Public Rooms"]) {
        const tab = tabs.getByRole("button", { name: label, exact: true });
        await tab.waitFor({ state: "visible", timeout: TIMEOUT_MS });
        await tab.click();
      }
      await page.getByText("Loading charts...").waitFor({ state: "hidden", timeout: TIMEOUT_MS });
      const warning = page.locator(".mk3-charts-page .mk3-status-warning");
      assert(await warning.count() === 0, "Charts rendered an error state: " + await warning.allTextContents());
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      assert(overflow.scrollWidth <= overflow.clientWidth + 1, "Charts overflow horizontally: " + JSON.stringify(overflow));
      assert(pageErrors.length === 0, "Charts raised page errors: " + pageErrors.join(" | "));
      checks.push({ profile: profile.id, name: "charts_route", pass: true, overflow });

      await page.goto(BASE_URL + "/discover?qa=launch_v1", {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUT_MS,
      });
      await page.getByText("BeauRocks Charts", { exact: true }).first().waitFor({ state: "visible", timeout: TIMEOUT_MS });
      await page.getByRole("button", { name: "View Charts", exact: true }).click();
      await page.waitForURL(/\/charts(?:\?|$)/, { timeout: TIMEOUT_MS });
      checks.push({ profile: profile.id, name: "discover_chart_teaser", pass: true });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({
  ok: true,
  baseUrl: BASE_URL,
  chartEra: "launch_v1",
  checks,
  timestamp: new Date().toISOString(),
}, null, 2));
