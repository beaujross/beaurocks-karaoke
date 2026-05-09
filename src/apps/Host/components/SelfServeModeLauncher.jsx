import React, { useEffect, useMemo, useState } from 'react';
import {
    buildSelfServeModePresentation,
    SELF_SERVE_FORMATS,
    buildSelfServeActivationPatch,
    buildSelfServeReturnPatch,
    buildSelfServeRulesCard,
    buildSelfServeTvPreviewOverlay,
    endSelfServeAuctionWindow,
    getSelfServeAuctionWindow,
    getSelfServeLaunchOptions,
    isSelfServeAuctionWindowLive,
    normalizeSelfServeFormat,
} from '../../../lib/selfServeKaraoke';

const CARD_ACCENTS = {
    [SELF_SERVE_FORMATS.openStage]: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100',
    [SELF_SERVE_FORMATS.spotlightAuction]: 'border-amber-300/30 bg-amber-500/10 text-amber-100',
    [SELF_SERVE_FORMATS.showcase]: 'border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100',
};

const BUTTON = 'rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition';

const SelfServeModeLauncher = ({
    room = null,
    roomCode = '',
    updateRoom,
    toast,
}) => {
    const activeFormat = normalizeSelfServeFormat(room?.selfServeMode?.format || '');
    const [selectedFormat, setSelectedFormat] = useState(activeFormat || SELF_SERVE_FORMATS.openStage);
    const [busyAction, setBusyAction] = useState('');

    useEffect(() => {
        if (room?.selfServeMode?.enabled) {
            setSelectedFormat(activeFormat);
        }
    }, [activeFormat, room?.selfServeMode?.enabled]);

    const launchOptions = useMemo(() => getSelfServeLaunchOptions(), []);
    const selectedCard = useMemo(() => buildSelfServeRulesCard(selectedFormat), [selectedFormat]);
    const activeCard = useMemo(
        () => (room?.selfServeMode?.enabled ? buildSelfServeRulesCard(activeFormat) : null),
        [activeFormat, room?.selfServeMode?.enabled]
    );

    const runRoomUpdate = async (actionKey, patch, successMessage) => {
        if (typeof updateRoom !== 'function' || busyAction) return;
        setBusyAction(actionKey);
        try {
            await updateRoom(patch);
            if (successMessage && typeof toast === 'function') toast(successMessage);
        } catch (_error) {
            if (typeof toast === 'function') {
                toast(`Could not update self-serve mode${actionKey ? ` (${actionKey})` : ''}.`);
            }
        } finally {
            setBusyAction('');
        }
    };

    const previewSelectedFormat = async () => runRoomUpdate('preview', {
        tvPreviewOverlay: buildSelfServeTvPreviewOverlay(selectedFormat),
    }, `${selectedCard.shortLabel} preview opened on TV.`);

    const clearPreview = async () => runRoomUpdate('clear_preview', {
        tvPreviewOverlay: null,
    }, 'TV preview cleared.');

    const activateSelectedFormat = async () => runRoomUpdate('activate',
        buildSelfServeActivationPatch(selectedFormat, room, {
            startedAtMs: Date.now(),
        }),
        `${selectedCard.launchLabel} is live.`
    );

    const returnToNormal = async () => runRoomUpdate('return',
        buildSelfServeReturnPatch(room),
        'Returned to normal karaoke.'
    );

    const togglePauseNewEntries = async () => {
        if (!room?.selfServeMode?.enabled) return;
        await runRoomUpdate('pause_entries', {
            selfServeMode: {
                ...room.selfServeMode,
                pauseNewEntries: room?.selfServeMode?.pauseNewEntries !== true,
            },
        }, room?.selfServeMode?.pauseNewEntries ? 'New entries reopened.' : 'New entries paused.');
    };

    const togglePaidPriority = async () => {
        if (!room?.selfServeMode?.enabled) return;
        if (room?.selfServeMode?.paidPriorityEnabled === false && activeAuctionWindow.closed) {
            if (typeof toast === 'function') {
                toast('This Spotlight Auction block is already closed. Launch a new block to reopen paid priority.');
            }
            return;
        }
        await runRoomUpdate('paid_priority', {
            selfServeMode: {
                ...room.selfServeMode,
                paidPriorityEnabled: room?.selfServeMode?.paidPriorityEnabled === false,
            },
        }, room?.selfServeMode?.paidPriorityEnabled === false ? 'Paid priority re-enabled.' : 'Paid priority disabled.');
    };

    const endSponsoredBlock = async () => {
        if (!room?.selfServeMode?.enabled || !activeCard?.supportsAuction) return;
        await runRoomUpdate('end_sponsored_block', {
            selfServeMode: endSelfServeAuctionWindow(room.selfServeMode, {
                nowMs: Date.now(),
                closeReason: 'manual_end',
            }),
        }, 'Sponsored block ended. The room is back on fair queueing.');
    };

    const currentAccent = CARD_ACCENTS[selectedCard.id] || CARD_ACCENTS[SELF_SERVE_FORMATS.openStage];
    const activeAccent = activeCard ? (CARD_ACCENTS[activeCard.id] || CARD_ACCENTS[SELF_SERVE_FORMATS.openStage]) : '';
    const previewActive = room?.tvPreviewOverlay?.active === true && String(room?.tvPreviewOverlay?.itemId || '').startsWith('self_serve_');
    const roomReady = !!String(roomCode || '').trim();
    const activeAuctionWindow = useMemo(() => getSelfServeAuctionWindow(room?.selfServeMode), [room?.selfServeMode]);
    const activeAuctionLive = useMemo(() => isSelfServeAuctionWindowLive(room?.selfServeMode), [room?.selfServeMode]);
    const activePresentation = useMemo(
        () => (room?.selfServeMode?.enabled ? buildSelfServeModePresentation(room.selfServeMode) : null),
        [room?.selfServeMode]
    );

    return (
        <section className="rounded-[1.7rem] border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(8,17,30,0.94),rgba(23,10,31,0.88))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/68">Self-Serve Formats</div>
                    <div className="mt-2 text-3xl font-black text-white">Launch a hostless BeauRocks night</div>
                    <div className="mt-2 max-w-3xl text-sm text-cyan-100/72">
                        Pick a branded format, preview the rules on TV, then activate it without turning the room into a second host console.
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={previewSelectedFormat}
                        disabled={!!busyAction || !roomReady}
                        className={`${BUTTON} border-cyan-300/30 bg-cyan-500/15 text-cyan-100 hover:border-cyan-200/45 hover:bg-cyan-500/22 disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                        {busyAction === 'preview' ? 'Opening Preview...' : 'Preview On TV'}
                    </button>
                    <button
                        type="button"
                        onClick={activateSelectedFormat}
                        disabled={!!busyAction || !roomReady}
                        className={`${BUTTON} border-white/15 bg-white text-black hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                        {busyAction === 'activate' ? 'Launching...' : 'Go Live'}
                    </button>
                </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                        {launchOptions.map((option) => {
                            const isSelected = option.id === selectedFormat;
                            const accent = CARD_ACCENTS[option.id] || CARD_ACCENTS[SELF_SERVE_FORMATS.openStage];
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setSelectedFormat(option.id)}
                                    className={`rounded-[1.4rem] border p-4 text-left transition ${isSelected ? accent : 'border-white/10 bg-black/18 text-white/82 hover:border-cyan-300/25 hover:bg-white/5'}`}
                                >
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">{option.internalPreset.replaceAll('_', ' ')}</div>
                                    <div className="mt-2 text-lg font-black text-white">{option.launchLabel}</div>
                                    <div className="mt-2 text-sm text-white/72">{option.tagline}</div>
                                </button>
                            );
                        })}
                    </div>

                    <div className={`rounded-[1.5rem] border p-4 ${currentAccent}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.22em] text-white/65">Rules Summary</div>
                                <div className="mt-2 text-2xl font-black text-white">{selectedCard.launchLabel}</div>
                                <div className="mt-2 text-sm text-white/75">{selectedCard.tagline}</div>
                                {!roomReady ? (
                                    <div className="mt-3 rounded-full border border-amber-300/25 bg-amber-500/12 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                                        Create or reopen a room first to preview or launch this format
                                    </div>
                                ) : null}
                            </div>
                            {previewActive ? (
                                <button
                                    type="button"
                                    onClick={clearPreview}
                                    disabled={!!busyAction}
                                    className={`${BUTTON} border-white/15 bg-black/18 text-white hover:bg-black/28 disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    {busyAction === 'clear_preview' ? 'Clearing...' : 'Clear TV Preview'}
                                </button>
                            ) : null}
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            {selectedCard.rulesSummary.map((line) => (
                                <div key={line} className="rounded-[1.2rem] border border-white/10 bg-black/18 px-4 py-3 text-sm text-white/84">
                                    {line}
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3">
                            <div className="text-[10px] uppercase tracking-[0.22em] text-white/56">Fallback</div>
                            <div className="mt-2 text-sm text-white/78">{selectedCard.fallbackSummary}</div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {selectedCard.recoveryActions.map((action) => (
                                <span key={action} className="rounded-full border border-white/10 bg-black/18 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/72">
                                    {action}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className={`rounded-[1.5rem] border p-4 ${activeCard ? activeAccent : 'border-white/10 bg-black/18 text-white/74'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.22em] text-white/56">Current Live State</div>
                                <div className="mt-2 text-2xl font-black text-white">
                                    {room?.selfServeMode?.enabled ? activeCard?.launchLabel : 'Normal Karaoke'}
                                </div>
                                <div className="mt-2 text-sm text-white/76">
                                    {room?.selfServeMode?.enabled
                                        ? (activePresentation?.hostSummary || 'Self-serve format is currently live.')
                                        : 'No self-serve format is currently active.'}
                                </div>
                                {activeCard?.supportsAuction ? (
                                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-amber-100/82">
                                        {activePresentation?.badgeLabel || 'Spotlight Auction'}
                                        {activeAuctionLive
                                            ? ` | ${activeAuctionWindow.remainingSlots} of ${activeAuctionWindow.slotCount} priority slots remaining`
                                            : activeAuctionWindow.closed
                                                ? ' | Sponsored block complete'
                                                : room?.selfServeMode?.paidPriorityEnabled === false
                                                    ? ' | Paid priority off'
                                                    : ' | Ready for bids'}
                                    </div>
                                ) : null}
                            </div>
                            {room?.selfServeMode?.enabled ? (
                                <button
                                    type="button"
                                    onClick={returnToNormal}
                                    disabled={!!busyAction}
                                    className={`${BUTTON} border-rose-300/30 bg-rose-500/14 text-rose-100 hover:border-rose-200/40 hover:bg-rose-500/22 disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    {busyAction === 'return' ? 'Returning...' : 'Return To Normal Karaoke'}
                                </button>
                            ) : null}
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-[1.2rem] border border-white/10 bg-black/18 px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-white/54">Room Status</div>
                                <div className="mt-2 text-sm text-white/76">
                                    {room?.selfServeMode?.enabled
                                        ? `${activePresentation?.badgeLabel || 'Live'}: ${activePresentation?.detail || 'The room is live.'}`
                                        : 'Hosts see the format in plain English, can preview it on TV, and have a visible return path back to standard karaoke.'}
                                </div>
                            </div>
                            <div className="rounded-[1.2rem] border border-white/10 bg-black/18 px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-white/54">Current Preview</div>
                                <div className="mt-2 text-sm text-white/76">
                                    {previewActive ? 'A self-serve rules card is currently showing on Public TV.' : 'No self-serve TV preview is active.'}
                                </div>
                            </div>
                        </div>

                        {room?.selfServeMode?.enabled && activePresentation ? (
                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                                <div className="rounded-[1.2rem] border border-white/10 bg-black/18 px-4 py-3">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/54">TV Hero</div>
                                    <div className="mt-2 text-base font-black text-white">{activePresentation.heroLabel}</div>
                                    <div className="mt-1 text-xs text-white/62">{activePresentation.detail}</div>
                                </div>
                                <div className="rounded-[1.2rem] border border-white/10 bg-black/18 px-4 py-3">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/54">Phone Prompt</div>
                                    <div className="mt-2 text-base font-black text-white">{activePresentation.joinPrompt}</div>
                                    <div className="mt-1 text-xs text-white/62">{activePresentation.helper}</div>
                                </div>
                                <div className="rounded-[1.2rem] border border-white/10 bg-black/18 px-4 py-3">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/54">Room Flow</div>
                                    <div className="mt-2 text-base font-black text-white">{activePresentation.roomFlowLabel}</div>
                                    <div className="mt-1 text-xs text-white/62">
                                        {activePresentation.supportsAuction
                                            ? 'Auction block and fair-queue fallback stay visible to the host at all times.'
                                            : 'The room keeps singing with fair rotation and bounded crowd moments.'}
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {room?.selfServeMode?.enabled ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={togglePauseNewEntries}
                                    disabled={!!busyAction}
                                    className={`${BUTTON} border-white/12 bg-black/18 text-white hover:bg-black/28 disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    {busyAction === 'pause_entries'
                                        ? 'Updating...'
                                        : room?.selfServeMode?.pauseNewEntries
                                            ? 'Resume New Entries'
                                            : 'Pause New Entries'}
                                </button>
                                {room?.selfServeMode?.paidPriorityEnabled !== undefined && activeCard?.supportsPaidPriority ? (
                                    <button
                                        type="button"
                                        onClick={togglePaidPriority}
                                        disabled={!!busyAction || (!room?.selfServeMode?.paidPriorityEnabled && activeAuctionWindow.closed)}
                                        className={`${BUTTON} border-amber-300/24 bg-amber-500/12 text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60`}
                                    >
                                        {busyAction === 'paid_priority'
                                            ? 'Updating...'
                                            : (!room?.selfServeMode?.paidPriorityEnabled && activeAuctionWindow.closed)
                                                ? 'Auction Window Closed'
                                            : room?.selfServeMode?.paidPriorityEnabled
                                                ? 'Disable Paid Priority'
                                                : 'Enable Paid Priority'}
                                    </button>
                                ) : null}
                                {activeCard?.supportsAuction ? (
                                    <button
                                        type="button"
                                        onClick={endSponsoredBlock}
                                        disabled={!!busyAction || !activeAuctionLive}
                                        className={`${BUTTON} border-rose-300/26 bg-rose-500/12 text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60`}
                                    >
                                        {busyAction === 'end_sponsored_block' ? 'Ending Block...' : 'End Sponsored Block'}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SelfServeModeLauncher;
