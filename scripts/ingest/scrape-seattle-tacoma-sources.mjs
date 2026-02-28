#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const PROJECT_ID = "beaurocks-karaoke-v2";
const DEFAULT_CONFIG = "scripts/ingest/seattle-tacoma-source-registry.json";
const DEFAULT_OUTPUT = "artifacts/ingest/seattle_tacoma_seed_records.json";
const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_MAX_PER_REGION = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const PIPELINE_VERSION = "seattle_tacoma_v1";

const usage = `
Usage:
  node scripts/ingest/scrape-seattle-tacoma-sources.mjs [--dry-run]
  node scripts/ingest/scrape-seattle-tacoma-sources.mjs --apply

Options:
  --config <path>          Source registry JSON path (default: ${DEFAULT_CONFIG})
  --output <path>          JSON output artifact (default: ${DEFAULT_OUTPUT})
  --sources <ids>          Comma-separated source ids to run
  --regions <tokens>       Comma-separated region tokens to keep in output/apply
  --max-per-region <n>     Seed listing cap per region (default: registry maxPerRegion or ${DEFAULT_MAX_PER_REGION})
  --timeout-ms <n>         Request timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --apply                  Upsert directory_regions docs in Firestore
  --dry-run                Force dry-run mode (no writes)
  --verbose                Print per-source details

Notes:
  - Dry-run is the default unless --apply is passed.
  - Firestore writes use firebase-tools OAuth token from ~/.config/configstore/firebase-tools.json.
  - This script only seeds directory_regions.seedListings; nightlyDirectorySync then performs external provider ingestion.
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

const configPath = path.resolve(readArg("--config") || DEFAULT_CONFIG);
const outputPath = path.resolve(readArg("--output") || DEFAULT_OUTPUT);
const sourceFilter = String(readArg("--sources") || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const regionFilter = String(readArg("--regions") || "")
  .split(",")
  .map((item) => normalizeToken(item, 80))
  .filter(Boolean);
const timeoutMsRaw = Number(readArg("--timeout-ms") || DEFAULT_TIMEOUT_MS);
const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 1000 ? Math.floor(timeoutMsRaw) : DEFAULT_TIMEOUT_MS;
const maxPerRegionRaw = Number(readArg("--max-per-region") || 0);
const verbose = hasFlag("--verbose");
const apply = hasFlag("--apply") && !hasFlag("--dry-run");
const dryRun = !apply;

const HTML_ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};

function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function safe(value = "", max = 180) {
  return normalizeWhitespace(value).slice(0, max);
}

function normalizeToken(value = "", max = 80) {
  return safe(value, max).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function slugToken(value = "", max = 80) {
  return safe(value, max).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeState(value = "") {
  const token = safe(value, 40).toUpperCase();
  if (token === "WASHINGTON") return "WA";
  if (token === "CALIFORNIA") return "CA";
  return token;
}

function normalizeCityLabel(value = "", state = "") {
  const raw = safe(value, 120).replace(/\+/g, " ");
  const compact = normalizeWhitespace(raw);
  if (!compact) return "";
  const stateToken = normalizeState(state || "");
  if (!stateToken) return safe(compact, 80);
  const trailingStateRegex = new RegExp(`\\b${stateToken}\\b$`, "i");
  return safe(compact.replace(trailingStateRegex, "").trim(), 80);
}

function normalizeCityToken(value = "") {
  return slugToken(normalizeCityLabel(value, ""), 80);
}

function normalizeListingType(value = "") {
  const token = normalizeToken(value, 40);
  if (token === "venue" || token === "event" || token === "room_session") return token;
  return "venue";
}

function decodeHtml(value = "") {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&([a-z]+);/gi, (full, name) => HTML_ENTITY_MAP[name.toLowerCase()] || full);
}

function stripTags(value = "") {
  return normalizeWhitespace(decodeHtml(String(value || "").replace(/<[^>]*>/g, " ")));
}

function extractFirstGroup(input = "", pattern = null, groupIdx = 1) {
  if (!pattern) return "";
  const source = String(input || "");
  const flags = (pattern.flags || "").replace(/g/g, "");
  const regex = new RegExp(pattern.source, flags);
  const match = regex.exec(source);
  if (!match) return "";
  return String(match[groupIdx] || "");
}

function parseNumber(value, decimals = 6) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(decimals));
}

function parseDateToMs(value = "") {
  const token = safe(value, 64);
  if (!token) return 0;
  const direct = Date.parse(token);
  if (Number.isFinite(direct)) return direct;
  const match = token.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/i);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);
  const zulu = String(match[7] || "").toUpperCase() === "Z";
  const ms = zulu
    ? Date.UTC(year, month, day, hour, minute, second, 0)
    : new Date(year, month, day, hour, minute, second, 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function absoluteUrl(base = "", href = "") {
  const token = safe(href, 2048);
  if (!token) return "";
  try {
    return new URL(token, base || undefined).toString();
  } catch {
    return "";
  }
}

function normalizeOptionalUrl(value = "") {
  const token = safe(value, 2048);
  if (!token) return "";
  if (!/^https?:\/\//i.test(token)) return "";
  return token;
}

function composeAddress(parts = []) {
  const cleaned = parts.map((item) => safe(item, 120)).filter(Boolean);
  return safe(cleaned.join(", "), 220);
}

function parseCityStateFromAddress(address = "") {
  const raw = safe(address, 220);
  if (!raw) return { city: "", state: "" };
  const match = raw.match(/,\s*([A-Za-z .'-]+?)\s*,\s*([A-Za-z]{2})\b/);
  if (!match) return { city: "", state: "" };
  return {
    city: safe(match[1], 80),
    state: normalizeState(match[2]),
  };
}

function matchesSourceKeywords(text = "", source = {}) {
  const haystack = String(text || "").toLowerCase();
  const keywords = Array.isArray(source.keywords) ? source.keywords.map((item) => safe(item, 80).toLowerCase()).filter(Boolean) : [];
  if (!keywords.length && !source.keywordRegex) return true;
  if (keywords.some((keyword) => haystack.includes(keyword))) return true;
  const keywordRegex = safe(source.keywordRegex || "", 200);
  if (!keywordRegex) return false;
  try {
    const regex = new RegExp(keywordRegex, "i");
    return regex.test(String(text || ""));
  } catch {
    return false;
  }
}

function deriveRegionToken({ state = "", city = "", fallback = "" } = {}) {
  const regionFallback = normalizeToken(fallback || "", 80);
  if (regionFallback) return regionFallback;
  const stateToken = slugToken(normalizeState(state) || "wa", 20);
  const cityToken = slugToken(city || "metro", 60);
  return `${stateToken}_${cityToken}`;
}

function recordCompleteness(record = {}) {
  let score = 0;
  if (record.address1) score += 2;
  if (record.websiteUrl) score += 1;
  if (record.venueName) score += 1;
  if (Number(record.startsAtMs || 0) > 0) score += 1;
  if (record.lat !== null && record.lng !== null) score += 1;
  return score;
}

function buildRecordKey(record = {}) {
  const listingType = normalizeListingType(record.listingType || "venue");
  const city = normalizeToken(record.city || "", 80);
  const state = normalizeToken(record.state || "", 20);
  const name = normalizeToken(record.name || "", 180);
  const venueName = normalizeToken(record.venueName || "", 180);
  const dateKey = Number(record.startsAtMs || 0) > 0
    ? new Date(Number(record.startsAtMs)).toISOString().slice(0, 10)
    : "na";
  if (listingType === "venue") {
    return `venue|${name}|${city}|${state}`;
  }
  return `event|${name}|${venueName}|${city}|${state}|${dateKey}`;
}

function scoreRecord(record = {}, source = {}) {
  let score = Number(source.priority || 50);
  if (normalizeListingType(record.listingType || "") === "venue") score += 16;
  else score += 8;
  if (record.address1) score += 6;
  if (record.websiteUrl) score += 3;
  if (Number(record.startsAtMs || 0) > 0) score += 3;
  if (record.lat !== null && record.lng !== null) score += 2;
  if (record.sourceItemUrl) score += 1;
  return Math.max(0, Math.round(score));
}

function normalizeSeedRecord(input = {}, source = {}) {
  const cityRaw = safe(input.city || source.city || "", 80);
  const stateRaw = normalizeState(input.state || source.state || "");
  const regionRaw = deriveRegionToken({
    state: stateRaw || source.state || "WA",
    city: cityRaw || source.city || "Seattle",
    fallback: input.region || source.region || "",
  });
  const listingType = normalizeListingType(input.listingType || source.listingType || "venue");
  const name = safe(input.name || input.title || "", 180);
  if (!name) return null;
  const startsAtMs = Number(input.startsAtMs || 0);
  const endsAtMs = Number(input.endsAtMs || 0);
  const lat = parseNumber(input.lat, 6);
  const lng = parseNumber(input.lng, 6);
  const base = {
    name,
    listingType,
    city: cityRaw,
    state: stateRaw || "WA",
    region: regionRaw || "wa_seattle",
    locationText: safe(
      input.locationText || [cityRaw, stateRaw || "WA", "United States"].filter(Boolean).join(", "),
      220
    ),
    address1: safe(input.address1 || "", 180),
    startsAtMs: Number.isFinite(startsAtMs) && startsAtMs > 0 ? Math.floor(startsAtMs) : 0,
    endsAtMs: Number.isFinite(endsAtMs) && endsAtMs > 0 ? Math.floor(endsAtMs) : 0,
    hostName: safe(input.hostName || "", 120),
    venueName: safe(input.venueName || "", 120),
    websiteUrl: normalizeOptionalUrl(input.websiteUrl || ""),
    bookingUrl: normalizeOptionalUrl(input.bookingUrl || ""),
    sourceId: safe(input.sourceId || source.id || "", 80),
    sourceLabel: safe(input.sourceLabel || source.label || "", 120),
    sourceUrl: normalizeOptionalUrl(input.sourceUrl || source.url || ""),
    sourceItemUrl: normalizeOptionalUrl(input.sourceItemUrl || ""),
    notes: safe(input.notes || "", 300),
    score: Number(input.score || 0) || 0,
    lat,
    lng,
  };
  if (base.endsAtMs && base.startsAtMs && base.endsAtMs < base.startsAtMs) {
    base.endsAtMs = 0;
  }
  return base;
}

function normalizeSeedListing(entry = {}, nowIso = "") {
  return {
    name: safe(entry.name || "", 180),
    city: safe(entry.city || "", 80),
    state: normalizeState(entry.state || ""),
    region: normalizeToken(entry.region || "", 80),
    locationText: safe(entry.locationText || "", 220),
    address1: safe(entry.address1 || "", 180),
    listingType: normalizeListingType(entry.listingType || "venue"),
    startsAtMs: Number(entry.startsAtMs || 0) || 0,
    endsAtMs: Number(entry.endsAtMs || 0) || 0,
    hostName: safe(entry.hostName || "", 120),
    venueName: safe(entry.venueName || "", 120),
    websiteUrl: normalizeOptionalUrl(entry.websiteUrl || ""),
    bookingUrl: normalizeOptionalUrl(entry.bookingUrl || ""),
    sourceId: safe(entry.sourceId || "", 80),
    sourceLabel: safe(entry.sourceLabel || "", 120),
    sourceUrl: normalizeOptionalUrl(entry.sourceUrl || ""),
    sourceItemUrl: normalizeOptionalUrl(entry.sourceItemUrl || ""),
    score: Number(entry.score || 0) || 0,
    scrapedAt: nowIso,
  };
}

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url = "", { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const token = normalizeOptionalUrl(url);
  if (!token) throw new Error(`Invalid URL: ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(token, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Upgrade-Insecure-Requests": "1",
        Referer: token,
      },
      signal: controller.signal,
    });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`Fetch failed (${res.status}) for ${token}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function parseCalendarGoogleHref(href = "") {
  const url = normalizeOptionalUrl(decodeHtml(href));
  if (!url) return { startsAtMs: 0, endsAtMs: 0, address1: "" };
  let params;
  try {
    params = new URL(url).searchParams;
  } catch {
    return { startsAtMs: 0, endsAtMs: 0, address1: "" };
  }
  const dates = decodeHtml(params.get("dates") || "");
  const location = decodeHtml(params.get("location") || "");
  const [startToken, endToken] = dates.split("/");
  return {
    startsAtMs: parseDateToMs(startToken || ""),
    endsAtMs: parseDateToMs(endToken || ""),
    address1: safe(location.replace(/\s+/g, " ").replace(/,\s*United States$/i, ""), 220),
  };
}

async function parseKaraokeNearCity({ html = "", source = {}, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const records = [];
  const linkPattern = /<a href="([^"]+)" class="card-link">([\s\S]*?)<\/a>/gi;
  const nowIso = new Date().toISOString();
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const href = safe(match[1] || "", 2048);
    const card = String(match[2] || "");
    if (!/class="card listed"/i.test(card)) continue;
    const title = stripTags(extractFirstGroup(card, /<h4 class="card-title">([\s\S]*?)<\/h4>/i));
    if (!title) continue;
    const summary = stripTags(extractFirstGroup(card, /<p>([\s\S]*?)<\/p>/i));
    const dayBadges = [...card.matchAll(/badge badge-pill badge-secondary">([^<]+)</gi)]
      .map((entry) => safe(entry[1] || "", 24))
      .filter(Boolean);
    const lat = parseNumber(extractFirstGroup(card, /class="lat"[^>]*value="([^"]+)"/i), 6);
    const lng = parseNumber(extractFirstGroup(card, /class="lon"[^>]*value="([^"]+)"/i), 6);
    const sourceItemUrl = absoluteUrl(source.url, href);
    if (!matchesSourceKeywords(`${title} ${summary} ${dayBadges.join(" ")}`, source)) continue;
    records.push({
      listingType: "venue",
      name: title,
      city: safe(source.city || "", 80),
      state: normalizeState(source.state || "WA"),
      region: normalizeToken(source.region || "", 80),
      locationText: safe([source.city || "", source.state || "WA", "United States"].filter(Boolean).join(", "), 220),
      address1: "",
      startsAtMs: 0,
      endsAtMs: 0,
      hostName: "",
      venueName: title,
      websiteUrl: "",
      bookingUrl: "",
      sourceId: safe(source.id || "", 80),
      sourceLabel: safe(source.label || "", 120),
      sourceUrl: normalizeOptionalUrl(source.url || ""),
      sourceItemUrl,
      notes: safe(summary, 300),
      days: dayBadges,
      lat,
      lng,
      scrapedAt: nowIso,
    });
  }

  const shouldFetchDetails = !!source.fetchDetailPages;
  if (!shouldFetchDetails || !records.length) return records;

  const maxDetailPages = Math.max(1, Math.min(Number(source.maxDetailPages || records.length), records.length));
  const targets = [];
  const seen = new Set();
  records.forEach((record) => {
    const url = normalizeOptionalUrl(record.sourceItemUrl || "");
    if (!url || seen.has(url)) return;
    seen.add(url);
    targets.push(url);
  });

  for (const detailUrl of targets.slice(0, maxDetailPages)) {
    try {
      const detailHtml = await fetchText(detailUrl, { timeout });
      const addressRaw = stripTags(extractFirstGroup(detailHtml, /<span class="address[^>]*>([\s\S]*?)<\/span>/i));
      const venueWebsiteRaw = decodeHtml(extractFirstGroup(detailHtml, /<span class="website[^>]*>[\s\S]*?<a href="([^"]+)"/i));
      const detailAddress = safe(addressRaw, 220);
      const venueWebsite = normalizeOptionalUrl(venueWebsiteRaw);
      const { city, state } = parseCityStateFromAddress(detailAddress);
      records.forEach((record) => {
        if (record.sourceItemUrl !== detailUrl) return;
        if (detailAddress && !record.address1) record.address1 = safe(detailAddress, 180);
        if (venueWebsite && !record.websiteUrl) record.websiteUrl = venueWebsite;
        if (city) record.city = city;
        if (state) record.state = state;
      });
    } catch {
      // Skip detail page errors and keep base listing record.
    }
    await sleep(120);
  }
  return records;
}

function parseDo206EventFeed({ html = "", source = {} } = {}) {
  const records = [];
  const nowMs = Date.now();
  const staleCutoffMs = nowMs - (90 * DAY_MS);
  const parts = String(html || "").split("<div class=\"ds-listing event-card").slice(1);
  for (const part of parts) {
    const block = `<div class="ds-listing event-card${part}`;
    const title = stripTags(extractFirstGroup(block, /<span class="ds-listing-event-title-text"[^>]*>([\s\S]*?)<\/span>/i));
    if (!title) continue;
    const venueName = stripTags(extractFirstGroup(block, /<a href="\/venues\/[^\"]+" itemprop="url"><span itemprop="name">([\s\S]*?)<\/span><\/a>/i));
    if (!matchesSourceKeywords(`${title} ${venueName}`, source)) continue;
    const eventPath = extractFirstGroup(block, /<a href="([^"]+)" itemprop="url" class="ds-listing-event-title/i);
    const venuePath = extractFirstGroup(block, /<a href="(\/venues\/[^\"]+)" itemprop="url"><span itemprop="name">/i);
    const streetAddress = decodeHtml(extractFirstGroup(block, /itemprop="streetAddress" content="([^"]*)"/i));
    const locality = decodeHtml(extractFirstGroup(block, /itemprop="addressLocality" content="([^"]*)"/i));
    const addressRegion = normalizeState(extractFirstGroup(block, /itemprop="addressRegion" content="([^"]*)"/i));
    const postalCode = decodeHtml(extractFirstGroup(block, /itemprop="postalCode" content="([^"]*)"/i));
    const startDateToken = extractFirstGroup(block, /itemprop="startDate"[^>]*content="([^"]+)"/i)
      || extractFirstGroup(block, /itemprop="startDate"[^>]*datetime="([^"]+)"/i);
    let startsAtMs = parseDateToMs(startDateToken);
    if (startsAtMs && startsAtMs < staleCutoffMs) startsAtMs = 0;
    const lat = parseNumber(extractFirstGroup(block, /itemprop="latitude" content="([^"]+)"/i), 6);
    const lng = parseNumber(extractFirstGroup(block, /itemprop="longitude" content="([^"]+)"/i), 6);
    const city = safe(locality || source.city || "", 80);
    const state = normalizeState(addressRegion || source.state || "WA");
    const region = deriveRegionToken({
      state,
      city,
      fallback: source.region || "",
    });
    const eventUrl = absoluteUrl(source.url, eventPath);
    const venueUrl = absoluteUrl(source.url, venuePath);
    const address1 = composeAddress([streetAddress, locality, addressRegion, postalCode]);

    records.push({
      listingType: normalizeListingType(source.listingType || "event"),
      name: title,
      city,
      state,
      region,
      locationText: safe([city, state, "United States"].filter(Boolean).join(", "), 220),
      address1: safe(address1, 180),
      startsAtMs,
      endsAtMs: 0,
      hostName: "",
      venueName: safe(venueName, 120),
      websiteUrl: normalizeOptionalUrl(eventUrl),
      bookingUrl: "",
      sourceId: safe(source.id || "", 80),
      sourceLabel: safe(source.label || "", 120),
      sourceUrl: normalizeOptionalUrl(source.url || ""),
      sourceItemUrl: normalizeOptionalUrl(eventUrl),
      notes: "",
      lat,
      lng,
    });

    if (source.emitVenueCompanions && venueName) {
      records.push({
        listingType: "venue",
        name: safe(venueName, 180),
        city,
        state,
        region,
        locationText: safe([city, state, "United States"].filter(Boolean).join(", "), 220),
        address1: safe(address1, 180),
        startsAtMs: 0,
        endsAtMs: 0,
        hostName: "",
        venueName: safe(venueName, 120),
        websiteUrl: normalizeOptionalUrl(venueUrl || eventUrl),
        bookingUrl: "",
        sourceId: safe(source.id || "", 80),
        sourceLabel: safe(source.label || "", 120),
        sourceUrl: normalizeOptionalUrl(source.url || ""),
        sourceItemUrl: normalizeOptionalUrl(venueUrl || eventUrl),
        notes: "Derived from event feed venue reference.",
        lat,
        lng,
      });
    }
  }
  return records;
}

