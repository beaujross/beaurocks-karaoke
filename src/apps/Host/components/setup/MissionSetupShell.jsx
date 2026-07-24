import React from 'react';

const OVERLAY_BG = 'radial-gradient(circle at 12% 6%, rgba(0,196,217,0.26), transparent 32%), radial-gradient(circle at 90% 10%, rgba(236,72,153,0.22), transparent 34%), linear-gradient(180deg, #06070d 0%, #090b14 45%, #05060c 100%)';

const MissionSetupShell = ({
    header = null,
    primaryContent = null,
    sideContent = null,
    footer = null
}) => (
    <div className="fixed inset-0 z-[240] overflow-y-auto overscroll-y-contain p-2 pt-[calc(env(safe-area-inset-top)+0.35rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)] md:p-3" style={{ background: OVERLAY_BG }}>
        <div className="mx-auto flex min-h-full w-full max-w-7xl items-start pb-24">
            <div className="w-full overflow-hidden rounded-3xl border border-white/15 bg-zinc-950/94 shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
                {header}
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2.25fr)_minmax(280px,0.75fr)]">
                    <div className="space-y-3 px-3 py-3 md:px-4 md:py-4">
                        {primaryContent}
                    </div>
                    <aside className="border-t border-white/10 bg-zinc-950/75 px-3 py-3 md:px-4 md:py-4 xl:border-l xl:border-t-0">
                        {sideContent}
                    </aside>
                </div>
            </div>
        </div>
        {footer}
    </div>
);

export default MissionSetupShell;
