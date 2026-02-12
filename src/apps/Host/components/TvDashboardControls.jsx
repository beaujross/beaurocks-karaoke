import React from 'react';

const TvDashboardControls = ({
    tvControlsOpen,
    room,
    updateRoom,
    toggleSwitch,
    styles
}) => {
    const ToggleSwitch = toggleSwitch;
    const visualizerSource = room?.visualizerSource || 'auto';
    const visualizerMode = room?.visualizerMode || 'ribbon';
    const visualizerPreset = room?.visualizerPreset || 'neon';
    const visualizerSyncLightMode = !!room?.visualizerSyncLightMode;
    const reduceMotionFx = !!room?.reduceMotionFx;
    const visualizerSensitivity = Number.isFinite(Number(room?.visualizerSensitivity))
        ? Math.max(0.5, Math.min(2.5, Number(room.visualizerSensitivity)))
        : 1;
    const visualizerSmoothing = Number.isFinite(Number(room?.visualizerSmoothing))
        ? Math.max(0, Math.min(0.95, Number(room.visualizerSmoothing)))
        : 0.35;
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
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-3">TV Display</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-zinc-900/60 p-2 rounded-xl border border-white/10">
            <button
                onClick={() => updateRoom({ showLyricsTv: false, showVisualizerTv: false })}
                className={`${styles.btnStd} ${!room?.showLyricsTv && !room?.showVisualizerTv ? styles.btnHighlight : styles.btnNeutral} justify-center px-2`}
                title="Show stage video"
            >
                <i className="fa-solid fa-video mr-2"></i> Video
            </button>
            <button
                onClick={() => updateRoom({
                    showLyricsTv: !room?.showLyricsTv,
                    lyricsMode: room?.lyricsMode || 'auto'
                })}
                className={`${styles.btnStd} ${room?.showLyricsTv ? styles.btnHighlight : styles.btnNeutral} justify-center px-2`}
                title="Toggle lyrics on TV"
            >
                <i className="fa-solid fa-closed-captioning mr-2"></i> Lyrics
            </button>
            <button
                onClick={() => updateRoom({ showVisualizerTv: !room?.showVisualizerTv })}
                className={`${styles.btnStd} ${room?.showVisualizerTv ? styles.btnHighlight : styles.btnNeutral} justify-center px-2`}
                title="Toggle visualizer on TV"
            >
                <i className="fa-solid fa-wave-square mr-2"></i> Visualizer
            </button>
        </div>
        <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-[0.2em]">Tip: Lyrics and visualizer can run together.</div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-3">Visualizer Engine</div>
        <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/10 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="text-xs text-zinc-400">
                    Source
                    <select
                        value={visualizerSource}
                        onChange={(e) => updateRoom({ visualizerSource: e.target.value })}
                        className={`${styles.input} mt-1`}
                    >
                        <option value="auto">Auto (Recommended)</option>
                        <option value="host_bg">Host BG Music</option>
                        <option value="stage_mic">Stage Mic</option>
                        <option value="off">Off</option>
                    </select>
                </label>
                <label className="text-xs text-zinc-400">
                    Style
                    <select
                        value={visualizerMode}
                        onChange={(e) => updateRoom({ visualizerMode: e.target.value })}
                        className={`${styles.input} mt-1`}
                    >
                        <option value="ribbon">Liquid ribbon</option>
                        <option value="rings">Neon rings</option>
                        <option value="spark">Pulse sparkline</option>
                        <option value="waveform">Waveform</option>
                    </select>
                </label>
                <label className="text-xs text-zinc-400">
                    Preset
                    <select
                        value={visualizerPreset}
                        onChange={(e) => updateRoom({ visualizerPreset: e.target.value })}
                        className={`${styles.input} mt-1`}
                    >
                        <option value="calm">Calm</option>
                        <option value="club">Club</option>
                        <option value="neon">Neon</option>
                        <option value="retro">Retro</option>
                    </select>
                </label>
                <button
                    onClick={() => updateRoom({ visualizerSyncLightMode: !visualizerSyncLightMode })}
                    className={`${styles.btnStd} ${visualizerSyncLightMode ? styles.btnHighlight : styles.btnNeutral} mt-5`}
                    title="Sync visualizer preset with light mode (banger/storm/ballad/guitar/strobe)"
                >
                    <i className="fa-solid fa-link mr-2"></i>{visualizerSyncLightMode ? 'Light Sync On' : 'Light Sync Off'}
                </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-zinc-400">
                    Sensitivity: <span className="text-white">{visualizerSensitivity.toFixed(2)}x</span>
                    <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.05"
                        value={visualizerSensitivity}
                        onChange={(e) => updateRoom({ visualizerSensitivity: Number(e.target.value) })}
                        className="w-full accent-[#00C4D9] mt-1"
                    />
                </label>
                <label className="text-xs text-zinc-400">
                    Smoothing: <span className="text-white">{visualizerSmoothing.toFixed(2)}</span>
                    <input
                        type="range"
                        min="0"
                        max="0.95"
                        step="0.05"
                        value={visualizerSmoothing}
                        onChange={(e) => updateRoom({ visualizerSmoothing: Number(e.target.value) })}
                        className="w-full accent-[#00C4D9] mt-1"
                    />
                </label>
            </div>
        </div>
    </div>
    );
};

export default TvDashboardControls;
