const LOG_LEVEL_RANK = Object.freeze({
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
});

const getConfiguredLevel = () => {
    const raw = String(import.meta.env.VITE_LOG_LEVEL || '').trim().toLowerCase();
    if (raw && Object.prototype.hasOwnProperty.call(LOG_LEVEL_RANK, raw)) {
        return raw;
    }
    return import.meta.env.PROD ? 'warn' : 'info';
};

const ACTIVE_LEVEL = getConfiguredLevel();
const ACTIVE_RANK = LOG_LEVEL_RANK[ACTIVE_LEVEL];
const onceCache = new Set();

const shouldLog = (level) => LOG_LEVEL_RANK[level] <= ACTIVE_RANK;

const write = (method, scope, args) => {
    if (!shouldLog(method)) return;
    const label = scope ? `[${scope}]` : '[app]';
    console[method](label, ...args);
};

export const createLogger = (scope = '') => ({
    error: (...args) => write('error', scope, args),
    warn: (...args) => write('warn', scope, args),
    info: (...args) => write('info', scope, args),
    debug: (...args) => write('debug', scope, args),
    warnOnce: (key, ...args) => {
        const resolved = `${scope}:${key}`;
        if (onceCache.has(resolved)) return;
        onceCache.add(resolved);
        write('warn', scope, args);
    },
    debugOnce: (key, ...args) => {
        const resolved = `${scope}:${key}`;
        if (onceCache.has(resolved)) return;
        onceCache.add(resolved);
        write('debug', scope, args);
    }
});

