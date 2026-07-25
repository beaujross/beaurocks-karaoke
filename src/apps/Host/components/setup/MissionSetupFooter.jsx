import React from 'react';

const MissionSetupFooter = ({
    styles,
    applying = false,
    summaryText = '',
    onClose = () => {},
    onSaveDraft = () => {},
    onLaunchPackage = () => {}
}) => (
    <div className="fixed bottom-0 left-0 right-0 z-[95] border-t border-cyan-300/15 bg-zinc-950/95 shadow-[0_-18px_50px_rgba(0,0,0,0.28)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6">
            <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Ready when you are</div>
                <div className="max-w-[680px] truncate text-xs text-zinc-400">{summaryText}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                    onClick={onClose}
                    disabled={applying}
                    className={`${styles.btnStd} ${styles.btnNeutral} text-zinc-400 ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    Close
                </button>
                <button
                    onClick={onSaveDraft}
                    disabled={applying}
                    className={`${styles.btnStd} ${styles.btnSecondary} text-zinc-200 ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {applying ? 'Saving...' : 'Save'}
                </button>
                <button
                    onClick={onLaunchPackage}
                    disabled={applying}
                    className={`${styles.btnStd} ${styles.btnHighlight} min-h-[48px] px-5 shadow-[0_0_30px_rgba(34,211,238,0.14)] ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {applying ? 'Launching...' : 'Launch Room'}
                </button>
            </div>
        </div>
    </div>
);

export default MissionSetupFooter;
