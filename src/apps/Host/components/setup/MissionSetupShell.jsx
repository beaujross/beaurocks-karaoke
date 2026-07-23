import React from 'react';

const OVERLAY_BG = 'radial-gradient(circle at 12% 6%, rgba(0,196,217,0.26), transparent 32%), radial-gradient(circle at 90% 10%, rgba(236,72,153,0.22), transparent 34%), linear-gradient(180deg, #06070d 0%, #090b14 45%, #05060c 100%)';

const MissionSetupShell = ({
    header = null,
    primaryContent = null,
    sideContent = null,
    footer = null
}) => (
    <div className="fixed inset-0 z-[92] overflow-y-auto overscroll-y-contain p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+6.5rem)] md:p-6" style={{ background: OVERLAY_BG }}>
        <div className="mx-auto flex min-h-full w-full max-w-6xl items-start pb-28">
            <div className="w-full overflow-hidden rounded-3xl border border-white/15 bg-zinc-950/94 shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
                {header}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                    <div className="space-y-4 px-4 py-4 md:px-6 md:py-5">
                        {primaryContent}
                    </div>
                    <aside className="border-t border-white/10 bg-zinc-950/75 px-4 py-4 md:px-5 md:py-5 lg:border-l lg:border-t-0">
                        {sideContent}
                    </aside>
                </div>
            </div>
        </div>
        {footer}
    </div>
);

export default MissionSetupShell;
