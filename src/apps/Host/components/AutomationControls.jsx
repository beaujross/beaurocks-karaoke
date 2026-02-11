import React from 'react';

const AutomationControls = ({
    automationOpen,
    autoDj,
    setAutoDj,
    room,
    updateRoom,
    autoBgMusic,
    setAutoBgMusic,
    playingBg,
    setBgMusicState,
    toggleSwitch: ToggleSwitch,
    styles
}) => (
    <div className={automationOpen ? 'grid grid-cols-2 gap-2' : 'hidden'}>
        <button
            onClick={async () => {
                const next = !autoDj;
                setAutoDj(next);
                await updateRoom({ autoDj: next });
            }}
            className={`${styles.btnStd} ${autoDj ? styles.btnPrimary : styles.btnNeutral} flex-1`}
            title="Auto-advance the queue after each performance"
        >
            <i className="fa-solid fa-forward-fast mr-2"></i>Auto-Progress Queue
        </button>
        <ToggleSwitch checked={!!room?.bouncerMode} onChange={(v) => updateRoom({ bouncerMode: v })} icon={<i className="fa-solid fa-lock"></i>} label="Bouncer" />
        <button
            onClick={async () => {
                const next = !(room?.autoPlayMedia !== false);
                await updateRoom({ autoPlayMedia: !next });
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
                await updateRoom({ autoBgMusic: next });
                if (next && !playingBg) setBgMusicState(true);
            }}
            className={`${styles.btnStd} ${autoBgMusic ? styles.btnPrimary : styles.btnNeutral}`}
            title="Keep BG music rolling between songs"
        >
            <i className="fa-solid fa-compact-disc mr-2"></i>Auto BG music
        </button>
    </div>
);

export default AutomationControls;
