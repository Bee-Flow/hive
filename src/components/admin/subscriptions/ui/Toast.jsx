import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);

    const push = useCallback((tone, message, ttl = 3000) => {
        const id = Math.random().toString(36).slice(2);
        setToasts(t => [...t, { id, tone, message }]);
        if (ttl > 0) setTimeout(() => dismiss(id), ttl);
    }, [dismiss]);

    const api = {
        success: m => push('success', m),
        error:   m => push('error', m, 5000),
        info:    m => push('info', m),
    };

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="fixed top-4 right-4 z-[2000] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-lg text-[13px] font-medium min-w-[240px] max-w-[420px] backdrop-blur-sm animate-in fade-in slide-in-from-top-2 ${
                            t.tone === 'error'
                                ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                                : t.tone === 'success'
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                                    : 'bg-blue-500/15 border-blue-500/40 text-blue-200'
                        }`}
                    >
                        {t.tone === 'error'
                            ? <AlertTriangle className="w-4 h-4 shrink-0" />
                            : <CheckCircle  className="w-4 h-4 shrink-0" />}
                        <span className="flex-1 leading-snug">{t.message}</span>
                        <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        return {
            success: m => console.log('[toast:success]', m),
            error:   m => console.error('[toast:error]', m),
            info:    m => console.log('[toast:info]', m),
        };
    }
    return ctx;
}
