import { BROWSE_BACKING_INDEX } from '../src/lib/browseBackingIndex.js';

const REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_CONCURRENCY = 8;
const RETRY_DELAYS_MS = [0, 500, 1500];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const fetchWithRetry = async (url, options = {}) => {
  let lastError = null;
  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs) await sleep(delayMs);
    try {
      const response = await withTimeout(url, options);
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) return response;
      lastError = new Error(`Request failed with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Request failed');
};

const getEntries = () => Object.entries(BROWSE_BACKING_INDEX)
  .map(([songKey, backing]) => ({
    songKey,
    videoId: String(backing?.videoId || '').trim(),
    title: String(backing?.title || backing?.label || songKey).trim(),
  }))
  .filter((entry) => entry.videoId);

const auditWithDataApi = async (entries, apiKey) => {
  const statusByVideoId = new Map();
  for (let offset = 0; offset < entries.length; offset += 50) {
    const chunk = entries.slice(offset, offset + 50);
    const ids = [...new Set(chunk.map((entry) => entry.videoId))];
    const query = new URLSearchParams({
      part: 'status',
      id: ids.join(','),
      key: apiKey,
    });
    const response = await fetchWithRetry(`https://www.googleapis.com/youtube/v3/videos?${query}`);
    if (!response.ok) throw new Error(`YouTube Data API failed with ${response.status}`);
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    items.forEach((item) => {
      const privacyStatus = String(item?.status?.privacyStatus || '').trim().toLowerCase();
      statusByVideoId.set(String(item?.id || '').trim(), {
        status: item?.status?.embeddable === true && ['public', 'unlisted'].includes(privacyStatus)
          ? 'available'
          : 'unavailable',
        reason: item?.status?.embeddable === true ? privacyStatus || 'privacy_restricted' : 'not_embeddable',
      });
    });
    ids.forEach((id) => {
      if (!statusByVideoId.has(id)) statusByVideoId.set(id, { status: 'unavailable', reason: 'missing' });
    });
  }
  return entries.map((entry) => ({ ...entry, ...(statusByVideoId.get(entry.videoId) || { status: 'unknown', reason: 'missing_status' }) }));
};

const auditWithOembed = async (entries, concurrency) => {
  const results = new Array(entries.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;
      const entry = entries[index];
      const watchUrl = `https://www.youtube.com/watch?v=${entry.videoId}`;
      const query = new URLSearchParams({ url: watchUrl, format: 'json' });
      try {
        const response = await fetchWithRetry(`https://www.youtube.com/oembed?${query}`, {
          headers: { 'user-agent': 'BeauRocks-Catalog-Audit/1.0' },
        });
        results[index] = {
          ...entry,
          status: response.ok ? 'available' : 'unavailable',
          reason: response.ok ? 'oembed_ok' : `oembed_${response.status}`,
        };
      } catch (error) {
        results[index] = {
          ...entry,
          status: 'unknown',
          reason: String(error?.name === 'AbortError' ? 'timeout' : error?.message || 'request_failed'),
        };
      }
    }
  });
  await Promise.all(workers);
  return results;
};

const main = async () => {
  const entries = getEntries();
  const concurrencyFlag = process.argv.indexOf('--concurrency');
  const concurrency = concurrencyFlag >= 0
    ? Math.max(1, Math.min(20, Number(process.argv[concurrencyFlag + 1] || DEFAULT_CONCURRENCY)))
    : DEFAULT_CONCURRENCY;
  const apiKey = String(process.env.YOUTUBE_API_KEY || '').trim();
  const results = apiKey
    ? await auditWithDataApi(entries, apiKey)
    : await auditWithOembed(entries, concurrency);
  const unavailable = results.filter((entry) => entry.status === 'unavailable');
  const unknown = results.filter((entry) => entry.status === 'unknown');
  unavailable.forEach((entry) => process.stdout.write(`UNAVAILABLE ${entry.songKey} :: ${entry.videoId} :: ${entry.reason}\n`));
  unknown.forEach((entry) => process.stdout.write(`UNKNOWN ${entry.songKey} :: ${entry.videoId} :: ${entry.reason}\n`));
  process.stdout.write(`${JSON.stringify({
    checkedAt: new Date().toISOString(),
    verification: apiKey ? 'youtube_data_api' : 'youtube_oembed',
    checked: results.length,
    available: results.filter((entry) => entry.status === 'available').length,
    unavailable: unavailable.length,
    unknown: unknown.length,
  })}\n`);
  if (process.argv.includes('--fail-on-unavailable') && (unavailable.length || unknown.length)) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
