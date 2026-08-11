import React from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

export default function RemoveModuleDialog({ module, busy, onCancel, onConfirm }) {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={busy ? undefined : onCancel}>
            <div
                className="w-full max-w-md rounded-2xl border overflow-hidden"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                        {t('modules.remove_confirm_title', { name: module.name })}
                    </h3>
                    <button onClick={onCancel} disabled={busy} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                        <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                </div>
                <div className="px-5 py-4 space-y-3">
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {t('modules.remove_confirm_body')}
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            onClick={onCancel}
                            disabled={busy}
                            className="px-3 py-2 rounded-lg text-sm border disabled:opacity-50"
                            style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
                        >
                            {t('modules.cancel')}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={busy}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }}
                        >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {t('modules.remove_confirm_cta')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
