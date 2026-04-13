import React from 'react';

const MissionSetupFooter = ({
    styles,
    applying = false,
    summaryText = '',
    onOpenAdmin = () => {},
    onSaveDraft = () => {},
    onStartNight = () => {},
    onLaunchPackage = () => {}
}) => (
    <div className="fixed bottom-0 left-0 right-0 z-[95] border-t border-white/10 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 md:px-6 flex flex-wrap items-center justify-between gap-2">
            <button onClick={onOpenAdmin} className={`${styles.btnStd} ${styles.btnSecondary}`}>
                Open Full Setup
            </button>
            <div className="text-xs text-zinc-400">{summaryText}</div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                    onClick={onSaveDraft}
                    disabled={applying}
                    className={`${styles.btnStd} ${styles.btnSecondary} ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {applying ? 'Saving...' : 'Save Setup'}
                </button>
                <button
                    onClick={onStartNight}
                    disabled={applying}
                    className={`${styles.btnStd} ${styles.btnHighlight} ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {applying ? 'Starting...' : 'Save And Start'}
                </button>
                <button
                    onClick={onLaunchPackage}
                    disabled={applying}
                    className={`${styles.btnStd} ${styles.btnNeutral} ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {applying ? 'Launching...' : 'Save And Open Links'}
                </button>
            </div>
        </div>
    </div>
);

export default MissionSetupFooter;
