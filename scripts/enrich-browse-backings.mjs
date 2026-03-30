import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { BROWSE_CATEGORIES, TOPIC_HITS } from '../src/lib/browseLists.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'src', 'lib', 'browseBackingIndex.js');
const HOST_APP_DATA_PATH = path.join(ROOT, 'src', 'apps', 'Host', 'hostAppData.js');
const SEARCH_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9',
};
const SEARCH_MAX_CANDIDATES = 8;
const FALLBACK_SEARCH_SUFFIXES = [
  'karaoke lyrics',
  'karaoke',
  'instrumental karaoke'
];
const REQUEST_RETRY_DELAYS_MS = [0, 500, 1500, 3000];
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
  'feat', 'featuring', 'version', 'from'
]);

const normalizeText = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const buildSongKey = (title = '', artist = '') => {
  const safeTitle = normalizeText(title);
  const safeArtist = normalizeText(artist || 'unknown') || 'unknown';
  return `${safeTitle}__${safeArtist}`;
};

const tokenize = (value = '') => normalizeText(value)
  .split(' ')
  .map((token) => token.trim())
  .filter((token) => token && !STOP_WORDS.has(token));

const readTop100SeedFromSource = async () => {
  const raw = await fs.readFile(HOST_APP_DATA_PATH, 'utf8');
  const match = raw.match(/export const TOP100_SEED = Object\.freeze\((\[[\s\S]*?\])\);/);
  if (!match?.[1]) {
    throw new Error('Could not parse TOP100_SEED from hostAppData.js');
  }
  return Function(`"use strict"; return (${match[1]});`)();
};

const parseJsonBlob = (html = '') => {
  const patterns = [
    /var ytInitialData = (.*?);<\/script>/s,
    /window\["ytInitialData"\] = (.*?);<\/script>/s,
    /ytInitialData"\s*:\s*(\{.*\})\s*,\s*"responseContext"/s,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      return JSON.parse(match[1]);
    } catch {
      continue;
    }
  }
  return null;
};

const walkForVideoRenderers = (node, acc = []) => {
  if (!node || typeof node !== 'object') return acc;
  if (node.videoRenderer && typeof node.videoRenderer === 'object') {
    acc.push(node.videoRenderer);
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => walkForVideoRenderers(entry, acc));
    return acc;
  }
  Object.values(node).forEach((value) => walkForVideoRenderers(value, acc));
  return acc;
};

const flattenRunsText = (value = null) => {
  if (!value) return '';
  if (typeof value?.simpleText === 'string') return value.simpleText;
  if (Array.isArray(value?.runs)) return value.runs.map((entry) => entry?.text || '').join('');
  return '';
};

const parseLooseViewCount = (value = '') => {
  const normalized = String(value || '').toLowerCase().replace(/,/g, '').trim();
  const match = normalized.match(/([\d.]+)\s*([kmb])?\s+views?/);
  if (!match) return 0;
  const base = Number(match[1] || 0);
  if (!Number.isFinite(base)) return 0;
  const suffix = match[2] || '';
  if (suffix === 'k') return Math.round(base * 1_000);
  if (suffix === 'm') return Math.round(base * 1_000_000);
  if (suffix === 'b') return Math.round(base * 1_000_000_000);
  return Math.round(base);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url, options = {}) => {
  let lastError = null;
  for (const delayMs of REQUEST_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`Request failed with ${response.status}`);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Request failed');
};

const parseClockDuration = (value = '') => {
  const parts = String(value || '')
    .split(':')
    .map((token) => Number(token.trim()))
    .filter((token) => Number.isFinite(token));
  if (!parts.length) return 0;
  return parts.reduce((total, part) => (total * 60) + part, 0);
};

