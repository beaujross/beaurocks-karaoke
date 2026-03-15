import React from 'react';

const AutomationControls = ({
    automationOpen,
    autoDj,
    setAutoDj,
    autoDjDelaySec,
    setAutoDjDelaySec,
    autoEndOnTrackFinish,
    setAutoEndOnTrackFinish,
    autoBonusEnabled,
    setAutoBonusEnabled,
    autoBonusPoints,
    setAutoBonusPoints,
    room,
    updateRoom,
    autoBgMusic,
    setAutoBgMusic,
    playingBg,
    setBgMusicState,
    toggleSwitch,
    styles
}) => {
    const ToggleSwitch = toggleSwitch;
    const normalizeDelaySec = (value) => Math.max(2, Math.min(45, Number(value || 10) || 10));
    const normalizeBonusPoints = (value) => Math.max(0, Math.min(1000, Math.round(Number(value || 0) || 0)));
    return (
    <div className={automationOpen ? 'grid grid-cols-2 gap-2' : 'hidden'}>
        <button
            onClick={async () => {
                const next = !autoDj;
                setAutoDj(next);
                try {
                    await updateRoom({ autoDj: next });
                } catch (error) {
                    console.error('Failed to toggle Auto DJ', error);
                    setAutoDj(!next);
                }
            }}
            className={`${styles.btnStd} ${autoDj ? styles.btnPrimary : styles.btnNeutral} flex-1`}
            title="Automatically moves the next queued song to stage after each performance"
        >
            <i className="fa-solid fa-forward-fast mr-2"></i>Auto DJ Queue Runner
        </button>
        <ToggleSwitch checked={!!room?.bouncerMode} onChange={(v) => updateRoom({ bouncerMode: v })} icon={<i className="fa-solid fa-lock"></i>} label="Bouncer" />
        <button
            onClick={async () => {
                const next = !(room?.autoPlayMedia !== false);
                try {
                    await updateRoom({ autoPlayMedia: !next });
                } catch (error) {
                    console.error('Failed to toggle auto-play media', error);
                }
            }}
            className={`${styles.btnStd} ${(room?.autoPlayMedia !== false) ? styles.btnPrimary : styles.btnNeutral}`}
            title="Auto-play media when a singer starts"
        >
            <i className="fa-solid fa-play mr-2"></i>Auto-play media
        </button>
        <button
            onClick={async () => {
                const next = !autoBgMusic;
                setAutoBgMusic(next);
                try {
                    await updateRoom({ autoBgMusic: next });
                } catch (error) {
                    console.error('Failed to toggle auto BG music', error);
                    setAutoBgMusic(!next);
                    return;
                }
                if (next && !playingBg) setBgMusicState(true);
            }}
            className={`${styles.btnStd} ${autoBgMusic ? styles.btnPrimary : styles.btnNeutral}`}
            title="Keep BG music rolling between songs"
        >
            <i className="fa-solid fa-compact-disc mr-2"></i>Auto BG music
        </button>
        <button
            onClick={async () => {
                const next = !autoEndOnTrackFinish;
                setAutoEndOnTrackFinish(next);
                try {
                    await updateRoom({ autoEndOnTrackFinish: next });
                } catch (error) {
                    console.error('Failed to toggle auto end on finish', error);
                    setAutoEndOnTrackFinish(!next);
                }
            }}
            className={`${styles.btnStd} ${autoEndOnTrackFinish ? styles.btnPrimary : styles.btnNeutral}`}
            title="When enabled, host auto-flow ends a finished performance and starts applause flow"
        >
            <i className="fa-solid fa-stopwatch mr-2"></i>Auto end on finish
        </button>
        <button
            onClick={async () => {
                const next = !autoBonusEnabled;
                setAutoBonusEnabled(next);
                try {
                    await updateRoom({ autoBonusEnabled: next });
                } catch (error) {
                    console.error('Failed to toggle auto bonus', error);
                    setAutoBonusEnabled(!next);
                }
            }}
            className={`${styles.btnStd} ${autoBonusEnabled ? styles.btnPrimary : styles.btnNeutral}`}
            title="Automatically applies host bonus points when a performance ends with no bonus"
        >
            <i className="fa-solid fa-gift mr-2"></i>{autoBonusEnabled ? 'Auto bonus ON' : 'Auto bonus OFF'}
        </button>
        {autoDj ? (
            <label className="col-span-2 text-xs text-zinc-300 uppercase tracking-[0.2em]">
                Auto-DJ delay (seconds)
                <input
                    value={autoDjDelaySec}
                    onChange={(event) => setAutoDjDelaySec(event.target.value)}
                    onBlur={async () => {
                        const next = normalizeDelaySec(autoDjDelaySec);
                        setAutoDjDelaySec(next);
                        try {
                            await updateRoom({ autoDjDelaySec: next });
                        } catch (error) {
                            console.error('Failed to update auto-DJ delay', error);
                        }
                    }}
                    className={`${styles.input} mt-1`}
                    inputMode="numeric"
                    placeholder="10"
                />
            </label>
        ) : null}
        {autoBonusEnabled ? (
            <label className="col-span-2 text-xs text-zinc-300 uppercase tracking-[0.2em]">
                Auto bonus points
                <input
                    value={autoBonusPoints}
                    onChange={(event) => setAutoBonusPoints(event.target.value)}
                    onBlur={async () => {
                        const next = normalizeBonusPoints(autoBonusPoints);
                        setAutoBonusPoints(next);
                        try {
                            await updateRoom({ autoBonusPoints: next });
                        } catch (error) {
                            console.error('Failed to update auto bonus points', error);
                        }
                    }}
                    className={`${styles.input} mt-1`}
                    inputMode="numeric"
                    placeholder="25"
                />
            </label>
        ) : null}
    </div>
    );
};

export default AutomationControls;
