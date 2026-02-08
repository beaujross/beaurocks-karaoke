import React, { useState, createContext, useContext } from 'react';
import { EMOJI } from '../lib/emoji';

export const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = (msg) => { 
        const id = Date.now() + Math.random(); 
        setToasts(prev => [...prev, { id, msg }]); 
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500); 
    };

    return ( 
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="fixed top-24 left-0 w-full flex flex-col items-center gap-2 pointer-events-none z-[200]">
                {toasts.map(t => (
                    <div key={t.id} className="bg-zinc-800/90 border border-pink-500 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold animate-pop text-center backdrop-blur-sm">
                        {EMOJI.bell} {t.msg}
                    </div>
                ))}
            </div>
        </ToastContext.Provider> 
    );
};

export const useToast = () => useContext(ToastContext);
