import React, { useMemo } from 'react';
import groupChatMessages from '../../../lib/chatGrouping';
import { resolveRoomUserUid } from '../../../lib/gameLaunchSupport';

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

const formatAgeLabel = (value) => {
    const timestampMs = toTimestampMs(value);
    if (!timestampMs) return 'Live now';
    const diffMs = Math.max(0, Date.now() - timestampMs);
    const sec = Math.floor(diffMs / 1000);
    if (sec < 45) return 'Just now';
    if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}m ago`;
    if (sec < 86400) return `${Math.max(1, Math.round(sec / 3600))}h ago`;
    return `${Math.max(1, Math.round(sec / 86400))}d ago`;
};

const moderationTypeLabel = (type = '') => {
    if (type === 'doodle') return 'Doodle-oke';
    if (type === 'selfie') return 'Selfie';
    if (type === 'crowd_selfie') return 'Crowd Selfie';
    if (type === 'bingo') return 'Bingo';
    return 'Moderation';
};

const badgeClassBySource = {
    'Co-Host': 'border-amber-300/30 bg-amber-500/12 text-amber-100',
    Moderation: 'border-rose-300/30 bg-rose-500/12 text-rose-100',
    DM: 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100',
    Audience: 'border-white/10 bg-black/20 text-zinc-200',
    System: 'border-violet-300/30 bg-violet-500/12 text-violet-100',
};

const cardToneBySource = {
    'Co-Host': 'border-amber-300/20 bg-amber-500/8',
    Moderation: 'border-rose-300/18 bg-rose-500/8',
    DM: 'border-cyan-300/20 bg-cyan-500/8',
    Audience: 'border-white/10 bg-black/20',
    System: 'border-violet-300/20 bg-violet-500/8',
};

const itemButtonClass = 'inline-flex min-h-[32px] items-center justify-center rounded-xl border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition';

const ItemBadge = ({ source = 'Audience' }) => (
    <span className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${badgeClassBySource[source] || badgeClassBySource.Audience}`}>
        {source}
    </span>
);

