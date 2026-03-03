#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const DEFAULT_PROJECT_ID = "beaurocks-karaoke-v2";
const WRITE_BATCH_SIZE = 120;

const usage = `
Usage:
  node scripts/ingest/backfill-venue-featured-images.mjs [--dry-run]
  node scripts/ingest/backfill-venue-featured-images.mjs --apply
  node scripts/ingest/backfill-venue-featured-images.mjs --apply --overwrite

Options:
  --project <id>       Firebase project id (default: ${DEFAULT_PROJECT_ID})
  --limit <n>          Max approved venues to scan (default: 500, max: 2000)
  --max-photos <n>     Max photo URLs to persist per venue (default: 3, max: 6)
  --overwrite          Replace existing featured image fields.
  --dry-run            Preview only (default mode if --apply is omitted).
  --apply              Write updates to Firestore.
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

const projectId = readArg("--project", DEFAULT_PROJECT_ID).trim() || DEFAULT_PROJECT_ID;
const limitRaw = Number(readArg("--limit", "500"));
const scanLimit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 2000) : 500;
const maxPhotosRaw = Number(readArg("--max-photos", "3"));
const maxPhotos = Number.isFinite(maxPhotosRaw) && maxPhotosRaw > 0 ? Math.min(Math.floor(maxPhotosRaw), 6) : 3;
const apply = hasFlag("--apply");
const dryRun = !apply || hasFlag("--dry-run");
const overwrite = hasFlag("--overwrite");

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const readString = (field) => {
  if (!field || typeof field !== "object") return "";
  if (typeof field.stringValue === "string") return field.stringValue.trim();
  return "";
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

const chunk = (entries = [], size = WRITE_BATCH_SIZE) => {
  const out = [];
  for (let i = 0; i < entries.length; i += size) {
    out.push(entries.slice(i, i + size));
  }
  return out;
};

const normalizeUrl = (value = "") => {
  const token = String(value || "").trim();
  if (!token) return "";
  if (/^https?:\/\//i.test(token)) {
    return token.replace(/^http:\/\//i, "https://");
  }
  if (token.startsWith("//")) return `https:${token}`;
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

const runFirestoreQuery = async ({ projectId: activeProjectId, accessToken = "", structuredQuery = {} }) =>
  callJson({
    url: `https://firestore.googleapis.com/v1/projects/${activeProjectId}/databases/(default)/documents:runQuery`,
    method: "POST",
    accessToken,
    body: { structuredQuery },
  });

const commitWrites = async ({ projectId: activeProjectId, accessToken = "", writes = [] }) => {
  if (!writes.length) return;
  await callJson({
    url: `https://firestore.googleapis.com/v1/projects/${activeProjectId}/databases/(default)/documents:commit`,
    method: "POST",
    accessToken,
    body: { writes },
  });
};

const loadApprovedVenues = async ({ projectId: activeProjectId, accessToken = "", limit = 500 }) => {
  const rows = await runFirestoreQuery({
    projectId: activeProjectId,
    accessToken,
    structuredQuery: {
      from: [{ collectionId: "venues" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "status" },
          op: "EQUAL",
          value: { stringValue: "approved" },
        },
      },
      limit,
    },
  });

  const venues = [];
  rows.forEach((row) => {
    const doc = row?.document;
    if (!doc) return;
    const fields = doc.fields || {};
    const id = String(doc.name || "").split("/").pop() || "";
    if (!id) return;
    const imageCandidates = dedupeStrings([
      readString(fields.heroImageUrl),
      readString(fields.coverImageUrl),
      readString(fields.imageUrl),
      readString(fields.photoUrl),
      ...(Array.isArray(fields.imageUrls?.arrayValue?.values)
        ? fields.imageUrls.arrayValue.values.map((entry) => String(entry?.stringValue || "").trim())
        : []),
    ]);
    venues.push({
      id,
      docName: String(doc.name || ""),
      title: readString(fields.title),
      city: readString(fields.city),
      state: readString(fields.state) || "WA",
      address1: readString(fields.address1),
      imageCandidates,
      externalSources: toJsValue(fields.externalSources) || {},
    });
  });
  return venues.sort((a, b) => `${a.city}|${a.title}`.localeCompare(`${b.city}|${b.title}`));
};

const lookupGooglePlace = async ({ projectId: activeProjectId, accessToken = "", venue = {} }) => {
  const query = [
    venue.title,
    venue.address1,
    venue.city,
    venue.state,
    "USA",
  ]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .join(", ");
  if (!query) return null;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-goog-user-project": activeProjectId,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.photos.name",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 5,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const results = Array.isArray(data?.places) ? data.places : [];
  if (!results.length) return null;
  const preferred = results.find((entry) => Array.isArray(entry?.photos) && entry.photos.length) || results[0];
  if (!preferred) return null;
  const photoNames = dedupeStrings(
    (Array.isArray(preferred?.photos) ? preferred.photos : [])
      .map((photo) => String(photo?.name || "").trim())
      .filter(Boolean)
  );
  const lat = Number(preferred?.location?.latitude);
  const lng = Number(preferred?.location?.longitude);
  return {
    placeId: String(preferred?.id || "").trim(),
    name: String(preferred?.displayName?.text || "").trim(),
    address: String(preferred?.formattedAddress || "").trim(),
    rating: Number(preferred?.rating || 0) || 0,
    reviewCount: Number(preferred?.userRatingCount || 0) || 0,
    location: Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }
      : null,
    photoNames,
  };
};

