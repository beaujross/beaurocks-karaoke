import React from 'react';

const SoundboardControls = ({
    soundboardOpen,
    sfxMuted,
    setSfxMuted,
    silenceAll,
    styles,
    sfxLevel,
    sfxVolume,
    setSfxVolume,
    sounds,
    playSfxSafe,
    smallWaveform: SmallWaveform
}) => (
    <div className={soundboardOpen ? 'block' : 'hidden'}>
        <div className="flex items-center gap-3 bg-zinc-950/40 border border-white/10 rounded-xl p-2 mb-3">
            <div className="text-sm uppercase tracking-widest text-zinc-400">FX Volume</div>
            <SmallWaveform level={sfxMuted ? 0 : sfxLevel} className="h-6 w-16" color={['#00C4D9', '#EC4899']} />
            <button
                onClick={() => setSfxMuted(v => {
                    const next = !v;
                    if (next) silenceAll?.();
                    return next;
                })}
                className={`${styles.btnStd} ${sfxMuted ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-xs`}
            >
                <i className={`fa-solid ${sfxMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
            </button>
            <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(sfxVolume * 100)}
                onChange={e => setSfxVolume(parseInt(e.target.value, 10) / 100)}
                className="flex-1 h-2.5 bg-zinc-800 accent-[#00C4D9] rounded-lg appearance-none cursor-pointer"
                style={{ background: `linear-gradient(90deg, #00E5FF ${Math.round(sfxVolume * 100)}%, #27272a ${Math.round(sfxVolume * 100)}%)` }}
            />
        </div>
        <div className="grid grid-cols-3 gap-2">
            {sounds.map(s => (
                <button key={s.name} onClick={() => playSfxSafe(s.url)} className={`${styles.btnStd} ${styles.btnNeutral} truncate`}>
                    <i className={`fa-solid ${s.icon} mr-2`}></i>
                    {s.name}
                </button>
            ))}
        </div>
    </div>
);

export default SoundboardControls;
