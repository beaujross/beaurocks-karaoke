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
    toggleSwitch,
    styles
}) => {
    const ToggleSwitch = toggleSwitch;
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
            title="Auto-advance the queue after each performance"
        >
            <i className="fa-solid fa-forward-fast mr-2"></i>Auto-Progress Queue
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
    </div>
    );
};

export default AutomationControls;
