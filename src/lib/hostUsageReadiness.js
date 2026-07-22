const toFiniteNumber = (value = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeMeters = (meters = []) => (
    Array.isArray(meters) ? meters : Object.values(meters || {})
).filter(Boolean);

const getMeterWarningLevelBps = (meter = {}) => {
    const explicit = toFiniteNumber(meter.warningLevelBps);
    if (explicit > 0) return explicit;
    const hardLimit = Math.max(0, toFiniteNumber(meter.hardLimit));
    if (hardLimit <= 0) return 0;
    const exposure = Math.max(0, toFiniteNumber(meter.exposureUnits ?? meter.used));
    return Math.max(0, Math.min(10000, Math.round((exposure / hardLimit) * 10000)));
};

export const buildHostUsageReadiness = ({
    loading = false,
    error = '',
    meters = [],
    liveSearchState = 'enabled',
} = {}) => {
    const meterRows = normalizeMeters(meters);
    const finiteMeters = meterRows.filter((meter) => toFiniteNumber(meter?.hardLimit) > 0);
    const hardLimitMeters = meterRows.filter((meter) => meter?.hardLimitReached === true);
    const warningMeters = finiteMeters.filter((meter) => getMeterWarningLevelBps(meter) >= 8000);
    const maxWarningLevelBps = finiteMeters.reduce(
        (maximum, meter) => Math.max(maximum, getMeterWarningLevelBps(meter)),
        0,
    );
    const liveSearchPaused = String(liveSearchState || '').trim().toLowerCase() === 'blocked';

    if (loading) {
        return {
            status: 'syncing',
            label: 'Checking',
            title: 'Checking your Workspace capacity',
            summary: 'Your latest metered request status is loading.',
            nextAction: 'Wait for the current status',
            maxUsagePercent: Math.round(maxWarningLevelBps / 100),
            attentionMeterLabels: [],
        };
    }

    if (String(error || '').trim()) {
        return {
            status: 'unknown',
            label: 'Refresh needed',
            title: 'Capacity status is temporarily unavailable',
            summary: 'Core Room controls remain available while usage status reconnects.',
            nextAction: 'Refresh usage',
            maxUsagePercent: Math.round(maxWarningLevelBps / 100),
            attentionMeterLabels: [],
        };
    }

    if (finiteMeters.length === 0) {
        return {
            status: 'setup_required',
            label: 'Host plan needed',
            title: 'A finite Host plan capacity is required',
            summary: 'BeauRocks cannot confirm metered request headroom until the Workspace has active Host plan limits.',
            nextAction: 'Review Host plan',
            maxUsagePercent: 0,
            attentionMeterLabels: [],
        };
    }

    if (hardLimitMeters.length > 0 || liveSearchPaused) {
        const attentionMeterLabels = hardLimitMeters.map((meter) => String(meter?.label || meter?.meterId || '').trim()).filter(Boolean);
        return {
            status: 'action_needed',
            label: 'Action needed',
            title: 'Fresh provider requests are limited',
            summary: 'Cached and indexed tracks, local media, queue controls, Host override, and Public TV remain available.',
            nextAction: 'Review safety limits',
            maxUsagePercent: Math.round(maxWarningLevelBps / 100),
            attentionMeterLabels,
        };
    }

    if (warningMeters.length > 0) {
        const attentionMeterLabels = warningMeters.map((meter) => String(meter?.label || meter?.meterId || '').trim()).filter(Boolean);
        return {
            status: 'watch',
            label: 'Keep an eye on it',
            title: 'A metered request allowance is getting close',
            summary: 'Plan the next Room before relying on more fresh provider requests.',
            nextAction: 'Plan a Room',
            maxUsagePercent: Math.round(maxWarningLevelBps / 100),
            attentionMeterLabels,
        };
    }

    return {
        status: 'ready',
        label: 'On track',
        title: 'Current usage is within your Workspace limits',
        summary: 'No capacity action is needed right now. Use Plan a Room for an event-specific check.',
        nextAction: 'Plan your next Room',
        maxUsagePercent: Math.round(maxWarningLevelBps / 100),
        attentionMeterLabels: [],
    };
};

export { getMeterWarningLevelBps };
