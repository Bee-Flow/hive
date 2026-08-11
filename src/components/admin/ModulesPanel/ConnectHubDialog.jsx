import React from 'react';
import { Loader2, Plug, X } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

// Confirm-connect dialog. `licensed` picks the copy: a licensed install
// connects with its server licence; an unlicensed one connects with a free
// registration. Reused, with different copy, for the disconnect confirm.
export default function ConnectHubDialog({ mode = 'connect', licensed = true, busy, error, onConfirm, onCancel }) {
    const { t } = useTranslation();
    const isDisconnect = mode === 'disconnect';
    const title = isDisconnect ? t('modules.disconnect_confirm_title') : t('modules.connect_title');
    const body = isDisconnect
        ? t('modules.disconnect_confirm_body')
        : (licensed ? t('modules.connect_body') : t('modules.connect_body_unlicensed'));
    const cta = isDisconnect ? t('modules.disconnect') : t('modules.connect_cta');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={busy ? undefined : onCancel}>
            <div
                className="w-full max-w-md rounded-2xl border overflow-hidden"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Plug className="w-4 h-4" style={{ color: isDisconnect ? '#ef4444' : '#f59e0b' }} />
                        {title}
                    </h3>
                    <button onClick={onCancel} disabled={busy} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                        <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                </div>
                <div className="px-5 py-4 space-y-3">
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
                    {error && (
                        <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400">{error}</div>
                    )}
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
                            style={isDisconnect
                                ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }
                                : { background: 'var(--accent-primary)', color: '#fff' }}
                        >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                            {cta}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
