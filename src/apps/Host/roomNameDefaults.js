const DEFAULT_ROOM_NAME_LOCALE = 'en-US';

export const buildDefaultHostRoomName = (hostName = '', nowValue = Date.now()) => {
    const safeHostName = String(hostName || '').trim() || 'Host';
    const parsedDate = new Date(nowValue);
    const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const timestamp = new Intl.DateTimeFormat(DEFAULT_ROOM_NAME_LOCALE, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
    }).format(safeDate);

    return `${safeHostName} · ${timestamp}`;
};
