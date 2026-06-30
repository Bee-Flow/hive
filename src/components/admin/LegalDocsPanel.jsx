import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText, Megaphone, ListChecks, Save, UploadCloud, RotateCcw, Languages, Eye, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Admin → Legal. Platform admin edits the legal documents (English content +
 * version + requiresConsent + scope), manages optional (marketing) consents, and
 * views the consent acceptance audit ledger. Overrides are stored server-side via
 * legalStore; "Publish new version" bumps the version → triggers user re-consent.
 */

const SCOPES = [
    { id: 'both', label: 'Everyone' },
    { id: 'b2b', label: 'Org admin (DPA)' },
    { id: 'b2c', label: 'Consumer' },
];

export default function LegalDocsPanel() {
    const { t } = useTranslation();
    const [section, setSection] = useState('documents'); // documents | marketing | audit

    return (
        <div className="h-full flex flex-col">
            <div className="px-6 pt-5 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <FileText className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                    {t('admin.tab_legal', 'Legal')}
                </h2>
                <div className="flex gap-1 mt-3">
                    {[['documents', t('settings.legal_documents', 'Documents'), ListChecks],
                      ['marketing', t('settings.communication_prefs', 'Marketing consent'), Megaphone],
                      ['audit', 'Audit', FileText]].map(([id, label, Icon]) => (
                        <button key={id} type="button" onClick={() => setSection(id)}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-1.5"
                            style={section === id
                                ? { background: 'var(--accent-primary)', color: '#fff' }
                                : { color: 'var(--text-secondary)' }}>
                            <Icon className="w-4 h-4" /> {label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
                {section === 'documents' && <DocumentsManager />}
                {section === 'marketing' && <MarketingManager />}
                {section === 'audit' && <AuditViewer />}
            </div>
        </div>
    );
}

// ── Documents ────────────────────────────────────────────────────

function DocumentsManager() {
    const [docs, setDocs] = useState([]);
    const [locales, setLocales] = useState([]);
    const [selected, setSelected] = useState(null);
    const [editor, setEditor] = useState(null); // { docId, markdown, requiresConsent, scope, version, lastUpdated }
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState(false);
    const [msg, setMsg] = useState(null);

    const loadList = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/legal/admin/docs`);
            if (res.ok) {
                const d = await res.json();
                setDocs(d.docs || []);
                setLocales((d.locales || []).filter(l => l.code !== 'en'));
                if (!selected && d.docs?.length) setSelected(d.docs[0].docId);
            }
        } catch (_) { /* ignore */ } finally { setLoading(false); }
    }, [selected]);

    useEffect(() => { loadList(); }, [loadList]);

    useEffect(() => {
        if (!selected) return;
        setEditor(null); setMsg(null);
        (async () => {
            const res = await authFetch(`${API_BASE}/api/legal/admin/docs/${selected}`);
            if (res.ok) {
                const d = await res.json();
                setEditor({ docId: d.docId, markdown: d.markdown || '', requiresConsent: !!d.requiresConsent, scope: d.scope || 'both', version: d.version, lastUpdated: d.lastUpdated, hasOverride: d.hasOverride });
            }
        })();
    }, [selected]);

    const save = async (bumpVersion) => {
        if (!editor) return;
        if (bumpVersion && !window.confirm('Publish a new version? All users will be asked to re-accept this document on their next sign-in.')) return;
        setSaving(true); setMsg(null);
        try {
            const res = await authFetch(`${API_BASE}/api/legal/admin/docs/${editor.docId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    markdown: editor.markdown,
                    requiresConsent: editor.requiresConsent,
                    scope: editor.scope,
                    bumpVersion: !!bumpVersion,
                }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Save failed');
            setEditor(e => ({ ...e, version: d.doc.version, hasOverride: true }));
            setMsg({ type: 'ok', text: bumpVersion ? `Published v${d.doc.version} — users will re-consent.` : 'Saved.' });
            loadList();
        } catch (e) { setMsg({ type: 'err', text: e.message }); }
        finally { setSaving(false); }
    };

    const revert = async () => {
        if (!editor || !window.confirm('Revert to the built-in default? Your edits and version override will be removed.')) return;
        setSaving(true); setMsg(null);
        try {
            const res = await authFetch(`${API_BASE}/api/legal/admin/docs/${editor.docId}/revert`, { method: 'POST' });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Revert failed');
            setEditor({ docId: d.doc.docId, markdown: d.doc.markdown || '', requiresConsent: !!d.doc.requiresConsent, scope: d.doc.scope || 'both', version: d.doc.version, lastUpdated: d.doc.lastUpdated, hasOverride: false });
            setMsg({ type: 'ok', text: 'Reverted to default.' });
            loadList();
        } catch (e) { setMsg({ type: 'err', text: e.message }); }
        finally { setSaving(false); }
    };

    const retranslate = async () => {
        if (!locales.length) { setMsg({ type: 'err', text: 'No non-English locales configured.' }); return; }
        setSaving(true); setMsg({ type: 'ok', text: 'Re-translating…' });
        try {
            for (const l of locales) {
                await authFetch(`${API_BASE}/api/languages/${l.code}/ai-translate-legal`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ docIds: [editor.docId] }),
                });
            }
            setMsg({ type: 'ok', text: `Re-translated to ${locales.length} locale(s).` });
        } catch (e) { setMsg({ type: 'err', text: e.message }); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

    return (
        <div className="flex gap-6 h-full">
            {/* List */}
            <div className="w-64 shrink-0 space-y-1">
                {docs.map(d => (
                    <button key={d.docId} type="button" onClick={() => setSelected(d.docId)}
                        className="w-full text-left px-3 py-2 rounded-lg border text-sm"
                        style={selected === d.docId
                            ? { borderColor: 'var(--accent-primary)', background: 'var(--bg-tertiary)' }
                            : { borderColor: 'var(--border-subtle)' }}>
                        <div className="font-medium flex items-center justify-between gap-2" style={{ color: 'var(--text-primary)' }}>
                            <span className="truncate">{d.title}</span>
                            <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>v{d.version}</span>
                        </div>
                        <div className="text-[11px] mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                            {d.requiresConsent
                                ? <span className="text-emerald-500">Consent · {d.scope}</span>
                                : <span>Informational</span>}
                            {d.hasOverride && <span className="text-amber-500">· edited</span>}
                        </div>
                    </button>
                ))}
            </div>

            {/* Editor */}
            <div className="flex-1 min-w-0">
                {!editor ? (
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}><Loader2 className="w-5 h-5 animate-spin inline" /></div>
                ) : (
                    <div className="flex flex-col h-full">
                        <div className="flex items-center flex-wrap gap-3 mb-3">
                            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <input type="checkbox" checked={editor.requiresConsent}
                                    onChange={e => setEditor(s => ({ ...s, requiresConsent: e.target.checked }))}
                                    style={{ accentColor: 'var(--accent-primary)' }} />
                                Requires consent
                            </label>
                            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Scope
                                <select value={editor.scope} onChange={e => setEditor(s => ({ ...s, scope: e.target.value }))}
                                    disabled={!editor.requiresConsent}
                                    className="px-2 py-1 rounded border text-sm bg-transparent" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                    {SCOPES.map(s => <option key={s.id} value={s.id} style={{ background: 'var(--bg-secondary)' }}>{s.label}</option>)}
                                </select>
                            </label>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Current: v{editor.version}</span>
                            <button type="button" onClick={() => setPreview(p => !p)}
                                className="ml-auto inline-flex items-center gap-1 text-sm" style={{ color: 'var(--accent-primary)' }}>
                                <Eye className="w-4 h-4" /> {preview ? 'Edit' : 'Preview'}
                            </button>
                        </div>

                        {preview ? (
                            <div className="legal-admin-preview flex-1 overflow-auto rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{editor.markdown}</ReactMarkdown>
                            </div>
                        ) : (
                            <textarea value={editor.markdown}
                                onChange={e => setEditor(s => ({ ...s, markdown: e.target.value }))}
                                className="flex-1 w-full px-3 py-2 rounded-lg border text-xs font-mono resize-none focus:border-[var(--accent-primary)]"
                                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: 360 }} />
                        )}

                        {msg && (
                            <div className={`mt-3 text-sm flex items-center gap-1.5 ${msg.type === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>
                                {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}{msg.text}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <button type="button" onClick={() => save(false)} disabled={saving}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-50"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                <Save className="w-4 h-4" /> Save
                            </button>
                            <button type="button" onClick={() => save(true)} disabled={saving}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                                style={{ background: 'var(--accent-primary)' }}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} Publish new version
                            </button>
                            <button type="button" onClick={retranslate} disabled={saving}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-50"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                                <Languages className="w-4 h-4" /> Re-translate
                            </button>
                            {editor.hasOverride && (
                                <button type="button" onClick={revert} disabled={saving}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-50"
                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                                    <RotateCcw className="w-4 h-4" /> Revert to default
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Marketing consent ────────────────────────────────────────────

function MarketingManager() {
    const [consents, setConsents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/legal/admin/optional-consents`);
            if (res.ok) setConsents((await res.json()).consents || []);
        } catch (_) { /* ignore */ } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async (next) => {
        setSaving(true); setMsg(null);
        try {
            const res = await authFetch(`${API_BASE}/api/legal/admin/optional-consents`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ consents: next }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Save failed');
            setConsents(d.consents || []);
            setMsg({ type: 'ok', text: 'Saved.' });
        } catch (e) { setMsg({ type: 'err', text: e.message }); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

    return (
        <div className="max-w-2xl">
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Optional consents users can freely opt in/out of in their settings. Bumping a version re-asks for it.
            </p>
            <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--border-default)' }}>
                {consents.map((c, i) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 p-3">
                        <div>
                            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.id} <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {c.category} · v{c.version}</span></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => save(consents.map((x, j) => j === i ? { ...x, version: Number(x.version) + 1 } : x))}
                                disabled={saving} className="text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Bump version</button>
                            <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <input type="checkbox" checked={c.enabled !== false}
                                    onChange={e => save(consents.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))}
                                    style={{ accentColor: 'var(--accent-primary)' }} /> Enabled
                            </label>
                        </div>
                    </div>
                ))}
            </div>
            {msg && <div className={`mt-3 text-sm ${msg.type === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>{msg.text}</div>}
        </div>
    );
}

// ── Acceptance audit ─────────────────────────────────────────────

function AuditViewer() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/legal/admin/acceptances?limit=100`);
                if (res.ok) setRows((await res.json()).acceptances || []);
            } catch (_) { /* ignore */ } finally { setLoading(false); }
        })();
    }, []);

    if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}><Loader2 className="w-5 h-5 animate-spin inline" /></div>;
    if (!rows.length) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No acceptances recorded yet.</div>;

    const fmt = (s) => { try { return new Date(s).toLocaleString(); } catch { return s; } };

    return (
        <div className="overflow-auto">
            <table className="w-full text-xs" style={{ color: 'var(--text-secondary)' }}>
                <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                        {['When', 'User', 'Organisation', 'Document', 'Ver', 'Method', 'IP'].map(h => (
                            <th key={h} className="text-left font-semibold px-2 py-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.id} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                            <td className="px-2 py-1.5 whitespace-nowrap">{fmt(r.created_at)}</td>
                            <td className="px-2 py-1.5">{r.email || r.user_id}</td>
                            <td className="px-2 py-1.5">{r.organization_name || (r.organization_id ? r.organization_id : '—')}</td>
                            <td className="px-2 py-1.5">{r.doc_id}</td>
                            <td className="px-2 py-1.5">{r.doc_version}</td>
                            <td className="px-2 py-1.5">{r.method}</td>
                            <td className="px-2 py-1.5">{r.ip || '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
