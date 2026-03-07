#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const DEFAULT_PROJECT_ID = "beaurocks-karaoke-v2";
const DEFAULT_CONFIG = "scripts/ingest/official-host-profiles.json";
const DEFAULT_REPORT = "artifacts/ingest/official_host_profile_seed_report.json";

const usage = `
Usage:
  node scripts/ingest/seed-official-host-profiles.mjs [--dry-run]
  node scripts/ingest/seed-official-host-profiles.mjs --apply

Options:
  --project <id>          Firebase project id (default: ${DEFAULT_PROJECT_ID})
  --config <path>         Curated profile registry JSON (default: ${DEFAULT_CONFIG})
  --report <path>         Output report JSON path (default: ${DEFAULT_REPORT})
  --profiles <ids>        Comma-separated curated profile ids to seed
  --apply                 Write updates to Firestore
  --dry-run               Preview only (default if --apply omitted)
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

const projectId = String(readArg("--project", DEFAULT_PROJECT_ID) || DEFAULT_PROJECT_ID).trim() || DEFAULT_PROJECT_ID;
const configPath = path.resolve(readArg("--config", DEFAULT_CONFIG) || DEFAULT_CONFIG);
const reportPath = path.resolve(readArg("--report", DEFAULT_REPORT) || DEFAULT_REPORT);
const profileFilter = String(readArg("--profiles", ""))
  .split(",")
  .map((entry) => String(entry || "").trim())
  .filter(Boolean);
const apply = hasFlag("--apply") && !hasFlag("--dry-run");
const dryRun = !apply;

const normalizeString = (value = "", max = 200) => String(value || "").trim().slice(0, max);
const normalizeToken = (value = "", max = 80) =>
  normalizeString(value, max)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
const normalizeUrl = (value = "") => {
  const token = String(value || "").trim();
  if (!token) return "";
  if (/^https?:\/\//i.test(token) || token.startsWith("/")) return token;
  return "";
};
const dedupeStrings = (values = []) => {
  const seen = new Set();
  const out = [];
  values.forEach((entry) => {
    const token = String(entry || "").trim();
    if (!token || seen.has(token)) return;
    seen.add(token);
    out.push(token);
  });
  return out;
};

const toJsValue = (field) => {
  if (!field || typeof field !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(field, "nullValue")) return null;
  if (typeof field.stringValue === "string") return field.stringValue;
  if (typeof field.booleanValue === "boolean") return field.booleanValue;
  if (typeof field.integerValue === "string") {
    const parsed = Number(field.integerValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof field.integerValue === "number") return field.integerValue;
  if (typeof field.doubleValue === "number") return field.doubleValue;
  if (typeof field.timestampValue === "string") return field.timestampValue;
  if (field.arrayValue && Array.isArray(field.arrayValue.values)) {
    return field.arrayValue.values.map((entry) => toJsValue(entry));
  }
  if (field.mapValue && field.mapValue.fields && typeof field.mapValue.fields === "object") {
    const out = {};
    Object.entries(field.mapValue.fields).forEach(([key, value]) => {
      out[key] = toJsValue(value);
    });
    return out;
  }
  return null;
};

const toFieldValue = (value) => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { integerValue: "0" };
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => toFieldValue(entry)),
      },
    };
  }
  if (typeof value === "object") {
    const fields = {};
    Object.entries(value).forEach(([key, nested]) => {
      fields[key] = toFieldValue(nested);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
};

const toFirestoreFields = (payload = {}) => {
  const fields = {};
  Object.entries(payload).forEach(([key, value]) => {
    fields[key] = toFieldValue(value);
  });
  return fields;
};

const ensureDirForFile = async (targetPath = "") => {
  if (!targetPath) return;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
};

const loadFirebaseCliToken = async () => {
  const cfgPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  const raw = await fs.readFile(cfgPath, "utf8");
  const parsed = JSON.parse(raw);
  const accessToken = String(parsed?.tokens?.access_token || "").trim();
  if (!accessToken) {
    throw new Error("No firebase-tools access token found. Run `firebase login` first.");
  }
  return accessToken;
};

const callJson = async ({ url = "", method = "GET", accessToken = "", body = null }) => {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${url} failed (${res.status}): ${text.slice(0, 1200)}`);
  }
  return text ? JSON.parse(text) : {};
};

