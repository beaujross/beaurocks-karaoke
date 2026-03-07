#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const DEFAULT_REPORT = "artifacts/ops/overnight_directory_growth_report.json";
const DEFAULT_PHOTO_LIMIT = "250";
const DEFAULT_MAX_PHOTOS = "4";

const usage = `
Usage:
  node scripts/ops/overnight-directory-growth.mjs
  node scripts/ops/overnight-directory-growth.mjs --apply

Options:
  --apply                  Apply mutating ingest steps instead of dry-run previews
  --report <path>          Output report JSON path (default: ${DEFAULT_REPORT})
  --skip-qa                Skip overnight QA smoke
  --skip-host-profiles     Skip curated host profile seed step
  --skip-seattle           Skip Seattle/Tacoma seed refresh step
  --skip-venue-photos      Skip venue photo backfill step
  --photo-limit <n>        Venue scan limit for photo backfill (default: ${DEFAULT_PHOTO_LIMIT})
  --max-photos <n>         Max venue photos to persist (default: ${DEFAULT_MAX_PHOTOS})
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

const apply = hasFlag("--apply");
const reportPath = path.resolve(readArg("--report", DEFAULT_REPORT) || DEFAULT_REPORT);
const photoLimit = String(readArg("--photo-limit", DEFAULT_PHOTO_LIMIT) || DEFAULT_PHOTO_LIMIT).trim() || DEFAULT_PHOTO_LIMIT;
const maxPhotos = String(readArg("--max-photos", DEFAULT_MAX_PHOTOS) || DEFAULT_MAX_PHOTOS).trim() || DEFAULT_MAX_PHOTOS;
const skipQa = hasFlag("--skip-qa");
const skipHostProfiles = hasFlag("--skip-host-profiles");
const skipSeattle = hasFlag("--skip-seattle");
const skipVenuePhotos = hasFlag("--skip-venue-photos");

const ensureDirForFile = async (targetPath = "") => {
  if (!targetPath) return;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
};

const runStep = async ({ id = "", label = "", command = "", commandArgs = [] }) => {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  return await new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      shell: false,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = String(chunk || "");
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk || "");
      stderr += text;
      process.stderr.write(text);
    });

    child.on("error", (error) => {
      resolve({
        id,
        label,
        ok: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        exitCode: -1,
        stdoutTail: stdout.trim().split(/\r?\n/).slice(-40),
        stderrTail: [...stderr.trim().split(/\r?\n/).slice(-40), String(error?.message || error)],
      });
    });

    child.on("close", (code) => {
      resolve({
        id,
        label,
        ok: code === 0,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        exitCode: Number(code ?? -1),
        stdoutTail: stdout.trim().split(/\r?\n/).filter(Boolean).slice(-40),
        stderrTail: stderr.trim().split(/\r?\n/).filter(Boolean).slice(-40),
      });
    });
  });
};

const steps = [];
if (!skipQa) {
  steps.push({
    id: "qa_overnight_smoke",
    label: "QA overnight smoke",
    command: process.execPath,
    commandArgs: ["scripts/qa/overnight-audience-tv-host-smoke.mjs"],
  });
}
if (!skipHostProfiles) {
  steps.push({
    id: "seed_official_host_profiles",
    label: "Seed curated official host profiles",
    command: process.execPath,
    commandArgs: [
      "scripts/ingest/seed-official-host-profiles.mjs",
      ...(apply ? ["--apply"] : ["--dry-run"]),
    ],
  });
}
if (!skipSeattle) {
  steps.push({
    id: "seed_seattle_tacoma_regions",
    label: "Refresh Seattle/Tacoma region seeds",
    command: process.execPath,
    commandArgs: [
      "scripts/ingest/scrape-seattle-tacoma-sources.mjs",
      ...(apply ? ["--apply"] : ["--dry-run"]),
    ],
  });
}
if (!skipVenuePhotos) {
  steps.push({
    id: "backfill_venue_featured_images",
    label: "Backfill venue featured images",
    command: process.execPath,
    commandArgs: [
      "scripts/ingest/backfill-venue-featured-images.mjs",
      ...(apply ? ["--apply"] : ["--dry-run"]),
      "--limit",
      photoLimit,
      "--max-photos",
      maxPhotos,
    ],
  });
}

if (!steps.length) {
  console.error("No overnight steps selected.");
  process.exit(1);
}

const report = {
  generatedAt: new Date().toISOString(),
  apply,
  cwd: process.cwd(),
  steps: [],
};

for (const step of steps) {
  console.log(`\n=== ${step.label} ===`);
  const result = await runStep(step);
  report.steps.push(result);
}

report.summary = {
  total: report.steps.length,
  passed: report.steps.filter((entry) => entry.ok).length,
  failed: report.steps.filter((entry) => !entry.ok).length,
};

await ensureDirForFile(reportPath);
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`\nOvernight report written to ${reportPath}`);
if (report.summary.failed > 0) {
  process.exitCode = 1;
}
