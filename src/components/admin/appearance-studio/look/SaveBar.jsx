import { Check, Save, Loader2, AlertCircle } from 'lucide-react';
import React from 'react';

/**
 * SaveBar — sticky bottom action bar for the Look editor. Status pill on the
 * left, Discard + Reload + Save on the right.
 *
 * Stays opaque even when the editor is rendering under Glass via `data-surface
 * ="opaque"` so it's always legible.
 */
export default function SaveBar({
    dirty,
    saving,
    error,
    onSave,
    onDiscard,
    onReload,
}) {
    return (
        <div
            data-surface="opaque"
            className="sticky bottom-0 px-6 py-3 border-t flex items-center gap-3 flex-wrap z-10"
            style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
            }}
        >
            <StatusPill dirty={dirty} saving={saving} error={error} />
            <div className="ml-auto flex items-center gap-2">
                <button
                    type="button"
                    onClick={onDiscard}
                    disabled={!dirty || saving}
                    className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                    Discard
                </button>
                <button
                    type="button"
                    onClick={onReload}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    title="Re-fetch the saved theme from the server"
                >
                    Reload
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving || !dirty}
                    className="px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40 transition-opacity"
                    style={{
                        background: 'var(--accent-primary)',
                        color: 'var(--accent-primary-fg, #ffffff)',
                    }}
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving…' : 'Save as organisation default'}
                </button>
            </div>
        </div>
    );
}

function StatusPill({ dirty, saving, error }) {
    if (error) {
        return (
            <span
                className="text-xs inline-flex items-center gap-1.5"
                style={{ color: 'var(--danger, #ef4444)' }}
            >
                <AlertCircle className="w-3.5 h-3.5" /> {error}
            </span>
        );
    }
    if (saving) {
        return (
            <span
                className="text-xs inline-flex items-center gap-1.5"
                style={{ color: 'var(--text-muted)' }}
            >
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
            </span>
        );
    }
    if (dirty) {
        return (
            <span
                className="text-xs inline-flex items-center gap-1.5"
                style={{ color: 'var(--warning, #f59e0b)' }}
            >
                <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--warning, #f59e0b)' }}
                />
                Unsaved changes
            </span>
        );
    }
    return (
        <span
            className="text-xs inline-flex items-center gap-1.5"
            style={{ color: 'var(--text-muted)' }}
        >
            <Check className="w-3.5 h-3.5" style={{ color: '#10b981' }} /> All changes saved
        </span>
    );
}
