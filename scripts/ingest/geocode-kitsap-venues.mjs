#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const PROJECT_ID = "beaurocks-karaoke-v2";
const REGION = "wa_kitsap";
const GEOCODER_USER_AGENT = "beaurocks-karaoke-geocoder/1.0 (directory cleanup)";
const APPLY_FLAG = "--apply";
const WRITE_BATCH_SIZE = 200;

const usage = `
Usage:
  node scripts/ingest/geocode-kitsap-venues.mjs
  node scripts/ingest/geocode-kitsap-venues.mjs --apply

Behavior:
  - Reads approved+public venues in region "${REGION}" from Firestore.
  - Resolves addresses and coordinates.
  - Writes address1 + lat/lng + location when --apply is provided.
`;

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(usage.trim());
  process.exit(0);
}
const apply = args.includes(APPLY_FLAG);

const MANUAL_OVERRIDES = {
  venue_kitsap_belfair_the_woodshed: { address1: "23698 NE State Route 3, Belfair, WA 98528" },
  venue_kitsap_bremerton_mccloud_s_grill_house: { address1: "2901 Perry Ave, Suite 13, Bremerton, WA 98310" },
  venue_kitsap_bremerton_remedy_speakeasy: { address1: "602 4th St, Bremerton, WA 98337" },
  venue_kitsap_bremerton_south_pacific_bar_grill: { address1: "218 1st St, Bremerton, WA 98337" },
  venue_kitsap_bremerton_siren_s: { address1: "312 Naval Ave, Bremerton, WA 98337" },
  venue_kitsap_bremerton_town_portal: { address1: "305 Pacific Ave, Bremerton, WA 98337" },
  venue_kitsap_gig_harbor_eagles_club_gig_harbor: { address1: "4425 Burnham Dr NW, Gig Harbor, WA 98332" },
  venue_kitsap_gig_harbor_half_time_sports_saloon: { address1: "5114 Point Fosdick Dr NW, Gig Harbor, WA 98335" },
  venue_kitsap_gig_harbor_the_float: { address1: "14511 Sherman Dr NW, Gig Harbor, WA 98332" },
  venue_kitsap_port_orchard_eagles_club_port_orchard: { address1: "4001 Jackson Ave SE, Port Orchard, WA 98366" },
  venue_kitsap_port_orchard_new_way_lounge: { address1: "1551 SE Piperberry Way, Suite 101, Port Orchard, WA 98366" },
  venue_kitsap_port_orchard_vfw_post_2669: { address1: "3100 SE Mile Hill Dr, Port Orchard, WA 98366" },
  venue_kitsap_poulsbo_the_brass_kraken_pub: { address1: "18779 Front St NE, Poulsbo, WA 98370" },
  venue_kitsap_silverdale_our_place_pub: { address1: "9322 Silverdale Loop Rd NW, Silverdale, WA 98383" },
};

const readString = (field) => {
  if (!field || typeof field !== "object") return "";
  if (typeof field.stringValue === "string") return field.stringValue.trim();
  return "";
};

