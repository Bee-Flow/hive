import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Trash2, FileText, Globe, Paperclip, Search, Settings as SettingsIcon, Eye, EyeOff, Loader2, X, Plus } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';

const SOURCE_EMOJI = {
    web: '🌐', url: '🌐', sitemap: '🌐',
    upload: '📄', file: '📄', pdf: '📄', docx: '📄', xlsx: '📄', csv: '📄',
    text: '📝', email: '✉️',
};

const sourceEmoji = (t) => SOURCE_EMOJI[(t || '').toLowerCase()] || '📄';

const formatDate = (s) => {
    try { return new Date(s).toLocaleDateString(); } catch { return ''; }
};

export default function KBDetailPage({ kbId: initialKbId, onClose, onSaved, user, groups = [] }) {
    const isCreateMode = !initialKbId;
    const [kbId, setKbId] = useState(initialKbId || null);
    const [kb, setKb] = useState(null);
    const [loading, setLoading] = useState(!isCreateMode);
    const [tab, setTab] = useState(isCreateMode ? 'settings' : 'documents');

    // Settings form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [defaultLang, setDefaultLang] = useState('unknown');
    const [icon, setIcon] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [categories, setCategories] = useState([]);
    const [organizationId, setOrganizationId] = useState('');
    const [isPublished, setIsPublished] = useState(false);
    const [sharedGroups, setSharedGroups] = useState([]);
    const [saving, setSaving] = useState(false);

    // Documents tab state
    const [docs, setDocs] = useState([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [ingesting, setIngesting] = useState(false);
    const [ingestStatus, setIngestStatus] = useState('');
    const [ingestMode, setIngestMode] = useState('text');
    const [textTitle, setTextTitle] = useState('');
    const [textContent, setTextContent] = useState('');
    const [urlInput, setUrlInput] = useState('');

    // Search tab state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const nameRef = useRef(null);

    const isOwner = !!(kb && user && (kb.tenant_id === user.id || user.isAdmin || (user.permissions || []).includes('all')));
    const canManage = isCreateMode || isOwner || (user && (user.isAdmin || (user.permissions || []).includes('all') || (user.permissions || []).includes('manage_knowledge')));

    useEffect(() => {
        loadCategories();
        if (kbId) loadKB(kbId);
        else setTimeout(() => nameRef.current?.focus(), 50);
    }, [kbId]);

    async function loadCategories() {
        try {
            const res = await authFetch(`${API_BASE}/api/kb/categories`);
            if (res.ok) setCategories(await res.json());
        } catch (e) { /* ignore */ }
    }

    async function loadKB(id) {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${id}`);
            if (res.ok) {
                const data = await res.json();
                setKb(data);
                setName(data.name || '');
                setDescription(data.description || '');
                setDefaultLang(data.default_lang || 'unknown');
                setIcon(data.icon || '');
                setCategoryId(data.category_id || '');
                setOrganizationId(data.organization_id || '');
                setIsPublished(!!data.is_published);
                try { setSharedGroups(JSON.parse(data.shared_groups || '[]')); } catch { setSharedGroups([]); }
                setDocs(Array.isArray(data.documents) ? data.documents : []);
            } else if (res.status === 404) {
                setKb(null);
            }
        } catch (e) { console.error('[KB] Load error:', e); }
        finally { setLoading(false); }
    }

    async function refreshDocs() {
        if (!kbId) return;
        setDocsLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/documents`);
            if (res.ok) {
                const data = await res.json();
                setDocs(Array.isArray(data) ? data : (data.documents || []));
            }
        } catch (e) { /* ignore */ }
        finally { setDocsLoading(false); }
    }

    async function handleSaveSettings() {
        if (!name.trim()) return;
        setSaving(true);
        try {
            if (isCreateMode || !kbId) {
                const res = await authFetch(`${API_BASE}/api/kb`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name.trim(),
                        description,
                        defaultLang,
                        icon: icon || null,
                        categoryId: categoryId || null,
                    }),
                });
                if (res.ok) {
                    const created = await res.json();
                    setKbId(created.id);
                    setKb(created);
                    onSaved?.(created);
                    setTab('documents');
                } else {
                    const err = await res.json().catch(() => ({}));
                    alert('Failed to create: ' + (err.error || res.status));
                }
            } else {
                const res = await authFetch(`${API_BASE}/api/kb/${kbId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name.trim(),
                        description,
                        defaultLang,
                        icon: icon || null,
                        categoryId: categoryId || null,
                    }),
                });
                if (res.ok) {
                    const updated = await res.json();
                    setKb(prev => ({ ...prev, ...updated }));
                    onSaved?.(updated);
                } else {
                    alert('Failed to save settings');
                }
            }
        } catch (e) { alert('Save failed: ' + e.message); }
        finally { setSaving(false); }
    }

    async function handleTogglePublish(next) {
        if (!kbId) return;
        if (next && !organizationId) {
            alert('This KB is personal. Move it to an organisation before publishing.');
            return;
        }
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/publish`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublished: next, sharedGroups }),
            });
            if (res.ok) {
                setIsPublished(next);
                const data = await res.json();
                setKb(prev => ({ ...prev, ...(data.kb || {}) }));
                onSaved?.(data.kb);
            } else {
                const err = await res.json().catch(() => ({}));
                alert('Publish failed: ' + (err.error || res.status));
            }
        } catch (e) { alert('Publish failed: ' + e.message); }
        finally { setSaving(false); }
    }

    async function handleDeleteKB() {
        if (!kbId) return;
        if (!confirm(`Delete "${name}"? This removes all documents and chunks. Cannot be undone.`)) return;
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}`, { method: 'DELETE' });
            if (res.ok) { onSaved?.(null); onClose?.(); }
            else { alert('Delete failed'); }
        } catch (e) { alert('Delete failed: ' + e.message); }
    }

    async function ingestText() {
        if (!kbId || !textContent.trim()) return;
        setIngesting(true); setIngestStatus('Processing...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/ingest/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: textContent, title: textTitle || 'Text' }),
            });
            if (res.ok) { setTextContent(''); setTextTitle(''); setIngestStatus(''); refreshDocs(); }
            else { const err = await res.json().catch(() => ({})); alert('Error: ' + (err.error || res.status)); setIngestStatus(''); }
        } catch (e) { setIngestStatus(''); alert('Failed: ' + e.message); }
        finally { setIngesting(false); }
    }

    async function ingestUrl() {
        if (!kbId || !urlInput.trim()) return;
        setIngesting(true); setIngestStatus('Fetching URL...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/ingest/url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlInput.trim() }),
            });
            if (res.ok) { setUrlInput(''); setIngestStatus(''); refreshDocs(); }
            else { const err = await res.json().catch(() => ({})); alert('Error: ' + (err.error || res.status)); setIngestStatus(''); }
        } catch (e) { setIngestStatus(''); alert('Failed: ' + e.message); }
        finally { setIngesting(false); }
    }

    async function ingestFile(e) {
        const file = e.target.files?.[0];
        if (!file || !kbId) return;
        setIngesting(true); setIngestStatus('Uploading...');
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/ingest/file`, { method: 'POST', body: formData });
            if (res.ok) { setIngestStatus(''); refreshDocs(); }
            else { const err = await res.json().catch(() => ({})); alert('Error: ' + (err.error || res.status)); setIngestStatus(''); }
        } catch (e2) { setIngestStatus(''); alert('Failed: ' + e2.message); }
        finally { setIngesting(false); e.target.value = ''; }
    }

    async function deleteDoc(docId) {
        if (!kbId) return;
        if (!confirm('Delete this document?')) return;
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) refreshDocs();
        } catch (e) { /* ignore */ }
    }

    async function runSearch() {
        if (!kbId || !searchQuery.trim()) return;
        setSearching(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kb_id: kbId, query: searchQuery.trim(), top_k: 10 }),
            });
            if (res.ok) {
                const data = await res.json();
                setSearchResults(Array.isArray(data?.results) ? data.results : (data?.chunks || []));
            } else {
                setSearchResults([]);
            }
        } catch (e) { setSearchResults([]); }
        finally { setSearching(false); }
    }

    function toggleGroup(gid) {
        setSharedGroups(prev => prev.includes(gid) ? prev.filter(g => g !== gid) : [...prev, gid]);
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    if (!isCreateMode && !kb) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background: 'var(--bg-secondary)' }}>
                <div className="text-3xl">🤔</div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Knowledge base not found.</p>
                <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>Back</button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden w-full h-full" style={{ background: 'var(--bg-secondary)' }} data-testid="kb-detail-page">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {onClose && (
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]" title="Back">
                                <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            </button>
                        )}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-primary)' }}>
                            {icon || <BookOpen className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                {isCreateMode ? 'New Knowledge Base' : (name || 'Untitled')}
                            </h1>
                            {!isCreateMode && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {(kb?.document_count ?? docs.length) || 0} documents · {kb?.total_chunks || 0} chunks
                                    {isPublished && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Published</span>}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isCreateMode && canManage && (
                            <button
                                onClick={() => handleTogglePublish(!isPublished)}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                            >
                                {isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                {isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b -mb-px" style={{ borderColor: 'var(--border-subtle)' }}>
                    {[
                        { id: 'documents', label: 'Documents', icon: FileText, disabled: isCreateMode },
                        { id: 'search', label: 'Search', icon: Search, disabled: isCreateMode },
                        { id: 'settings', label: 'Settings', icon: SettingsIcon },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => !t.disabled && setTab(t.id)}
                            disabled={t.disabled}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${tab === t.id ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'} ${t.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            <t.icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto">
                <div className="px-6 py-5 max-w-3xl space-y-5">

                    {/* Documents tab */}
                    {tab === 'documents' && !isCreateMode && (
                        <div className="space-y-4">
                            {/* Ingest controls */}
                            {canManage && (
                                <div className="p-3 rounded-xl border space-y-3" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Add a source</h3>
                                        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                            {[
                                                { id: 'text', label: '📝 Text' },
                                                { id: 'url', label: '🌐 URL' },
                                            ].map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => setIngestMode(m.id)}
                                                    className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${ingestMode === m.id ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}
                                                >{m.label}</button>
                                            ))}
                                        </div>
                                    </div>

                                    {ingestMode === 'text' && (
                                        <div className="space-y-2">
                                            <input
                                                value={textTitle}
                                                onChange={e => setTextTitle(e.target.value)}
                                                placeholder="Title (optional)"
                                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                            />
                                            <textarea
                                                value={textContent}
                                                onChange={e => setTextContent(e.target.value)}
                                                placeholder="Paste text content here..."
                                                rows={4}
                                                className="w-full px-3 py-2 rounded-lg border text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                    )}

                                    {ingestMode === 'url' && (
                                        <input
                                            type="url"
                                            value={urlInput}
                                            onChange={e => setUrlInput(e.target.value)}
                                            placeholder="https://example.com/page"
                                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                            onKeyDown={e => { if (e.key === 'Enter' && !ingesting) ingestUrl(); }}
                                        />
                                    )}

                                    <div className="flex justify-end items-center gap-2">
                                        {ingestStatus && (
                                            <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                {ingestStatus}
                                            </span>
                                        )}
                                        <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 hover:bg-[var(--bg-tertiary)]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                                            <input type="file" accept=".pdf,.txt,.md,.docx,.csv" className="hidden" onChange={ingestFile} disabled={ingesting} />
                                            <Paperclip className="w-3.5 h-3.5" /> Upload file
                                        </label>
                                        <button
                                            onClick={ingestMode === 'url' ? ingestUrl : ingestText}
                                            disabled={ingesting || (ingestMode === 'text' ? !textContent.trim() : !urlInput.trim())}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 hover:brightness-110"
                                            style={{ background: 'var(--accent-primary)' }}
                                        >
                                            {ingesting ? 'Processing…' : 'Add'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Documents list */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Documents ({docs.length})</h3>
                                    <button onClick={refreshDocs} className="text-[11px]" style={{ color: 'var(--text-muted)' }} disabled={docsLoading}>
                                        {docsLoading ? 'Refreshing…' : 'Refresh'}
                                    </button>
                                </div>
                                {docs.length === 0 ? (
                                    <div className="text-center py-10 text-xs rounded-xl border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                        No documents yet. Upload a file, paste text, or add a URL above.
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {docs.map(doc => (
                                            <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded-lg group hover:bg-[var(--bg-tertiary)]" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span className="text-base flex-shrink-0">{sourceEmoji(doc.source_type)}</span>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title || 'Untitled'}</div>
                                                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                            {doc.chunk_count || 0} chunks · {formatDate(doc.created_at)}
                                                            {doc.source_uri && <span className="ml-1.5 truncate">· {doc.source_uri.replace(/^https?:\/\//, '').slice(0, 40)}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                {canManage && (
                                                    <button onClick={() => deleteDoc(doc.id)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10" title="Delete">
                                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Search tab */}
                    {tab === 'search' && !isCreateMode && (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search this knowledge base…"
                                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                    onKeyDown={e => { if (e.key === 'Enter' && !searching) runSearch(); }}
                                />
                            </div>
                            {searching && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Searching…</p>}
                            {!searching && searchResults.length === 0 && searchQuery.trim() && (
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No results.</p>
                            )}
                            <div className="space-y-2">
                                {searchResults.map((r, i) => (
                                    <div key={r.id || i} className="p-3 rounded-xl border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm">{sourceEmoji(r.source_type)}</span>
                                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{r.title || r.document_title || 'Untitled'}</span>
                                            {typeof r.score === 'number' && (
                                                <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{r.score.toFixed(3)}</span>
                                            )}
                                        </div>
                                        <p className="text-xs leading-relaxed line-clamp-4" style={{ color: 'var(--text-secondary)' }}>
                                            {r.content || r.text || r.chunk || ''}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Settings tab */}
                    {tab === 'settings' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name</label>
                                <input
                                    ref={nameRef}
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Product Documentation"
                                    disabled={!canManage}
                                    className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="What's in this KB?"
                                    rows={2}
                                    disabled={!canManage}
                                    className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none resize-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Icon (emoji)</label>
                                    <input
                                        value={icon}
                                        onChange={e => setIcon(e.target.value.slice(0, 4))}
                                        placeholder="📚"
                                        maxLength={4}
                                        disabled={!canManage}
                                        className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Default Language</label>
                                    <input
                                        value={defaultLang}
                                        onChange={e => setDefaultLang(e.target.value)}
                                        placeholder="en, nl, …"
                                        disabled={!canManage}
                                        className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Category</label>
                                <select
                                    value={categoryId}
                                    onChange={e => setCategoryId(e.target.value)}
                                    disabled={!canManage}
                                    className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                >
                                    <option value="">Uncategorised</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.icon || '📚'} {c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Sharing block — only meaningful for org KBs */}
                            {!isCreateMode && (
                                <div className="p-3 rounded-xl border space-y-3" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                                    <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Sharing</h3>
                                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                        {organizationId
                                            ? (isPublished
                                                ? 'Visible to your organisation in the Knowledge Bases store.'
                                                : 'This is a personal draft. Publish to share with your organisation.')
                                            : 'Personal KB — only you can see it. Move it to an organisation to enable publishing.'
                                        }
                                    </div>
                                    {organizationId && groups && groups.length > 0 && (
                                        <div>
                                            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                                Restrict to groups (optional)
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {groups.map(g => {
                                                    const active = sharedGroups.includes(g.id);
                                                    return (
                                                        <button
                                                            key={g.id}
                                                            onClick={() => canManage && toggleGroup(g.id)}
                                                            className="px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all"
                                                            style={{
                                                                background: active ? 'var(--accent-primary)' : 'transparent',
                                                                color: active ? '#fff' : 'var(--text-secondary)',
                                                                borderColor: active ? 'var(--accent-primary)' : 'var(--border-subtle)',
                                                                cursor: canManage ? 'pointer' : 'not-allowed',
                                                            }}
                                                        >{g.name}</button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                                Empty selection = entire organisation.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2">
                                {!isCreateMode && canManage && (
                                    <button
                                        onClick={handleDeleteKB}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Delete KB
                                    </button>
                                )}
                                <div className="ml-auto flex gap-2">
                                    {onClose && (
                                        <button
                                            onClick={onClose}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-[var(--bg-tertiary)]"
                                            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                        >Cancel</button>
                                    )}
                                    {canManage && (
                                        <button
                                            onClick={handleSaveSettings}
                                            disabled={saving || !name.trim()}
                                            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 hover:brightness-110"
                                            style={{ background: 'var(--accent-primary)' }}
                                        >
                                            {saving ? 'Saving…' : (isCreateMode ? 'Create' : 'Save')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
