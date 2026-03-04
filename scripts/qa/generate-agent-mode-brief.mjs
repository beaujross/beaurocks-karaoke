import fs from "node:fs";
import path from "node:path";

const DEFAULT_ROOT_URL = "https://beaurocks.app";
const OUTPUT_PATH = "tmp/qa-agent-mode-brief.md";

const deriveSurfaceOriginFromRoot = (rootUrl = "", surface = "app") => {
  try {
    const parsed = new URL(String(rootUrl || "").trim());
    const protocol = parsed.protocol || "https:";
    const hostname = String(parsed.hostname || "").trim().toLowerCase();
    const portPart = parsed.port ? `:${parsed.port}` : "";

    if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname || "localhost"}${portPart}`;
    }

    const labels = hostname.split(".");
    const knownSurface = new Set(["app", "host", "tv", "www"]);
    let domainLabels = labels;
    if (knownSurface.has(labels[0])) {
      domainLabels = labels.slice(1);
    }
    if (!domainLabels.length) {
      return `${protocol}//${hostname}${portPart}`;
    }
    return `${protocol}//${surface}.${domainLabels.join(".")}${portPart}`;
  } catch {
    return "";
  }
};

const rootUrl = process.env.QA_ROOT_URL || process.env.QA_BASE_URL || DEFAULT_ROOT_URL;
const hostOrigin = process.env.QA_HOST_ORIGIN || deriveSurfaceOriginFromRoot(rootUrl, "host");
const appOrigin = process.env.QA_AUDIENCE_ORIGIN || deriveSurfaceOriginFromRoot(rootUrl, "app");
const tvOrigin = process.env.QA_TV_ORIGIN || deriveSurfaceOriginFromRoot(rootUrl, "tv");
const hostUrl =
  process.env.QA_HOST_URL ||
  `${hostOrigin}/?mode=host&hostUiVersion=v2&view=ops&section=ops.room_setup&tab=admin`;
const hostAccessUrl = process.env.QA_HOST_ACCESS_URL || `${String(rootUrl || "").replace(/\/+$/, "")}/host-access`;

const hostEmail = String(process.env.QA_HOST_EMAIL || "").trim();
const hostPasswordProvided = String(process.env.QA_HOST_PASSWORD || "").trim().length > 0;

const nowIso = new Date().toISOString();

const content = `# Agent Mode Exploratory QA Brief

Generated: ${nowIso}

## Mission
Find broken behavior, UX blockers, and cross-surface sync bugs in the host "hands-off" flow.
Use exploratory browsing (not just scripted replay) and report concrete reproducible defects.

## Environment
- Root site: ${rootUrl}
- Host access (login): ${hostAccessUrl}
- Host surface: ${hostUrl}
- Audience surface: ${appOrigin}
- TV surface: ${tvOrigin}

## Credentials
- Host email: ${hostEmail || "[MISSING: set QA_HOST_EMAIL]"}
- Host password: ${hostPasswordProvided ? "[PROVIDED via env]" : "[MISSING: set QA_HOST_PASSWORD]"}
- Use a dedicated low-privilege QA host account (not super-admin).

## Required Golden Path To Explore
1. Log in as host from root-domain host-access page.
2. Create a new room.
3. Turn automations on (auto-play, auto BG, auto DJ queue, auto lyrics if available).
4. Open public TV and verify join QR + room visibility.
5. Join as audience from QR/join URL.
6. Submit a song as host and verify host + TV update.
7. Submit a song as audience and verify host + TV update.
8. Try small perturbations: refresh one surface, open new tab, brief network hiccup, repeat request.

## What To Flag As High Severity
- Login succeeds but host cannot create/open room.
- Host queue and TV queue diverge.
- Audience request accepted but missing on host/TV.
- Room code/join URL mismatch across surfaces.
- Any crash, blank screen, spinner deadlock, or hard permission error in golden path.

## Evidence Rules
- Include direct URL for every issue.
- Include exact repro steps with minimal ambiguity.
- Include expected vs actual behavior.
- Include console/network error text if visible.
- Include screenshot file names if available.

## Output Format (strict)
Return findings in this table:

| Severity | Title | Surface | URL | Repro Steps | Expected | Actual | Evidence |
|---|---|---|---|---|---|---|---|

Then include:
1. "Blocked paths" section.
2. "No issue found" section for paths you validated cleanly.
3. "Top 3 fixes by impact" section.
`;

const absoluteOutput = path.resolve(process.cwd(), OUTPUT_PATH);
fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
fs.writeFileSync(absoluteOutput, content, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      outputPath: absoluteOutput,
      rootUrl,
      hostAccessUrl,
      hostUrl,
      appOrigin,
      tvOrigin,
      hostEmailConfigured: Boolean(hostEmail),
      hostPasswordConfigured: hostPasswordProvided,
      timestamp: nowIso,
    },
    null,
    2
  )
);
