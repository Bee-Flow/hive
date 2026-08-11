/**
 * Auto-dismissing toast for the Guardrails / Privacy Shield admin surface.
 *
 * Success toasts vanish after `duration` ms (default 3 000).
 * Error toasts stay until the user closes them or a subsequent save succeeds.
 *
 * Exported shape:
 *   - <ToastHost />          — mount once at the top of GuardrailsPanel
 *   - showToast(type, msg)   — global imperative API
 */

import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

const _subscribers = new Set();
let _id = 0;

export function showToast(type, text, { duration } = {}) {
    const toast = {
        id: ++_id,
        type: type === 'error' ? 'error' : 'success',
        text: String(text || ''),
        // Errors stick by default; success fades.
        duration: duration != null ? duration : (type === 'error' ? 0 : 3000),
        createdAt: Date.now(),
    };
    _subscribers.forEach(fn => fn({ kind: 'add', toast }));
    return toast.id;
}

export function dismissToast(id) {
    _subscribers.forEach(fn => fn({ kind: 'remove', id }));
}

export function ToastHost() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const onEvent = ({ kind, toast, id }) => {
            if (kind === 'add') setToasts(prev => [...prev, toast]);
            else if (kind === 'remove') setToasts(prev => prev.filter(t => t.id !== id));
        };
        _subscribers.add(onEvent);
        return () => { _subscribers.delete(onEvent); };
    }, []);

    // Per-toast auto-dismiss timers.
    useEffect(() => {
        const timers = toasts
            .filter(t => t.duration > 0)
            .map(t => setTimeout(() => dismissToast(t.id), t.duration - (Date.now() - t.createdAt)));
        return () => timers.forEach(clearTimeout);
    }, [toasts]);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[1100] flex flex-col gap-2 pointer-events-none max-w-sm">
            {toasts.map(t => (
                <div
                    key={t.id}
                    role={t.type === 'error' ? 'alert' : 'status'}
                    className="pointer-events-auto flex items-start gap-2 px-3 py-2 rounded-lg border shadow-lg text-xs"
                    style={{
                        background: 'var(--bg-card)',
                        borderColor: t.type === 'error' ? 'rgba(220, 38, 38, 0.4)' : 'rgba(34, 197, 94, 0.4)',
                        animation: 'dropdownIn .15s ease-out',
                    }}
                >
                    {t.type === 'error'
                        ? <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#dc2626' }} />
                        : <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#22c55e' }} />}
                    <div className="flex-1 min-w-0 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{t.text}</div>
                    <button
                        onClick={() => dismissToast(t.id)}
                        className="shrink-0 p-0.5 rounded hover:bg-[var(--bg-tertiary)]"
                        aria-label="Close notification"
                    >
                        <X className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                    </button>
                </div>
            ))}
        </div>
    );
}