const fetchHtmlSearchCandidates = async (query) => {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`;
  const response = await fetchWithRetry(url, { headers: SEARCH_HEADERS });
  if (!response.ok) {
    throw new Error(`YouTube search page failed with ${response.status}`);
  }
  const html = await response.text();
  const initialData = parseJsonBlob(html);
  if (!initialData) return [];
  const renderers = walkForVideoRenderers(initialData).slice(0, 20);
  return renderers
    .map((renderer) => ({
      id: String(renderer.videoId || '').trim(),
      title: flattenRunsText(renderer.title),
      channelTitle: flattenRunsText(renderer.ownerText) || flattenRunsText(renderer.longBylineText),
      lengthText: flattenRunsText(renderer.lengthText),
      viewCountText: flattenRunsText(renderer.viewCountText),
      rawViewCount: parseLooseViewCount(flattenRunsText(renderer.viewCountText)),
      durationSec: parseClockDuration(flattenRunsText(renderer.lengthText)),
    }))
    .filter((candidate) => candidate.id && candidate.title)
    .slice(0, SEARCH_MAX_CANDIDATES);
};

const fetchOembedStatus = async (videoId = '') => {
  const safeVideoId = String(videoId || '').trim();
  if (!safeVideoId) return { embeddable: false, playable: false };
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${safeVideoId}`)}&format=json`;
  const response = await fetchWithRetry(url, { headers: SEARCH_HEADERS });
  if (!response.ok) {
    return { embeddable: false, playable: false };
  }
  return { embeddable: true, playable: true };
};

const computeTokenOverlap = (needleTokens = [], haystack = '') => {
  if (!needleTokens.length) return 0;
  const haystackTokens = new Set(tokenize(haystack));
  const matched = needleTokens.filter((token) => haystackTokens.has(token)).length;
  return matched / needleTokens.length;
};

const scoreCandidate = ({ song, candidate, detail = null }) => {
  if (detail && (!detail.playable || !detail.embeddable)) return Number.NEGATIVE_INFINITY;
  const title = normalizeText(candidate.title);
  const channelTitle = normalizeText(candidate.channelTitle);
  const songTitleTokens = tokenize(song.title);
  const artistTokens = tokenize(song.artist);
  const titleOverlap = computeTokenOverlap(songTitleTokens, title);
  const artistOverlap = computeTokenOverlap(artistTokens, `${title} ${channelTitle}`);
  const karaokeSignals = [
    'karaoke',
    'instrumental',
    'backing track',
    'lyrics',
    'karafun',
    'sing king',
    'karaoke version',
  ];
  const negativeSignals = ['cover', 'live', 'reaction', 'lesson', 'tutorial', 'remix', 'dance'];
  let score = 0;
  score += title.includes('karaoke') ? 40 : 0;
  score += title.includes('instrumental') ? 14 : 0;
  score += title.includes('lyrics') ? 8 : 0;
  score += karaokeSignals.some((signal) => channelTitle.includes(signal)) ? 10 : 0;
  score += Math.round(titleOverlap * 32);
  score += Math.round(artistOverlap * 16);
  score += Math.min(18, Math.log10(Math.max(1, detail?.viewCount || candidate.rawViewCount || 1)) * 3);
  score -= negativeSignals.some((signal) => title.includes(signal)) ? 20 : 0;
  const durationSec = Number(detail?.durationSec || candidate.durationSec || 0);
  score -= durationSec > 0 && durationSec < 80 ? 30 : 0;
  score -= durationSec > 660 ? 12 : 0;
  return score;
};

const chooseBestCandidate = async (song) => {
  const attempts = [];
  for (const suffix of FALLBACK_SEARCH_SUFFIXES) {
    const query = `${song.title} ${song.artist} ${suffix}`.trim();
    const candidates = await fetchHtmlSearchCandidates(query);
    if (candidates.length) {
      attempts.push(...candidates);
    }
    if (attempts.length >= SEARCH_MAX_CANDIDATES) break;
  }
  const uniqueCandidates = [...new Map(attempts.map((candidate) => [candidate.id, candidate])).values()].slice(0, SEARCH_MAX_CANDIDATES);
  if (!uniqueCandidates.length) return null;
  const ranked = uniqueCandidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate({ song, candidate }),
    }))
    .sort((a, b) => b.score - a.score);
  const topCandidates = ranked.slice(0, 4);
  const verified = [];
  for (const entry of topCandidates) {
    const detail = await fetchOembedStatus(entry.candidate.id);
    const score = scoreCandidate({ song, candidate: entry.candidate, detail });
    if (Number.isFinite(score)) {
      verified.push({
        candidate: entry.candidate,
        detail: {
          ...detail,
          durationSec: entry.candidate.durationSec,
          viewCount: entry.candidate.rawViewCount,
        },
        score,
      });
    }
  }
  verified.sort((a, b) => b.score - a.score);
  const best = verified[0];
  if (!best || best.score < 28) return null;
  return {
    approved: true,
    playable: true,
    embeddable: true,
    trackSource: 'youtube',
    mediaUrl: `https://www.youtube.com/watch?v=${best.candidate.id}`,
    videoId: best.candidate.id,
    label: `${song.title} karaoke`,
    title: best.candidate.title,
    channelTitle: best.candidate.channelTitle,
    durationSec: Number(best.detail?.durationSec || 0),
    viewCount: Number(best.detail?.viewCount || best.candidate.rawViewCount || 0),
    qualityScore: Number(best.score || 0),
    localFallback: null,
  };
};

