import React from 'react';

const MissionSetupAdvancedDrawer = ({
    styles,
    isOpen = false,
    onToggleOpen = () => {},
    overrideCount = 0,
    onResetAdvanced = () => {},
    spotlightModes = [],
    selectedSpotlightMode = 'karaoke',
    onSelectSpotlightMode = () => {},
    canToggleSpotlightList = false,
    showAllSpotlightModes = false,
    onToggleShowAllSpotlightModes = () => {},
    queueOpen = false,
    onToggleQueueOpen = () => {},
    queueLimitOptions = [],
    queueLimitMode = 'none',
    onSetQueueLimitMode = () => {},
    queueLimitCount = 0,
    onSetQueueLimitCount = () => {},
    queueRotationOptions = [],
    queueRotation = 'round_robin',
    onSetQueueRotation = () => {},
    queueFirstTimeBoost = true,
    onToggleQueueFirstTimeBoost = () => {},
    partyOpen = false,
    onTogglePartyOpen = () => {},
    karaokeFirst = true,
    onToggleKaraokeFirst = () => {},
    minSingingSharePct = 70,
    onSetMinSingingSharePct = () => {},
    maxBreakDurationSec = 20,
    onSetMaxBreakDurationSec = () => {},
    maxConsecutiveNonKaraokeModes = 1,
    onSetMaxConsecutiveNonKaraokeModes = () => {},
    togglesOpen = false,
    onToggleTogglesOpen = () => {},
    liveToggles = []
}) => (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <button
            onClick={onToggleOpen}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
            <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Advanced</div>
                <div className="text-base font-bold text-white mt-1">Fine Tuning + Full Control</div>
            </div>
            <div className="flex items-center gap-2">
                {overrideCount > 0 && (
                    <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-100">
                        {overrideCount} override{overrideCount === 1 ? '' : 's'}
                    </span>
                )}
                <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-zinc-500`}></i>
            </div>
        </button>

        {isOpen && (
            <div className="px-4 pb-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-zinc-300">All advanced controls are optional and preserve override precedence.</div>
                    <button onClick={onResetAdvanced} className={`${styles.btnStd} ${styles.btnNeutral} text-[10px]`}>
                        Reset Advanced
                    </button>
                </div>

                <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-bold text-white">Spotlight Focus</div>
                        {canToggleSpotlightList && (
                            <button onClick={onToggleShowAllSpotlightModes} className={`${styles.btnStd} ${styles.btnNeutral} text-[10px]`}>
                                {showAllSpotlightModes ? 'Show Featured' : 'Show All Modes'}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {spotlightModes.map((mode) => (
                            <button
                                key={`advanced-spotlight-${mode.id}`}
                                onClick={() => onSelectSpotlightMode(mode.id)}
                                className={`text-left rounded-xl border px-3 py-2 transition-all ${selectedSpotlightMode === mode.id ? 'border-fuchsia-400/60 bg-fuchsia-500/12' : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <i className={`fa-solid ${mode.icon} text-fuchsia-200`}></i>
                                    <span className="text-sm font-bold text-white">{mode.label}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-zinc-700 bg-zinc-950/60">
                    <button onClick={onToggleQueueOpen} className="w-full px-3 py-2 flex items-center justify-between text-left">
                        <span className="text-sm font-bold text-white">Queue Overrides</span>
                        <i className={`fa-solid fa-chevron-${queueOpen ? 'up' : 'down'} text-zinc-500`}></i>
                    </button>
                    {queueOpen && (
                        <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Limit Mode</div>
                                <select
                                    value={queueLimitMode}
                                    onChange={(event) => onSetQueueLimitMode(event.target.value)}
                                    className={styles.input}
                                >
                                    {queueLimitOptions.map((option) => (
                                        <option key={`advanced-limit-${option.id}`} value={option.id}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Limit Count</div>
                                <input
                                    value={queueLimitCount}
                                    onChange={(event) => onSetQueueLimitCount(Math.max(0, Number(event.target.value || 0)))}
                                    className={styles.input}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Rotation</div>
                                <select
                                    value={queueRotation}
                                    onChange={(event) => onSetQueueRotation(event.target.value)}
                                    className={styles.input}
                                >
                                    {queueRotationOptions.map((option) => (
                                        <option key={`advanced-rotation-${option.id}`} value={option.id}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">First-Time Boost</div>
                                <button
                                    onClick={onToggleQueueFirstTimeBoost}
                                    className={`${styles.btnStd} ${queueFirstTimeBoost ? styles.btnInfo : styles.btnNeutral} w-full`}
                                >
                                    {queueFirstTimeBoost ? 'Enabled' : 'Disabled'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-zinc-700 bg-zinc-950/60">
                    <button onClick={onTogglePartyOpen} className="w-full px-3 py-2 flex items-center justify-between text-left">
                        <span className="text-sm font-bold text-white">Karaoke-First Guardrails</span>
                        <i className={`fa-solid fa-chevron-${partyOpen ? 'up' : 'down'} text-zinc-500`}></i>
                    </button>
                    {partyOpen && (
                        <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Karaoke Priority</div>
                                <button
                                    onClick={onToggleKaraokeFirst}
                                    className={`${styles.btnStd} ${karaokeFirst ? styles.btnInfo : styles.btnNeutral} w-full`}
                                >
                                    {karaokeFirst ? 'Karaoke-First ON' : 'Karaoke-First OFF'}
                                </button>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Minimum Singing Share (%)</div>
                                <input
                                    type="number"
                                    min="50"
                                    max="95"
                                    value={minSingingSharePct}
                                    onChange={(event) => onSetMinSingingSharePct(event.target.value)}
                                    className={styles.input}
                                />
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Max Break Duration (sec)</div>
                                <input
                                    type="number"
                                    min="3"
                                    max="120"
                                    value={maxBreakDurationSec}
                                    onChange={(event) => onSetMaxBreakDurationSec(event.target.value)}
                                    className={styles.input}
                                />
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Max Consecutive Group Modes</div>
                                <input
                                    type="number"
                                    min="1"
                                    max="4"
                                    value={maxConsecutiveNonKaraokeModes}
                                    onChange={(event) => onSetMaxConsecutiveNonKaraokeModes(event.target.value)}
                                    className={styles.input}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-zinc-700 bg-zinc-950/60">
                    <button onClick={onToggleTogglesOpen} className="w-full px-3 py-2 flex items-center justify-between text-left">
                        <span className="text-sm font-bold text-white">Live Toggle Overrides</span>
                        <i className={`fa-solid fa-chevron-${togglesOpen ? 'up' : 'down'} text-zinc-500`}></i>
                    </button>
                    {togglesOpen && (
                        <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {liveToggles.map((toggle) => (
                                <button
                                    key={`advanced-toggle-${toggle.key}`}
                                    onClick={toggle.onToggle}
                                    className={`${styles.btnStd} ${toggle.value ? styles.btnInfo : styles.btnNeutral} justify-start`}
                                >
                                    {toggle.label}: {toggle.value ? 'ON' : 'OFF'}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
);

export default MissionSetupAdvancedDrawer;
