const toTimestampMs = (value) => {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') {
        const nanos = typeof value?.nanoseconds === 'number' ? value.nanoseconds : 0;
        return (value.seconds * 1000) + Math.floor(nanos / 1000000);
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const senderKeyForMessage = (message = {}) => (
    message?.uid
    || message?.userId
    || message?.fromUid
    || message?.toUid
    || message?.user
    || message?.name
    || 'unknown'
);

export const groupChatMessages = (messages = [], options = {}) => {
    const mergeWindowMs = Number(options?.mergeWindowMs || 8 * 60 * 1000);
    const groups = [];

    messages.forEach((message, index) => {
        if (!message) return;
        const senderKey = senderKeyForMessage(message);
        const timestampMs = toTimestampMs(message.timestamp);
        const previousGroup = groups[groups.length - 1];
        const previousMessage = previousGroup?.messages?.[previousGroup.messages.length - 1];
        const previousTs = previousMessage?.timestampMs || 0;
        const closeInTime = !previousTs || !timestampMs || Math.abs(previousTs - timestampMs) <= mergeWindowMs;
        const canMerge = previousGroup
            && previousGroup.senderKey === senderKey
            && closeInTime;

        const normalizedMessage = {
            ...message,
            timestampMs
        };

        if (canMerge) {
            previousGroup.messages.push(normalizedMessage);
            return;
        }

        groups.push({
            id: message.id || `group-${senderKey}-${index}`,
            senderKey,
            senderUid: String(message?.uid || message?.fromUid || message?.userId || message?.toUid || '').trim(),
            user: message.user || message.name || 'Guest',
            avatar: message.avatar || null,
            isVip: !!message.isVip,
            isHost: !!message.isHost,
            messages: [normalizedMessage]
        });
    });

    return groups;
};

export default groupChatMessages;
