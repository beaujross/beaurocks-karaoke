const sanitizeOperationToken = (value = '') => String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);

const randomToken = () => {
    if (typeof globalThis?.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID().replace(/-/g, '');
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
};

export const createUsageOperationId = (prefix = 'usage') => {
    const safePrefix = sanitizeOperationToken(prefix) || 'usage';
    return `${safePrefix}:${Date.now().toString(36)}:${randomToken().slice(0, 32)}`;
};