const InboxItemCard = ({
    item,
    styles,
    emoji,
    dmTargetUid,
    setDmTargetUid,
    dmDraft,
    setDmDraft,
    sendHostDmMessage,
    usersByUid,
}) => {
    const canReply = item.type === 'dm' && item.senderUid;
    const replyTargetLabel = canReply ? (usersByUid[item.senderUid] || item.title || 'Guest') : '';
    const replySelected = canReply && dmTargetUid === item.senderUid;
    const busyAction = item.moderationBusyAction || '';

    return (
        <div className={`rounded-2xl border px-3 py-3 ${cardToneBySource[item.source] || cardToneBySource.Audience}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <ItemBadge source={item.source} />
                        <div className="truncate text-[12px] font-semibold text-white">{item.title}</div>
                        {item.countLabel ? (
                            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                {item.countLabel}
                            </span>
                        ) : null}
                    </div>
                    <div className="mt-1 text-[12px] leading-snug text-zinc-200">{item.body}</div>
                    {item.context ? (
                        <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-zinc-400">{item.context}</div>
                    ) : null}
                </div>
                <div className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-zinc-400">{item.ageLabel}</div>
            </div>

            {item.type === 'moderation' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                    {item.moderationType === 'doodle' ? (
                        <button
                            type="button"
                            onClick={() => item.onApprove?.()}
                            disabled={!!busyAction || typeof item.onApprove !== 'function'}
                            className={`${styles?.btnStd || ''} ${styles?.btnHighlight || ''} text-[10px] px-3 py-1.5 ${busyAction || typeof item.onApprove !== 'function' ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            Approve
                        </button>
                    ) : null}
                    {item.moderationType === 'selfie' ? (
                        <button
                            type="button"
                            onClick={() => item.onApprove?.()}
                            disabled={!!busyAction || typeof item.onApprove !== 'function'}
                            className={`${styles?.btnStd || ''} ${styles?.btnInfo || ''} text-[10px] px-3 py-1.5 ${busyAction || typeof item.onApprove !== 'function' ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            Approve + Queue
                        </button>
                    ) : null}
                    {item.moderationType === 'crowd_selfie' ? (
                        <>
                            <button
                                type="button"
                                onClick={() => item.onApprove?.()}
                                disabled={!!busyAction || typeof item.onApprove !== 'function'}
                                className={`${styles?.btnStd || ''} ${styles?.btnHighlight || ''} text-[10px] px-3 py-1.5 ${busyAction || typeof item.onApprove !== 'function' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Approve + Show
                            </button>
                            <button
                                type="button"
                                onClick={() => item.onReject?.()}
                                disabled={!!busyAction || typeof item.onReject !== 'function'}
                                className={`${styles?.btnStd || ''} text-[10px] px-3 py-1.5 border border-red-400/35 bg-red-500/12 text-red-100 ${busyAction || typeof item.onReject !== 'function' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Reject
                            </button>
                        </>
                    ) : null}
                    {item.moderationType === 'bingo' ? (
                        <>
                            <button
                                type="button"
                                onClick={() => item.onApprove?.()}
                                disabled={!!busyAction || typeof item.onApprove !== 'function'}
                                className={`${styles?.btnStd || ''} ${styles?.btnHighlight || ''} text-[10px] px-3 py-1.5 ${busyAction || typeof item.onApprove !== 'function' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Reveal Tile
                            </button>
                            <button
                                type="button"
                                onClick={() => item.onReject?.()}
                                disabled={!!busyAction || typeof item.onReject !== 'function'}
                                className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} text-[10px] px-3 py-1.5 ${busyAction || typeof item.onReject !== 'function' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Clear
                            </button>
                        </>
                    ) : null}
                </div>
            ) : null}

            {item.type === 'track_check' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => item.onApprove?.()}
                        disabled={!!item.busy || typeof item.onApprove !== 'function'}
                        className={`${styles?.btnStd || ''} ${styles?.btnHighlight || ''} text-[10px] px-3 py-1.5 ${item.busy || typeof item.onApprove !== 'function' ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        Use Again
                    </button>
                    <button
                        type="button"
                        onClick={() => item.onReject?.()}
                        disabled={!!item.busy || typeof item.onReject !== 'function'}
                        className={`${styles?.btnStd || ''} text-[10px] px-3 py-1.5 border border-rose-300/35 bg-rose-500/12 text-rose-100 ${item.busy || typeof item.onReject !== 'function' ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        Bad Track
                    </button>
                    <button
                        type="button"
                        onClick={() => item.onDismiss?.()}
                        disabled={!!item.busy || typeof item.onDismiss !== 'function'}
                        className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} text-[10px] px-3 py-1.5 ${item.busy || typeof item.onDismiss !== 'function' ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        Skip
                    </button>
                </div>
            ) : null}

            {canReply ? (
                <div className="mt-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setDmTargetUid?.(item.senderUid)}
                            className={`${itemButtonClass} border-cyan-300/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-200/55 hover:bg-cyan-500/18`}
                        >
                            {replySelected ? 'Replying' : 'Reply'}
                        </button>
                        <div className="text-[11px] text-zinc-400">
                            {replySelected ? `Sending to ${replyTargetLabel}` : `Direct message from ${replyTargetLabel}`}
                        </div>
                    </div>
                    {replySelected ? (
                        <div className="mt-2 flex gap-2">
                            <input
                                value={dmDraft}
                                onChange={(event) => setDmDraft?.(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter' || event.shiftKey) return;
                                    event.preventDefault();
                                    const nextMessage = String(dmDraft || '').trim();
                                    if (!nextMessage) return;
                                    sendHostDmMessage?.(item.senderUid, nextMessage);
                                    setDmDraft?.('');
                                }}
                                className={`${styles?.input || ''} flex-1 text-xs`}
                                placeholder={`Reply to ${replyTargetLabel}...`}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const nextMessage = String(dmDraft || '').trim();
                                    if (!nextMessage) return;
                                    sendHostDmMessage?.(item.senderUid, nextMessage);
                                    setDmDraft?.('');
                                }}
                                disabled={!String(dmDraft || '').trim()}
                                className={`${styles?.btnStd || ''} ${styles?.btnSecondary || ''} px-3 ${!String(dmDraft || '').trim() ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <i className="fa-solid fa-paper-plane mr-2"></i>Send
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {item.type === 'room_chat' ? (
                <div className="mt-2 text-[11px] text-zinc-500">
                    {emoji?.sparkle || '•'} Passive lounge chatter. Open full chat only if you need to jump in.
                </div>
            ) : null}
        </div>
    );
};

const InboxBucket = ({
    label,
    count,
    accentClass,
    items,
    emptyTitle,
    emptyBody,
    styles,
    emoji,
    dmTargetUid,
    setDmTargetUid,
    dmDraft,
    setDmDraft,
    sendHostDmMessage,
    usersByUid,
}) => (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${accentClass}`}></div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white">{label}</div>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                {count}
            </span>
        </div>
        {items.length ? (
            <div className="mt-3 space-y-2">
                {items.map((item) => (
                    <InboxItemCard
                        key={item.id}
                        item={item}
                        styles={styles}
                        emoji={emoji}
                        dmTargetUid={dmTargetUid}
                        setDmTargetUid={setDmTargetUid}
                        dmDraft={dmDraft}
                        setDmDraft={setDmDraft}
                        sendHostDmMessage={sendHostDmMessage}
                        usersByUid={usersByUid}
                    />
                ))}
            </div>
        ) : (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                <div className="text-[12px] font-semibold text-white">{emptyTitle}</div>
                <div className="mt-1 text-[11px] leading-snug text-zinc-400">{emptyBody}</div>
            </div>
        )}
    </div>
);

export default function HostInboxPanel({
    roomCode = '',
    hostBase = '',
    systemInboxItems = [],
    coHostSignals = [],
    roomChatMessages = [],
    hostDmMessages = [],
    moderationQueueItems = [],
    moderationCounts = {},
    moderationActions = {},
    moderationBusyAction = '',
    moderationNeedsAttention = false,
    chatUnread = 0,
    dmUnread = 0,
    users = [],
    handleChatViewMode,
    openChatSettings,
    onOpenModerationInbox,
    dmTargetUid = '',
    setDmTargetUid,
    dmDraft = '',
    setDmDraft,
    sendHostDmMessage,
    styles,
    emoji,
}) {
    const usersByUid = useMemo(() => {
        const next = {};
        (Array.isArray(users) ? users : []).forEach((entry) => {
            const uid = resolveRoomUserUid(entry);
            if (!uid) return;
            next[uid] = entry?.name || 'Guest';
        });
        return next;
    }, [users]);

    const hostDmGroups = useMemo(
        () => groupChatMessages((Array.isArray(hostDmMessages) ? hostDmMessages : []).slice(-8), { mergeWindowMs: 12 * 60 * 1000 }).reverse(),
        [hostDmMessages]
    );
    const roomChatGroups = useMemo(
        () => groupChatMessages((Array.isArray(roomChatMessages) ? roomChatMessages : []).slice(-8), { mergeWindowMs: 12 * 60 * 1000 }).reverse(),
        [roomChatMessages]
    );

    const moderationItems = useMemo(() => (
        Array.isArray(moderationQueueItems)
            ? moderationQueueItems.slice(0, 4).map((item) => ({
                id: item.key,
                type: 'moderation',
                source: 'Moderation',
                title: item.title || moderationTypeLabel(item.type),
                body: item.subtitle || 'Pending review',
                context: moderationTypeLabel(item.type),
                ageLabel: formatAgeLabel(item.timestamp),
                moderationType: item.type,
                moderationBusyAction,
                onApprove: item.type === 'doodle'
                    ? () => moderationActions?.approveDoodleUid?.(item.submission?.uid)
                    : item.type === 'selfie'
                        ? () => moderationActions?.approveSelfieSubmission?.(item.submission)
                        : item.type === 'crowd_selfie'
                            ? () => moderationActions?.moderateCrowdSelfieSubmission?.(item.submission, 'approve')
                            : item.type === 'bingo'
                                ? () => moderationActions?.approveBingoSuggestion?.(item.suggestion?.idx)
                                : null,
                onReject: item.type === 'crowd_selfie'
                    ? () => moderationActions?.moderateCrowdSelfieSubmission?.(item.submission, 'reject')
                    : item.type === 'bingo'
                        ? () => moderationActions?.clearBingoSuggestion?.(item.suggestion?.idx)
                        : null,
            }))
            : []
    ), [moderationActions, moderationBusyAction, moderationQueueItems]);

    const coHostItems = useMemo(() => (
        Array.isArray(coHostSignals)
            ? coHostSignals.slice(0, 4).map((signal) => ({
                id: signal.id || `${signal.label}-${signal.latestAt || signal.latestAgeLabel || 'recent'}`,
                type: 'cohost',
                source: 'Co-Host',
                title: signal.hostLabel || signal.label || 'Co-host note',
                body: signal.summary || 'Live note from the floor',
                context: signal.contextTitle
                    ? `${signal.contextTitle}${signal.contextMeta ? ` • ${signal.contextMeta}` : ''}`
                    : (signal.contextMeta || 'Live performance context'),
                ageLabel: signal.latestAgeLabel || 'recently',
                countLabel: `${signal.uniqueCount || signal.count || 1}`,
            }))
            : []
    ), [coHostSignals]);

    const dmItems = useMemo(() => (
        hostDmGroups.map((group) => ({
            id: group.id,
            type: 'dm',
            source: 'DM',
            title: group.user || 'Guest',
            body: group.messages[group.messages.length - 1]?.text || 'New direct message',
            context: group.messages.length > 1 ? `${group.messages.length} messages in this thread` : 'Direct host message',
            ageLabel: formatAgeLabel(group.messages[group.messages.length - 1]?.timestamp),
            senderUid: group.senderUid,
        }))
    ), [hostDmGroups]);

    const roomFeedItems = useMemo(() => (
        roomChatGroups.map((group) => ({
            id: group.id,
            type: 'room_chat',
            source: 'Audience',
            title: group.user || 'Guest',
            body: group.messages[group.messages.length - 1]?.text || 'Lounge note',
            context: group.messages.length > 1 ? `${group.messages.length} messages in lounge thread` : 'Lounge chat',
            ageLabel: formatAgeLabel(group.messages[group.messages.length - 1]?.timestamp),
        }))
    ), [roomChatGroups]);

    const systemItems = useMemo(() => (
        Array.isArray(systemInboxItems)
            ? systemInboxItems.slice(0, 4)
            : []
    ), [systemInboxItems]);
    const needsHostItems = [...systemItems, ...moderationItems, ...coHostItems, ...dmItems];
    const everythingElseItems = roomFeedItems;
    const needsHostCount = needsHostItems.length;
    const everythingElseCount = everythingElseItems.length;
    const pendingModerationCount = Math.max(0, Number(moderationCounts?.totalPending || 0));

    return (
        <div data-feature-id="host-inbox-panel">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-300">Host Inbox</div>
                    <div className="mt-1 text-[12px] leading-snug text-zinc-300">
                        Co-host notes, moderation, direct messages, and lounge chatter in one live view.
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]">
                    <span className={`rounded-full border px-2 py-1 ${needsHostCount ? 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-black/20 text-zinc-300'}`}>
                        {needsHostCount} needs host
                    </span>
                    <span className={`rounded-full border px-2 py-1 ${pendingModerationCount ? 'border-rose-300/25 bg-rose-500/10 text-rose-100' : 'border-white/10 bg-black/20 text-zinc-300'}`}>
                        {pendingModerationCount} moderation
                    </span>
                    {(chatUnread || dmUnread) ? (
                        <span className="rounded-full border border-pink-300/35 bg-pink-500/10 px-2 py-1 text-pink-100">
                            {Number(chatUnread || 0) + Number(dmUnread || 0)} new
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => {
                        handleChatViewMode?.('host');
                        onOpenModerationInbox?.();
                    }}
                    className={`${itemButtonClass} border-cyan-300/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-200/55 hover:bg-cyan-500/18`}
                >
                    Open Action Tools
                </button>
                <button
                    type="button"
                    onClick={() => {
                        handleChatViewMode?.('room');
                        if (hostBase && roomCode && typeof window !== 'undefined') {
                            window.open(`${hostBase}?room=${roomCode}&mode=host&tab=stage&chat=1`, '_blank');
                        }
                    }}
                    className={`${itemButtonClass} border-white/10 bg-black/20 text-zinc-200 hover:border-white/20 hover:bg-black/35`}
                >
                    Pop Out Chat
                </button>
                <button
                    type="button"
                    onClick={() => openChatSettings?.()}
                    className={`${itemButtonClass} border-white/10 bg-black/20 text-zinc-200 hover:border-white/20 hover:bg-black/35`}
                >
                    Chat Settings
                </button>
                {moderationNeedsAttention ? (
                    <span className="inline-flex min-h-[32px] items-center justify-center rounded-xl border border-amber-300/25 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
                        Moderation needs attention
                    </span>
                ) : null}
            </div>

            <div className="space-y-3">
                <InboxBucket
                    label="Needs Host"
                    count={needsHostCount}
                    accentClass="bg-cyan-300"
                    items={needsHostItems}
                    emptyTitle="Nothing is actively pulling the host right now."
                    emptyBody="Critical notes, moderation approvals, and direct host messages will stack here."
                    styles={styles}
                    emoji={emoji}
                    dmTargetUid={dmTargetUid}
                    setDmTargetUid={setDmTargetUid}
                    dmDraft={dmDraft}
                    setDmDraft={setDmDraft}
                    sendHostDmMessage={sendHostDmMessage}
                    usersByUid={usersByUid}
                />
                <InboxBucket
                    label="Everything Else"
                    count={everythingElseCount}
                    accentClass="bg-zinc-400"
                    items={everythingElseItems}
                    emptyTitle="The room is quiet."
                    emptyBody="Audience lounge chat will stay here unless it becomes something the host needs to act on."
                    styles={styles}
                    emoji={emoji}
                    dmTargetUid={dmTargetUid}
                    setDmTargetUid={setDmTargetUid}
                    dmDraft={dmDraft}
                    setDmDraft={setDmDraft}
                    sendHostDmMessage={sendHostDmMessage}
                    usersByUid={usersByUid}
                />
            </div>
        </div>
    );
}
