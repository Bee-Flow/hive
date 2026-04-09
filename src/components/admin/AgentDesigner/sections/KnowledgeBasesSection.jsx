import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import GoogleDrivePicker from '../../../chat/GoogleDrivePicker';

/**
 * Standalone Knowledge Bases management section for the Agent Designer.
 * Full CRUD + document management + ingestion — independent of any agent context.
 */
const KnowledgeBasesSection = ({ isReadonly }) => {
    // ── KB list state ────────────────────────────────────────────────
    const [kbs, setKbs] = useState([]);
    const [loadingKbs, setLoadingKbs] = useState(true);
    const [selectedKB, setSelectedKB] = useState(null);

    // ── Create/Edit KB ───────────────────────────────────────────────
    const [showCreateKB, setShowCreateKB] = useState(false);
    const [newKBName, setNewKBName] = useState('');
    const [newKBDesc, setNewKBDesc] = useState('');
    const [creatingKB, setCreatingKB] = useState(false);
    const [editingKB, setEditingKB] = useState(null); // KB id being edited
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    // ── Documents state ──────────────────────────────────────────────
    const [kbDocs, setKbDocs] = useState([]);

    // ── Ingestion state ──────────────────────────────────────────────
    const [kbInputMode, setKbInputMode] = useState('text');
    const [kbTextContent, setKbTextContent] = useState('');
    const [kbTextTitle, setKbTextTitle] = useState('');
    const [kbUrlInput, setKbUrlInput] = useState('');
    const [kbIngesting, setKbIngesting] = useState(false);
    const [kbIngestStatus, setKbIngestStatus] = useState('');
    const [sitemapMode, setSitemapMode] = useState(false);
    const [sitemapMaxPages, setSitemapMaxPages] = useState(50);

    // ── Re-index state ───────────────────────────────────────────────
    const [reindexStatus, setReindexStatus] = useState('');
    const [reindexing, setReindexing] = useState(false);

    // ── Azure KB  ────────────────────────────────────────────────────
    const [useAzureKB, setUseAzureKB] = useState(false);

    // ── n8n ──────────────────────────────────────────────────────────
    const [n8nWorkflows, setN8nWorkflows] = useState([]);
    const [n8nIngestMode, setN8nIngestMode] = useState('data');

    // ── Google Drive ─────────────────────────────────────────────────
    const [drivePickerOpen, setDrivePickerOpen] = useState(false);
    const [driveConnected, setDriveConnected] = useState(false);

    // ── Search/Filter ────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');

    // ── Effects ──────────────────────────────────────────────────────
    useEffect(() => { fetchKBs(); }, []);
    useEffect(() => { if (selectedKB) fetchKBDocs(selectedKB.id); }, [selectedKB?.id]);
    useEffect(() => {
        const checkDrive = async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/integrations/gdrive/status`);
                if (res.ok) { const d = await res.json(); setDriveConnected(d.connected); }
            } catch { }
        };
        checkDrive();
    }, []);
    useEffect(() => {
        const fetchAzure = async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config`);
                if (res.ok) { const d = await res.json(); setUseAzureKB(!!d.useAzureDocProcessing); }
            } catch { }
        };
        fetchAzure();
    }, []);
    useEffect(() => {
        if (kbInputMode === 'n8n') {
            (async () => {
                try {
                    const res = await authFetch(`${API_BASE}/api/kb/n8n/ingestible`);
                    if (res.ok) setN8nWorkflows(await res.json());
                } catch (e) { console.error('Failed to fetch n8n ingestible:', e); }
            })();
        }
    }, [kbInputMode]);

    // ── API calls ────────────────────────────────────────────────────
    const fetchKBs = async () => {
        setLoadingKbs(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb`);
            if (res.ok) setKbs(await res.json());
        } catch (e) { console.error('Failed to fetch KBs:', e); }
        finally { setLoadingKbs(false); }
    };

    const createKB = async () => {
        if (!newKBName.trim()) return;
        setCreatingKB(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKBName, description: newKBDesc })
            });
            if (res.ok) {
                const kb = await res.json();
                setNewKBName(''); setNewKBDesc(''); setShowCreateKB(false);
                fetchKBs();
                setSelectedKB(kb);
            }
        } catch (e) { console.error('Failed to create KB:', e); }
        finally { setCreatingKB(false); }
    };

    const updateKB = async () => {
        if (!editingKB || !editName.trim()) return;
        setSavingEdit(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${editingKB}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, description: editDesc })
            });
            if (res.ok) {
                setEditingKB(null);
                fetchKBs();
                // Update selected KB if it's the one being edited
                if (selectedKB?.id === editingKB) {
                    setSelectedKB(prev => ({ ...prev, name: editName, description: editDesc }));
                }
            }
        } catch (e) { console.error('Failed to update KB:', e); }
        finally { setSavingEdit(false); }
    };

    const deleteKB = async (kbId) => {
        if (!confirm('Delete this knowledge base and all its documents? This action cannot be undone.')) return;
        try {
            await authFetch(`${API_BASE}/api/kb/${kbId}`, { method: 'DELETE' });
            if (selectedKB?.id === kbId) { setSelectedKB(null); setKbDocs([]); }
            fetchKBs();
        } catch (e) { console.error('Failed to delete KB:', e); }
    };

    const fetchKBDocs = async (kbId) => {
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/documents`);
            if (res.ok) setKbDocs(await res.json());
        } catch (e) { console.error('Failed to fetch docs:', e); }
    };

    const deleteDoc = async (docId) => {
        if (!selectedKB || !confirm('Delete this document and all its chunks?')) return;
        try {
            await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/documents/${docId}`, { method: 'DELETE' });
            fetchKBDocs(selectedKB.id);
            fetchKBs();
        } catch (e) { console.error('Failed to delete doc:', e); }
    };

    // ── Ingestion ────────────────────────────────────────────────────
    const ingestText = async () => {
        if (!selectedKB || !kbTextContent.trim()) return;
        setKbIngesting(true); setKbIngestStatus('Processing...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/ingest/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: kbTextContent, title: kbTextTitle || 'Text' })
            });
            if (res.ok) {
                setKbTextContent(''); setKbTextTitle(''); setKbIngestStatus('');
                fetchKBDocs(selectedKB.id); fetchKBs();
            } else {
                const err = await res.json();
                setKbIngestStatus(''); alert('Error: ' + err.error);
            }
        } catch (e) { setKbIngestStatus(''); alert('Failed: ' + e.message); }
        finally { setKbIngesting(false); }
    };

    const ingestUrl = async () => {
        if (!selectedKB || !kbUrlInput.trim()) return;
        setKbIngesting(true); setKbIngestStatus('Fetching URL...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/ingest/url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: kbUrlInput.trim() })
            });
            if (res.ok) {
                setKbUrlInput(''); setKbIngestStatus('');
                fetchKBDocs(selectedKB.id); fetchKBs();
            } else {
                const err = await res.json();
                setKbIngestStatus(''); alert('Error: ' + err.error);
            }
        } catch (e) { setKbIngestStatus(''); alert('Failed: ' + e.message); }
        finally { setKbIngesting(false); }
    };

    const ingestSitemap = async () => {
        if (!selectedKB || !kbUrlInput.trim()) return;
        setKbIngesting(true); setKbIngestStatus('Fetching sitemap...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/ingest/sitemap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: kbUrlInput.trim(), maxPages: sitemapMaxPages })
            });
            if (res.ok) {
                const data = await res.json();
                setKbUrlInput('');
                setKbIngestStatus(`Done: ${data.ingested} ingested, ${data.skipped} skipped, ${data.errors} errors`);
                fetchKBDocs(selectedKB.id); fetchKBs();
                setTimeout(() => setKbIngestStatus(''), 5000);
            } else {
                const err = await res.json();
                setKbIngestStatus(''); alert('Sitemap error: ' + err.error);
            }
        } catch (e) { setKbIngestStatus(''); alert('Sitemap failed: ' + e.message); }
        finally { setKbIngesting(false); }
    };

    const ingestFile = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedKB) return;
        setKbIngesting(true); setKbIngestStatus('Uploading...');
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/ingest/file`, {
                method: 'POST', body: formData
            });
            if (res.ok) {
                setKbIngestStatus('');
                fetchKBDocs(selectedKB.id); fetchKBs();
            } else {
                const err = await res.json();
                setKbIngestStatus(''); alert('Error: ' + err.error);
            }
        } catch (e2) { setKbIngestStatus(''); alert('Failed: ' + e2.message); }
        finally { setKbIngesting(false); e.target.value = ''; }
    };

    const ingestDriveFiles = async (driveFiles) => {
        if (!selectedKB || !driveFiles?.length) return;
        setKbIngesting(true);
        let ingested = 0;
        try {
            for (const file of driveFiles) {
                setKbIngestStatus(`Ingesting ${file.name}... (${ingested + 1}/${driveFiles.length})`);
                const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/ingest/text`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: file.content, title: file.name })
                });
                if (res.ok) ingested++;
            }
            setKbIngestStatus('');
            fetchKBDocs(selectedKB.id); fetchKBs();
        } catch (e) { setKbIngestStatus(''); alert('Failed: ' + e.message); }
        finally { setKbIngesting(false); }
    };

    const ingestN8n = async (workflowId) => {
        if (!selectedKB || !workflowId) return;
        setKbIngesting(true); setKbIngestStatus('Ingesting workflow...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/ingest/n8n`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflowId, mode: n8nIngestMode })
            });
            if (res.ok) {
                const data = await res.json();
                setKbIngestStatus(`Done: ${data.chunks} chunks`);
                fetchKBDocs(selectedKB.id); fetchKBs();
                setTimeout(() => setKbIngestStatus(''), 5000);
            } else {
                const err = await res.json();
                setKbIngestStatus(''); alert('Error: ' + err.error);
            }
        } catch (e) { setKbIngestStatus(''); alert('Failed: ' + e.message); }
        finally { setKbIngesting(false); }
    };

    const reindexKB = async () => {
        if (!selectedKB) return;
        if (!confirm(`Re-index "${selectedKB.name}"?\n\nThis will re-fetch all URL sources and re-embed all documents with the current model. This may take a while.`)) return;
        setReindexing(true); setReindexStatus('Starting re-index...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/reindex`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const data = await res.json();
                setReindexStatus(`Done: ${data.reindexed}/${data.total} re-indexed${data.failed ? `, ${data.failed} failed` : ''}`);
                fetchKBDocs(selectedKB.id); fetchKBs();
                setTimeout(() => setReindexStatus(''), 8000);
            } else {
                const err = await res.json();
                setReindexStatus(''); alert('Re-index failed: ' + err.error);
            }
        } catch (e) { setReindexStatus(''); alert('Re-index failed: ' + e.message); }
        finally { setReindexing(false); }
    };

    // ── Filtered KBs ─────────────────────────────────────────────────
    const filteredKBs = searchQuery.trim()
        ? kbs.filter(kb => kb.name.toLowerCase().includes(searchQuery.toLowerCase()) || (kb.description || '').toLowerCase().includes(searchQuery.toLowerCase()))
        : kbs;

    // ── Source icon helper ────────────────────────────────────────────
    const docIcon = (type) => {
        switch (type) {
            case 'web': return '🌐';
            case 'upload': return '📄';
            case 'n8n': return '⚙️';
            default: return '📝';
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn" data-testid="kb-manager">
            {/* Google Drive Picker Modal */}
            <GoogleDrivePicker
                isOpen={drivePickerOpen}
                onClose={() => setDrivePickerOpen(false)}
                onFilesSelected={ingestDriveFiles}
                apiBase={API_BASE}
            />

            {/* Header */}
            <div>
                <h2 className="text-base font-semibold text-primary">Knowledge Bases</h2>
                <p className="text-xs text-muted mt-0.5">
                    Create and manage knowledge bases for your AI agents. Link them to agents in the Knowledge tab.
                </p>
            </div>

            {/* Search + Create */}
            <div className="max-w-3xl">
                <div className="flex items-center gap-3 mb-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search knowledge bases..."
                            className="w-full pl-9 pr-3 py-2 rounded-lg border text-xs"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        />
                    </div>

                    {/* Create button */}
                    {!isReadonly && (
                        <button onClick={() => setShowCreateKB(!showCreateKB)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white flex-shrink-0 transition-all hover:opacity-90"
                            style={{ background: 'var(--accent-primary)' }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Knowledge Base
                        </button>
                    )}
                </div>

                {/* Create KB Form */}
                {showCreateKB && !isReadonly && (
                    <div className="p-4 rounded-xl border bg-[var(--bg-tertiary)] border-[var(--border-default)] space-y-3 mb-4 animate-fadeIn">
                        <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Create Knowledge Base</h4>
                        <input value={newKBName} onChange={e => setNewKBName(e.target.value)}
                            placeholder="Knowledge base name (e.g. Product Documentation)" autoFocus
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                        <input value={newKBDesc} onChange={e => setNewKBDesc(e.target.value)}
                            placeholder="Description (optional)"
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => { setShowCreateKB(false); setNewKBName(''); setNewKBDesc(''); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
                            <button onClick={createKB} disabled={creatingKB || !newKBName.trim()}
                                className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-all hover:opacity-90"
                                style={{ background: 'var(--accent-primary)' }}>
                                {creatingKB ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                )}

                {/* KB List */}
                {loadingKbs ? (
                    <div className="text-center py-12 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <div className="spinner-sm mx-auto mb-2"></div>
                        Loading knowledge bases...
                    </div>
                ) : filteredKBs.length === 0 ? (
                    <div className="text-center py-12 text-xs rounded-xl border-2 border-dashed"
                        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                        <span className="text-3xl block mb-3">📚</span>
                        {searchQuery ? 'No knowledge bases match your search.' : `No knowledge bases yet. Create one to get started with ${useAzureKB ? 'Azure OpenAI' : 'bge-m3'} embeddings + hybrid search.`}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredKBs.map(kb => {
                            const isSelected = selectedKB?.id === kb.id;
                            const isEditing = editingKB === kb.id;
                            return (
                                <div key={kb.id}
                                    className={`rounded-xl border group transition-all ${isSelected ? 'ring-2 ring-[var(--accent-primary)] border-transparent' : 'hover:border-[var(--border-hover)]'}`}
                                    style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                                    {/* KB Header Row */}
                                    <div className="p-3 cursor-pointer" onClick={() => setSelectedKB(isSelected ? null : kb)}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                                                    style={{ background: isSelected ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)' }}>
                                                    📚
                                                </div>
                                                <div className="min-w-0">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                            <input value={editName} onChange={e => setEditName(e.target.value)}
                                                                className="px-2 py-1 rounded border text-sm font-medium"
                                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                                autoFocus />
                                                            <button onClick={updateKB} disabled={savingEdit || !editName.trim()}
                                                                className="px-2 py-1 rounded text-[10px] font-medium text-white disabled:opacity-50"
                                                                style={{ background: 'var(--accent-primary)' }}>
                                                                {savingEdit ? '...' : 'Save'}
                                                            </button>
                                                            <button onClick={() => setEditingKB(null)}
                                                                className="px-2 py-1 rounded text-[10px] font-medium"
                                                                style={{ color: 'var(--text-muted)' }}>Cancel</button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                                            {kb.name}
                                                            {kb.organization_id ? (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-400" title="Shared with organization">🏢 Org</span>
                                                            ) : (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-white/5 text-[var(--text-muted)]" title="Personal KB">👤</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] flex items-center gap-2 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                        {kb.document_count || 0} docs · {kb.total_chunks || 0} chunks
                                                        {kb.description && <span>· {kb.description}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            {!isReadonly && !isEditing && (
                                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                    {/* Edit button */}
                                                    <button onClick={() => { setEditingKB(kb.id); setEditName(kb.name); setEditDesc(kb.description || ''); }}
                                                        className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 transition-all" title="Edit KB">
                                                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    {/* Delete button */}
                                                    <button onClick={() => deleteKB(kb.id)}
                                                        className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all" title="Delete KB">
                                                        <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded KB Detail — Ingest + Documents */}
                                    {isSelected && (
                                        <div className="px-3 pb-3 space-y-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                            {/* KB Description Edit (inline) */}
                                            {editingKB === kb.id && (
                                                <div className="pt-3" onClick={e => e.stopPropagation()}>
                                                    <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                                                        placeholder="Description (optional)"
                                                        className="w-full px-3 py-2 rounded-lg border text-xs"
                                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                                </div>
                                            )}

                                            {/* Toolbar: Re-index */}
                                            <div className="flex items-center justify-between pt-3">
                                                <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    Manage Documents
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    {reindexStatus && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium flex items-center gap-1">
                                                            {reindexing && (
                                                                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="44" strokeDashoffset="8" />
                                                                </svg>
                                                            )}
                                                            {reindexStatus}
                                                        </span>
                                                    )}
                                                    {!isReadonly && (
                                                        <button onClick={reindexKB} disabled={reindexing || kbDocs.length === 0}
                                                            className="text-[10px] px-2.5 py-1 rounded-full font-medium transition-all hover:bg-amber-500/15 disabled:opacity-40"
                                                            style={{ background: 'rgba(245,158,11,0.08)', color: 'rgb(245,158,11)' }}
                                                            title="Re-fetch URLs and re-embed all documents with current model">
                                                            {reindexing ? '⏳ Re-indexing...' : '🔄 Re-index All'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Ingest Section */}
                                            {!isReadonly && (
                                                <div className="space-y-3">
                                                    <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] w-fit">
                                                        {[{ id: 'text', label: '📝 Text' }, { id: 'url', label: '🌐 URL' }, { id: 'n8n', label: '⚙️ n8n' }].map(tab => (
                                                            <button key={tab.id} onClick={() => setKbInputMode(tab.id)}
                                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${kbInputMode === tab.id
                                                                    ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}>
                                                                {tab.label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {kbInputMode === 'text' && (
                                                        <div className="space-y-2">
                                                            <input value={kbTextTitle} onChange={e => setKbTextTitle(e.target.value)}
                                                                placeholder="Title (optional)" className="w-full px-3 py-2 rounded-lg border text-xs"
                                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                                            <textarea value={kbTextContent} onChange={e => setKbTextContent(e.target.value)}
                                                                placeholder="Paste text content here..." rows={3}
                                                                className="w-full px-3 py-2 rounded-lg border text-xs"
                                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                                        </div>
                                                    )}

                                                    {kbInputMode === 'url' && (
                                                        <div className="space-y-2">
                                                            <input type="url" value={kbUrlInput} onChange={e => setKbUrlInput(e.target.value)}
                                                                placeholder={sitemapMode ? 'https://example.com' : 'https://example.com/page'}
                                                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                                onKeyDown={e => { if (e.key === 'Enter' && !kbIngesting) { sitemapMode ? ingestSitemap() : ingestUrl(); } }} />
                                                            <div className="flex items-center gap-3">
                                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                                    <input type="checkbox" checked={sitemapMode} onChange={e => setSitemapMode(e.target.checked)} className="rounded border-gray-500" />
                                                                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>🗺️ Import from sitemap</span>
                                                                </label>
                                                                {sitemapMode && (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Max pages:</span>
                                                                        <input type="number" value={sitemapMaxPages}
                                                                            onChange={e => setSitemapMaxPages(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
                                                                            className="w-14 px-1.5 py-0.5 rounded border text-xs text-center"
                                                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                                            min={1} max={200} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {kbInputMode === 'n8n' && (
                                                        <div className="space-y-3">
                                                            <div className="flex bg-[var(--bg-secondary)] p-1 rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                <button onClick={() => setN8nIngestMode('data')}
                                                                    className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-md transition-all ${n8nIngestMode === 'data' ? 'bg-[var(--bg-primary)] shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                                                                    style={{ color: n8nIngestMode === 'data' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                                    Execute & Ingest Output Data
                                                                </button>
                                                                <button onClick={() => setN8nIngestMode('definition')}
                                                                    className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-md transition-all ${n8nIngestMode === 'definition' ? 'bg-[var(--bg-primary)] shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                                                                    style={{ color: n8nIngestMode === 'definition' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                                    Import Workflow Definition
                                                                </button>
                                                            </div>
                                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                                {n8nWorkflows.length === 0 ? (
                                                                    <div className="text-xs p-3 text-center rounded border border-dashed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                                                                        No n8n workflows enabled for KB ingestion. Enable them in your Organisation settings.
                                                                    </div>
                                                                ) : (
                                                                    n8nWorkflows.map(wf => (
                                                                        <div key={wf.id} className="flex items-center justify-between p-2 rounded border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                                                            <div className="min-w-0 pr-2">
                                                                                <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{wf.name}</div>
                                                                                <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>n8n_run_{wf.slug}</div>
                                                                            </div>
                                                                            <button disabled={kbIngesting} onClick={() => ingestN8n(wf.id)}
                                                                                className="px-2 py-1 text-[10px] font-medium rounded text-white disabled:opacity-50 transition-opacity hover:opacity-80 flex-shrink-0"
                                                                                style={{ background: 'var(--accent-primary)' }}>
                                                                                {n8nIngestMode === 'data' ? 'Execute' : 'Ingest'}
                                                                            </button>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Action buttons */}
                                                    <div className="flex gap-2 justify-end items-center">
                                                        {kbIngestStatus && (
                                                            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                                                                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="44" strokeDashoffset="8" />
                                                                </svg>
                                                                {kbIngestStatus}
                                                            </span>
                                                        )}
                                                        {kbInputMode !== 'n8n' && (
                                                            <>
                                                                <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 hover:bg-[var(--bg-tertiary)] transition-colors"
                                                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                                                    <input type="file" accept=".pdf,.txt,.md,.docx,.csv" className="hidden" onChange={ingestFile} disabled={kbIngesting} />
                                                                    📎 File
                                                                </label>
                                                                {driveConnected && (
                                                                    <button onClick={() => setDrivePickerOpen(true)} disabled={kbIngesting}
                                                                        className="px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
                                                                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                                                        <svg className="w-3.5 h-3.5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                                                                            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
                                                                            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
                                                                            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.8z" fill="#ea4335" />
                                                                            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
                                                                            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
                                                                            <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
                                                                        </svg>
                                                                        Drive
                                                                    </button>
                                                                )}
                                                                <button onClick={kbInputMode === 'url' ? (sitemapMode ? ingestSitemap : ingestUrl) : ingestText}
                                                                    disabled={kbIngesting || (kbInputMode === 'text' ? !kbTextContent.trim() : !kbUrlInput.trim())}
                                                                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-all hover:opacity-90"
                                                                    style={{ background: 'var(--accent-primary)' }}>
                                                                    {kbIngesting ? 'Processing...' : 'Ingest'}
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Documents List */}
                                            <div>
                                                <h5 className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                                                    Documents ({kbDocs.length})
                                                </h5>
                                                {kbDocs.length === 0 ? (
                                                    <div className="text-center py-6 text-xs rounded-lg border border-dashed"
                                                        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                                        No documents yet. {!isReadonly && 'Ingest text, files, or URLs above.'}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                                        {kbDocs.map(doc => (
                                                            <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg group"
                                                                style={{ background: 'var(--bg-secondary)' }}>
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className="text-sm flex-shrink-0">{docIcon(doc.source_type)}</span>
                                                                    <div className="min-w-0">
                                                                        <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title || 'Untitled'}</div>
                                                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                                            {doc.chunk_count || 0} chunks · {new Date(doc.created_at).toLocaleDateString()}
                                                                            {doc.source_uri && doc.source_type === 'web' && (
                                                                                <> · <a href={doc.source_uri} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-400">{new URL(doc.source_uri).hostname}</a></>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {!isReadonly && (
                                                                    <button onClick={() => deleteDoc(doc.id)}
                                                                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 flex-shrink-0 transition-all">
                                                                        <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export { KnowledgeBasesSection };
export default KnowledgeBasesSection;
