#!/usr/bin/env node
import process from "node:process";
import fs from "node:fs/promises";
import admin from "firebase-admin";

const usage = `
Usage:
  node scripts/ingest/import-kitsap-seed.mjs --file seed.csv [--dry-run]
  node scripts/ingest/import-kitsap-seed.mjs --stdin [--dry-run]

Expected columns (header names can vary slightly):
  name,title,city,state,address,region,listingType,startsAtMs,endsAtMs,hostName,venueName
`;

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readArg = (flag) => {
  const idx = args.indexOf(flag);
  if (idx < 0) return "";
  return args[idx + 1] || "";
};

if (hasFlag("--help")) {
  console.log(usage);
  process.exit(0);
}

const dryRun = hasFlag("--dry-run");
const filePath = readArg("--file");
const useStdin = hasFlag("--stdin");

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const parseDelimited = (raw = "") => {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((item) => item.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((item) => item.trim());
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] || "";
    });
    return row;
  });
};

const normalizeListingType = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === "event" || token === "room_session" || token === "venue") return token;
  return "venue";
};

const safe = (value = "", max = 180) => String(value || "").trim().slice(0, max);

const toSeedPayload = (row = {}) => {
  const title = safe(row.title || row.name || "", 180);
  if (!title) return null;
  return {
    title,
    listingType: normalizeListingType(row.listingtype || row.listing_type || row.type || "venue"),
    city: safe(row.city || "", 80),
    state: safe(row.state || "", 40),
    region: safe(row.region || "nationwide", 80),
    address1: safe(row.address || row.address1 || "", 180),
    startsAtMs: Number(row.startsatms || row.startsatms || row.start_ms || 0) || 0,
    endsAtMs: Number(row.endsatms || row.endsatms || row.end_ms || 0) || 0,
    hostName: safe(row.hostname || row.host_name || "", 120),
    venueName: safe(row.venuename || row.venue_name || "", 120),
    visibility: "public",
    status: "pending",
    sourceType: "seed_import",
  };
};

const initAdmin = () => {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin.firestore();
};

const run = async () => {
  const raw = filePath ? await fs.readFile(filePath, "utf8") : useStdin ? await readStdin() : "";
  if (!raw) {
    throw new Error("No input provided. Use --file or --stdin.");
  }

  const rows = parseDelimited(raw);
  const payloads = rows.map(toSeedPayload).filter(Boolean);
  if (!payloads.length) {
    throw new Error("No valid rows found.");
  }

  console.log(`Parsed ${payloads.length} listing row(s).`);
  if (dryRun) {
    console.log("Dry run payload preview:");
    console.log(JSON.stringify(payloads.slice(0, 5), null, 2));
    return;
  }

  const db = initAdmin();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const batchLimit = 300;
  let total = 0;

  for (let i = 0; i < payloads.length; i += batchLimit) {
    const chunk = payloads.slice(i, i + batchLimit);
    const batch = db.batch();
    chunk.forEach((payload) => {
      const docRef = db.collection("directory_submissions").doc();
      batch.set(docRef, {
        submissionId: docRef.id,
        listingType: payload.listingType,
        status: "pending",
        sourceType: "seed_import",
        providers: [],
        payload,
        createdBy: "seed_import_script",
        createdAt: now,
        updatedAt: now,
        moderation: {
          action: "pending",
          notes: "",
          moderatedBy: null,
          moderatedAt: null,
        },
      }, { merge: true });
    });
    await batch.commit();
    total += chunk.length;
    console.log(`Queued ${total}/${payloads.length} submissions...`);
  }

  console.log(`Completed. ${total} submission records written to directory_submissions.`);
};

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