const resolveGooglePhotoUrl = async ({ projectId: activeProjectId, accessToken = "", photoName = "" }) => {
  const name = String(photoName || "").trim();
  if (!name) return "";
  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=1600&skipHttpRedirect=true`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-goog-user-project": activeProjectId,
        "X-Goog-FieldMask": "name,photoUri",
      },
    });
    if (!res.ok) return "";
    const data = await res.json().catch(() => null);
    return normalizeUrl(data?.photoUri || "");
  } catch {
    return "";
  }
};

const buildUpdateWrite = ({ venue = {}, payload = {} }) => ({
  update: {
    name: venue.docName,
    fields: toFirestoreFields(payload),
  },
  updateMask: {
    fieldPaths: [
      "heroImageUrl",
      "coverImageUrl",
      "imageUrl",
      "photoUrl",
      "imageUrls",
      "photos",
      "externalSources",
      "updatedAt",
      "updatedBy",
    ],
  },
  currentDocument: { exists: true },
});

const run = async () => {
  const accessToken = await loadFirebaseCliToken();

  const venues = await loadApprovedVenues({
    projectId,
    accessToken,
    limit: scanLimit,
  });
  if (!venues.length) {
    console.log("No approved venues found.");
    return;
  }

  const writes = [];
  const stats = {
    scanned: venues.length,
    queuedUpdates: 0,
    skippedExistingImage: 0,
    skippedNoLookup: 0,
    skippedNoPhoto: 0,
    previewLogged: 0,
  };

  for (const venue of venues) {
    const hasExistingFeaturedImage = venue.imageCandidates.length > 0;
    if (hasExistingFeaturedImage && !overwrite) {
      stats.skippedExistingImage += 1;
      continue;
    }

    const lookup = await lookupGooglePlace({
      projectId,
      accessToken,
      venue,
    });
    if (!lookup) {
      stats.skippedNoLookup += 1;
      await sleep(120);
      continue;
    }
    const photoNames = dedupeStrings(lookup.photoNames).slice(0, Math.max(1, maxPhotos));
    if (!photoNames.length) {
      stats.skippedNoPhoto += 1;
      await sleep(120);
      continue;
    }
    const resolvedUrls = [];
    for (const photoName of photoNames) {
      const resolved = await resolveGooglePhotoUrl({
        projectId,
        accessToken,
        photoName,
      });
      if (resolved) resolvedUrls.push(resolved);
      await sleep(90);
    }
    const photoUrls = dedupeStrings(resolvedUrls).slice(0, Math.max(1, maxPhotos));
    if (!photoUrls.length) {
      stats.skippedNoPhoto += 1;
      await sleep(120);
      continue;
    }

    const existingExternal = venue.externalSources && typeof venue.externalSources === "object"
      ? venue.externalSources
      : {};
    const existingGoogle = existingExternal.google && typeof existingExternal.google === "object"
      ? existingExternal.google
      : {};
    const nextGoogle = {
      ...existingGoogle,
      placeId: String(existingGoogle.placeId || lookup.placeId || "").trim(),
      mapsUrl: String(existingGoogle.mapsUrl || "").trim()
        || (lookup.placeId
          ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(String(lookup.placeId))}`
          : ""),
      address: String(lookup.address || existingGoogle.address || "").trim(),
      rating: Number(lookup.rating || existingGoogle.rating || 0) || 0,
      reviewCount: Number(lookup.reviewCount || existingGoogle.reviewCount || 0) || 0,
      photoRef: String(existingGoogle.photoRef || "").trim(),
      photoRefs: Array.isArray(existingGoogle.photoRefs) ? existingGoogle.photoRefs : [],
      photoUrl: photoUrls[0],
      photoUrls,
      imageUrl: photoUrls[0],
      refreshedAtMs: Date.now(),
    };
    const nextExternal = {
      ...existingExternal,
      google: nextGoogle,
    };
    const payload = {
      heroImageUrl: photoUrls[0],
      coverImageUrl: photoUrls[0],
      imageUrl: photoUrls[0],
      photoUrl: photoUrls[0],
      imageUrls: photoUrls,
      photos: photoUrls,
      externalSources: nextExternal,
      updatedAt: new Date(),
      updatedBy: "script_backfill_venue_featured_images",
    };
    writes.push(buildUpdateWrite({ venue, payload }));
    stats.queuedUpdates += 1;

    if (stats.previewLogged < 5) {
      stats.previewLogged += 1;
      console.log(
        JSON.stringify(
          {
            venueId: venue.id,
            title: venue.title,
            city: venue.city,
            featuredImage: photoUrls[0],
            photoCount: photoUrls.length,
          },
          null,
          2
        )
      );
    }
    await sleep(120);
  }

  console.log(
    JSON.stringify(
      {
        projectId,
        dryRun,
        overwrite,
        maxPhotos,
        ...stats,
      },
      null,
      2
    )
  );

  if (dryRun) {
    console.log("Dry run complete. Re-run with --apply to write updates.");
    return;
  }

  const groups = chunk(writes, WRITE_BATCH_SIZE);
  for (let i = 0; i < groups.length; i += 1) {
    await commitWrites({ projectId, accessToken, writes: groups[i] });
    console.log(`Committed batch ${i + 1}/${groups.length} (${groups[i].length} writes).`);
  }
  console.log("Venue featured-image backfill complete.");
};

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
