import React from 'react';

const HostWorkspaceShell = ({
    views,
    activeView,
    onSelectView,
    context,
    children
}) => {
    return (
        <div className="flex-1 min-h-0 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
                <aside className="border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-950 p-2 sm:p-3 space-y-1 overflow-y-auto custom-scrollbar max-h-[220px] lg:max-h-none">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 px-2 pb-1">Admin Areas</div>
                    {views.map((view) => {
                        const isActive = activeView === view.id;
                        return (
                            <button
                                key={`workspace-view-${view.id}`}
                                onClick={() => onSelectView?.(view.id)}
                                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                                    isActive
                                        ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100'
                                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
                                }`}
                            >
                                <div className="flex items-center gap-2 text-sm font-semibold leading-tight">
                                    <i className={`fa-solid ${view.icon || 'fa-folder'} text-xs w-3 text-center`}></i>
                                    {view.label}
                                </div>
                            </button>
                        );
                    })}
                </aside>
                <main className="min-h-0 overflow-hidden flex flex-col bg-zinc-950">
                    {children}
                </main>
                <aside className="hidden lg:block border-l border-zinc-800 bg-zinc-950 p-3">
                    {context || (
                        <div className="text-xs text-zinc-500">
                            Select an area to configure host operations.
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};

export default HostWorkspaceShell;
