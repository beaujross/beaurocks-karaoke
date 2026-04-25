import React from 'react';

const MissionSetupFooter = ({
    styles,
    applying = false,
    summaryText = '',
    onClose = () => {},
    onSaveDraft = () => {},
    onStartNight = () => {},
    onLaunchPackage = () => {}
}) => (
    <div className="fixed bottom-0 left-0 right-0 z-[95] border-t border-white/10 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6">
            <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-200">Autopilot Plan</div>
                <div className="max-w-[680px] truncate text-xs text-zinc-400">{summaryText}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                    onClick={onClose}
                    disabled={applying}
                    className={`${styles.btnStd} ${styles.btnNeutral} ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    Close
                </button>
                <button
                    onClick={onSaveDraft}
                    disabled={applying}
                    className={`${styles.btnStd} ${styles.btnSecondary} ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {applying ? 'Saving...' : 'Save'}
                </button>
                <button
                    onClick={onStartNight}
                    disabled={applying}
                    className={`${styles.btnStd} ${styles.btnHighlight} ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {applying ? 'Starting...' : 'Start Room'}
                </button>
                <button
                    onClick={onLaunchPackage}
                    disabled={applying}
                    className={`${styles.btnStd} ${styles.btnNeutral} ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {applying ? 'Opening...' : 'Open TV + Copy Link'}
                </button>
            </div>
        </div>
    </div>
);

export default MissionSetupFooter;
