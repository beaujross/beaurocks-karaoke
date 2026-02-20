import React from 'react';

const TvDashboardControls = ({
    tvControlsOpen,
    room,
    updateRoom,
    toggleSwitch,
    styles
}) => {
    const ToggleSwitch = toggleSwitch;
    const reduceMotionFx = !!room?.reduceMotionFx;
    return (
    <div className={tvControlsOpen ? 'block' : 'hidden'}>
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">PUBLIC TV LAYOUT</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-zinc-900/60 p-2 rounded-xl border border-white/10">
            <button
                onClick={() => updateRoom({ layoutMode: 'standard' })}
                className={`${styles.btnStd} ${room?.layoutMode === 'standard' ? styles.btnHighlight : styles.btnNeutral} justify-center px-2`}
                title="Full layout with overlays and stats"
            >
                <i className="fa-solid fa-desktop mr-2"></i> Standard
            </button>
            <button
                onClick={() => updateRoom({ layoutMode: 'minimal' })}
                className={`${styles.btnStd} ${room?.layoutMode === 'minimal' ? styles.btnHighlight : styles.btnNeutral} justify-center px-2`}
                title="Compact layout for small screens"
            >
                <i className="fa-solid fa-window-minimize mr-2"></i> Minimal
            </button>
            <button
                onClick={() => updateRoom({ layoutMode: 'cinema' })}
                className={`${styles.btnStd} ${room?.layoutMode === 'cinema' ? styles.btnHighlight : styles.btnNeutral} justify-center px-2`}
                title="Video-first layout with minimal UI"
            >
                <i className="fa-solid fa-film mr-2"></i> Cinema
            </button>
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Screen elements</div>
        <div className="grid grid-cols-2 gap-2">
            <ToggleSwitch checked={!room?.hideWaveform} onChange={(v) => updateRoom({ hideWaveform: !v })} icon={<i className="fa-solid fa-wave-square"></i>} label="Waveform" />
            <ToggleSwitch checked={!room?.hideOverlay} onChange={(v) => updateRoom({ hideOverlay: !v })} icon={<i className="fa-solid fa-layer-group"></i>} label="Overlay" />
            <ToggleSwitch checked={!room?.hideLogo} onChange={(v) => updateRoom({ hideLogo: !v })} icon={<i className="fa-solid fa-star"></i>} label="Logo" />
            <button
                onClick={() => updateRoom({ hideCornerOverlay: !room?.hideCornerOverlay })}
                className={`${styles.btnStd} ${room?.hideCornerOverlay ? styles.btnNeutral : styles.btnPrimary} flex-1`}
            >
                <i className="fa-solid fa-user mr-2"></i>On Stage
            </button>
            <ToggleSwitch checked={room?.showScoring !== false} onChange={(v) => updateRoom({ showScoring: v })} icon={<i className="fa-solid fa-chart-line"></i>} label="Score HUD" />
            <button
                onClick={() => updateRoom({ reduceMotionFx: !reduceMotionFx })}
                className={`${styles.btnStd} ${reduceMotionFx ? styles.btnHighlight : styles.btnNeutral} flex-1`}
                title="Reduce effect intensity for readability and motion comfort"
            >
                <i className="fa-solid fa-universal-access mr-2"></i>{reduceMotionFx ? 'Motion Safe On' : 'Motion Safe Off'}
            </button>
        </div>
        <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
            TV mode and visualizer controls now live in the top Live Deck `TV` dropdown for faster access during shows.
        </div>
    </div>
    );
};

export default TvDashboardControls;
