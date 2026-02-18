import React from 'react';

const HostWorkspaceShell = ({ context, children }) => {
    return (
        <div className="flex-1 min-h-0 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]">
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
