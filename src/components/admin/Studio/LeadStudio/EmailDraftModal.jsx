import React, { useState, useEffect, useCallback } from 'react';
import { X, Mail, RefreshCw, Copy, Check, Loader2, Send } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import useTranslation from '../../../../hooks/useTranslation';

const TONES = [
    { id: '', label: 'Standaard' },
    { id: 'formeel', label: 'Formeel' },
    { id: 'informeel', label: 'Informeel' },
    { id: 'kort en zakelijk', label: 'Kort & zakelijk' },
];

/**
 * AI outreach e-mail composer for a single lead. On open it shows the persisted
 * draft if there is one, otherwise it auto-generates. "Opnieuw genereren" runs a
 * fresh, web-grounded generation (with optional extra instructions + tone); the
 * server persists the result so teammates see the same draft. "Bewaar" saves
 * manual edits without regenerating.
 */
export default function EmailDraftModal({ lead, onClose, t: tProp }) {
    const { t: tHook } = useTranslation();
    const t = tProp || tHook;
    const [subject, setSubject] = useState(lead?.emailDraftSubject || '');
    const [body, setBody] = useState(lead?.emailDraftBody || '');
    const [instructions, setInstructions] = useState('');
    const [tone, setTone] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [err, setErr] = useState(null);
    const [note, setNote] = useState(null);

    const generate = useCallback(async () => {
        setLoading(true); setErr(null); setNote(null);
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/leads/${lead.id}/draft-email`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instructions: instructions.trim() || null, tone: tone || null }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) { setErr(d.message || d.error || t('leads.email.err', 'Genereren mislukt.')); return; }
            setSubject(d.subject || '');
            setBody(d.body || '');
            if (d.usedSearch === false) setNote(t('leads.email.no_search', 'Geen extra webinformatie gevonden — opgesteld op basis van de bekende leadgegevens.'));
        } catch (e) {
            setErr(e.message || t('leads.email.err', 'Genereren mislukt.'));
        } finally { setLoading(false); }
    }, [lead?.id, instructions, tone, t]);

    // Auto-generate the first time only when there's no saved draft yet.
    useEffect(() => {
        if (!lead?.emailDraftSubject && !lead?.emailDraftBody) generate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const save = async () => {
        setSaving(true); setErr(null);
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/leads/${lead.id}/draft-email`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, body }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.message || d.error || t('leads.email.err_save', 'Opslaan mislukt.')); return; }
            setNote(t('leads.email.saved', 'Concept opgeslagen.'));
        } catch (e) { setErr(e.message || t('leads.email.err_save', 'Opslaan mislukt.')); }
        finally { setSaving(false); }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(`${t('leads.email.subject', 'Onderwerp')}: ${subject}\n\n${body}`);
            setCopied(true); setTimeout(() => setCopied(false), 1500);
        } catch (_) { /* clipboard blocked */ }
    };

    const mailto = lead?.email
        ? `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        : null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="relative w-[640px] max-h-[90vh] overflow-y-auto rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-xl" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                        <Mail size={15} style={{ color: 'var(--accent-primary)' }} />
                        {t('leads.email.title', 'Concept e-mail')} · <span className="text-[var(--text-secondary)] font-normal truncate max-w-[260px]">{lead?.companyName}</span>
                    </h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"><X size={16} /></button>
                </header>

                <div className="px-5 py-4 flex flex-col gap-3">
                    {/* Tweak controls */}
                    <div className="flex items-end gap-2 flex-wrap">
                        <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
                            <span className="text-xs text-[var(--text-tertiary)]">{t('leads.email.instructions', 'Extra instructies (optioneel)')}</span>
                            <input value={instructions} onChange={e => setInstructions(e.target.value)}
                                placeholder={t('leads.email.instructions_ph', 'bv. verwijs naar hun nieuwe vestiging')}
                                className="px-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-[var(--text-tertiary)]">{t('leads.email.tone', 'Toon')}</span>
                            <select value={tone} onChange={e => setTone(e.target.value)}
                                className="px-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                                {TONES.map(o => <option key={o.id} value={o.id}>{t(`leads.email.tone_${o.id || 'default'}`, o.label)}</option>)}
                            </select>
                        </label>
                        <button onClick={generate} disabled={loading}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50">
                            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            {t('leads.email.regenerate', 'Opnieuw genereren')}
                        </button>
                    </div>

                    {loading && !subject && !body ? (
                        <div className="flex items-center justify-center py-10 text-[var(--text-tertiary)] gap-2 text-xs">
                            <Loader2 size={16} className="animate-spin" /> {t('leads.email.generating', 'De AI zoekt informatie en stelt een e-mail op…')}
                        </div>
                    ) : (
                        <>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs text-[var(--text-tertiary)]">{t('leads.email.subject', 'Onderwerp')}</span>
                                <input value={subject} onChange={e => setSubject(e.target.value)}
                                    className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs text-[var(--text-tertiary)]">{t('leads.email.body', 'Bericht')}</span>
                                <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
                                    className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] leading-relaxed" />
                            </label>
                        </>
                    )}

                    {note && <div className="text-[11px] text-[var(--text-tertiary)]">{note}</div>}
                    {err && <div className="text-xs" style={{ color: 'var(--danger, #ef4444)' }}>{err}</div>}
                </div>

                <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                    <div className="flex items-center gap-2">
                        <button onClick={copy} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
                            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />} {t('leads.email.copy', 'Kopiëren')}
                        </button>
                        {mailto && (
                            <a href={mailto} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
                                <Send size={12} /> {t('leads.email.open_client', 'Openen in e-mail')}
                            </a>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]">{t('common.close', 'Sluiten')}</button>
                        <button onClick={save} disabled={saving || loading}
                            className="px-3 py-1.5 text-sm rounded text-white font-semibold disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}>
                            {saving ? t('leads.email.saving', 'Opslaan…') : t('leads.email.save', 'Bewaar')}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
