import React from 'react';
import { createPortal } from 'react-dom';

const QueueSongInspector = ({
    song,
    onClose,
    compactViewport = false,
    children,
}) => {
    React.useEffect(() => {
        if (!song || typeof window === 'undefined') return undefined;
        const handleKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            onClose?.();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, song]);
    if (!song || typeof document === 'undefined') return null;
    return createPortal(
        <aside
            role="dialog"
            aria-modal="false"
            aria-label={`Performance details for ${song.singerName || song.singer || 'singer'}`}
            data-feature-id="queue-song-inspector"
            className={`host-app fixed z-[80] overflow-hidden rounded-2xl border border-cyan-300/30 bg-zinc-950/98 text-white shadow-[0_24px_80px_rgba(0,0,0,0.72)] backdrop-blur-xl ${
                compactViewport
                    ? 'inset-x-2 bottom-2 max-h-[72vh]'
                    : 'bottom-4 right-4 top-[190px] w-[min(440px,calc(100vw-2rem))]'
            }`}
        >
            <div className="flex min-h-[56px] items-center justify-between gap-3 border-b border-white/10 bg-cyan-500/[0.08] px-3 py-2">
                <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Performance Details</div>
                    <div className="truncate text-base font-black text-white">{song.singerName || song.singer || 'Singer'}</div>
                    <div className="truncate text-sm text-zinc-300">{song.songTitle || song.title || 'Song'}</div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close performance details"
                    className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/30 text-zinc-100 transition hover:border-cyan-300/40 hover:text-white"
                >
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div className="max-h-[calc(72vh-56px)] overflow-y-auto p-2 custom-scrollbar">
                {children}
            </div>
        </aside>,
        document.body,
    );
};

export default QueueSongInspector;
