import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import GoogleDrivePicker from './chat/GoogleDrivePicker';
import EmailThreadExplorer from './EmailThreadExplorer';

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


    // ── Multi-KB ────────────────────────────────────────────────────
    const [kbs, setKbs] = useState([]);
    const [loadingKbs, setLoadingKbs] = useState(false);
    const [selectedKB, setSelectedKB] = useState(null);
    const [kbDocs, setKbDocs] = useState([]);
    const [kbDocsTotal, setKbDocsTotal] = useState(0);
    const [kbDocsOffset, setKbDocsOffset] = useState(0);
    const [kbDocsPageSize] = useState(50);
    const [kbSelectedIds, setKbSelectedIds] = useState(new Set());
    const [kbDocsFilters, setKbDocsFilters] = useState({ sender: '', threadId: '', hasAttachment: false, dateFrom: '', dateTo: '' });
    const [kbBulkBusy, setKbBulkBusy] = useState(false);
    const [showCreateKB, setShowCreateKB] = useState(false);
    const [newKBName, setNewKBName] = useState('');
    const [newKBDesc, setNewKBDesc] = useState('');
    const [creatingKB, setCreatingKB] = useState(false);
    const [kbInputMode, setKbInputMode] = useState('text');
    const [kbTextContent, setKbTextContent] = useState('');
    const [kbTextTitle, setKbTextTitle] = useState('');
    const [kbUrlInput, setKbUrlInput] = useState('');
    const [kbIngesting, setKbIngesting] = useState(false);
    const [kbIngestStatus, setKbIngestStatus] = useState('');
    const [activeTab, setActiveTab] = useState('kbs'); // 'kbs' | 'legacy'
    const [drivePickerOpen, setDrivePickerOpen] = useState(false);
    const [driveConnected, setDriveConnected] = useState(false);
    const [sitemapMode, setSitemapMode] = useState(false);
    const [sitemapMaxPages, setSitemapMaxPages] = useState(50);
    const [reindexStatus, setReindexStatus] = useState('');
    const [reindexing, setReindexing] = useState(false);
    const [useAzureKB, setUseAzureKB] = useState(false);
    const [n8nWorkflows, setN8nWorkflows] = useState([]);
    const [n8nIngestMode, setN8nIngestMode] = useState('data'); // 'data' | 'definition'

    useEffect(() => { fetchKnowledge(); }, [agentId]);
    useEffect(() => { setSelectedIds(new Set()); }, [items]);
    useEffect(() => { fetchKBs(); }, []);
    useEffect(() => { if (selectedKB) fetchKBDocs(selectedKB.id); }, [selectedKB?.id]);

    // Check Google Drive connection status
    useEffect(() => {
        const checkDrive = async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/integrations/gdrive/status`);
                if (res.ok) {
                    const data = await res.json();
                    setDriveConnected(data.connected);
                }
            } catch { }
        };
        checkDrive();
    }, []);

    useEffect(() => {
        if (kbInputMode === 'n8n') {
            const fetchWfs = async () => {
                try {
                    const res = await authFetch(`${API_BASE}/api/kb/n8n/ingestible`);
                    if (res.ok) setN8nWorkflows(await res.json());
                } catch (e) { console.error('Failed to fetch n8n ingestible:', e); }
            };
            fetchWfs();
        }
    }, [kbInputMode]);

    // Fetch Azure KB processing config
    useEffect(() => {
        const fetchAzureConfig = async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config`);
                if (res.ok) {
                    const data = await res.json();
                    setUseAzureKB(!!data.useAzureDocProcessing);
                }
            } catch { }
        };
        fetchAzureConfig();
    }, []);



    // ── KB API calls ────────────────────────────────────────────────
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
                // Auto-link to agent
                if (onKnowledgeBaseIdsChange) {
                    onKnowledgeBaseIdsChange([...knowledgeBaseIds, kb.id]);
                }
            }
        } catch (e) { console.error('Failed to create KB:', e); }
        finally { setCreatingKB(false); }
    };

    const deleteKB = async (kbId) => {
        if (!confirm('Delete this knowledge base and all its documents?')) return;
        try {
            await authFetch(`${API_BASE}/api/kb/${kbId}`, { method: 'DELETE' });
            if (selectedKB?.id === kbId) setSelectedKB(null);
            fetchKBs();
            if (onKnowledgeBaseIdsChange) {
                onKnowledgeBaseIdsChange(knowledgeBaseIds.filter(id => id !== kbId));
            }
        } catch (e) { console.error('Failed to delete KB:', e); }
    };

    const fetchKBDocs = async (kbId, { append = false, offset = 0, filters = kbDocsFilters } = {}) => {
        try {
            const params = new URLSearchParams();
            params.set('limit', String(kbDocsPageSize));
            params.set('offset', String(offset));
            if (filters.sender) params.set('sender', filters.sender);
            if (filters.threadId) params.set('threadId', filters.threadId);
            if (filters.hasAttachment) params.set('hasAttachment', 'true');
            if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
            if (filters.dateTo) params.set('dateTo', filters.dateTo);
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/documents?${params.toString()}`);
            if (!res.ok) return;
            const body = await res.json();
            const rows = Array.isArray(body) ? body : (body.documents || []);
            const total = Array.isArray(body) ? rows.length : (body.total || rows.length);
            if (append) setKbDocs(prev => [...prev, ...rows]);
            else setKbDocs(rows);
            setKbDocsTotal(total);
            setKbDocsOffset(offset);
            if (!append) setKbSelectedIds(new Set());
        } catch (e) { console.error('Failed to fetch docs:', e); }
    };

    const loadMoreKBDocs = () => {
        if (!selectedKB) return;
        fetchKBDocs(selectedKB.id, { append: true, offset: kbDocsOffset + kbDocsPageSize });
    };

    const toggleSelectDoc = (docId) => {
        setKbSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(docId)) next.delete(docId); else next.add(docId);
            return next;
        });
    };

    const toggleSelectAllOnPage = () => {
        setKbSelectedIds(prev => {
            const visible = kbDocs.map(d => d.id);
            const allSelected = visible.every(id => prev.has(id));
            const next = new Set(prev);
            if (allSelected) visible.forEach(id => next.delete(id));
            else visible.forEach(id => next.add(id));
            return next;
        });
    };

    const bulkDeleteSelected = async () => {
        if (!selectedKB || kbSelectedIds.size === 0) return;
        if (!confirm(`Delete ${kbSelectedIds.size} document${kbSelectedIds.size === 1 ? '' : 's'}?`)) return;
        setKbBulkBusy(true);
        try {
            await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/documents/bulk-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentIds: Array.from(kbSelectedIds) }),
            });
            setKbSelectedIds(new Set());
            await fetchKBDocs(selectedKB.id, { offset: 0 });
            await fetchKBs();
        } catch (e) { console.error('Bulk delete failed:', e); }
        finally { setKbBulkBusy(false); }
    };

    const deleteDoc = async (docId) => {
        if (!selectedKB || !confirm('Delete this document?')) return;
        try {
            await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/documents/${docId}`, { method: 'DELETE' });
            fetchKBDocs(selectedKB.id, { offset: 0 });
            fetchKBs();
        } catch (e) { console.error('Failed to delete doc:', e); }
    };

    // ── KB Re-index ───────────────────────────────────────────────────
    const reindexKB = async () => {
        if (!selectedKB) return;
        if (!confirm(`Re-index "${selectedKB.name}"?\n\nThis will re-fetch all URL sources and re-embed all documents with the current model. This may take a while.`)) return;
        setReindexing(true); setReindexStatus('Starting re-index...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/reindex`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
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

    const toggleKBLink = (kbId) => {
        if (!onKnowledgeBaseIdsChange) return;
        const current = new Set(knowledgeBaseIds);
        if (current.has(kbId)) current.delete(kbId);
        else current.add(kbId);
        onKnowledgeBaseIdsChange([...current]);
    };

    // ── KB Ingestion ────────────────────────────────────────────────
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
                const data = await res.json();
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
                const data = await res.json();
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
                if (res.ok) {
                    ingested++;
                } else {
                    const err = await res.json();
                    console.error(`Failed to ingest ${file.name}:`, err.error);
                }
            }
            setKbIngestStatus('');
            fetchKBDocs(selectedKB.id); fetchKBs();
            if (ingested > 0 && ingested < driveFiles.length) {
                alert(`Ingested ${ingested}/${driveFiles.length} files. Some failed.`);
            }
        } catch (e) { setKbIngestStatus(''); alert('Failed: ' + e.message); }
        finally { setKbIngesting(false); }
    };

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

    return (
        <div className="flex flex-col h-full space-y-4" data-testid="knowledge-panel">
            {/* Google Drive Picker Modal */}
            <GoogleDrivePicker
                isOpen={drivePickerOpen}
                onClose={() => setDrivePickerOpen(false)}
                onFilesSelected={ingestDriveFiles}
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
                                Knowledge Bases ({kbs.length})
                            </h3>
                            <button onClick={() => setShowCreateKB(!showCreateKB)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                                style={{ background: 'var(--accent-primary)' }}
                                data-testid="kb-create-btn">
                                + Create KB
                            </button>
                        </div>

                        {/* Create KB Form */}
                        {showCreateKB && (
                            <div className="p-4 rounded-xl border bg-[var(--bg-tertiary)] border-[var(--border-default)] space-y-3">
                                <input value={newKBName} onChange={e => setNewKBName(e.target.value)}
                                    placeholder="KB Name (e.g. Product Docs)" autoFocus
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                <input value={newKBDesc} onChange={e => setNewKBDesc(e.target.value)}
                                    placeholder="Description (optional)"
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setShowCreateKB(false)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
                                    <button onClick={createKB} disabled={creatingKB || !newKBName.trim()}
                                        className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                                        style={{ background: 'var(--accent-primary)' }}>
                                        {creatingKB ? 'Creating...' : 'Create'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {loadingKbs ? (
                            <div className="text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</div>
                        ) : kbs.length === 0 ? (
                            <div className="text-center py-8 text-xs rounded-xl border border-dashed"
                                style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                No knowledge bases yet. Create one to get started with {useAzureKB ? 'Azure OpenAI' : 'bge-m3'} embeddings + hybrid search.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {kbs.map(kb => {
                                    const isLinked = knowledgeBaseIds.includes(kb.id);
                                    const isSelected = selectedKB?.id === kb.id;
                                    return (
                                        <div key={kb.id}
                                            className={`p-3 rounded-lg border group cursor-pointer transition-all ${isSelected ? 'ring-2 ring-[var(--accent-primary)] border-transparent' : 'hover:border-[var(--border-hover)]'}`}
                                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}
                                            onClick={() => setSelectedKB(isSelected ? null : kb)}
                                            data-testid={`kb-item-${kb.id}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                                                        style={{ background: isLinked ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)' }}>
                                                        📚
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                                            {kb.name}
                                                            {kb.organization_id ? (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-400" title="Shared with organization">🏢 Org</span>
                                                            ) : (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-white/5 text-[var(--text-muted)]" title="Personal KB">👤</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                                            {kb.document_count || 0} docs · {kb.total_chunks || 0} chunks
                                                            {kb.description && <span>· {kb.description}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => toggleKBLink(kb.id)}
                                                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${isLinked ? 'bg-blue-500/15 text-blue-400 hover:bg-red-500/15 hover:text-red-400' : 'bg-white/5 text-[var(--text-muted)] hover:bg-blue-500/15 hover:text-blue-400'}`}>
                                                        {isLinked ? '✓ Linked' : '+ Link'}
                                                    </button>
                                                    <button onClick={() => deleteKB(kb.id)}
                                                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10" title="Delete KB"
                                                        data-testid={`kb-delete-${kb.id}`}>
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
                                        <button onClick={reindexKB} disabled={reindexing || kbDocs.length === 0}
                                            className="text-[10px] px-2 py-0.5 rounded-full font-medium transition-all hover:bg-amber-500/15 disabled:opacity-40"
                                            style={{ background: 'rgba(245,158,11,0.08)', color: 'rgb(245,158,11)' }}
                                            title="Re-fetch URLs and re-embed all documents with current model">
                                            {reindexing ? '⏳ Re-indexing...' : '🔄 Re-index'}
                                        </button>
                
                                    </div>
                                </div>

                                {/* Ingest Section */}
                                <div className="space-y-3">
                                    <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] w-fit">
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
                                                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                            <textarea value={kbTextContent} onChange={e => setKbTextContent(e.target.value)}
                                                placeholder="Paste text content here..." rows={3}
                                                className="w-full px-3 py-2 rounded-lg border text-xs"
                                                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                        </div>
                                    )}
                                    {kbInputMode === 'url' && (
                                        <div className="space-y-2">
                                            <input type="url" value={kbUrlInput} onChange={e => setKbUrlInput(e.target.value)}
                                                placeholder={sitemapMode ? 'https://example.com' : 'https://example.com/page'}
                                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                onKeyDown={e => { if (e.key === 'Enter' && !kbIngesting) { sitemapMode ? ingestSitemap() : ingestUrl(); } }} />
                                            <div className="flex items-center gap-3">
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input type="checkbox" checked={sitemapMode} onChange={e => setSitemapMode(e.target.checked)}
                                                        className="rounded border-gray-500" />
                                                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>🗺️ Import from sitemap</span>
                                                </label>
                                                {sitemapMode && (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Max pages:</span>
                                                        <input type="number" value={sitemapMaxPages} onChange={e => setSitemapMaxPages(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
                                                            className="w-14 px-1.5 py-0.5 rounded border text-xs text-center"
                                                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                            min={1} max={200} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {kbInputMode === 'n8n' && (
                                        <div className="space-y-3">
                                            <div className="flex bg-[var(--bg-tertiary)] p-1 rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
                                                <button
                                                    onClick={() => setN8nIngestMode('data')}
                                                    className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-md transition-all ${n8nIngestMode === 'data' ? 'bg-[var(--bg-primary)] shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                                                    style={{ color: n8nIngestMode === 'data' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                    Execute & Ingest Output Data
                                                </button>
                                                <button
                                                    onClick={() => setN8nIngestMode('definition')}
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
                                                        <div key={wf.id} className="flex items-center justify-between p-2 rounded border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)' }}>
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
                                                <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5"
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
                                                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                                                    style={{ background: 'var(--accent-primary)' }}>
                                                    {kbIngesting ? 'Processing...' : 'Ingest'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Documents List */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                            Documents ({kbDocs.length}{kbDocsTotal > kbDocs.length ? ` of ${kbDocsTotal}` : ''})
                                        </h5>
                                        {kbSelectedIds.size > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{kbSelectedIds.size} selected</span>
                                                <button onClick={bulkDeleteSelected} disabled={kbBulkBusy}
                                                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 disabled:opacity-50">
                                                    {kbBulkBusy ? 'Deleting…' : 'Delete selected'}
                                                </button>
                                                <button onClick={() => setKbSelectedIds(new Set())} className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Clear</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Email-specific filter bar: shown when any doc in list is sourced from email. */}
                                    {kbDocs.some(d => d.source_type === 'email') && (
                                        <div className="mb-2 p-2 rounded-lg border flex flex-wrap gap-1.5 items-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                            <input type="text" placeholder="Sender" value={kbDocsFilters.sender}
                                                onChange={e => setKbDocsFilters(f => ({ ...f, sender: e.target.value }))}
                                                className="px-2 py-1 rounded text-[11px] border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                            <input type="date" value={kbDocsFilters.dateFrom}
                                                onChange={e => setKbDocsFilters(f => ({ ...f, dateFrom: e.target.value }))}
                                                className="px-2 py-1 rounded text-[11px] border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                            <input type="date" value={kbDocsFilters.dateTo}
                                                onChange={e => setKbDocsFilters(f => ({ ...f, dateTo: e.target.value }))}
                                                className="px-2 py-1 rounded text-[11px] border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                            <label className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-primary)' }}>
                                                <input type="checkbox" checked={kbDocsFilters.hasAttachment}
                                                    onChange={e => setKbDocsFilters(f => ({ ...f, hasAttachment: e.target.checked }))} />
                                                Has attachment
                                            </label>
                                            <button onClick={() => fetchKBDocs(selectedKB.id, { offset: 0 })}
                                                className="px-2 py-1 rounded text-[11px] font-medium" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
                                                Apply
                                            </button>
                                            <button onClick={() => { const cleared = { sender: '', threadId: '', hasAttachment: false, dateFrom: '', dateTo: '' }; setKbDocsFilters(cleared); fetchKBDocs(selectedKB.id, { offset: 0, filters: cleared }); }}
                                                className="px-2 py-1 rounded text-[11px]" style={{ color: 'var(--text-muted)' }}>Clear</button>
                                        </div>
                                    )}

                                    {kbDocs.length === 0 ? (
                                        <div className="text-center py-4 text-xs rounded-lg border border-dashed"
                                            style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                            No documents yet. Ingest text, files, or URLs above.
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 mb-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                <input type="checkbox"
                                                    checked={kbDocs.length > 0 && kbDocs.every(d => kbSelectedIds.has(d.id))}
                                                    onChange={toggleSelectAllOnPage} />
                                                Select all on page
                                            </div>
                                            <div className="space-y-1.5">
                                                {kbDocs.map(doc => (
                                                    <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg group"
                                                        style={{ background: 'var(--bg-tertiary)' }}
                                                        data-testid={`kb-doc-${doc.id}`}>
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <input type="checkbox" checked={kbSelectedIds.has(doc.id)}
                                                                onChange={() => toggleSelectDoc(doc.id)}
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
                                                        <button onClick={() => deleteDoc(doc.id)}
                                                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 flex-shrink-0"
                                                            data-testid={`kb-doc-delete-${doc.id}`}>
                                                            <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            {kbDocsTotal > kbDocs.length && (
                                                <div className="flex justify-center mt-2">
                                                    <button onClick={loadMoreKBDocs}
                                                        className="px-3 py-1 rounded text-[11px] font-medium border"
                                                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                                                        Load more ({kbDocsTotal - kbDocs.length} left)
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Email thread explorer (only renders when the KB has email threads). */}
                                    {kbDocs.some(d => d.source_type === 'email') && selectedKB?.id && (
                                        <EmailThreadExplorer
                                            kbId={selectedKB.id}
                                            authFetch={authFetch}
                                            onOpenDoc={(doc) => setKbDocsFilters(f => ({ ...f, threadId: doc.metadata?.threadId || '' }))}
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