const serializeIndex = (indexEntries) => {
  const lines = ['export const BROWSE_BACKING_INDEX = Object.freeze({'];
  for (const [key, value] of indexEntries) {
    const json = JSON.stringify(value, null, 2)
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    lines.push(`  ${JSON.stringify(key)}: ${json.replace(/^  /, '')},`);
  }
  lines.push('});');
  lines.push('');
  return lines.join('\n');
};

const readExistingIndex = async () => {
  try {
    const moduleUrl = `${pathToFileURL(OUTPUT_PATH).href}?t=${Date.now()}`;
    const mod = await import(moduleUrl);
    const entries = Object.entries(mod?.BROWSE_BACKING_INDEX || {});
    return new Map(entries);
  } catch {
    return new Map();
  }
};

const main = async () => {
  const apply = process.argv.includes('--apply');
  const limitFlagIndex = process.argv.indexOf('--limit');
  const offsetFlagIndex = process.argv.indexOf('--offset');
  const limit = limitFlagIndex >= 0 ? Math.max(1, Number(process.argv[limitFlagIndex + 1] || 0) || 0) : 0;
  const offset = offsetFlagIndex >= 0 ? Math.max(0, Number(process.argv[offsetFlagIndex + 1] || 0) || 0) : 0;
  const top100Seed = await readTop100SeedFromSource();
  const songs = (() => {
    const seen = new Set();
    return [...BROWSE_CATEGORIES.flatMap((list) => list.songs), ...TOPIC_HITS.flatMap((list) => list.songs), ...top100Seed]
      .map((song) => ({
        title: String(song?.title || '').trim(),
        artist: String(song?.artist || '').trim() || 'Unknown',
      }))
      .filter((song) => song.title)
      .filter((song) => {
        const key = buildSongKey(song.title, song.artist);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  })();
  const slicedSongs = offset > 0 ? songs.slice(offset) : songs;
  const targetSongs = limit > 0 ? slicedSongs.slice(0, limit) : slicedSongs;
  const results = new Map();
  let foundCount = 0;

  for (let index = 0; index < targetSongs.length; index += 1) {
    const song = targetSongs[index];
    const key = buildSongKey(song.title, song.artist);
    process.stdout.write(`[${index + 1}/${targetSongs.length}] ${song.title} - ${song.artist}\n`);
    try {
      const best = await chooseBestCandidate(song);
      if (best) {
        results.set(key, best);
        foundCount += 1;
        process.stdout.write(`  matched ${best.videoId} (${best.viewCount} views)\n`);
      } else {
        process.stdout.write('  no approved match\n');
      }
    } catch (error) {
      process.stdout.write(`  failed: ${error.message}\n`);
    }
    await sleep(250);
  }

  process.stdout.write(`Matched ${foundCount} of ${targetSongs.length} songs.\n`);
  if (!apply) return;

  const existing = await readExistingIndex();
  for (const [key, value] of results.entries()) {
    existing.set(key, value);
  }
  const fileContent = serializeIndex([...existing.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  await fs.writeFile(OUTPUT_PATH, fileContent, 'utf8');
  process.stdout.write(`Wrote ${existing.size} entries to ${path.relative(ROOT, OUTPUT_PATH)}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
