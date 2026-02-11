import React from 'react';

const HostLogoManager = ({
    styles,
    logoUrl,
    setLogoUrl,
    logoUploading,
    logoUploadProgress,
    logoInputRef,
    uploadLogoFile,
    saveLogoUrl,
    logoChoices,
    removeCustomLogo,
    assets
}) => {
    return (
        <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mt-3">Logo manager</div>
            <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg border border-zinc-700 bg-black/40 overflow-hidden flex items-center justify-center">
                        <img
                            src={logoUrl || assets.logo}
                            alt="Active logo preview"
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => { e.currentTarget.src = assets.logo; }}
                        />
                    </div>
                    <div className="text-xs text-zinc-400 leading-relaxed">
                        <div className="text-zinc-200 font-semibold uppercase tracking-widest">Active Logo</div>
                        <div>Choose a preset, upload your own, or paste a URL.</div>
                        <div>Then click Save Settings to keep all changes.</div>
                    </div>
                </div>
                <input
                    value={logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                    className={styles.input}
                    placeholder="Logo URL (optional)"
                    title="Paste a public logo URL"
                />
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => saveLogoUrl(logoUrl)}
                        className={`${styles.btnStd} ${styles.btnSecondary}`}
                    >
                        Apply URL Now
                    </button>
                    <button
                        onClick={() => saveLogoUrl('')}
                        className={`${styles.btnStd} ${styles.btnNeutral}`}
                    >
                        Reset to Default
                    </button>
                    <button
                        onClick={() => logoInputRef.current?.click()}
                        disabled={logoUploading}
                        className={`${styles.btnStd} ${styles.btnInfo} ${logoUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {logoUploading ? `Uploading ${logoUploadProgress}%` : 'Upload Custom Logo'}
                    </button>
                    <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                        className="hidden"
                        onChange={(e) => uploadLogoFile(e.target.files?.[0])}
                    />
                </div>
                <div className="host-form-helper">Logo defaults to BROSS when blank. Recommended upload max: 12 MB.</div>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {logoChoices.map(item => {
                        const active = (logoUrl || '').trim() === item.url;
                        const isCustom = item.id.startsWith('custom-');
                        return (
                            <div
                                key={item.id}
                                className={`rounded-lg border p-2 bg-zinc-900/70 ${active ? 'border-[#00C4D9]' : 'border-zinc-700'}`}
                            >
                                <button
                                    onClick={() => setLogoUrl(item.url)}
                                    className="w-full text-left"
                                    title={item.label}
                                >
                                    <div className="w-full h-16 rounded border border-zinc-700 bg-black/40 mb-2 overflow-hidden flex items-center justify-center">
                                        <img
                                            src={item.url}
                                            alt={item.label}
                                            className="max-w-full max-h-full object-contain"
                                            onError={(e) => { e.currentTarget.src = assets.logo; }}
                                        />
                                    </div>
                                    <div className="text-[11px] text-zinc-300 truncate">{item.label}</div>
                                </button>
                                <div className="mt-2 flex gap-1">
                                    <button
                                        onClick={() => saveLogoUrl(item.url)}
                                        className={`${styles.btnStd} ${styles.btnSecondary} flex-1`}
                                    >
                                        Use
                                    </button>
                                    {isCustom && (
                                        <button
                                            onClick={() => removeCustomLogo(item.url)}
                                            className={`${styles.btnStd} ${styles.btnDanger} px-2`}
                                            title="Remove from custom library"
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

export default HostLogoManager;
