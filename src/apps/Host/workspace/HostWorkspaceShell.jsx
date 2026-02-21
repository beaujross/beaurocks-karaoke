import React from 'react';

const HostWorkspaceShell = ({
    views = [],
    activeView = '',
    onSelectView,
    context,
    children,
    showContext = true,
    fullBleed = false
}) => {
    const hasViewNav = Array.isArray(views) && views.length > 0;

    return (
        <div className={`flex-1 min-h-0 bg-zinc-950 overflow-hidden ${fullBleed ? '' : 'border border-zinc-800 rounded-xl'}`}>
            <div className="h-full min-h-0 flex flex-col">
                {hasViewNav && (
                    <div className={`border-b border-zinc-800 bg-zinc-950 ${fullBleed ? 'px-3 py-2 md:px-4' : 'px-3 py-2'}`} data-admin-view-nav>
                        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-0.5">
                            {views.map((view) => {
                                const isActive = activeView === view.id;
                                return (
                                    <button
                                        key={`workspace-view-${view.id}`}
                                        type="button"
                                        data-admin-view-item={view.id}
                                        onClick={() => onSelectView?.(view.id)}
                                        className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                                            isActive
                                                ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100'
                                                : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white'
                                        }`}
                                    >
                                        <i className={`fa-solid ${view.icon || 'fa-folder'} text-[11px]`}></i>
                                        <span>{view.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
                <div className={`flex-1 min-h-0 grid ${showContext ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-1'}`}>
                    <main className="min-h-0 overflow-hidden flex flex-col bg-zinc-950">
                        {children}
                    </main>
                    {showContext && (
                        <aside className="hidden lg:block border-l border-zinc-800 bg-zinc-950 p-3">
                            {context || (
                                <div className="text-xs text-zinc-500">
                                    Select an area to configure host operations.
                                </div>
                            )}
                        </aside>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HostWorkspaceShell;
