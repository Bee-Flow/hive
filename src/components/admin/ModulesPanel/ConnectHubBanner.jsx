import React from 'react';
import { Loader2, Plug } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

// Shown on the Marketplace tab when the install is not connected to the hub.
// The primary CTA opens the connect confirm dialog.
export default function ConnectHubBanner({ licensed = true, busy, onConnect }) {
    const { t } = useTranslation();
    return (
        <div
            className="rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
            data-testid="connect-hub-banner"
        >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)' }}>
                <Plug className="w-5 h-5" style={{ color: '#f59e0b' }} />
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('modules.connect_title')}</h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {licensed ? t('modules.connect_body') : t('modules.connect_body_unlicensed')}
                </p>
            </div>
            <button
                onClick={onConnect}
                disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 flex-shrink-0"
                style={{ background: 'var(--accent-primary)', color: '#fff' }}
            >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                {t('modules.connect_cta')}
            </button>
        </div>
    );
}
