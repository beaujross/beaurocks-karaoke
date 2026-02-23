#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const PROJECT_ID = "beaurocks-karaoke-v2";
const ALLOW_OUTSIDE_COUNTY_FLAG = "--allow-outside-county";
const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const usage = `
Usage:
  node scripts/ingest/seed-kitsap-directory-rest.mjs --file C:\\path\\kitsap_karaoke_schedule.csv [--dry-run]
  node scripts/ingest/seed-kitsap-directory-rest.mjs --file C:\\path\\kitsap_karaoke_schedule.csv [--dry-run] --allow-outside-county

Notes:
  - Writes approved docs into venues and karaoke_events.
  - Enforces Kitsap-only cities by default (disable with --allow-outside-county).
  - Uses firebase-tools CLI OAuth token from ~/.config/configstore/firebase-tools.json.
`;

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readArg = (flag) => {
  const idx = args.indexOf(flag);
  if (idx < 0) return "";
  return args[idx + 1] || "";
};

if (hasFlag("--help")) {
  console.log(usage.trim());
  process.exit(0);
}

const inputFile = readArg("--file");
const dryRun = hasFlag("--dry-run");
const allowOutsideCounty = hasFlag(ALLOW_OUTSIDE_COUNTY_FLAG);

if (!inputFile) {
  console.error("Missing --file argument.");
  console.error(usage.trim());
  process.exit(1);
}

const normalize = (value = "") =>
  String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/â€“/g, "-")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/Ã¥/g, "a")
    .replace(/SkÃ¥l/g, "Skal")
    .replace(/\s+/g, " ")
    .trim();

const KITSAP_CITY_ALLOWLIST = new Set([
  "bainbridge island",
  "belfair",
  "bremerton",
  "burley",
  "gorst",
  "hansville",
  "keyport",
  "kingston",
  "olmsted",
  "port gamble",
  "port orchard",
  "poulsbo",
  "rollingbay",
  "seabeck",
  "silverdale",
  "suquamish",
  "tracyton",
]);

const normalizeCityKey = (value = "") => normalize(value).toLowerCase();

const slug = (value = "", fallback = "item") => {
  const token = normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return token || fallback;
};

const csvSplitLine = (line = "") => {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      const next = line[i + 1];
      if (inQuotes && next === "\"") {
        cur += "\"";
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((item) => normalize(item));
};

const parseCsv = (raw = "") => {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const header = csvSplitLine(lines[0]);
  const idx = Object.fromEntries(header.map((key, i) => [key.toLowerCase(), i]));
  return lines.slice(1).map((line) => {
    const cells = csvSplitLine(line);
    const row = {};
    header.forEach((key, i) => {
      row[key] = cells[i] || "";
    });
    return {
      region: row[header[idx.region]] || "",
      place: row[header[idx.place]] || "",
      city: row[header[idx.city]] || "",
      mon: row[header[idx.mon]] || "",
      tue: row[header[idx.tue]] || "",
      wed: row[header[idx.wed]] || "",
      thu: row[header[idx.thu]] || "",
      fri: row[header[idx.fri]] || "",
      sat: row[header[idx.sat]] || "",
      sun: row[header[idx.sun]] || "",
      notes: row[header[idx.notes]] || "",
    };
  });
};

const extractTimeMatches = (text = "") => {
  const input = normalize(text).toLowerCase();
  const matches = [...input.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/g)];
  return matches.map((match) => ({
    hour: Number(match[1] || 0),
    minute: Number(match[2] || 0),
    meridiem: match[3] || "",
  }));
};

const to24Hour = ({ hour = 0, minute = 0, meridiem = "" } = {}) => {
  if (!Number.isFinite(hour) || hour <= 0 || hour > 12) return null;
  const safeMinute = Number.isFinite(minute) ? minute : 0;
  const mm = Math.max(0, Math.min(59, safeMinute));
  const m = String(meridiem || "").toLowerCase();
  if (!m) return { hour: hour % 12, minute: mm };
  if (m === "am") return { hour: hour % 12, minute: mm };
  if (m === "pm") return { hour: (hour % 12) + 12, minute: mm };
  return { hour: hour % 12, minute: mm };
};

