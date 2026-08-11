import React from 'react';

const OVERLAY_BG = 'radial-gradient(circle at 10% 4%, rgba(34,211,238,0.42), transparent 34%), radial-gradient(circle at 92% 8%, rgba(244,114,182,0.38), transparent 38%), linear-gradient(145deg, #13243c 0%, #18233e 48%, #351d3d 100%)';

const MissionSetupShell = ({
    header = null,
    primaryContent = null,
    sideContent = null,
    footer = null
}) => (
    <div className="fixed inset-0 z-[240] overflow-y-auto overscroll-y-contain p-2 pt-[calc(env(safe-area-inset-top)+0.35rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)] md:p-3" style={{ background: OVERLAY_BG }}>
        <div className="mx-auto flex min-h-full w-full max-w-5xl items-start pb-24">
            <div className="w-full overflow-hidden rounded-[1.35rem] border border-cyan-200/28 bg-[linear-gradient(145deg,rgba(25,43,70,0.98),rgba(52,29,62,0.98))] shadow-[0_26px_70px_rgba(8,15,34,0.42)]">
                {header}
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-3 px-3 py-3 md:px-4 md:py-4">
                        {primaryContent}
                    </div>
                    <aside className="border-t border-cyan-100/15 bg-cyan-950/14 px-3 py-3 md:px-4 md:py-5 xl:border-l xl:border-t-0">
                        {sideContent}
                    </aside>
                </div>
            </div>
        </div>
        {footer}
    </div>
);

export default MissionSetupShell;
