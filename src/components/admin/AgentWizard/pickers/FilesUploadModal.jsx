import React, { useState, useEffect, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

// Sub-component: list of all KBs the user can link/unlink to this agent,
// plus an inline create-form. Co-located here because nothing else uses it.
function KbList({ kbs, linkedIds, onToggle, onCreate, t }) {
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        if (!name.trim() || busy) return;
        setBusy(true);
        const created = await onCreate(name.trim(), description.trim());
        setBusy(false);
        if (created) { setName(''); setDescription(''); setCreating(false); }
    };
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <div className="text-[13px] font-medium text-[var(--text-secondary)]">
                    {t('agent_wizard.knowledge.kbs')} ({kbs.length})
                </div>
                <button
                    onClick={() => setCreating(v => !v)}
                    className="text-xs text-[var(--accent)] hover:underline"
                >
                    + {t('agent_wizard.knowledge.create_kb')}
                </button>
            </div>
            {creating && (
                <div className="mb-3 p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] space-y-2">
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('agent_wizard.knowledge.kb_name')}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                    <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('agent_wizard.knowledge.kb_description')}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            {t('agent_studio.cancel')}
                        </button>
                        <button onClick={submit} disabled={!name.trim() || busy} className="px-4 py-1.5 rounded-full text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
                            {busy ? '…' : t('agent_wizard.knowledge.create_kb')}
                        </button>
                    </div>
                </div>
            )}
            {kbs.length === 0 && (
                <div className="text-xs text-[var(--text-tertiary)] py-2">{t('agent_wizard.knowledge.no_kbs')}</div>
            )}
            <div className="divide-y divide-[var(--border-default)] border-t border-b border-[var(--border-default)]">
                {kbs.map(kb => {
                    const linked = linkedIds.includes(kb.id);
                    return (
                        <div key={kb.id} className="flex items-center gap-3 py-2 px-1">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-[var(--text-primary)] truncate">{kb.name}</div>
                                {(kb.docs_count != null || kb.doc_count != null) && (
                                    <div className="text-[11px] text-[var(--text-tertiary)]">
                                        {(kb.docs_count ?? kb.doc_count ?? 0)} docs
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => onToggle(kb.id)}
                                className={`px-3 py-1 rounded-full text-xs border transition ${linked
                                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--bg-secondary)]'
                                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                            >
                                {linked ? `✓ ${t('agent_wizard.knowledge.linked')}` : `+ ${t('agent_wizard.knowledge.link')}`}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function FilesUploadModal({ t, agent, knowledgeBaseIds, onKnowledgeBaseIdsChange, strictKnowledge, onStrictKnowledgeChange, includeSourceReferences, onIncludeSourceReferencesChange, allKbs, onToggleKbLink, onCreateKb, onClose }) {
    // Primary KB = the auto-created KB at wizard/commit time, or the first linked KB.
    const initialKbId = agent?.config?.wizard?.primaryKbId || knowledgeBaseIds?.[0] || null;
    const [kbId, setKbId] = useState(initialKbId);
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const ensureKB = useCallback(async () => {
        if (kbId) return kbId;
        // Lazily create one if commit didn't (older agents, KB feature was disabled, etc.).
        try {
            const res = await authFetch(`${API_BASE}/api/kb`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: agent?.name || 'Knowledge', description: `Auto-generated for agent "${agent?.name}"` }),
            });
            if (!res.ok) throw new Error(await res.text());
            const created = await res.json();
            setKbId(created.id);
            const next = Array.from(new Set([...(knowledgeBaseIds || []), created.id]));
            onKnowledgeBaseIdsChange(next);
            return created.id;
        } catch (err) {
            setError(err.message);
            return null;
        }
    }, [kbId, agent?.name, agent?.id, knowledgeBaseIds, onKnowledgeBaseIdsChange]);

    const loadDocs = useCallback(async (id) => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${id}/documents?limit=200`);
            if (res.ok) {
                const data = await res.json();
                setDocs(data.items || data.documents || data || []);
            }
        } catch (_) { /* ignore */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { if (kbId) loadDocs(kbId); }, [kbId, loadDocs]);

    const uploadFiles = async (files) => {
        if (!files || files.length === 0) return;
        setError(null);
        setUploading(true);
        try {
            const id = await ensureKB();
            if (!id) return;
            for (const file of files) {
                const fd = new FormData();
                fd.append('file', file);
                const res = await authFetch(`${API_BASE}/api/kb/${id}/ingest/file`, {
                    method: 'POST',
                    body: fd,
                });
                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(`${file.name}: ${txt}`);
                }
            }
            await loadDocs(id);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer?.files?.length) uploadFiles(Array.from(e.dataTransfer.files));
    };

    const deleteDoc = async (docId) => {
        if (!kbId) return;
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/documents/${docId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            await loadDocs(kbId);
        } catch (err) { setError(err.message); }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--bg-card,#fff)] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
                    <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{t('agent_wizard.files.title')}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">{t('agent_wizard.files.subtitle')}</div>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="flex items-start gap-3 px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] cursor-pointer">
                            <input type="checkbox" checked={!!strictKnowledge} onChange={(e) => onStrictKnowledgeChange(e.target.checked)} className="mt-1" />
                            <div>
                                <div className="text-sm text-[var(--text-primary)]">{t('agent_wizard.files.strict_label')}</div>
                                <div className="text-xs text-[var(--text-tertiary)]">{t('agent_wizard.files.strict_help')}</div>
                            </div>
                        </label>
                        <label className="flex items-start gap-3 px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] cursor-pointer">
                            <input type="checkbox" checked={!!includeSourceReferences} onChange={(e) => onIncludeSourceReferencesChange?.(e.target.checked)} className="mt-1" />
                            <div>
                                <div className="text-sm text-[var(--text-primary)]">{t('agent_wizard.knowledge.sources_label')}</div>
                                <div className="text-xs text-[var(--text-tertiary)]">{t('agent_wizard.knowledge.sources_help')}</div>
                            </div>
                        </label>
                    </div>

                    {Array.isArray(allKbs) && (
                        <div>
                            <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-2">
                                {t('agent_wizard.knowledge.kbs') || 'Knowledge bases'} ({allKbs.length})
                            </div>
                            <KbList
                                t={t}
                                kbs={allKbs}
                                linkedIds={knowledgeBaseIds}
                                onToggle={onToggleKbLink}
                                onCreate={onCreateKb}
                            />
                        </div>
                    )}

                    <label
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                        className={`block rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition ${dragOver ? 'border-[var(--accent)] bg-[var(--bg-secondary)]' : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                    >
                        <Upload className="mx-auto mb-2 text-[var(--text-tertiary)]" size={24} />
                        <div className="text-sm text-[var(--text-primary)]">{t('agent_wizard.files.drop_here')}</div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-1">{t('agent_wizard.files.click_or_drag')}</div>
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => { uploadFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
                        />
                    </label>

                    {uploading && <div className="text-xs text-[var(--text-secondary)]">{t('agent_wizard.files.uploading')}</div>}
                    {error && <div className="text-xs text-red-500">{error}</div>}

                    <div>
                        <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-2">
                            {t('agent_wizard.files.documents')} {!loading && `(${docs.length})`}
                        </div>
                        {loading && <div className="text-xs text-[var(--text-tertiary)]">…</div>}
                        {!loading && docs.length === 0 && (
                            <div className="text-xs text-[var(--text-tertiary)] py-3 text-center">{t('agent_wizard.files.no_documents')}</div>
                        )}
                        <div className="divide-y divide-[var(--border-default)]">
                            {docs.map((d) => (
                                <div key={d.id} className="flex items-center gap-3 py-2 text-sm text-[var(--text-primary)]">
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">{d.title || d.source_url || d.id}</div>
                                        <div className="text-[11px] text-[var(--text-tertiary)]">
                                            {d.chunk_count != null ? `${d.chunk_count} chunks` : ''}
                                        </div>
                                    </div>
                                    <button onClick={() => deleteDoc(d.id)} className="text-[var(--text-tertiary)] hover:text-red-500"><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
