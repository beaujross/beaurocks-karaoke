#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const DEFAULT_BASE_URL = "https://host.beaurocks.app";
const DEFAULT_DURATION_HOURS = 6;
const DEFAULT_INTERVAL_MINUTES = 20;
const DEFAULT_PAGE_SETTLE_MS = 7000;
const DEFAULT_STEP_TIMEOUT_MS = 45 * 60 * 1000;
const DEFAULT_MAX_DETAIL_ROUTES = 6;

const usage = `
Usage:
  node scripts/ops/overnight-product-intelligence.mjs
  node scripts/ops/overnight-product-intelligence.mjs --duration-hours 6 --interval-minutes 20

Options:
  --base-url <url>             Base URL to inspect (default: ${DEFAULT_BASE_URL})
  --duration-hours <n>         Total runtime target in hours (default: ${DEFAULT_DURATION_HOURS})
  --interval-minutes <n>       Delay between route-sweep cycles (default: ${DEFAULT_INTERVAL_MINUTES})
  --page-settle-ms <n>         Extra wait after navigation before measuring (default: ${DEFAULT_PAGE_SETTLE_MS})
  --step-timeout-ms <n>        Timeout for heavier child-process steps (default: ${DEFAULT_STEP_TIMEOUT_MS})
  --max-detail-routes <n>      Extra event/venue/detail routes to sample from manifest (default: ${DEFAULT_MAX_DETAIL_ROUTES})
  --out-dir <path>             Output directory (default: artifacts/overnight/product-intelligence/<timestamp>)
  --skip-smokes                Skip overnight smoke scripts
  --skip-directory-audit       Skip overnight directory dry-run/audit
  --help                       Show this help
`;

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readArg = (flag, fallback = "") => {
  const idx = args.indexOf(flag);
  if (idx < 0) return fallback;
  return args[idx + 1] || fallback;
};

if (hasFlag("--help")) {
  console.log(usage.trim());
  process.exit(0);
}

const clampPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const nowIso = () => new Date().toISOString();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runId = nowIso().replace(/[:.]/g, "-");
const baseUrl = String(readArg("--base-url", DEFAULT_BASE_URL) || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
const durationHours = clampPositiveNumber(readArg("--duration-hours", DEFAULT_DURATION_HOURS), DEFAULT_DURATION_HOURS);
const intervalMinutes = clampPositiveNumber(readArg("--interval-minutes", DEFAULT_INTERVAL_MINUTES), DEFAULT_INTERVAL_MINUTES);
const pageSettleMs = clampPositiveNumber(readArg("--page-settle-ms", DEFAULT_PAGE_SETTLE_MS), DEFAULT_PAGE_SETTLE_MS);
const stepTimeoutMs = clampPositiveNumber(readArg("--step-timeout-ms", DEFAULT_STEP_TIMEOUT_MS), DEFAULT_STEP_TIMEOUT_MS);
const maxDetailRoutes = Math.max(0, Math.floor(clampPositiveNumber(readArg("--max-detail-routes", DEFAULT_MAX_DETAIL_ROUTES), DEFAULT_MAX_DETAIL_ROUTES)));
const skipSmokes = hasFlag("--skip-smokes");
const skipDirectoryAudit = hasFlag("--skip-directory-audit");
const outDir = path.resolve(
  readArg("--out-dir", path.join("artifacts", "overnight", "product-intelligence", runId))
);

const reportPath = path.join(outDir, "overnight-report.json");
const summaryPath = path.join(outDir, "overnight-summary.md");
const cyclesDir = path.join(outDir, "cycles");
const screenshotsDir = path.join(outDir, "screenshots");
const stepLogsDir = path.join(outDir, "steps");

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

const ensureDir = async (targetPath = "") => {
  if (!targetPath) return;
  await fs.mkdir(targetPath, { recursive: true });
};

const writeJson = async (targetPath, data) => {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const sanitizeSlug = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/[\\/]+/g, "__")
    .replace(/^-+|-+$/g, "") || "route";

const normalizeUrl = (routePath = "/") => {
  const safePath = String(routePath || "/").startsWith("/") ? routePath : `/${routePath}`;
  return `${baseUrl}${safePath}`;
};
const baseOrigin = new URL(baseUrl).origin;

const loadManifest = async () => {
  try {
    const response = await fetch(`${baseUrl}/marketing-route-manifest.json`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch {
    try {
      const localManifest = await fs.readFile(path.resolve("dist/marketing-route-manifest.json"), "utf8");
      return JSON.parse(localManifest);
    } catch {
      return null;
    }
  }
};

const pickDetailRoutes = (manifest = null, limit = 0) => {
  if (!manifest || !Array.isArray(manifest.detailRoutes)) return [];
  const source = manifest.detailRoutes.map((entry) => String(entry || "").trim()).filter(Boolean);
  const preferred = [];
  const pushUnique = (value) => {
    const token = String(value || "").trim();
    if (!token || preferred.includes(token)) return;
    preferred.push(token);
  };

  source
    .filter((route) => /event_aahf|event_beaurocks/i.test(route))
    .slice(0, 3)
    .forEach(pushUnique);
  source
    .filter((route) => /venues\/.*(woodshed|plate_pint|town_portal|ruby_slipper)/i.test(route))
    .slice(0, 2)
    .forEach(pushUnique);
  source
    .filter((route) => /^\/hosts\//i.test(route))
    .slice(0, 1)
    .forEach(pushUnique);
  source
    .filter((route) => /^\/sessions\//i.test(route))
    .slice(0, 1)
    .forEach(pushUnique);

  source.forEach(pushUnique);
  return preferred.slice(0, Math.max(0, limit));
};

const buildTargets = async () => {
  const manifest = await loadManifest();
  const coreTargets = [
    { id: "home", path: "/", label: "Homepage" },
    { id: "discover", path: "/discover", label: "Discover" },
    { id: "demo", path: "/demo", label: "Demo" },
    { id: "fans", path: "/for-fans", label: "For Fans" },
    { id: "hosts", path: "/for-hosts", label: "For Hosts" },
    { id: "venues", path: "/for-venues", label: "For Venues" },
  ];
  const detailTargets = pickDetailRoutes(manifest, maxDetailRoutes).map((routePath, index) => ({
    id: `detail_${index + 1}`,
    path: routePath,
    label: routePath,
  }));
  return { manifest, targets: [...coreTargets, ...detailTargets] };
};

const countWords = (text = "") => String(text || "").trim().split(/\s+/).filter(Boolean).length;

const buildPageIssues = ({ path: routePath, metrics = {}, responseStatus = 0, criticalRequests = [], pageErrors = [] }) => {
  const issues = [];
  if (responseStatus && responseStatus >= 400) {
    issues.push(`HTTP ${responseStatus}`);
  }
  if (pageErrors.length) {
    issues.push(`${pageErrors.length} page errors`);
  }
  if (criticalRequests.length) {
    issues.push(`${criticalRequests.length} failed requests`);
  }
  if (routePath === "/") {
    if ((metrics.aboveFoldWordCount || 0) > 150) issues.push("Homepage above-fold copy is still dense");
    if ((metrics.visualCountAboveFold || 0) < 2) issues.push("Homepage feels light on visuals above the fold");
  }
  if (routePath === "/discover") {
    if (!metrics.mapPresent) issues.push("Discover map missing");
    if (typeof metrics.mapTop === "number" && metrics.mapTop > 420) issues.push("Discover map sits too low");
    if (!metrics.resultsRailPresent) issues.push("Discover results rail missing");
  }
  if (routePath === "/demo") {
    if ((metrics.surfaceCount || 0) < 3) issues.push("Demo is missing one or more live surfaces");
    if ((metrics.sceneButtonCount || 0) < 8) issues.push("Demo scene nav is incomplete");
    if (String(metrics.inlineStatus || "").toLowerCase().includes("app check")) issues.push("Demo guided sync is blocked by App Check in headless runs");
  }
  if (/^\/events\//i.test(routePath) || /^\/venues\//i.test(routePath) || /^\/hosts\//i.test(routePath)) {
    if ((metrics.imageCount || 0) < 1) issues.push("Listing/detail page appears to be missing imagery");
    if ((metrics.hostProfileImageCount || 0) < 1) issues.push("Host profile image not detected on detail page");
  }
  return issues;
};

const inspectRoute = async ({ browser, route, cycleIndex }) => {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1400 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  const pageErrors = [];
  let responseStatus = 0;

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    consoleErrors.push(String(msg.text() || "").trim());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(String(error?.message || error).trim());
  });
  page.on("response", (response) => {
    const status = Number(response.status());
    if (status < 400) return;
    const req = response.request();
    const resourceType = req.resourceType();
    const url = response.url();
    if (!String(url || "").startsWith(baseOrigin)) return;
    const isCritical =
      resourceType === "document"
      || resourceType === "script"
      || resourceType === "stylesheet"
      || resourceType === "fetch"
      || resourceType === "xhr";
    if (!isCritical) return;
    failedRequests.push({ status, url, resourceType });
  });

  const url = normalizeUrl(route.path);
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    responseStatus = Number(response?.status() || 0);
    await page.waitForTimeout(route.path === "/demo" ? Math.max(pageSettleMs, 9000) : pageSettleMs);
    const screenshotPath = path.join(screenshotsDir, `cycle-${String(cycleIndex).padStart(2, "0")}__${sanitizeSlug(route.path)}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const metrics = await page.evaluate(({ routePath }) => {
      const getVisibleTextNodes = (selector) => {
        const seen = new Set();
        const items = [];
        document.querySelectorAll(selector).forEach((node) => {
          const text = (node.textContent || "").trim().replace(/\s+/g, " ");
          if (!text || seen.has(text)) return;
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          const visible = rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          if (!visible) return;
          seen.add(text);
          items.push({ text, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height });
        });
        return items;
      };

      const viewportHeight = window.innerHeight || 0;
      const viewportWidth = window.innerWidth || 0;
      const textNodes = getVisibleTextNodes("h1,h2,h3,p,li,a,button,strong,span");
      const aboveFoldText = textNodes.filter((entry) => entry.top < viewportHeight && entry.bottom > 0).map((entry) => entry.text);
      const visualNodes = Array.from(document.querySelectorAll("img, video, iframe, canvas, svg"))
        .map((node) => {
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          return {
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none",
          };
        })
        .filter((entry) => entry.visible);
      const visualsAboveFold = visualNodes.filter((entry) => entry.top < viewportHeight && entry.bottom > 0);
      const aboveFoldVisualArea = visualsAboveFold.reduce((sum, entry) => {
        const height = Math.max(0, Math.min(entry.bottom, viewportHeight) - Math.max(entry.top, 0));
        return sum + (Math.max(0, entry.width) * height);
      }, 0);
      const ctaTexts = getVisibleTextNodes("a,button")
        .map((entry) => entry.text)
        .filter((text) => text.length >= 3 && text.length <= 44)
        .slice(0, 10);

      const result = {
        title: document.title,
        h1: (document.querySelector("h1")?.textContent || "").trim(),
        bodyWordCount: (document.body?.innerText || "").trim().split(/\s+/).filter(Boolean).length,
        aboveFoldWordCount: aboveFoldText.join(" ").trim().split(/\s+/).filter(Boolean).length,
        sectionCount: document.querySelectorAll("section, article").length,
        headingCount: document.querySelectorAll("h1, h2, h3").length,
        buttonCount: document.querySelectorAll("button").length,
        linkCount: document.querySelectorAll("a[href]").length,
        imageCount: document.querySelectorAll("img").length,
        iframeCount: document.querySelectorAll("iframe").length,
        ctaTexts,
        visualCountAboveFold: visualsAboveFold.length,
        aboveFoldVisualCoverage: viewportWidth && viewportHeight
          ? Number((aboveFoldVisualArea / (viewportWidth * viewportHeight)).toFixed(3))
          : 0,
        hostProfileImageCount: Array.from(document.querySelectorAll("img"))
          .filter((img) => String(img.getAttribute("src") || "").toLowerCase().includes("bross-host-beaurocks"))
          .length,
      };

      if (routePath === "/discover") {
        const mapEl = document.querySelector(".mk3-discover-shell .mk3-map-grid, .mk3-discover-shell .mk3-map-canvas");
        const resultsRail = document.querySelector(".mk3-card-results, .mk3-card-tiles, .mk3-results-shell");
        const shownMatch = (document.body?.innerText || "").match(/\b(\d+)\s+shown\b/i);
        result.mapPresent = !!mapEl;
        result.mapTop = mapEl ? Math.round(mapEl.getBoundingClientRect().top) : null;
        result.resultsRailPresent = !!resultsRail;
        result.resultCardCount = document.querySelectorAll("[data-discover-card], .mk3-discover-card, .mk3-discover-listing-card").length;
        result.resultsShown = shownMatch ? Number(shownMatch[1]) : null;
      }

      if (routePath === "/demo") {
        result.surfaceCount = document.querySelectorAll(".mk3-demo-surface").length;
        result.sceneButtonCount = document.querySelectorAll(".mk3-demo-scene-nav button").length;
        result.inlineStatus = (document.querySelector(".mk3-inline-status")?.textContent || "").trim();
      }

      return result;
    }, { routePath: route.path });

    const criticalRequests = failedRequests.filter((entry) => entry.status >= 400);
    const issues = buildPageIssues({
      path: route.path,
      metrics,
      responseStatus,
      criticalRequests,
      pageErrors,
    });

    return {
      id: route.id,
      label: route.label,
      path: route.path,
      url,
      ok: issues.length === 0,
      responseStatus,
      screenshotPath,
      metrics,
      consoleErrors: consoleErrors.slice(0, 12),
      pageErrors: pageErrors.slice(0, 12),
      failedRequests: criticalRequests.slice(0, 20),
      issues,
    };
  } catch (error) {
    return {
      id: route.id,
      label: route.label,
      path: route.path,
      url,
      ok: false,
      responseStatus,
      screenshotPath: "",
      metrics: {},
      consoleErrors: consoleErrors.slice(0, 12),
      pageErrors: [...pageErrors.slice(0, 12), String(error?.message || error)],
      failedRequests: failedRequests.slice(0, 20),
      issues: [String(error?.message || error)],
    };
  } finally {
    await context.close().catch(() => {});
  }
};

const runChildStep = async ({ id = "", label = "", command = "", commandArgs = [], timeoutMs = stepTimeoutMs }) => {
  const startedAt = nowIso();
  const startedMs = Date.now();
  const stdoutLines = [];
  const stderrLines = [];

  return await new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      shell: false,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      const lines = String(chunk || "").split(/\r?\n/).filter(Boolean);
      stdoutLines.push(...lines);
      process.stdout.write(String(chunk || ""));
    });
    child.stderr.on("data", (chunk) => {
      const lines = String(chunk || "").split(/\r?\n/).filter(Boolean);
      stderrLines.push(...lines);
      process.stderr.write(String(chunk || ""));
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        id,
        label,
        ok: false,
        timedOut,
        startedAt,
        finishedAt: nowIso(),
        durationMs: Date.now() - startedMs,
        exitCode: -1,
        stdoutTail: stdoutLines.slice(-60),
        stderrTail: [...stderrLines.slice(-60), String(error?.message || error)],
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        id,
        label,
        ok: Number(code ?? -1) === 0 && !timedOut,
        timedOut,
        startedAt,
        finishedAt: nowIso(),
        durationMs: Date.now() - startedMs,
        exitCode: Number(code ?? -1),
        stdoutTail: stdoutLines.slice(-60),
        stderrTail: stderrLines.slice(-60),
      });
    });
  });
};

const writeSummary = async (report = {}) => {
  const lines = [
    "# Overnight Product Intelligence",
    "",
    `Generated: ${report.generatedAt || nowIso()}`,
    `Base URL: ${report.baseUrl || baseUrl}`,
    `Duration target: ${report.durationHours || durationHours} hours`,
    `Cycles completed: ${report.cycles?.length || 0}`,
    "",
  ];

  const latestCycle = Array.isArray(report.cycles) && report.cycles.length
    ? report.cycles[report.cycles.length - 1]
    : null;

  if (latestCycle) {
    lines.push("## Latest Cycle");
    lines.push("");
    lines.push(`Cycle ${latestCycle.index} at ${latestCycle.startedAt}`);
    lines.push(`Pages checked: ${latestCycle.pages.length}`);
    lines.push(`Pages with issues: ${latestCycle.pages.filter((page) => page.issues?.length).length}`);
    lines.push("");
    latestCycle.pages
      .filter((page) => page.issues?.length)
      .slice(0, 12)
      .forEach((page) => {
        lines.push(`- ${page.path}: ${page.issues.join("; ")}`);
      });
    lines.push("");
  }

  const routeIssueCounts = new Map();
  (report.cycles || []).forEach((cycle) => {
    (cycle.pages || []).forEach((page) => {
      const current = routeIssueCounts.get(page.path) || { count: 0, issues: new Set() };
      if (Array.isArray(page.issues) && page.issues.length) {
        current.count += page.issues.length;
        page.issues.forEach((issue) => current.issues.add(issue));
      }
      routeIssueCounts.set(page.path, current);
    });
  });

  const worstRoutes = Array.from(routeIssueCounts.entries())
    .filter(([, entry]) => entry.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  if (worstRoutes.length) {
    lines.push("## Most Repeated Issues");
    lines.push("");
    worstRoutes.forEach(([routePath, entry]) => {
      lines.push(`- ${routePath}: ${entry.count} issue hits (${Array.from(entry.issues).slice(0, 3).join("; ")})`);
    });
    lines.push("");
  }

  if (Array.isArray(report.steps) && report.steps.length) {
    lines.push("## Heavy Steps");
    lines.push("");
    report.steps.forEach((step) => {
      lines.push(`- ${step.label}: ${step.ok ? "pass" : "fail"} (${Math.round((step.durationMs || 0) / 1000)}s)`);
    });
    lines.push("");
  }

  lines.push("## Artifacts");
  lines.push("");
  lines.push(`- JSON report: ${reportPath}`);
  lines.push(`- Screenshots: ${screenshotsDir}`);
  lines.push(`- Step logs: ${stepLogsDir}`);
  lines.push("");

  await fs.writeFile(summaryPath, `${lines.join("\n")}\n`, "utf8");
};

const run = async () => {
  await ensureDir(outDir);
  await ensureDir(cyclesDir);
  await ensureDir(screenshotsDir);
  await ensureDir(stepLogsDir);

  const { chromium } = await ensurePlaywright();
  const { manifest, targets } = await buildTargets();

  const report = {
    generatedAt: nowIso(),
    runId,
    baseUrl,
    outDir,
    durationHours,
    intervalMinutes,
    pageSettleMs,
    startedAt: nowIso(),
    targetCount: targets.length,
    targets,
    manifestGeneratedAt: manifest?.generatedAt || "",
    manifestCounts: manifest?.counts || null,
    cycles: [],
    steps: [],
  };

  const browser = await chromium.launch({ headless: true });
  const startedMs = Date.now();
  const endMs = startedMs + (durationHours * 60 * 60 * 1000);
  let cycleIndex = 0;
  let lastSmokeAtMs = 0;
  let directoryAuditRun = false;

  try {
    while (Date.now() < endMs) {
      cycleIndex += 1;
      const cycleStartedMs = Date.now();
      console.log(`\n=== Route sweep cycle ${cycleIndex} ===`);
      const pages = [];
      for (const route of targets) {
        console.log(`Checking ${route.path}`);
        const result = await inspectRoute({ browser, route, cycleIndex });
        pages.push(result);
      }

      const cycle = {
        index: cycleIndex,
        startedAt: new Date(cycleStartedMs).toISOString(),
        finishedAt: nowIso(),
        durationMs: Date.now() - cycleStartedMs,
        pages,
        issueCount: pages.reduce((sum, page) => sum + (page.issues?.length || 0), 0),
      };
      report.cycles.push(cycle);
      await writeJson(path.join(cyclesDir, `cycle-${String(cycleIndex).padStart(2, "0")}.json`), cycle);

      if (!directoryAuditRun && !skipDirectoryAudit) {
        directoryAuditRun = true;
        console.log("\n=== Directory audit dry-run ===");
        const step = await runChildStep({
          id: "directory_audit",
          label: "Directory growth dry-run",
          command: process.execPath,
          commandArgs: [
            "scripts/ops/overnight-directory-growth.mjs",
            "--skip-qa",
            "--report",
            path.join(stepLogsDir, "directory-growth-report.json"),
          ],
        });
        report.steps.push(step);
        await writeJson(path.join(stepLogsDir, "directory-growth-step.json"), step);
      }

      const shouldRunSmoke = !skipSmokes && (
        cycleIndex === 1
        || (Date.now() - lastSmokeAtMs) >= (2 * 60 * 60 * 1000)
      );
      if (shouldRunSmoke) {
        lastSmokeAtMs = Date.now();
        console.log("\n=== Overnight smoke ===");
        const smokeIndex = report.steps.filter((entry) => entry.id === "overnight_smoke").length + 1;
        const step = await runChildStep({
          id: "overnight_smoke",
          label: `Audience/TV/Host smoke ${smokeIndex}`,
          command: process.execPath,
          commandArgs: ["scripts/qa/overnight-audience-tv-host-smoke.mjs"],
        });
        report.steps.push(step);
        await writeJson(path.join(stepLogsDir, `overnight-smoke-${String(smokeIndex).padStart(2, "0")}.json`), step);
      }

      report.generatedAt = nowIso();
      report.elapsedMs = Date.now() - startedMs;
      await writeJson(reportPath, report);
      await writeSummary(report);

      const remainingMs = endMs - Date.now();
      if (remainingMs <= 0) break;
      const sleepMs = Math.min(intervalMinutes * 60 * 1000, remainingMs);
      console.log(`Sleeping for ${Math.round(sleepMs / 60000)} minute(s)...`);
      await delay(sleepMs);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  report.generatedAt = nowIso();
  report.finishedAt = nowIso();
  report.elapsedMs = Date.now() - startedMs;
  report.summary = {
    cycles: report.cycles.length,
    pagesChecked: report.cycles.reduce((sum, cycle) => sum + cycle.pages.length, 0),
    pagesWithIssues: report.cycles.reduce(
      (sum, cycle) => sum + cycle.pages.filter((page) => page.issues?.length).length,
      0
    ),
    steps: report.steps.length,
    stepFailures: report.steps.filter((step) => !step.ok).length,
  };
  await writeJson(reportPath, report);
  await writeSummary(report);
  console.log(`\nOvernight intelligence written to ${outDir}`);
};

run().catch(async (error) => {
  const failure = {
    ok: false,
    generatedAt: nowIso(),
    baseUrl,
    outDir,
    error: String(error?.message || error),
  };
  try {
    await ensureDir(outDir);
    await writeJson(reportPath, failure);
  } catch {
    // Ignore write failure during fatal exit.
  }
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
});
