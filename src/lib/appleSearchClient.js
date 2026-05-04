import { callFunction } from './firebase';

const APPLE_SEARCH_TELEMETRY_WINDOW_MS = 15 * 60 * 1000;
const appleSearchTelemetrySubscribers = new Set();
const appleSearchTelemetryEvents = [];

const nowMs = () => Date.now();

const pruneAppleSearchTelemetryEvents = (now = nowMs()) => {
    const cutoffMs = Number(now || nowMs()) - APPLE_SEARCH_TELEMETRY_WINDOW_MS;
    while (appleSearchTelemetryEvents.length > 0 && Number(appleSearchTelemetryEvents[0]?.atMs || 0) < cutoffMs) {
        appleSearchTelemetryEvents.shift();
    }
};

const buildAppleSearchTelemetrySnapshot = () => {
    const now = nowMs();
    pruneAppleSearchTelemetryEvents(now);
    const summary = {
        windowMs: APPLE_SEARCH_TELEMETRY_WINDOW_MS,
        windowLabel: '15m',
        recentSearches: 0,
        successes: 0,
        failures: 0,
        emptyResults: 0,
        lastOutcome: '',
        lastUpdatedAtMs: 0,
        successPct: 0,
        failurePct: 0,
    };
    for (const event of appleSearchTelemetryEvents) {
        const kind = String(event?.kind || '').trim().toLowerCase();
        if (!['success', 'empty', 'failure'].includes(kind)) continue;
        summary.recentSearches += 1;
        summary.lastOutcome = kind;
        summary.lastUpdatedAtMs = Math.max(summary.lastUpdatedAtMs, Number(event?.atMs || 0));
        if (kind === 'success') summary.successes += 1;
        if (kind === 'empty') {
            summary.successes += 1;
            summary.emptyResults += 1;
        }
        if (kind === 'failure') summary.failures += 1;
    }
    if (summary.recentSearches > 0) {
        summary.successPct = Math.round((summary.successes / summary.recentSearches) * 100);
        summary.failurePct = Math.round((summary.failures / summary.recentSearches) * 100);
    }
    return summary;
};

const notifyAppleSearchTelemetrySubscribers = () => {
    const snapshot = buildAppleSearchTelemetrySnapshot();
    for (const subscriber of appleSearchTelemetrySubscribers) {
        try {
            subscriber(snapshot);
        } catch {
            // Ignore subscriber failures.
        }
    }
};

const recordAppleSearchTelemetryEvent = (kind = '') => {
    const safeKind = String(kind || '').trim().toLowerCase();
    if (!safeKind) return;
    appleSearchTelemetryEvents.push({
        kind: safeKind,
        atMs: nowMs(),
    });
    notifyAppleSearchTelemetrySubscribers();
};

export const getAppleSearchTelemetrySnapshot = () => buildAppleSearchTelemetrySnapshot();

export const subscribeToAppleSearchTelemetry = (listener) => {
    if (typeof listener !== 'function') return () => {};
    appleSearchTelemetrySubscribers.add(listener);
    listener(buildAppleSearchTelemetrySnapshot());
    return () => {
        appleSearchTelemetrySubscribers.delete(listener);
    };
};

export const searchAppleCatalog = async ({
    term = '',
    limit = 5,
    roomCode = '',
    usageSource = 'apple_search',
} = {}) => {
    const safeTerm = String(term || '').trim();
    if (!safeTerm) return { results: [] };
    try {
        const data = await callFunction('itunesSearch', {
            term: safeTerm,
            limit: Math.max(1, Number(limit || 5) || 5),
            roomCode,
            usageContext: { source: usageSource },
        });
        const results = Array.isArray(data?.results) ? data.results : [];
        recordAppleSearchTelemetryEvent(results.length > 0 ? 'success' : 'empty');
        return {
            ...(data || {}),
            results,
        };
    } catch (error) {
        recordAppleSearchTelemetryEvent('failure');
        throw error;
    }
};
