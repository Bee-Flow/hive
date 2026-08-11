import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import GoogleDrivePicker from './chat/GoogleDrivePicker';
import EmailThreadExplorer from './EmailThreadExplorer';
import CreateKBModal from './knowledge/CreateKBModal';
import KBIngestPanel from './knowledge/KBIngestPanel';
import useKnowledgeBases from '../hooks/useKnowledgeBases';

const KnowledgePanel = ({ agentId, API_BASE, strictKnowledge = false, onStrictKnowledgeChange, includeSourceReferences = false, onIncludeSourceReferencesChange, knowledgeBaseIds = [], onKnowledgeBaseIdsChange }) => {
    // ── Legacy flat knowledge ───────────────────────────────────────
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newItemContent, setNewItemContent] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [adding, setAdding] = useState(false);
    const [inputMode, setInputMode] = useState('text');
    const [extractionMode, setExtractionMode] = useState('exact');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [deleting, setDeleting] = useState(false);
    const [urlStatus, setUrlStatus] = useState('');

    // ── Multi-KB (shared hook) ──────────────────────────────────────
    // Agent-picker context: list only KBs usable by agents, and keep the
    // agent's knowledgeBaseIds in sync when a KB is created/deleted here.
    const kb = useKnowledgeBases({
        listContext: 'agent',
        paginateDocs: true,
        enableDrive: true,
        enableAzureInfo: true,
        onKBCreated: (created) => { if (onKnowledgeBaseIdsChange) onKnowledgeBaseIdsChange([...knowledgeBaseIds, created.id]); },
        onKBDeleted: (kbId) => { if (onKnowledgeBaseIdsChange) onKnowledgeBaseIdsChange(knowledgeBaseIds.filter(id => id !== kbId)); },
    });
    const selectedKB = kb.selectedKB;

    useEffect(() => { fetchKnowledge(); }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { setSelectedIds(new Set()); }, [items]);

    // ── Legacy knowledge functions ──────────────────────────────────
    const fetchKnowledge = async () => {
        if (!agentId) return;
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/agents/${agentId}/knowledge`);
            if (res.ok) setItems(await res.json());
        } catch (err) { console.error('Failed to fetch knowledge:', err); }
        finally { setLoading(false); }
    };

    const handleAdd = async () => {
        if (!newItemContent.trim()) return;
        setAdding(true);
        try {
            const res = await authFetch(`${API_BASE}/agents/${agentId}/knowledge`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newItemContent })
            });
            if (res.ok) { setNewItemContent(''); fetchKnowledge(); }
            else { const err = await res.json(); alert('Error: ' + err.error); }
        } catch (err) { alert('Failed to connect'); }
        finally { setAdding(false); }
    };

    const handleUrlImport = async () => {
        if (!urlInput.trim()) return;
        try { new URL(urlInput.trim()); } catch { alert('Invalid URL'); return; }
        setAdding(true); setUrlStatus('Fetching...');
        try {
            const res = await authFetch(`${API_BASE}/agents/${agentId}/knowledge/url`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlInput.trim(), mode: extractionMode })
            });
            if (res.ok) { setUrlInput(''); setUrlStatus(''); fetchKnowledge(); }
            else { const err = await res.json(); setUrlStatus(''); alert('Error: ' + err.error); }
        } catch (err) { setUrlStatus(''); alert('Failed'); }
        finally { setAdding(false); }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setAdding(true);
        const formData = new FormData();
        formData.append('file', file); formData.append('mode', extractionMode);
        try {
            const res = await authFetch(`${API_BASE}/agents/${agentId}/knowledge/upload`, {
                method: 'POST', body: formData
            });
            if (res.ok) { const d = await res.json(); alert(d.message); fetchKnowledge(); }
            else { const err = await res.json(); alert('Error: ' + err.error); }
        } catch (err) { alert('Failed'); }
        finally { setAdding(false); e.target.value = ''; }
    };

    const handleDelete = async (itemId) => {
        if (!confirm('Delete this knowledge item?')) return;
        try {
            await authFetch(`${API_BASE}/agents/${agentId}/knowledge/${itemId}`, { method: 'DELETE' });
            fetchKnowledge();
        } catch (err) { console.error('Delete failed:', err); }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0 || !confirm(`Delete ${selectedIds.size} items?`)) return;
        setDeleting(true);
        try {
            await Promise.all(Array.from(selectedIds).map(id =>
                authFetch(`${API_BASE}/agents/${agentId}/knowledge/${id}`, { method: 'DELETE' })
            ));
            setSelectedIds(new Set()); fetchKnowledge();
        } catch (err) { alert('Failed to delete some items'); }
        finally { setDeleting(false); }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };
    const toggleSelectAll = () => {
        selectedIds.size === items.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(items.map(i => i.id)));
    };
    const isAllSelected = items.length > 0 && selectedIds.size === items.length;
    const getItemMeta = (item) => {
        try {
            if (typeof item.metadata === 'string') return JSON.parse(item.metadata);
            if (typeof item.metadata === 'object') return item.metadata;
        } catch { }
        return {};
    };

    // ── KB link toggle (agent-specific link state) ──────────────────
    const toggleKBLink = (kbId) => {
        if (!onKnowledgeBaseIdsChange) return;
        const current = new Set(knowledgeBaseIds);
        if (current.has(kbId)) current.delete(kbId);
        else current.add(kbId);
        onKnowledgeBaseIdsChange([...current]);
    };

    return (
        <div className="flex flex-col h-full space-y-4" data-testid="knowledge-panel" data-tour="agent-knowledge">
            {/* Google Drive Picker Modal */}
            <GoogleDrivePicker
                isOpen={kb.drivePickerOpen}
                onClose={() => kb.setDrivePickerOpen(false)}
                onFilesSelected={kb.ingestDriveFiles}
                apiBase={API_BASE}
            />
            <div className="max-w-3xl space-y-4">
                {/* Toggles */}
                {onStrictKnowledgeChange && (
                    <div className="flex items-center justify-between p-4 rounded-xl border bg-[var(--bg-tertiary)] border-[var(--border-default)]">
                        <div className="flex items-center gap-3">
                            <span className="text-lg">🔒</span>
                            <div>
                                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Strict Knowledge Mode</div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Only answer from the knowledge base.</div>
                            </div>
                        </div>
                        <button onClick={() => onStrictKnowledgeChange(!strictKnowledge)}
                            className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${strictKnowledge ? 'bg-amber-500' : 'bg-gray-600'}`}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${strictKnowledge ? 'left-5' : 'left-1'}`} />
                        </button>
                    </div>
                )}
                {onIncludeSourceReferencesChange && (
                    <div className="flex items-center justify-between p-4 rounded-xl border bg-[var(--bg-tertiary)] border-[var(--border-default)]">
                        <div className="flex items-center gap-3">
                            <span className="text-lg">🔗</span>
                            <div>
                                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Include Source References</div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Cite source URLs when answering from knowledge.</div>
                            </div>
                        </div>
                        <button onClick={() => onIncludeSourceReferencesChange(!includeSourceReferences)}
                            className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${includeSourceReferences ? 'bg-blue-500' : 'bg-gray-600'}`}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${includeSourceReferences ? 'left-5' : 'left-1'}`} />
                        </button>
                    </div>
                )}

                {/* ════════════════ Knowledge Bases ════════════════ */}
                {(
                    <div className="space-y-4">
                        {/* KB List */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                Knowledge Bases ({kb.kbs.length})
                            </h3>
                            <button onClick={kb.openCreateKB}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                                style={{ background: 'var(--accent-primary)' }}
                                data-testid="kb-create-btn">
                                + Create KB
                            </button>
                        </div>

                        {/* Create KB Form */}
                        {kb.showCreateKB && (
                            <CreateKBModal
                                name={kb.newKBName} onNameChange={kb.setNewKBName}
                                description={kb.newKBDesc} onDescChange={kb.setNewKBDesc}
                                creating={kb.creatingKB} onCreate={kb.createKB} onCancel={kb.cancelCreateKB}
                                namePlaceholder="KB Name (e.g. Product Docs)"
                            />
                        )}

                        {kb.loadingKbs ? (
                            <div className="text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</div>
                        ) : kb.kbs.length === 0 ? (
                            <div className="text-center py-8 text-xs rounded-xl border border-dashed"
                                style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                No knowledge bases yet. Create one to get started with {kb.useAzureKB ? 'Azure OpenAI' : 'bge-m3'} embeddings + hybrid search.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {kb.kbs.map(item => {
                                    const isLinked = knowledgeBaseIds.includes(item.id);
                                    const isSelected = selectedKB?.id === item.id;
                                    return (
                                        <div key={item.id}
                                            className={`p-3 rounded-lg border group cursor-pointer transition-all ${isSelected ? 'ring-2 ring-[var(--accent-primary)] border-transparent' : 'hover:border-[var(--border-hover)]'}`}
                                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}
                                            onClick={() => kb.setSelectedKB(isSelected ? null : item)}
                                            data-testid={`kb-item-${item.id}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                                                        style={{ background: isLinked ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)' }}>
                                                        📚
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                                            {item.name}
                                                            {item.organization_id ? (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-400" title="Shared with organization">🏢 Org</span>
                                                            ) : (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-white/5 text-[var(--text-muted)]" title="Personal KB">👤</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                                            {item.document_count || 0} docs · {item.total_chunks || 0} chunks
                                                            {item.description && <span>· {item.description}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => toggleKBLink(item.id)}
                                                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${isLinked ? 'bg-blue-500/15 text-blue-400 hover:bg-red-500/15 hover:text-red-400' : 'bg-white/5 text-[var(--text-muted)] hover:bg-blue-500/15 hover:text-blue-400'}`}>
                                                        {isLinked ? '✓ Linked' : '+ Link'}
                                                    </button>
                                                    <button onClick={() => kb.deleteKB(item.id)}
                                                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10" title="Delete KB"
                                                        data-testid={`kb-delete-${item.id}`}>
                                                        <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Selected KB Detail — Ingest + Documents */}
                        {selectedKB && (
                            <div className="p-4 rounded-xl border bg-[var(--bg-secondary)] border-[var(--border-default)] space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        📚 {selectedKB.name}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        {kb.reindexStatus && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium flex items-center gap-1">
                                                {kb.reindexing && (
                                                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="44" strokeDashoffset="8" />
                                                    </svg>
                                                )}
                                                {kb.reindexStatus}
                                            </span>
                                        )}
                                        <button onClick={kb.reindexKB} disabled={kb.reindexing || kb.kbDocs.length === 0}
                                            className="text-[10px] px-2 py-0.5 rounded-full font-medium transition-all hover:bg-amber-500/15 disabled:opacity-40"
                                            style={{ background: 'rgba(245,158,11,0.08)', color: 'rgb(245,158,11)' }}
                                            title="Re-fetch URLs and re-embed all documents with current model">
                                            {kb.reindexing ? '⏳ Re-indexing...' : '🔄 Re-index'}
                                        </button>

                                    </div>
                                </div>

                                {/* Ingest Section */}
                                <KBIngestPanel kb={kb} fieldBg="var(--bg-tertiary)" />

                                {/* Documents List */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                            Documents ({kb.kbDocs.length}{kb.kbDocsTotal > kb.kbDocs.length ? ` of ${kb.kbDocsTotal}` : ''})
                                        </h5>
                                        {kb.kbSelectedIds.size > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{kb.kbSelectedIds.size} selected</span>
                                                <button onClick={kb.bulkDeleteSelected} disabled={kb.kbBulkBusy}
                                                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 disabled:opacity-50">
                                                    {kb.kbBulkBusy ? 'Deleting…' : 'Delete selected'}
                                                </button>
                                                <button onClick={() => kb.setKbSelectedIds(new Set())} className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Clear</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Email-specific filter bar: shown when any doc in list is sourced from email. */}
                                    {kb.kbDocs.some(d => d.source_type === 'email') && (
                                        <div className="mb-2 p-2 rounded-lg border flex flex-wrap gap-1.5 items-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                            <input type="text" placeholder="Sender" value={kb.kbDocsFilters.sender}
                                                onChange={e => kb.setKbDocsFilters(f => ({ ...f, sender: e.target.value }))}
                                                className="px-2 py-1 rounded text-[11px] border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                            <input type="date" value={kb.kbDocsFilters.dateFrom}
                                                onChange={e => kb.setKbDocsFilters(f => ({ ...f, dateFrom: e.target.value }))}
                                                className="px-2 py-1 rounded text-[11px] border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                            <input type="date" value={kb.kbDocsFilters.dateTo}
                                                onChange={e => kb.setKbDocsFilters(f => ({ ...f, dateTo: e.target.value }))}
                                                className="px-2 py-1 rounded text-[11px] border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                            <label className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-primary)' }}>
                                                <input type="checkbox" checked={kb.kbDocsFilters.hasAttachment}
                                                    onChange={e => kb.setKbDocsFilters(f => ({ ...f, hasAttachment: e.target.checked }))} />
                                                Has attachment
                                            </label>
                                            <button onClick={() => kb.fetchKBDocs(selectedKB.id, { offset: 0 })}
                                                className="px-2 py-1 rounded text-[11px] font-medium" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
                                                Apply
                                            </button>
                                            <button onClick={() => { const cleared = { sender: '', threadId: '', hasAttachment: false, dateFrom: '', dateTo: '' }; kb.setKbDocsFilters(cleared); kb.fetchKBDocs(selectedKB.id, { offset: 0, filters: cleared }); }}
                                                className="px-2 py-1 rounded text-[11px]" style={{ color: 'var(--text-muted)' }}>Clear</button>
                                        </div>
                                    )}

                                    {kb.kbDocs.length === 0 ? (
                                        <div className="text-center py-4 text-xs rounded-lg border border-dashed"
                                            style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                            No documents yet. Ingest text, files, or URLs above.
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 mb-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                <input type="checkbox"
                                                    checked={kb.kbDocs.length > 0 && kb.kbDocs.every(d => kb.kbSelectedIds.has(d.id))}
                                                    onChange={kb.toggleSelectAllOnPage} />
                                                Select all on page
                                            </div>
                                            <div className="space-y-1.5">
                                                {kb.kbDocs.map(doc => (
                                                    <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg group"
                                                        style={{ background: 'var(--bg-tertiary)' }}
                                                        data-testid={`kb-doc-${doc.id}`}>
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <input type="checkbox" checked={kb.kbSelectedIds.has(doc.id)}
                                                                onChange={() => kb.toggleSelectDoc(doc.id)}
                                                                className="flex-shrink-0" />
                                                            <span className="text-sm flex-shrink-0">
                                                                {doc.source_type === 'web' ? '🌐'
                                                                    : doc.source_type === 'upload' ? '📄'
                                                                    : doc.source_type === 'email' ? '✉️'
                                                                    : '📝'}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title || 'Untitled'}</div>
                                                                <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                                                                    {doc.chunk_count || 0} chunks · {new Date(doc.created_at).toLocaleDateString()}
                                                                    {doc.metadata?.from ? ` · ${String(doc.metadata.from).replace(/<[^>]+>/, '').trim().slice(0, 30)}` : ''}
                                                                    {doc.metadata?.hasAttachments ? ' · 📎' : ''}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => kb.deleteDoc(doc.id)}
                                                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 flex-shrink-0"
                                                            data-testid={`kb-doc-delete-${doc.id}`}>
                                                            <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            {kb.kbDocsTotal > kb.kbDocs.length && (
                                                <div className="flex justify-center mt-2">
                                                    <button onClick={kb.loadMoreKBDocs}
                                                        className="px-3 py-1 rounded text-[11px] font-medium border"
                                                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                                                        Load more ({kb.kbDocsTotal - kb.kbDocs.length} left)
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Email thread explorer (only renders when the KB has email threads). */}
                                    {kb.kbDocs.some(d => d.source_type === 'email') && selectedKB?.id && (
                                        <EmailThreadExplorer
                                            kbId={selectedKB.id}
                                            authFetch={authFetch}
                                            onOpenDoc={(doc) => kb.setKbDocsFilters(f => ({ ...f, threadId: doc.metadata?.threadId || '' }))}
                                        />
                                    )}
                                </div>
                            </div>
                        )}


                    </div>
                )}

                {false && (/* Legacy tab removed */
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl border bg-[var(--bg-tertiary)] border-[var(--border-default)]">
                            <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Add Knowledge</h3>
                            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                                Legacy per-agent knowledge (flat). For multi-KB with hybrid search, use the Knowledge Bases tab.
                            </p>
                            <div className="flex gap-1 mb-3 p-0.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] w-fit">
                                {[{ id: 'text', label: '📝 Text' }, { id: 'url', label: '🌐 URL' }].map(tab => (
                                    <button key={tab.id} onClick={() => setInputMode(tab.id)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${inputMode === tab.id
                                            ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{tab.label}</button>
                                ))}
                            </div>
                            {inputMode === 'text' && (
                                <textarea value={newItemContent} onChange={e => setNewItemContent(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border text-sm mb-3"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    rows={3} placeholder="e.g. Project 'BlueSky' is due on Oct 15th." />
                            )}
                            {inputMode === 'url' && (
                                <div className="mb-3">
                                    <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        placeholder="https://example.com/page"
                                        onKeyDown={e => { if (e.key === 'Enter' && !adding) handleUrlImport(); }} />
                                    {urlStatus && (
                                        <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: 'var(--accent-primary)' }}>
                                            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="44" strokeDashoffset="8" />
                                            </svg>
                                            {urlStatus}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="flex gap-2 justify-end mt-2">
                                <label className="cursor-pointer px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2"
                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                    <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleFileUpload} disabled={adding} />
                                    📎 {adding && inputMode !== 'url' ? 'Uploading...' : 'Upload File'}
                                </label>
                                {inputMode === 'url' ? (
                                    <button onClick={handleUrlImport} disabled={adding || !urlInput.trim()}
                                        className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                                        style={{ background: 'var(--accent-primary)' }}>
                                        {adding ? 'Importing...' : 'Import URL'}
                                    </button>
                                ) : (
                                    <button onClick={handleAdd} disabled={adding || !newItemContent.trim()}
                                        className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                                        style={{ background: 'var(--accent-primary)' }}>
                                        {adding ? 'Adding...' : 'Add Text'}
                                    </button>
                                )}
                            </div>
                            {(
                                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                    <label className="text-xs mb-2 block font-medium" style={{ color: 'var(--text-muted)' }}>Extraction Strategy</label>
                                    <div className="flex flex-wrap gap-4">
                                        {[
                                            { id: 'exact', label: 'Exact Content', desc: 'Verbatim text extraction' },
                                            { id: 'formatted', label: 'Formatted', desc: 'Full content, clean formatting' },
                                            { id: 'detailed', label: 'Detailed Summary', desc: 'Comprehensive overview' },
                                            { id: 'compact', label: 'Compact Summary', desc: 'Key takeaways only' }
                                        ].map(mode => (
                                            <label key={mode.id} className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="extractionMode" value={mode.id}
                                                    checked={extractionMode === mode.id} onChange={e => setExtractionMode(e.target.value)}
                                                    className="w-4 h-4" />
                                                <div>
                                                    <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{mode.label}</div>
                                                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{mode.desc}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Item List */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Legacy Items ({items.length})</h3>
                                    {items.length > 0 && (
                                        <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: 'var(--text-muted)' }}>
                                            <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded" /> Select All
                                        </label>
                                    )}
                                </div>
                                {selectedIds.size > 0 && (
                                    <button onClick={handleBulkDelete} disabled={deleting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                                        style={{ background: 'var(--color-error, #ef4444)' }}>
                                        {deleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
                                    </button>
                                )}
                            </div>
                            {loading ? (
                                <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</div>
                            ) : items.length === 0 ? (
                                <div className="text-center py-8 text-xs rounded-xl border border-dashed"
                                    style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                    No legacy knowledge items.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {items.map(item => {
                                        const meta = getItemMeta(item);
                                        const isUrl = meta.type === 'url_import';
                                        const isFile = meta.type === 'file_upload';
                                        return (
                                            <div key={item.id}
                                                className={`p-3 rounded-lg border group relative transition-colors ${selectedIds.has(item.id) ? 'ring-2 ring-[var(--accent-primary)]' : 'hover:border-[var(--border-hover)]'}`}
                                                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                                                <div className="flex items-start gap-3">
                                                    <input type="checkbox" checked={selectedIds.has(item.id)}
                                                        onChange={() => toggleSelection(item.id)} className="mt-1 w-4 h-4 rounded" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm pr-8 line-clamp-2" style={{ color: 'var(--text-primary)' }}>{item.content}</div>
                                                        <div className="flex items-center gap-2 mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                            {isUrl && <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">🌐 {meta.source_domain}</span>}
                                                            {isFile && meta.source && <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">📄 {meta.source}</span>}
                                                            <span>Added: {new Date(item.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDelete(item.id)}
                                                    className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10">
                                                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KnowledgePanel;
