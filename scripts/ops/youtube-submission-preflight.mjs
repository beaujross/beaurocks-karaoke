import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIVE = process.argv.includes("--live");
const STRICT = process.argv.includes("--strict");
const CURRENT_HOSTING_RELEASE = "1784078708909000";
const CURRENT_HOSTING_VERSION = "5bc48c15cd873eac";

const checks = [];
const humanBlockers = [];

const record = (name, pass, detail) => {
  checks.push({ name, pass: pass === true, detail });
};

const readRepoFile = async (relativePath) => fs.readFile(path.join(ROOT, relativePath), "utf8");

const verifyArtifact = async (relativePath, minimumBytes = 1) => {
  try {
    const stat = await fs.stat(path.join(ROOT, relativePath));
    const pass = stat.isFile() && stat.size >= minimumBytes;
    record(`artifact:${relativePath}`, pass, pass ? `${stat.size} bytes` : "missing or empty");
    return pass;
  } catch {
    record(`artifact:${relativePath}`, false, "missing");
    return false;
  }
};

const verifyText = async (relativePath, expectedValues) => {
  try {
    const text = await readRepoFile(relativePath);
    const missing = expectedValues.filter((value) => !text.includes(value));
    record(
      `content:${relativePath}`,
      missing.length === 0,
      missing.length ? `missing: ${missing.join(", ")}` : "required release and quota language present",
    );
  } catch {
    record(`content:${relativePath}`, false, "unreadable");
  }
};

const legalEvidence = [
  "desktop-terms.png",
  "desktop-privacy.png",
  "desktop-data-deletion.png",
  "mobile-terms.png",
  "mobile-privacy.png",
  "mobile-data-deletion.png",
].map((name) => `docs/compliance/evidence/2026-07-06-youtube-audit/${name}`);

const productEvidence = [
  "host-youtube-add-panel.png",
  "host-room-library-curator.png",
  "audience-youtube-search.png",
  "audience-youtube-url-paste.png",
  "tv-youtube-performance.png",
  "tv-apple-background.png",
].map((name) => `docs/compliance/evidence/2026-07-06-youtube-product-audit/${name}`);

const liveEvidence = [
  "google-cloud-youtube-assigned-quotas.json",
  "google-cloud-youtube-assigned-quotas.md",
  "quota-exhaustion-fallback.png",
  "quota-exhaustion-fallback.md",
  "room-permanent-delete-confirmation.png",
  "room-permanent-delete-success.png",
  "room-permanent-delete-evidence.md",
].map((name) => `docs/compliance/evidence/2026-07-06-youtube-live-evidence/${name}`);

for (const artifact of [...legalEvidence, ...productEvidence, ...liveEvidence]) {
  await verifyArtifact(artifact, artifact.endsWith(".png") ? 10_000 : 100);
}

await verifyArtifact("docs/compliance/evidence/2026-07-06-youtube-audit/manifest.json", 500);
await verifyArtifact("docs/compliance/evidence/2026-07-06-youtube-product-audit/manifest.json", 500);
await verifyArtifact("docs/compliance/evidence/2026-07-06-youtube-live-evidence/manifest.md", 500);

await verifyText("docs/compliance/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md", [
  CURRENT_HOSTING_RELEASE,
  CURRENT_HOSTING_VERSION,
  "1,000 Search Queries/day",
  "search.list",
  "videos.list",
  "playlistItems.list",
]);
await verifyText("docs/compliance/YOUTUBE_QUOTA_EXTENSION_PACKET_2026-07-06.md", [
  CURRENT_HOSTING_RELEASE,
  CURRENT_HOSTING_VERSION,
  "1,000 Search Queries calls/day",
  "100 Search Queries/day",
  "10,000",
]);

const functionsSource = await readRepoFile("functions/index.js");
for (const [method, endpoint] of [
  ["search.list", "/youtube/v3/search"],
  ["videos.list", "/youtube/v3/videos"],
  ["playlistItems.list", "/youtube/v3/playlistItems"],
]) {
  record(`method:${method}`, functionsSource.includes(endpoint), endpoint);
}

const lifecycleSource = await readRepoFile("functions/lib/youtubeIndexMaintenance.js");
record(
  "retention:temporary_room_index",
  lifecycleSource.includes("const YOUTUBE_INDEX_RETENTION_MS = 30 * DAY_MS;")
    && lifecycleSource.includes("lastValidatedAtMs + YOUTUBE_INDEX_RETENTION_MS"),
  "30-day retention constant remains wired in server maintenance",
);

if (LIVE) {
  for (const url of [
    "https://beaurocks.app/karaoke/terms",
    "https://beaurocks.app/karaoke/privacy",
    "https://beaurocks.app/karaoke/data-deletion",
  ]) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
      record(`live:${url}`, response.ok, `HTTP ${response.status}`);
    } catch (error) {
      record(`live:${url}`, false, String(error?.message || error));
    }
  }
}

const consoleScreenshot = "docs/compliance/evidence/2026-07-06-youtube-live-evidence/google-cloud-youtube-quotas.png";
if (!(await verifyArtifact(consoleScreenshot, 10_000))) {
  humanBlockers.push({
    id: "console_quota_screenshot",
    action: "Capture the live Google Cloud YouTube Data API Quotas page at the documented filename.",
  });
}

if (process.env.YOUTUBE_AUDIT_CONTACT_CONFIRMED !== "1") {
  humanBlockers.push({
    id: "contact_confirmation",
    action: "Confirm hello@beaurocks.app as the audit/legal contact, then set YOUTUBE_AUDIT_CONTACT_CONFIRMED=1 for the strict run.",
  });
}
if (process.env.YOUTUBE_AUDIT_LEGAL_IDENTITY_CONFIRMED !== "1") {
  humanBlockers.push({
    id: "legal_identity_confirmation",
    action: "Confirm the final legal operator and product naming, then set YOUTUBE_AUDIT_LEGAL_IDENTITY_CONFIRMED=1 for the strict run.",
  });
}
if (String(process.env.YOUTUBE_SEARCH_QUOTA_REQUEST_APPROVED || "") !== "1000") {
  humanBlockers.push({
    id: "request_amount_approval",
    action: "Approve 1,000 Search Queries/day, then set YOUTUBE_SEARCH_QUOTA_REQUEST_APPROVED=1000 for the strict run.",
  });
}

const technicalFailures = checks.filter((item) => !item.pass && item.name !== `artifact:${consoleScreenshot}`);
const result = {
  ok: technicalFailures.length === 0 && humanBlockers.length === 0,
  technicalReady: technicalFailures.length === 0,
  submissionReady: technicalFailures.length === 0 && humanBlockers.length === 0,
  liveChecksEnabled: LIVE,
  currentRelease: {
    hostingRelease: CURRENT_HOSTING_RELEASE,
    hostingVersion: CURRENT_HOSTING_VERSION,
  },
  technicalFailureCount: technicalFailures.length,
  humanBlockerCount: humanBlockers.length,
  humanBlockers,
  checks,
  timestamp: new Date().toISOString(),
};

console.log(JSON.stringify(result, null, 2));

if (technicalFailures.length > 0) process.exitCode = 1;
else if (STRICT && humanBlockers.length > 0) process.exitCode = 2;