const readNumber = (field) => {
  if (!field || typeof field !== "object") return 0;
  if (typeof field.doubleValue === "number" && Number.isFinite(field.doubleValue)) return field.doubleValue;
  if (typeof field.integerValue === "string") {
    const parsed = Number(field.integerValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof field.integerValue === "number" && Number.isFinite(field.integerValue)) return field.integerValue;
  return 0;
};

const valueToField = (value) => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { integerValue: "0" };
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => valueToField(item)) } };
  }
  if (typeof value === "object") {
    const fields = {};
    Object.entries(value).forEach(([key, nested]) => {
      fields[key] = valueToField(nested);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
};

const toFirestoreFields = (payload = {}) => {
  const fields = {};
  Object.entries(payload).forEach(([key, value]) => {
    fields[key] = valueToField(value);
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

const runFirestoreQuery = async ({ accessToken, structuredQuery }) => {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ structuredQuery }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`runQuery failed (${res.status}): ${body}`);
  return JSON.parse(body);
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
  if (!res.ok) throw new Error(`commit failed (${res.status}): ${body}`);
};

const chunk = (arr = [], size = WRITE_BATCH_SIZE) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const geocodeArcgis = async ({ query = "" }) => {
  const safe = String(query || "").trim();
  if (!safe) return null;
  const url = new URL("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates");
  url.searchParams.set("f", "pjson");
  url.searchParams.set("SingleLine", safe);
  url.searchParams.set("maxLocations", "1");
  url.searchParams.set("outFields", "*");

  const res = await fetch(url, {
    headers: {
      "User-Agent": GEOCODER_USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const top = Array.isArray(data?.candidates) ? data.candidates[0] : null;
  if (!top) return null;
  const lat = Number(top?.location?.y);
  const lng = Number(top?.location?.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const attr = top?.attributes || {};
  const stAddr = String(attr?.StAddr || "").trim();
  const subAddr = String(attr?.SubAddr || "").trim();
  const address1 = [stAddr, subAddr].filter(Boolean).join(", ").trim();
  return {
    score: Number(top?.score || 0) || 0,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    address1,
    longLabel: String(attr?.LongLabel || "").trim(),
    matchAddr: String(attr?.Match_addr || "").trim(),
    placeAddr: String(attr?.Place_addr || "").trim(),
    type: String(attr?.Type || "").trim(),
  };
};

const isGeocodeAcceptable = (result = null, city = "") => {
  if (!result) return false;
  if (!result.address1) return false;
  const score = Number(result.score || 0);
  const type = String(result.type || "").toLowerCase();
  const label = `${result.longLabel} ${result.placeAddr}`.toLowerCase();
  const cityToken = String(city || "").trim().toLowerCase();
  if (score >= 98) return true;
  if (score >= 94 && cityToken && label.includes(cityToken) && type !== "city") return true;
  return false;
};

const loadKitsapVenues = async (accessToken) => {
  const rows = await runFirestoreQuery({
    accessToken,
    structuredQuery: {
      from: [{ collectionId: "venues" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: "region" },
                op: "EQUAL",
                value: { stringValue: REGION },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: "status" },
                op: "EQUAL",
                value: { stringValue: "approved" },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: "visibility" },
                op: "EQUAL",
                value: { stringValue: "public" },
              },
            },
          ],
        },
      },
      limit: 500,
    },
  });

  const out = [];
  rows.forEach((row) => {
    const doc = row?.document;
    if (!doc) return;
    const fields = doc.fields || {};
    const docName = String(doc.name || "");
    const docId = docName.split("/").pop() || "";
    out.push({
      id: docId,
      docName,
      title: readString(fields.title),
      city: readString(fields.city),
      state: readString(fields.state) || "WA",
      address1: readString(fields.address1),
      lat: readNumber(fields.lat),
      lng: readNumber(fields.lng),
    });
  });
  return out.sort((a, b) => `${a.city}|${a.title}`.localeCompare(`${b.city}|${b.title}`));
};

const buildUpdateWrite = ({ docName = "", payload = {} }) => ({
  update: {
    name: docName,
    fields: toFirestoreFields(payload),
  },
  updateMask: {
    fieldPaths: ["address1", "lat", "lng", "location", "updatedAt", "updatedBy"],
  },
  currentDocument: {
    exists: true,
  },
});

const run = async () => {
  const accessToken = await loadFirebaseCliToken();
  const venues = await loadKitsapVenues(accessToken);
  if (!venues.length) {
    console.log("No wa_kitsap venues found.");
    return;
  }

  const nowIso = new Date().toISOString();
  const resolved = [];
  const unresolved = [];

  for (const venue of venues) {
    const override = MANUAL_OVERRIDES[venue.id] || null;
    if (override?.address1) {
      const manualGeo = await geocodeArcgis({ query: override.address1 });
      if (!manualGeo) {
        unresolved.push({
          id: venue.id,
          title: venue.title,
          city: venue.city,
          reason: "manual_address_geocode_failed",
          attempted: override.address1,
        });
        await sleep(280);
        continue;
      }
      resolved.push({
        ...venue,
        address1: override.address1,
        lat: manualGeo.lat,
        lng: manualGeo.lng,
        score: manualGeo.score,
        method: "manual_override",
        longLabel: manualGeo.longLabel,
      });
      await sleep(280);
      continue;
    }

    const auto = await geocodeArcgis({
      query: `${venue.title}, ${venue.city}, ${venue.state || "WA"}, USA`,
    });
    if (!isGeocodeAcceptable(auto, venue.city)) {
      unresolved.push({
        id: venue.id,
        title: venue.title,
        city: venue.city,
        reason: "low_confidence",
        score: auto?.score || 0,
        longLabel: auto?.longLabel || "",
        address1: auto?.address1 || "",
      });
      await sleep(280);
      continue;
    }
    resolved.push({
      ...venue,
      address1: auto.address1,
      lat: auto.lat,
      lng: auto.lng,
      score: auto.score,
      method: "auto_arcgis",
      longLabel: auto.longLabel,
    });
    await sleep(280);
  }

  const writes = resolved.map((entry) =>
    buildUpdateWrite({
      docName: entry.docName,
      payload: {
        address1: entry.address1,
        lat: entry.lat,
        lng: entry.lng,
        location: {
          lat: entry.lat,
          lng: entry.lng,
        },
        updatedAt: nowIso,
        updatedBy: "kitsap_geocode_script",
      },
    })
  );

  const summary = {
    region: REGION,
    apply,
    venues: venues.length,
    resolved: resolved.length,
    unresolved: unresolved.length,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (unresolved.length) {
    console.log("Unresolved venues:");
    console.log(JSON.stringify(unresolved, null, 2));
  }

  console.log("Resolved preview:");
  console.log(
    JSON.stringify(
      resolved.map((entry) => ({
        id: entry.id,
        title: entry.title,
        city: entry.city,
        address1: entry.address1,
        lat: entry.lat,
        lng: entry.lng,
        method: entry.method,
        score: entry.score,
      })),
      null,
      2
    )
  );

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to write updates.");
    return;
  }

  const groups = chunk(writes, WRITE_BATCH_SIZE);
  for (let i = 0; i < groups.length; i += 1) {
    await commitWrites({ accessToken, writes: groups[i] });
    console.log(`Committed batch ${i + 1}/${groups.length} (${groups[i].length} writes).`);
  }
  console.log("Kitsap venue geocoding updates complete.");
};

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