function maybeExtractVenueLabel(addressRaw = "") {
  const token = safe(addressRaw.replace(/\(map\)/ig, ""), 180);
  if (!token) return "";
  const head = safe(token.split(",")[0] || "", 120);
  if (!head) return "";
  if (/\d/.test(head)) return "";
  return head;
}

function parseSquarespaceEvents({ html = "", source = {} } = {}) {
  const records = [];
  const nowMs = Date.now();
  const skipPastDays = Number(source.skipPastDays || 0);
  const oldestAllowedMs = skipPastDays > 0 ? nowMs - (skipPastDays * DAY_MS) : 0;
  const parts = String(html || "").split("<article class=\"eventlist-event").slice(1);

  for (const part of parts) {
    const block = `<article class="eventlist-event${part}`;
    const title = stripTags(extractFirstGroup(block, /<h1 class="eventlist-title"><a href="[^"]+"[^>]*>([\s\S]*?)<\/a><\/h1>/i));
    if (!title) continue;
    const excerpt = stripTags(extractFirstGroup(block, /<div class="eventlist-excerpt">([\s\S]*?)<\/div>/i));
    if (!matchesSourceKeywords(`${title} ${excerpt}`, source)) continue;
    const eventPath = extractFirstGroup(block, /<h1 class="eventlist-title"><a href="([^"]+)"/i);
    const eventUrl = absoluteUrl(source.url, eventPath);
    const addressMeta = stripTags(extractFirstGroup(block, /<li class="eventlist-meta-item eventlist-meta-address[\s\S]*?>([\s\S]*?)<\/li>/i))
      .replace(/\(map\)/ig, "");
    const googleHref = decodeHtml(
      extractFirstGroup(block, /<a href="(https?:\/\/www\.google\.com\/calendar\/event\?[^"]+)" class="eventlist-meta-export-google"/i)
    );
    const calendarMeta = parseCalendarGoogleHref(googleHref);
    let startsAtMs = Number(calendarMeta.startsAtMs || 0) || 0;
    if (startsAtMs && oldestAllowedMs && startsAtMs < oldestAllowedMs) {
      startsAtMs = 0;
    }
    const endsAtMs = Number(calendarMeta.endsAtMs || 0) || 0;
    const resolvedAddress = safe(calendarMeta.address1 || addressMeta, 180);
    const addrInfo = parseCityStateFromAddress(resolvedAddress);
    const city = safe(addrInfo.city || source.city || "", 80);
    const state = normalizeState(addrInfo.state || source.state || "WA");
    const region = deriveRegionToken({
      state,
      city,
      fallback: source.region || "",
    });
    const venueName = safe(source.venueName || maybeExtractVenueLabel(addressMeta), 120);

    records.push({
      listingType: normalizeListingType(source.listingType || "event"),
      name: title,
      city,
      state,
      region,
      locationText: safe([city, state, "United States"].filter(Boolean).join(", "), 220),
      address1: resolvedAddress,
      startsAtMs,
      endsAtMs,
      hostName: "",
      venueName,
      websiteUrl: normalizeOptionalUrl(eventUrl),
      bookingUrl: "",
      sourceId: safe(source.id || "", 80),
      sourceLabel: safe(source.label || "", 120),
      sourceUrl: normalizeOptionalUrl(source.url || ""),
      sourceItemUrl: normalizeOptionalUrl(eventUrl),
      notes: safe(excerpt, 300),
      lat: null,
      lng: null,
    });

    if (source.emitVenueCompanions && venueName) {
      records.push({
        listingType: "venue",
        name: venueName,
        city,
        state,
        region,
        locationText: safe([city, state, "United States"].filter(Boolean).join(", "), 220),
        address1: resolvedAddress,
        startsAtMs: 0,
        endsAtMs: 0,
        hostName: "",
        venueName,
        websiteUrl: normalizeOptionalUrl(source.url || eventUrl),
        bookingUrl: "",
        sourceId: safe(source.id || "", 80),
        sourceLabel: safe(source.label || "", 120),
        sourceUrl: normalizeOptionalUrl(source.url || ""),
        sourceItemUrl: normalizeOptionalUrl(source.url || eventUrl),
        notes: "Derived from Squarespace event venue context.",
        lat: null,
        lng: null,
      });
    }
  }

  return records;
}

async function parseKaraokeListingsState({ html = "", source = {}, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const records = [];
  const stateDefault = normalizeState(source.state || "WA");
  const cityLinks = [];
  const cityPattern = /href="(cities\.php\?city=([^"&]+)&state=([A-Za-z]{2}))"/gi;
  let cityMatch;
  while ((cityMatch = cityPattern.exec(String(html || ""))) !== null) {
    const href = safe(cityMatch[1] || "", 300);
    const cityRaw = decodeHtml(String(cityMatch[2] || "").replace(/\+/g, " "));
    const stateRaw = normalizeState(cityMatch[3] || stateDefault);
    const city = normalizeCityLabel(cityRaw, stateRaw);
    if (!href || !city) continue;
    cityLinks.push({
      city,
      state: stateRaw || stateDefault,
      url: absoluteUrl(source.url, href),
    });
  }

  const dedupedCityLinks = [];
  const seenCityLinks = new Set();
  cityLinks.forEach((entry) => {
    const key = `${normalizeCityToken(entry.city)}|${normalizeState(entry.state || stateDefault)}`;
    if (!key || seenCityLinks.has(key)) return;
    seenCityLinks.add(key);
    dedupedCityLinks.push(entry);
  });

  const allowedCityTokens = new Set(
    (Array.isArray(source.allowedCities) ? source.allowedCities : [])
      .map((city) => normalizeCityToken(city))
      .filter(Boolean)
  );
  const blockedCityTokens = new Set(
    (Array.isArray(source.excludeCities) ? source.excludeCities : [])
      .map((city) => normalizeCityToken(city))
      .filter(Boolean)
  );

  const cityTargets = dedupedCityLinks.filter((entry) => {
    const token = normalizeCityToken(entry.city);
    if (!token) return false;
    if (allowedCityTokens.size && !allowedCityTokens.has(token)) return false;
    if (blockedCityTokens.has(token)) return false;
    return true;
  });

  const maxCityPages = Math.max(1, Math.min(Number(source.maxCityPages || cityTargets.length || 1), cityTargets.length || 1));
  const nowIso = new Date().toISOString();
  const cityPages = cityTargets.slice(0, maxCityPages);

  for (const cityEntry of cityPages) {
    let cityHtml = "";
    try {
      cityHtml = await fetchText(cityEntry.url, { timeout });
    } catch {
      await sleep(120);
      continue;
    }

    const rowPattern = /<tr[^>]*>\s*<td[^>]*>[\s\S]*?<a href="(venue\.php\?ID=\d+)">([\s\S]*?)<\/a>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowPattern.exec(cityHtml)) !== null) {
      const venueHref = safe(rowMatch[1] || "", 200);
      const venueName = stripTags(rowMatch[2] || "");
      const tailHtml = String(rowMatch[3] || "");
      if (!venueHref || !venueName) continue;

      const detailLines = tailHtml
        .split(/<br\s*\/?>/gi)
        .map((line) => stripTags(line))
        .map((line) => safe(line, 220))
        .filter(Boolean);
      const address1 = safe(detailLines[0] || "", 180);
      const noteLines = detailLines
        .slice(1)
        .filter((line) => !/^\s*PSTD\s*:/i.test(line))
        .filter((line) => !/^\s*\d[\d\-() ]{6,}\s*$/.test(line));
      const notes = safe(noteLines.join(" | "), 300);

      if (!matchesSourceKeywords(`${venueName} ${address1} ${notes}`, source)) continue;

      const city = normalizeCityLabel(cityEntry.city, cityEntry.state || stateDefault);
      const state = normalizeState(cityEntry.state || stateDefault);
      const region = deriveRegionToken({
        state,
        city,
        fallback: source.region || "",
      });
      const sourceItemUrl = absoluteUrl(cityEntry.url, venueHref);

      records.push({
        listingType: "venue",
        name: venueName,
        city,
        state: state || stateDefault,
        region,
        locationText: safe([city, state || stateDefault, "United States"].filter(Boolean).join(", "), 220),
        address1,
        startsAtMs: 0,
        endsAtMs: 0,
        hostName: "",
        venueName,
        websiteUrl: "",
        bookingUrl: "",
        sourceId: safe(source.id || "", 80),
        sourceLabel: safe(source.label || "", 120),
        sourceUrl: normalizeOptionalUrl(source.url || ""),
        sourceItemUrl: normalizeOptionalUrl(sourceItemUrl),
        notes,
        lat: null,
        lng: null,
        scrapedAt: nowIso,
      });
    }
    await sleep(120);
  }

  return records;
}

