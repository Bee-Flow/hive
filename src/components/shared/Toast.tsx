import React, { useEffect, useState } from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

/**
 * Toast — minimal local toast system. Event-based so any module can call
 * `toast.success(msg)` without prop-drilling. Mount <Toaster /> once near the
 * app root and toasts queue into the corner.
 *
 * Intentionally tiny: no dependencies, no animation library, no positioning
 * library. If the project later needs anchored / stacked / interactive toasts,
 * swap this out for Sonner. The public API (toast.success / toast.error /
 * toast.info / toast.dismiss) is compatible enough to make that drop-in.
 */

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
    id: number;
    kind: ToastKind;
    message: string;
    duration: number;
}

interface ToastEventDetail {
    item: ToastItem;
}

const EVENT = 'beeflow:toast';
let nextId = 1;

function emit(item: ToastItem): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<ToastEventDetail>(EVENT, { detail: { item } }));
}

function push(kind: ToastKind, message: string, duration?: number): number {
    const id = nextId++;
    emit({ id, kind, message, duration: duration ?? (kind === 'error' ? 6000 : 3000) });
    return id;
}

export const toast = {
    success: (message: string, duration?: number) => push('success', message, duration),
    error: (message: string, duration?: number) => push('error', message, duration),
    info: (message: string, duration?: number) => push('info', message, duration),
    dismiss: (id?: number) => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('beeflow:toast:dismiss', { detail: { id } }));
    },
};

const KIND_STYLES: Record<ToastKind, { bg: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
    success: { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', icon: Check },
    error: { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', icon: AlertCircle },
    info: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', icon: Info },
};

export function Toaster() {
    const [items, setItems] = useState<ToastItem[]>([]);

    useEffect(() => {
        const onAdd = (e: Event) => {
            const detail = (e as CustomEvent<ToastEventDetail>).detail;
            if (!detail?.item) return;
            setItems((prev) => [...prev, detail.item]);
            if (detail.item.duration > 0) {
                window.setTimeout(() => {
                    setItems((prev) => prev.filter((t) => t.id !== detail.item.id));
                }, detail.item.duration);
            }
        };
        const onDismiss = (e: Event) => {
            const detail = (e as CustomEvent<{ id?: number }>).detail;
            setItems((prev) => (detail?.id == null ? [] : prev.filter((t) => t.id !== detail.id)));
        };
        window.addEventListener(EVENT, onAdd);
        window.addEventListener('beeflow:toast:dismiss', onDismiss);
        return () => {
            window.removeEventListener(EVENT, onAdd);
            window.removeEventListener('beeflow:toast:dismiss', onDismiss);
        };
    }, []);

    if (items.length === 0) return null;

    return (
        <div
            aria-live="polite"
            aria-atomic="false"
            className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        >
            {items.map((item) => {
                const s = KIND_STYLES[item.kind];
                const Icon = s.icon;
                return (
                    <div
                        key={item.id}
                        role={item.kind === 'error' ? 'alert' : 'status'}
                        data-surface="opaque"
                        className="pointer-events-auto flex items-start gap-2 px-3 py-2 rounded-lg shadow-lg border min-w-[220px] max-w-sm"
                        style={{
                            background: 'var(--bg-card)',
                            borderColor: 'var(--border-default)',
                            color: 'var(--text-primary)',
                        }}
                    >
                        <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 mt-0.5"
                            style={{ background: s.bg, color: s.color }}
                        >
                            <Icon className="w-3 h-3" />
                        </span>
                        <span className="text-sm flex-1 min-w-0">{item.message}</span>
                        <button
                            type="button"
                            onClick={() => toast.dismiss(item.id)}
                            aria-label="Dismiss"
                            className="shrink-0 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

export default toast;
