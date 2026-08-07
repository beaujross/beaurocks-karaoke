import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIVE = process.argv.includes("--live");
const STRICT = process.argv.includes("--strict");
const EVIDENCE_HOSTING_RELEASE = "1784078708909000";
const EVIDENCE_HOSTING_VERSION = "5bc48c15cd873eac";
const CURRENT_PRODUCTION_APP_COMMIT = "4a9030a";

const checks = [];
const humanBlockers = [];
const humanArtifactCheckNames = new Set();

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
  EVIDENCE_HOSTING_RELEASE,
  EVIDENCE_HOSTING_VERSION,
  CURRENT_PRODUCTION_APP_COMMIT,
  "5,000 Search Queries/day",
  "search.list",
  "videos.list",
  "playlistItems.list",
]);
await verifyText("docs/compliance/YOUTUBE_QUOTA_EXTENSION_PACKET_2026-07-06.md", [
  EVIDENCE_HOSTING_RELEASE,
  EVIDENCE_HOSTING_VERSION,
  CURRENT_PRODUCTION_APP_COMMIT,
  "5,000 Search Queries calls/day",
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

const presentationCaptures = [
  {
    id: "console_quota_screenshot",
    path: "docs/compliance/evidence/2026-07-15-youtube-form/01-google-cloud-youtube-quotas-address-bar.png",
    action: "Capture the live Google Cloud YouTube Data API Quotas page with the address bar visible.",
  },
  {
    id: "privacy_screenshot",
    path: "docs/compliance/evidence/2026-07-15-youtube-form/02-privacy-policy-address-bar.png",
    action: "Capture the production Privacy Policy with the address bar and YouTube/Google disclosures visible.",
  },
  {
    id: "policy_context_screenshot",
    path: "docs/compliance/evidence/2026-07-15-youtube-form/03-host-youtube-policy-links-address-bar.png",
    action: "Capture the production Host YouTube policy-link context with the address bar visible.",
  },
  {
    id: "terms_screenshot",
    path: "docs/compliance/evidence/2026-07-15-youtube-form/04-terms-address-bar.png",
    action: "Capture the production Terms page with the address bar and YouTube policy links visible.",
  },
  {
    id: "player_screenshot",
    path: "docs/compliance/evidence/2026-07-15-youtube-form/05-youtube-player-address-bar.png",
    action: "Capture the production YouTube player/embed context with the address bar visible.",
  },
];
for (const capture of presentationCaptures) {
  const checkName = `artifact:${capture.path}`;
  humanArtifactCheckNames.add(checkName);
  if (!(await verifyArtifact(capture.path, 10_000))) {
    humanBlockers.push({ id: capture.id, action: capture.action });
  }
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
if (String(process.env.YOUTUBE_SEARCH_QUOTA_REQUEST_APPROVED || "") !== "5000") {
  humanBlockers.push({
    id: "request_amount_approval",
    action: "Approve 5,000 Search Queries/day with a 120/minute peak, then set YOUTUBE_SEARCH_QUOTA_REQUEST_APPROVED=5000 for the strict run.",
  });
}

const technicalFailures = checks.filter((item) => !item.pass && !humanArtifactCheckNames.has(item.name));
const result = {
  ok: technicalFailures.length === 0 && humanBlockers.length === 0,
  technicalReady: technicalFailures.length === 0,
  submissionReady: technicalFailures.length === 0 && humanBlockers.length === 0,
  liveChecksEnabled: LIVE,
  productionBaseline: {
    appCommit: CURRENT_PRODUCTION_APP_COMMIT,
    evidenceHostingRelease: EVIDENCE_HOSTING_RELEASE,
    evidenceHostingVersion: EVIDENCE_HOSTING_VERSION,
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