const computeNextWindow = ({ weekday = "Mon", text = "" } = {}) => {
  const matches = extractTimeMatches(text);
  if (!matches.length) return { startsAtMs: 0, endsAtMs: 0 };

  const startRaw = { ...matches[0] };
  const endRaw = matches[1] ? { ...matches[1] } : null;
  if (!startRaw.meridiem && endRaw?.meridiem) {
    startRaw.meridiem = endRaw.meridiem;
  }
  if (!startRaw.meridiem) {
    startRaw.meridiem = "pm";
  }
  const start = to24Hour(startRaw);
  if (!start) return { startsAtMs: 0, endsAtMs: 0 };

  const now = new Date();
  const targetDow = DAY_TO_INDEX[weekday] ?? 1;
  let daysAhead = (targetDow - now.getDay() + 7) % 7;

  const startDate = new Date(now);
  startDate.setHours(start.hour, start.minute, 0, 0);
  if (daysAhead === 0 && startDate.getTime() <= now.getTime()) {
    daysAhead = 7;
  }
  startDate.setDate(startDate.getDate() + daysAhead);
  let endMs = 0;

  if (endRaw) {
    const derivedEnd = { ...endRaw };
    if (!derivedEnd.meridiem) {
      derivedEnd.meridiem = startRaw.meridiem;
    }
    const end = to24Hour(derivedEnd);
    if (end) {
      const endDate = new Date(startDate);
      endDate.setHours(end.hour, end.minute, 0, 0);
      if (endDate.getTime() <= startDate.getTime()) {
        endDate.setDate(endDate.getDate() + 1);
      }
      endMs = endDate.getTime();
    }
  }
  return {
    startsAtMs: startDate.getTime(),
    endsAtMs: endMs,
  };
};

