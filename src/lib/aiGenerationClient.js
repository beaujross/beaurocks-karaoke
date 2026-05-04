import { callFunction } from './firebase';

const AI_TELEMETRY_WINDOW_MS = 15 * 60 * 1000;
const aiTelemetrySubscribers = new Set();
const aiTelemetryEvents = [];

const nowMs = () => Date.now();

const pruneAiTelemetryEvents = (now = nowMs()) => {
    const cutoffMs = Number(now || nowMs()) - AI_TELEMETRY_WINDOW_MS;
    while (aiTelemetryEvents.length > 0 && Number(aiTelemetryEvents[0]?.atMs || 0) < cutoffMs) {
        aiTelemetryEvents.shift();
    }
};

const buildAiTelemetrySnapshot = () => {
    const now = nowMs();
    pruneAiTelemetryEvents(now);
    const summary = {
        windowMs: AI_TELEMETRY_WINDOW_MS,
        windowLabel: '15m',
        recentGenerations: 0,
        successes: 0,
        failures: 0,
        lastOutcome: '',
        lastUpdatedAtMs: 0,
        successPct: 0,
        failurePct: 0,
    };
    for (const event of aiTelemetryEvents) {
        const kind = String(event?.kind || '').trim().toLowerCase();
        if (!['success', 'failure'].includes(kind)) continue;
        summary.recentGenerations += 1;
        summary.lastOutcome = kind;
        summary.lastUpdatedAtMs = Math.max(summary.lastUpdatedAtMs, Number(event?.atMs || 0));
        if (kind === 'success') summary.successes += 1;
        if (kind === 'failure') summary.failures += 1;
    }
    if (summary.recentGenerations > 0) {
        summary.successPct = Math.round((summary.successes / summary.recentGenerations) * 100);
        summary.failurePct = Math.round((summary.failures / summary.recentGenerations) * 100);
    }
    return summary;
};

const notifyAiTelemetrySubscribers = () => {
    const snapshot = buildAiTelemetrySnapshot();
    for (const subscriber of aiTelemetrySubscribers) {
        try {
            subscriber(snapshot);
        } catch {
            // Ignore subscriber failures.
        }
    }
};

const recordAiTelemetryEvent = (kind = '') => {
    const safeKind = String(kind || '').trim().toLowerCase();
    if (!safeKind) return;
    aiTelemetryEvents.push({
        kind: safeKind,
        atMs: nowMs(),
    });
    notifyAiTelemetrySubscribers();
};

export const getAiGenerationTelemetrySnapshot = () => buildAiTelemetrySnapshot();

export const subscribeToAiGenerationTelemetry = (listener) => {
    if (typeof listener !== 'function') return () => {};
    aiTelemetrySubscribers.add(listener);
    listener(buildAiTelemetrySnapshot());
    return () => {
        aiTelemetrySubscribers.delete(listener);
    };
};

export const generateAiContentRequest = async ({
    type = '',
    context = null,
    roomCode = '',
    usageSource = '',
} = {}) => {
    const safeType = String(type || '').trim();
    if (!safeType) return null;
    const payload = roomCode
        ? { type: safeType, context, roomCode, usageContext: { source: usageSource || `host_${safeType}` } }
        : { type: safeType, context, usageContext: { source: usageSource || `host_${safeType}` } };
    try {
        const data = await callFunction('geminiGenerate', payload);
        recordAiTelemetryEvent('success');
        return data?.result || null;
    } catch (error) {
        recordAiTelemetryEvent('failure');
        throw error;
    }
};