async function scrapeSource(source = {}, options = {}) {
  const normalizedSource = {
    ...source,
    id: safe(source.id || "", 80),
    type: safe(source.type || "", 80),
    url: normalizeOptionalUrl(source.url || ""),
    city: safe(source.city || "", 80),
    state: normalizeState(source.state || "WA"),
    region: normalizeToken(source.region || "", 80),
  };
  if (!normalizedSource.id || !normalizedSource.type || !normalizedSource.url) {
    throw new Error("Source missing id/type/url.");
  }

  const html = await fetchText(normalizedSource.url, { timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS });
  if (normalizedSource.type === "karaokenear_city") {
    return parseKaraokeNearCity({
      html,
      source: normalizedSource,
      timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    });
  }
  if (normalizedSource.type === "do206_event_feed") {
    return parseDo206EventFeed({ html, source: normalizedSource });
  }
  if (normalizedSource.type === "squarespace_events") {
    return parseSquarespaceEvents({ html, source: normalizedSource });
  }
  if (normalizedSource.type === "karaokelistings_state") {
    return parseKaraokeListingsState({
      html,
      source: normalizedSource,
      timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    });
  }
  throw new Error(`Unsupported source type: ${normalizedSource.type}`);
}

function fieldValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { integerValue: "0" };
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => fieldValue(entry)),
      },
    };
  }
  if (typeof value === "object") {
    const fields = {};
    Object.entries(value).forEach(([key, nested]) => {
      fields[key] = fieldValue(nested);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(payload = {}) {
  const fields = {};
  Object.entries(payload).forEach(([key, value]) => {
    fields[key] = fieldValue(value);
  });
  return fields;
}

async function loadFirebaseCliToken() {
  const cfgPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  const raw = await fs.readFile(cfgPath, "utf8");
  const parsed = JSON.parse(raw);
  const accessToken = safe(parsed?.tokens?.access_token || "", 4096);
  if (!accessToken) {
    throw new Error("No firebase-tools access token found. Run `firebase login` first.");
  }
  return accessToken;
}

async function commitWrites({ accessToken, writes = [] } = {}) {
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
}

function chunk(items = [], size = 200) {
  const output = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
}

function buildRegionDoc({
  token = "",
  city = "",
  state = "WA",
  label = "",
  seedListings = [],
  sourceCount = 0,
  nowIso = "",
}) {
  const readableCity = safe(city || "", 80);
  const readableState = normalizeState(state || "WA");
  const readableLabel = safe(label || readableCity || token, 120);
  return {
    token: normalizeToken(token, 80),
    title: `${readableLabel} Karaoke`,
    description: `Seeded karaoke candidates for ${readableLabel}, ${readableState}.`,
    city: readableCity,
    state: readableState,
    country: "US",
    enabled: true,
    seedListings,
    sourceType: "seed_scrape",
    pipelineVersion: PIPELINE_VERSION,
    sourceCount: Number(sourceCount || 0),
    updatedAt: nowIso,
    updatedBy: "seattle_tacoma_seed_scraper",
  };
}

function buildRegionWrite(token = "", doc = {}) {
  const normalizedToken = normalizeToken(token, 80);
  const fieldPaths = Object.keys(doc);
  return {
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/directory_regions/${normalizedToken}`,
      fields: toFirestoreFields(doc),
    },
    updateMask: {
      fieldPaths,
    },
  };
}

async function run() {
  const configRaw = await fs.readFile(configPath, "utf8");
  const registry = JSON.parse(configRaw);
  const configuredMaxPerRegion = Number(registry?.maxPerRegion || 0);
  const maxPerRegion = Number.isFinite(maxPerRegionRaw) && maxPerRegionRaw > 0
    ? Math.min(maxPerRegionRaw, 100)
    : (Number.isFinite(configuredMaxPerRegion) && configuredMaxPerRegion > 0
      ? Math.min(configuredMaxPerRegion, 100)
      : DEFAULT_MAX_PER_REGION);
  const allSources = Array.isArray(registry?.sources) ? registry.sources : [];
  if (!allSources.length) {
    throw new Error("No sources found in registry.");
  }

  const selectedSources = sourceFilter.length
    ? allSources.filter((source) => sourceFilter.includes(String(source?.id || "")))
    : allSources;
  if (!selectedSources.length) {
    throw new Error("No sources selected after --sources filter.");
  }

  const regionMap = new Map();
  (Array.isArray(registry?.regions) ? registry.regions : []).forEach((region) => {
    const token = normalizeToken(region?.token || "", 80);
    if (!token) return;
    regionMap.set(token, {
      token,
      city: safe(region?.city || "", 80),
      state: normalizeState(region?.state || "WA"),
      label: safe(region?.label || region?.city || token, 120),
    });
  });

  const sourceSummaries = [];
  const rawRecords = [];

  for (const source of selectedSources) {
    const summary = {
      id: safe(source?.id || "", 80),
      type: safe(source?.type || "", 80),
      url: normalizeOptionalUrl(source?.url || ""),
      ok: false,
      recordCount: 0,
      error: "",
    };
    try {
      const scraped = await scrapeSource(source, { timeoutMs });
      summary.ok = true;
      summary.recordCount = scraped.length;
      scraped.forEach((entry) => rawRecords.push({ ...entry }));
      if (verbose) {
        console.log(`source ${summary.id}: ${scraped.length} raw records`);
      }
    } catch (error) {
      summary.error = safe(error?.message || error, 300);
      if (verbose) {
        console.log(`source ${summary.id} failed: ${summary.error}`);
      }
    }
    sourceSummaries.push(summary);
    await sleep(120);
  }

  const normalized = rawRecords
    .map((entry) => {
      const source = selectedSources.find((item) => String(item?.id || "") === String(entry?.sourceId || ""));
      const rec = normalizeSeedRecord(entry, source || {});
      if (!rec) return null;
      rec.score = scoreRecord(rec, source || {});
      return rec;
    })
    .filter(Boolean);

  const dedupeMap = new Map();
  for (const record of normalized) {
    const key = buildRecordKey(record);
    const existing = dedupeMap.get(key);
    if (!existing) {
      dedupeMap.set(key, record);
      continue;
    }
    const better = record.score > existing.score
      || (record.score === existing.score && recordCompleteness(record) > recordCompleteness(existing));
    if (better) dedupeMap.set(key, record);
  }
  const deduped = Array.from(dedupeMap.values());

  const grouped = new Map();
  deduped.forEach((record) => {
    const token = normalizeToken(record.region || "", 80);
    if (!token) return;
    if (regionFilter.length && !regionFilter.includes(token)) return;
    if (!grouped.has(token)) grouped.set(token, []);
    grouped.get(token).push(record);
    if (!regionMap.has(token)) {
      regionMap.set(token, {
        token,
        city: safe(record.city || "", 80),
        state: normalizeState(record.state || "WA"),
        label: safe(record.city || token, 120),
      });
    }
  });

  const nowIso = new Date().toISOString();
  const regionDocs = [];
  const regionSummaries = [];
  grouped.forEach((entries, token) => {
    const sorted = [...entries].sort((a, b) => {
      const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const aVenue = normalizeListingType(a.listingType) === "venue" ? 1 : 0;
      const bVenue = normalizeListingType(b.listingType) === "venue" ? 1 : 0;
      if (aVenue !== bVenue) return bVenue - aVenue;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    const selected = sorted.slice(0, maxPerRegion);
    const seedListings = selected.map((entry) => normalizeSeedListing(entry, nowIso));
    const sourcesInRegion = new Set(seedListings.map((entry) => entry.sourceId).filter(Boolean));
    const regionMeta = regionMap.get(token) || {
      token,
      city: "",
      state: "WA",
      label: token,
    };
    regionDocs.push({
      token,
      doc: buildRegionDoc({
        token,
        city: regionMeta.city,
        state: regionMeta.state,
        label: regionMeta.label,
        seedListings,
        sourceCount: sourcesInRegion.size,
        nowIso,
      }),
    });
    regionSummaries.push({
      token,
      city: regionMeta.city,
      state: regionMeta.state,
      totalCandidates: entries.length,
      selectedSeeds: seedListings.length,
      venueSeeds: seedListings.filter((entry) => entry.listingType === "venue").length,
      eventSeeds: seedListings.filter((entry) => entry.listingType === "event").length,
    });
  });

  const outputPayload = {
    generatedAt: nowIso,
    dryRun,
    apply,
    configPath,
    outputPath,
    maxPerRegion,
    totals: {
      selectedSources: selectedSources.length,
      sourceRuns: sourceSummaries.length,
      sourceFailures: sourceSummaries.filter((item) => !item.ok).length,
      rawRecords: rawRecords.length,
      dedupedRecords: deduped.length,
      regions: regionDocs.length,
      seedListings: regionDocs.reduce((sum, item) => sum + (Array.isArray(item.doc?.seedListings) ? item.doc.seedListings.length : 0), 0),
    },
    sources: sourceSummaries,
    regions: regionSummaries.sort((a, b) => String(a.token).localeCompare(String(b.token))),
    records: deduped,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(outputPayload, null, 2));

  console.log(JSON.stringify({
    dryRun,
    apply,
    configPath,
    outputPath,
    maxPerRegion,
    sources: outputPayload.totals.selectedSources,
    sourceFailures: outputPayload.totals.sourceFailures,
    rawRecords: outputPayload.totals.rawRecords,
    dedupedRecords: outputPayload.totals.dedupedRecords,
    regions: outputPayload.totals.regions,
    seedListings: outputPayload.totals.seedListings,
  }, null, 2));
  console.log("Region summary:");
  console.log(JSON.stringify(outputPayload.regions, null, 2));

  if (dryRun) {
    console.log("Dry run complete. Re-run with --apply to upsert directory_regions seed listings.");
    return;
  }
  if (!regionDocs.length) {
    console.log("No region docs to write.");
    return;
  }

  const accessToken = await loadFirebaseCliToken();
  const writes = regionDocs.map((entry) => buildRegionWrite(entry.token, entry.doc));
  const batches = chunk(writes, 200);
  for (let i = 0; i < batches.length; i += 1) {
    await commitWrites({ accessToken, writes: batches[i] });
    console.log(`Committed batch ${i + 1}/${batches.length} (${batches[i].length} writes).`);
  }
  console.log("directory_regions seed upsert complete.");
}

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