const fieldValue = (value) => {
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
        values: value.map((item) => fieldValue(item)),
      },
    };
  }
  if (typeof value === "object") {
    const fields = {};
    Object.entries(value).forEach(([k, v]) => {
      fields[k] = fieldValue(v);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
};

const toFirestoreFields = (data = {}) => {
  const fields = {};
  Object.entries(data).forEach(([key, value]) => {
    fields[key] = fieldValue(value);
  });
  return fields;
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

const commitWrites = async ({ accessToken, writes = [] }) => {
  if (!writes.length) return;
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ writes }),
    }
  );
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Firestore commit failed (${res.status}): ${body}`);
  }
};

const chunk = (arr = [], size = 200) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const buildVenueDoc = (row = {}, nowIso = "") => {
  const place = normalize(row.place);
  const city = normalize(row.city);
  const notes = normalize(row.notes);
  const dayValues = {
    Mon: normalize(row.mon),
    Tue: normalize(row.tue),
    Wed: normalize(row.wed),
    Thu: normalize(row.thu),
    Fri: normalize(row.fri),
    Sat: normalize(row.sat),
    Sun: normalize(row.sun),
  };
  const karaokeNightsLabel = DAY_KEYS
    .filter((day) => !!dayValues[day])
    .map((day) => `${day} ${dayValues[day]}`)
    .join(" | ");

  const venueId = `venue_kitsap_${slug(city, "city")}_${slug(place, "venue")}`;
  return {
    docId: venueId,
    collectionName: "venues",
    data: {
      listingType: "venue",
      title: place,
      description: notes ? `Kitsap karaoke schedule listing. ${notes}` : "Kitsap karaoke schedule listing.",
      city,
      state: "WA",
      region: "wa_kitsap",
      address1: "",
      karaokeNightsLabel,
      sourceType: "seed_import",
      sourceSeed: "kitsap_karaoke_schedule",
      seedRegion: normalize(row.region),
      status: "approved",
      visibility: "public",
      createdAt: nowIso,
      updatedAt: nowIso,
      approvedAt: nowIso,
      createdBy: "seed_kitsap_script",
      updatedBy: "seed_kitsap_script",
      approvedBy: "seed_kitsap_script",
    },
    dayValues,
  };
};

const buildEventDocs = ({ row = {}, venue = {}, nowIso = "" } = {}) => {
  const place = normalize(row.place);
  const city = normalize(row.city);
  const notes = normalize(row.notes);
  const out = [];

  DAY_KEYS.forEach((day) => {
    const timeText = normalize(venue.dayValues?.[day] || "");
    if (!timeText) return;
    const { startsAtMs, endsAtMs } = computeNextWindow({ weekday: day, text: timeText });
    const eventId = `event_kitsap_${slug(city, "city")}_${slug(place, "venue")}_${day.toLowerCase()}`;
    out.push({
      docId: eventId,
      collectionName: "karaoke_events",
      data: {
        listingType: "event",
        title: `${place} Karaoke`,
        description: notes ? `Kitsap karaoke schedule listing. ${notes}` : "Kitsap karaoke schedule listing.",
        city,
        state: "WA",
        region: "wa_kitsap",
        venueId: venue.docId,
        venueName: place,
        hostName: "",
        recurringRule: `Weekly ${day} ${timeText}`,
        startsAtMs,
        endsAtMs,
        sourceType: "seed_import",
        sourceSeed: "kitsap_karaoke_schedule",
        seedRegion: normalize(row.region),
        status: "approved",
        visibility: "public",
        createdAt: nowIso,
        updatedAt: nowIso,
        approvedAt: nowIso,
        createdBy: "seed_kitsap_script",
        updatedBy: "seed_kitsap_script",
        approvedBy: "seed_kitsap_script",
      },
    });
  });

  return out;
};

const createWrite = ({ collectionName, docId, data }) => ({
  update: {
    name: `projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}/${docId}`,
    fields: toFirestoreFields(data),
  },
});

const run = async () => {
  const raw = await fs.readFile(inputFile, "utf8");
  const parsedRows = parseCsv(raw)
    .filter((row) => normalize(row.place))
    .filter((row) => normalize(row.city));
  const skippedOutsideCounty = [];
  const rows = parsedRows.filter((row) => {
    if (allowOutsideCounty) return true;
    const city = normalize(row.city);
    const cityKey = normalizeCityKey(city);
    if (KITSAP_CITY_ALLOWLIST.has(cityKey)) return true;
    skippedOutsideCounty.push({
      place: normalize(row.place),
      city,
      region: normalize(row.region),
    });
    return false;
  });
  if (!rows.length) {
    throw new Error("No valid rows in spreadsheet.");
  }

  const nowIso = new Date().toISOString();
  const venueDocs = [];
  const eventDocs = [];
  rows.forEach((row) => {
    const venue = buildVenueDoc(row, nowIso);
    venueDocs.push(venue);
    eventDocs.push(...buildEventDocs({ row, venue, nowIso }));
  });

  const writes = [
    ...venueDocs.map((entry) => createWrite({
      collectionName: entry.collectionName,
      docId: entry.docId,
      data: entry.data,
    })),
    ...eventDocs.map((entry) => createWrite(entry)),
    createWrite({
      collectionName: "directory_geo_pages",
      docId: "wa_kitsap",
      data: {
        token: "wa_kitsap",
        title: "Kitsap, WA Karaoke",
        description: "Seeded Kitsap karaoke listings and recurring nights.",
        updatedAt: nowIso,
        sourceType: "seed_import",
      },
    }),
  ];

  console.log(
    JSON.stringify(
      {
        rows: rows.length,
        skippedOutsideCounty: skippedOutsideCounty.length,
        venues: venueDocs.length,
        events: eventDocs.length,
        writes: writes.length,
        dryRun,
        allowOutsideCounty,
      },
      null,
      2
    )
  );

  if (skippedOutsideCounty.length) {
    console.log("Skipped non-Kitsap cities (policy guard):");
    console.log(JSON.stringify(skippedOutsideCounty, null, 2));
  }

  if (dryRun) return;
  const accessToken = await loadFirebaseCliToken();
  const groups = chunk(writes, 250);
  for (let i = 0; i < groups.length; i += 1) {
    await commitWrites({ accessToken, writes: groups[i] });
    console.log(`Committed batch ${i + 1}/${groups.length} (${groups[i].length} writes).`);
  }
  console.log("Kitsap seed import complete.");
};

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
