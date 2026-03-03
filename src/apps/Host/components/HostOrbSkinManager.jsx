import React from 'react';

const HostOrbSkinManager = ({
    styles,
    orbSkinUrl,
    setOrbSkinUrl,
    orbSkinUploading,
    orbSkinUploadProgress,
    orbSkinInputRef,
    uploadOrbSkinFile,
    saveOrbSkinUrl,
    orbSkinChoices,
    removeCustomOrbSkin
}) => {
    const activeUrl = (orbSkinUrl || '').trim();

    return (
        <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mt-3">Orb skin manager</div>
            <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full border border-zinc-700 bg-black/40 overflow-hidden flex items-center justify-center">
                        {activeUrl ? (
                            <img
                                src={activeUrl}
                                alt="Active orb skin preview"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-400/55 via-fuchsia-400/45 to-cyan-200/55" />
                        )}
                    </div>
                    <div className="text-xs text-zinc-400 leading-relaxed">
                        <div className="text-zinc-200 font-semibold uppercase tracking-widest">Active Orb Skin</div>
                        <div>Upload or choose a round image to skin the lobby orb.</div>
                        <div>Square art with transparent background looks best.</div>
                    </div>
                </div>
                <input
                    value={orbSkinUrl}
                    onChange={(e) => setOrbSkinUrl(e.target.value)}
                    className={styles.input}
                    placeholder="Orb skin URL (optional)"
                    title="Paste a public orb skin URL"
                />
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => saveOrbSkinUrl(orbSkinUrl)}
                        className={`${styles.btnStd} ${styles.btnSecondary}`}
                    >
                        Apply URL Now
                    </button>
                    <button
                        onClick={() => saveOrbSkinUrl('')}
                        className={`${styles.btnStd} ${styles.btnNeutral}`}
                    >
                        Reset to Default
                    </button>
                    <button
                        onClick={() => orbSkinInputRef.current?.click()}
                        disabled={orbSkinUploading}
                        className={`${styles.btnStd} ${styles.btnInfo} ${orbSkinUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {orbSkinUploading ? `Uploading ${orbSkinUploadProgress}%` : 'Upload Orb Skin'}
                    </button>
                    <input
                        ref={orbSkinInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                        className="hidden"
                        onChange={(e) => uploadOrbSkinFile(e.target.files?.[0])}
                    />
                </div>
                <div className="host-form-helper">Orb skin is optional. If blank, the default animated orb appears.</div>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {orbSkinChoices.map((item) => {
                        const normalizedItemUrl = (item?.url || '').trim();
                        const active = activeUrl === normalizedItemUrl;
                        const isCustom = item.id.startsWith('custom-');
                        return (
                            <div
                                key={item.id}
                                className={`rounded-lg border p-2 bg-zinc-900/70 ${active ? 'border-[#00C4D9]' : 'border-zinc-700'}`}
                            >
                                <button
                                    onClick={() => setOrbSkinUrl(normalizedItemUrl)}
                                    className="w-full text-left"
                                    title={item.label}
                                >
                                    <div className="w-full h-16 mb-2 flex items-center justify-center">
                                        <div className="w-16 h-16 rounded-full border border-zinc-700 bg-black/40 overflow-hidden">
                                            {normalizedItemUrl ? (
                                                <img
                                                    src={normalizedItemUrl}
                                                    alt={item.label}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-400/55 via-fuchsia-400/45 to-cyan-200/55" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-zinc-300 truncate">{item.label}</div>
                                </button>
                                <div className="mt-2 flex gap-1">
                                    <button
                                        onClick={() => saveOrbSkinUrl(normalizedItemUrl)}
                                        className={`${styles.btnStd} ${styles.btnSecondary} flex-1`}
                                    >
                                        Use
                                    </button>
                                    {isCustom && (
                                        <button
                                            onClick={() => removeCustomOrbSkin(normalizedItemUrl)}
                                            className={`${styles.btnStd} ${styles.btnDanger} px-2`}
                                            title="Remove from custom orb skins"
                                        >
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default HostOrbSkinManager;