const loadExistingProfile = async ({ accessToken = "", uid = "" }) => {
  const token = normalizeString(uid, 128);
  if (!token) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/directory_profiles/${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (res.status === 404) return null;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GET ${url} failed (${res.status}): ${text.slice(0, 1200)}`);
  }
  const parsed = text ? JSON.parse(text) : {};
  return {
    name: parsed.name || "",
    fields: parsed.fields || {},
    data: Object.fromEntries(
      Object.entries(parsed.fields || {}).map(([key, value]) => [key, toJsValue(value)])
    ),
  };
};

const patchProfile = async ({ accessToken = "", uid = "", payload = {} }) => {
  const token = normalizeString(uid, 128);
  const fieldPaths = Object.keys(payload);
  if (!token || !fieldPaths.length) return;
  const params = new URLSearchParams();
  fieldPaths.forEach((entry) => params.append("updateMask.fieldPaths", entry));
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/directory_profiles/${encodeURIComponent(token)}?${params.toString()}`;
  await callJson({
    url,
    method: "PATCH",
    accessToken,
    body: {
      fields: toFirestoreFields(payload),
    },
  });
};

const buildMergedPayload = ({ curated = {}, existing = null }) => {
  const prior = existing?.data && typeof existing.data === "object" ? existing.data : {};
  const preserve = new Set(Array.isArray(curated.preserveExisting) ? curated.preserveExisting.map((entry) => String(entry || "").trim()) : []);
  const choose = (field, curatedValue, fallbackValue = "") => {
    const existingValue = prior[field];
    if (preserve.has(field)) {
      const token = Array.isArray(existingValue) ? existingValue.length : String(existingValue || "").trim();
      if (token) return existingValue;
    }
    if (curatedValue !== undefined && curatedValue !== null) {
      if (Array.isArray(curatedValue)) return curatedValue;
      if (typeof curatedValue === "object") return curatedValue;
      const token = String(curatedValue).trim();
      if (token) return curatedValue;
    }
    if (existingValue !== undefined && existingValue !== null) return existingValue;
    return fallbackValue;
  };

  const displayName = normalizeString(choose("displayName", curated.displayName, prior.displayName || ""), 120);
  const firstName = normalizeString(choose("firstName", curated.firstName, prior.firstName || ""), 80);
  const lastName = normalizeString(choose("lastName", curated.lastName, prior.lastName || ""), 80);
  const handle = normalizeToken(choose("handle", curated.handle, prior.handle || displayName), 40);
  const roles = dedupeStrings([...(Array.isArray(prior.roles) ? prior.roles : []), ...(Array.isArray(curated.roles) ? curated.roles : [])]);
  const socialLinks = {
    instagram: normalizeUrl(curated?.socialLinks?.instagram || prior?.socialLinks?.instagram || ""),
    tiktok: normalizeUrl(curated?.socialLinks?.tiktok || prior?.socialLinks?.tiktok || ""),
    spotify: normalizeUrl(curated?.socialLinks?.spotify || prior?.socialLinks?.spotify || ""),
    website: normalizeUrl(curated?.socialLinks?.website || prior?.socialLinks?.website || ""),
  };
  const imageUrls = dedupeStrings([
    ...(Array.isArray(curated.imageUrls) ? curated.imageUrls : []),
    ...(Array.isArray(prior.imageUrls) ? prior.imageUrls : []),
  ].map((entry) => normalizeUrl(entry)).filter(Boolean));
  const galleryUrls = dedupeStrings([
    ...(Array.isArray(curated.galleryUrls) ? curated.galleryUrls : []),
    ...(Array.isArray(prior.galleryUrls) ? prior.galleryUrls : []),
    ...imageUrls,
  ].map((entry) => normalizeUrl(entry)).filter(Boolean));
  const avatarUrl = normalizeUrl(choose("avatarUrl", curated.avatarUrl, prior.avatarUrl || ""));
  const photoUrl = normalizeUrl(curated.photoUrl || prior.photoUrl || avatarUrl || imageUrls[0] || "");
  const now = new Date();

  const payload = {
    uid: normalizeString(curated.uid || prior.uid || "", 128),
    displayName,
    firstName,
    lastName,
    handle,
    bio: normalizeString(choose("bio", curated.bio, prior.bio || ""), 500),
    city: normalizeString(choose("city", curated.city, prior.city || ""), 80),
    state: normalizeString(choose("state", curated.state, prior.state || ""), 40),
    country: normalizeString(choose("country", curated.country, prior.country || "US"), 2).toUpperCase(),
    visibility: normalizeString(choose("visibility", curated.visibility, prior.visibility || "public"), 20).toLowerCase(),
    status: normalizeString(choose("status", curated.status, prior.status || "approved"), 20).toLowerCase(),
    roles,
    avatarUrl,
    photoUrl,
    heroImageUrl: normalizeUrl(curated.heroImageUrl || prior.heroImageUrl || imageUrls[0] || ""),
    coverImageUrl: normalizeUrl(curated.coverImageUrl || prior.coverImageUrl || imageUrls[1] || imageUrls[0] || ""),
    imageUrls,
    galleryUrls,
    socialLinks,
    sourceType: "curated_host_seed",
    curatedProfileId: normalizeToken(curated.id || handle || displayName, 80),
    curatedProfileUpdatedAt: now,
    updatedAt: now,
  };

  if (!prior.createdAt) {
    payload.createdAt = now;
  }

  if (prior.hostRoomCodes && Array.isArray(prior.hostRoomCodes) && preserve.has("hostRoomCodes")) {
    payload.hostRoomCodes = dedupeStrings(prior.hostRoomCodes);
  }

  ["vipLevel", "fameLevel", "totalFamePoints", "sourceUserUpdatedAtMs"].forEach((field) => {
    if (preserve.has(field) && Number.isFinite(Number(prior[field]))) {
      payload[field] = Number(prior[field]) || 0;
    }
  });

  return payload;
};

const summarizeDiff = ({ payload = {}, existing = null }) => {
  const prior = existing?.data && typeof existing.data === "object" ? existing.data : {};
  const changed = [];
  Object.entries(payload).forEach(([key, value]) => {
    if (key === "updatedAt" || key === "curatedProfileUpdatedAt") {
      changed.push(key);
      return;
    }
    const before = JSON.stringify(prior[key] ?? null);
    const after = JSON.stringify(value ?? null);
    if (before !== after) changed.push(key);
  });
  return changed;
};

const run = async () => {
  const rawConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
  const profiles = Array.isArray(rawConfig?.profiles) ? rawConfig.profiles : [];
  const selected = profileFilter.length
    ? profiles.filter((entry) => profileFilter.includes(String(entry?.id || "").trim()))
    : profiles;
  if (!selected.length) {
    throw new Error("No curated host profiles selected.");
  }

  const accessToken = await loadFirebaseCliToken();
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun,
    apply,
    projectId,
    configPath,
    selectedProfiles: selected.length,
    items: [],
  };

  for (const curated of selected) {
    const uid = normalizeString(curated?.uid || "", 128);
    if (!uid) {
      report.items.push({
        id: curated?.id || "",
        uid: "",
        ok: false,
        error: "Missing uid in curated profile config.",
      });
      continue;
    }
    try {
      const existing = await loadExistingProfile({ accessToken, uid });
      const payload = buildMergedPayload({ curated, existing });
      const changedFields = summarizeDiff({ payload, existing });
      report.items.push({
        id: curated?.id || uid,
        uid,
        ok: true,
        existed: !!existing,
        changedFields,
        preview: {
          displayName: payload.displayName,
          handle: payload.handle,
          city: payload.city,
          state: payload.state,
          roles: payload.roles,
          heroImageUrl: payload.heroImageUrl,
          avatarUrl: payload.avatarUrl,
        },
      });
      if (!dryRun && changedFields.length) {
        await patchProfile({ accessToken, uid, payload });
      }
    } catch (error) {
      report.items.push({
        id: curated?.id || uid,
        uid,
        ok: false,
        error: String(error?.message || error),
      });
    }
  }

  await ensureDirForFile(reportPath);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const okCount = report.items.filter((entry) => entry.ok).length;
  const errorCount = report.items.length - okCount;
  console.log(JSON.stringify({
    dryRun,
    apply,
    projectId,
    selectedProfiles: report.selectedProfiles,
    ok: okCount,
    errors: errorCount,
    reportPath,
  }, null, 2));
  report.items.forEach((entry) => {
    if (!entry.ok) {
      console.log(`ERROR ${entry.id || entry.uid}: ${entry.error}`);
      return;
    }
    console.log(`${dryRun ? "PREVIEW" : "SEEDED"} ${entry.id}: ${entry.preview.displayName} (${entry.preview.handle}) -> ${entry.changedFields.join(", ") || "no changes"}`);
  });

  if (errorCount) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
