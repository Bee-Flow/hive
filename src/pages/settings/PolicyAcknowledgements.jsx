import React, { useEffect, useState } from 'react';
import { FileText, Check, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Member-facing ISMS policy acknowledgements (ISO 27001 clause 7.3 awareness).
 *
 * Lists the org's published policies with this user's acknowledgement state;
 * reading expands the markdown body inline, confirming binds the user to the
 * exact published version (sha256'd server-side). Renders nothing when the org
 * has no published policies or the compliance module isn't licensed — this is
 * an Enterprise surface that must not clutter everyone else's settings.
 */
export default function PolicyAcknowledgements() {
    const { t } = useTranslation();
    const [docs, setDocs] = useState(null);
    const [openSlug, setOpenSlug] = useState(null);
    const [body, setBody] = useState(null);
    const [busySlug, setBusySlug] = useState(null);

    const refresh = async () => {
        try {
            const r = await authFetch(`${API_BASE}/api/compliance/iso/docs/published/me`);
            if (!r.ok) { setDocs([]); return; } // 402/403 → unlicensed or no access; stay invisible
            const data = await r.json();
            setDocs(Array.isArray(data) ? data : []);
        } catch { setDocs([]); }
    };

    useEffect(() => { refresh(); }, []);

    if (!docs || docs.length === 0) return null;

    const open = async (slug) => {
        if (openSlug === slug) { setOpenSlug(null); setBody(null); return; }
        setOpenSlug(slug);
        setBody(null);
        try {
            const r = await authFetch(`${API_BASE}/api/compliance/iso/docs/published/${encodeURIComponent(slug)}/body`);
            if (r.ok) setBody(await r.json());
        } catch { /* body stays null; confirm still possible from the list row */ }
    };

    const confirm = async (slug) => {
        setBusySlug(slug);
        try {
            const r = await authFetch(`${API_BASE}/api/compliance/iso/docs/${encodeURIComponent(slug)}/acknowledge`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
            });
            if (r.ok) await refresh();
        } finally { setBusySlug(null); }
    };

    return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 space-y-3">
            <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('settings.policy_ack_title')}</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)]">{t('settings.policy_ack_desc')}</p>
            <div className="space-y-2">
                {docs.map(d => (
                    <div key={d.slug} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]">
                        <button onClick={() => open(d.slug)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                            {openSlug === d.slug
                                ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                                : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />}
                            <span className="flex-1 text-[13px] font-medium text-[var(--text-primary)]">
                                {d.title} <span className="text-[var(--text-muted)] font-normal">v{d.current_version}</span>
                            </span>
                            {d.acknowledged ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600">
                                    <Check className="w-3.5 h-3.5" />
                                    {t('settings.policy_ack_done', { date: d.acknowledged_at ? new Date(d.acknowledged_at).toLocaleDateString() : '' }, null) || 'Confirmed'}
                                </span>
                            ) : (
                                <span className="text-[11px] font-semibold text-amber-500">{t('settings.policy_ack_read')}</span>
                            )}
                        </button>
                        {openSlug === d.slug && (
                            <div className="px-4 pb-3 space-y-3">
                                {body === null ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                                ) : (
                                    <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-[var(--text-secondary)] max-h-80 overflow-y-auto rounded-lg bg-[var(--bg-secondary)] p-3">
                                        {body.body}
                                    </pre>
                                )}
                                {!d.acknowledged && (
                                    <button onClick={() => confirm(d.slug)} disabled={busySlug === d.slug}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50"
                                        style={{ background: 'var(--accent-primary)' }}>
                                        <Check className="w-3.5 h-3.5" /> {t('settings.policy_ack_confirm')}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
