import React, { useEffect, useRef, useState } from 'react';
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
 *
 * Repeats COLLAPSE. A caller in a retry loop — the routines builder re-saves a
 * debounced draft ~every 500ms, and a definition the server rejects fails every
 * time — used to paint a fresh toast per attempt, so a single invalid step
 * buried the screen under a dozen identical 6-second errors (BFSF-348). An
 * identical kind+message now refreshes the toast that is already up and counts
 * the repeat instead of queueing behind it.
 */

type ToastKind = 'success' | 'error' | 'info';

/** Beyond this the corner is a wall of text, not a notification. Oldest go. */
const MAX_TOASTS = 4;

interface ToastItem {
    id: number;
    kind: ToastKind;
    message: string;
    duration: number;
    /** How many times this exact message has arrived; 1 = shown once. */
    count?: number;
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
    // The list is mutated from DOM event handlers that need to READ it to decide
    // whether an arriving message is a repeat, so the ref — not the state — is
    // the working copy; `commit` keeps the two in step.
    const itemsRef = useRef<ToastItem[]>([]);
    const timers = useRef<Map<number, number>>(new Map());

    useEffect(() => {
        const commit = (next: ToastItem[]) => { itemsRef.current = next; setItems(next); };
        const clearTimer = (id: number) => {
            const t = timers.current.get(id);
            if (t) { window.clearTimeout(t); timers.current.delete(id); }
        };
        // (Re)start the dismiss countdown. A collapsed repeat re-arms the timer
        // of the toast already on screen, so a message that keeps arriving stays
        // up rather than expiring mid-retry.
        const arm = (id: number, duration: number) => {
            clearTimer(id);
            if (duration <= 0) return;
            timers.current.set(id, window.setTimeout(() => {
                timers.current.delete(id);
                commit(itemsRef.current.filter((t) => t.id !== id));
            }, duration));
        };

        const onAdd = (e: Event) => {
            const incoming = (e as CustomEvent<ToastEventDetail>).detail?.item;
            if (!incoming) return;
            const cur = itemsRef.current;
            const at = cur.findIndex((t) => t.kind === incoming.kind && t.message === incoming.message);
            if (at >= 0) {
                const next = cur.slice();
                next[at] = { ...cur[at], count: (cur[at].count || 1) + 1 };
                commit(next);
                arm(cur[at].id, incoming.duration);
                return;
            }
            const next = [...cur, { ...incoming, count: 1 }];
            while (next.length > MAX_TOASTS) {
                const dropped = next.shift();
                if (dropped) clearTimer(dropped.id);
            }
            commit(next);
            arm(incoming.id, incoming.duration);
        };
        const onDismiss = (e: Event) => {
            const id = (e as CustomEvent<{ id?: number }>).detail?.id;
            if (id == null) {
                itemsRef.current.forEach((t) => clearTimer(t.id));
                commit([]);
                return;
            }
            clearTimer(id);
            commit(itemsRef.current.filter((t) => t.id !== id));
        };
        window.addEventListener(EVENT, onAdd);
        window.addEventListener('beeflow:toast:dismiss', onDismiss);
        return () => {
            window.removeEventListener(EVENT, onAdd);
            window.removeEventListener('beeflow:toast:dismiss', onDismiss);
            timers.current.forEach((t) => window.clearTimeout(t));
            timers.current.clear();
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
                        {(item.count || 1) > 1 && (
                            <span
                                title={`This happened ${item.count} times`}
                                className="shrink-0 self-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                                style={{ background: s.bg, color: s.color }}
                            >
                                ×{item.count}
                            </span>
                        )}
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
