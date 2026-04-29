import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Trash2, FileText, Globe, Paperclip, Settings as SettingsIcon, Loader2, Plus, X, RefreshCcw, Building2, Check } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';

const SOURCE_EMOJI = {
    web: '🌐', url: '🌐', sitemap: '🌐',
    upload: '📄', file: '📄', pdf: '📄', docx: '📄', xlsx: '📄', csv: '📄',
    text: '📝', email: '✉️', n8n: '⚙️',
};

const sourceEmoji = (t) => SOURCE_EMOJI[(t || '').toLowerCase()] || '📄';

const formatDate = (s) => {
    try { return new Date(s).toLocaleDateString(); } catch { return ''; }
};

const EMOJI_CATEGORIES = {
    smileys: { label: '😀', title: 'Smileys', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '🥰', '😍', '🤩', '🤓', '😎', '🥳', '🤖'] },
    objects: { label: '📚', title: 'Books & Docs', emojis: ['📚', '📖', '📕', '📗', '📘', '📙', '📓', '📒', '📔', '📰', '🗞️', '📜', '📄', '📑', '🔖', '🏷️', '📂', '📁', '🗂️', '🗃️', '🗄️', '📊', '📈', '📉', '🧾', '✉️', '📧', '📨', '📬', '🗒️', '🗓️', '📅'] },
    tech: { label: '🤖', title: 'Tech & Work', emojis: ['🤖', '🧠', '💡', '🔧', '🔨', '⚒️', '🛠️', '⚙️', '🧰', '🎯', '🚀', '⚡', '🔥', '✨', '🌟', '⭐', '📝', '✏️', '🖊️', '📌', '🔒', '🔓', '🔐', '🔑'] },
    food: { label: '🍕', title: 'Food', emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🌶️', '🌽', '🍞', '🥐', '🥖', '🧀', '🥚', '🍔', '🍟', '🍕', '🍜', '🍣'] },
    symbols: { label: '⚡', title: 'Symbols', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💯', '✅', '☑️', '✔️', '❌', '❗', '❓', '⚠️', '♻️', '⚛️', '🛡️'] },
};

export default function KBDetailPage({ kbId: initialKbId, onClose, onSaved, user }) {
    const isCreateMode = !initialKbId;
    const [kbId, setKbId] = useState(initialKbId || null);
    const [kb, setKb] = useState(null);
    const [loading, setLoading] = useState(!isCreateMode);
    const [tab, setTab] = useState(isCreateMode ? 'settings' : 'documents');

    // Settings form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [defaultLang, setDefaultLang] = useState('unknown');
    const [icon, setIcon] = useState('📚');
    const [categoryId, setCategoryId] = useState('');
    const [categories, setCategories] = useState([]);
    const [organizationId, setOrganizationId] = useState('');
    const [isPublished, setIsPublished] = useState(false);
    const [sharedGroups, setSharedGroups] = useState([]);
    const [orgGroups, setOrgGroups] = useState([]);
    const [saving, setSaving] = useState(false);

    // Inline category creation
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Emoji / icon picker
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [emojiCategory, setEmojiCategory] = useState('objects');
    const iconPickerRef = useRef(null);

    // Publish dropdown
    const [showPublishMenu, setShowPublishMenu] = useState(false);
    const publishMenuRef = useRef(null);

    // Documents tab state
    const [docs, setDocs] = useState([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [ingesting, setIngesting] = useState(false);
    const [ingestStatus, setIngestStatus] = useState('');
    const [ingestMode, setIngestMode] = useState('text');
    const [textTitle, setTextTitle] = useState('');
    const [textContent, setTextContent] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [sitemapMode, setSitemapMode] = useState(false);
    const [sitemapMaxPages, setSitemapMaxPages] = useState(50);

    // n8n ingestion
    const [n8nWorkflows, setN8nWorkflows] = useState([]);
    const [n8nIngestMode, setN8nIngestMode] = useState('data');

    // Re-index
    const [reindexing, setReindexing] = useState(false);
    const [reindexStatus, setReindexStatus] = useState('');

    const nameRef = useRef(null);

    const isOwner = !!(kb && user && (kb.tenant_id === user.id || user.isAdmin || (user.permissions || []).includes('all')));
    const canManage = isCreateMode || isOwner || (user && (user.isAdmin || (user.permissions || []).includes('all') || (user.permissions || []).includes('manage_knowledge')));

    useEffect(() => {
        loadCategories();
        loadGroups();
        if (kbId) loadKB(kbId);
        else setTimeout(() => nameRef.current?.focus(), 50);
    }, [kbId]);

    // Click-outside for icon picker + publish menu
    useEffect(() => {
        const onClick = (e) => {
            if (showIconPicker && iconPickerRef.current && !iconPickerRef.current.contains(e.target)) {
                setShowIconPicker(false);
            }
            if (showPublishMenu && publishMenuRef.current && !publishMenuRef.current.contains(e.target)) {
                setShowPublishMenu(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [showIconPicker, showPublishMenu]);

    // Load n8n workflows when n8n tab is opened
    useEffect(() => {
        if (ingestMode === 'n8n' && kbId) {
            (async () => {
                try {
                    const res = await authFetch(`${API_BASE}/api/kb/n8n/ingestible`);
                    if (res.ok) setN8nWorkflows(await res.json());
                } catch (e) { /* ignore */ }
            })();
        }
    }, [ingestMode, kbId]);

    async function loadCategories() {
        try {
            const res = await authFetch(`${API_BASE}/api/kb/categories`);
            if (res.ok) setCategories(await res.json());
        } catch (e) { /* ignore */ }
    }

    async function loadGroups() {
        try {
            const res = await authFetch(`${API_BASE}/auth/groups`);
            if (res.ok) {
                const data = await res.json();
                setOrgGroups(Array.isArray(data) ? data : []);
            }
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
                setIcon(data.icon || '📚');
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

    async function handleCreateCategory() {
        if (!newCategoryName.trim()) return;
        try {
            const res = await authFetch(`${API_BASE}/api/kb/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCategoryName.trim() }),
            });
            if (res.ok) {
                const cat = await res.json();
                setCategories(prev => [...prev, cat]);
                setCategoryId(cat.id);
                setNewCategoryName('');
                setShowNewCategory(false);
            }
        } catch (e) { console.error('Failed to create category', e); }
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

    async function togglePublish(groups) {
        if (!kbId) return;
        const next = !isPublished;
        if (next && !organizationId) {
            alert('This KB is personal. Save it inside an organisation before publishing.');
            return;
        }
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/publish`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublished: next, sharedGroups: next ? (groups || []) : [] }),
            });
            if (res.ok) {
                const data = await res.json();
                setIsPublished(next);
                setSharedGroups(next ? (groups || []) : []);
                setKb(prev => ({ ...prev, ...(data.kb || {}) }));
                setShowPublishMenu(false);
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
        setIngesting(true);
        const isSitemap = sitemapMode;
        setIngestStatus(isSitemap ? 'Crawling sitemap...' : 'Fetching URL...');
        try {
            const endpoint = isSitemap ? `${API_BASE}/api/kb/${kbId}/ingest/sitemap` : `${API_BASE}/api/kb/${kbId}/ingest/url`;
            const body = isSitemap ? { url: urlInput.trim(), maxPages: sitemapMaxPages } : { url: urlInput.trim() };
            const res = await authFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
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

    async function ingestN8n(workflowId) {
        if (!kbId || !workflowId) return;
        setIngesting(true); setIngestStatus('Ingesting workflow...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/ingest/n8n`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflowId, mode: n8nIngestMode }),
            });
            if (res.ok) {
                const data = await res.json();
                setIngestStatus(`Done: ${data.chunks || 0} chunks`);
                refreshDocs();
                setTimeout(() => setIngestStatus(''), 5000);
            } else {
                const err = await res.json().catch(() => ({}));
                setIngestStatus(''); alert('Error: ' + (err.error || res.status));
            }
        } catch (e) { setIngestStatus(''); alert('Failed: ' + e.message); }
        finally { setIngesting(false); }
    }

    async function reindexKB() {
        if (!kbId) return;
        if (!confirm(`Re-index "${name}"?\n\nThis re-fetches URL sources and re-embeds all documents with the current model. May take a while.`)) return;
        setReindexing(true); setReindexStatus('Starting re-index...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/reindex`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
            });
            if (res.ok) {
                const data = await res.json();
                setReindexStatus(`Done: ${data.reindexed}/${data.total} re-indexed${data.failed ? `, ${data.failed} failed` : ''}`);
                refreshDocs();
                setTimeout(() => setReindexStatus(''), 8000);
            } else {
                const err = await res.json().catch(() => ({}));
                setReindexStatus(''); alert('Re-index failed: ' + (err.error || res.status));
            }
        } catch (e) { setReindexStatus(''); alert('Re-index failed: ' + e.message); }
        finally { setReindexing(false); }
    }

    async function deleteDoc(docId) {
        if (!kbId) return;
        if (!confirm('Delete this document?')) return;
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) refreshDocs();
        } catch (e) { /* ignore */ }
    }

    function toggleGroup(gid) {
        setSharedGroups(prev => prev.includes(gid) ? prev.filter(g => g !== gid) : [...prev, gid]);
    }

    function pickIcon(emoji) {
        setIcon(emoji);
        setShowIconPicker(false);
    }

    function uploadIconImage(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 512 * 1024) {
            alert('Image must be under 512KB');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setIcon(ev.target.result);
            setShowIconPicker(false);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
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

    const hasImageIcon = icon && typeof icon === 'string' && (icon.startsWith('data:') || icon.startsWith('http'));

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
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 overflow-hidden" style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-primary)' }}>
                            {hasImageIcon ? <img src={icon} alt="" className="w-full h-full object-cover" /> : (icon || <BookOpen className="w-5 h-5" />)}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                {isCreateMode ? 'New Knowledge Base' : (name || 'Untitled')}
                            </h1>
                            {!isCreateMode && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {(kb?.document_count ?? docs.length) || 0} documents · {kb?.total_chunks || 0} chunks
                                </p>
                            )}
                        </div>
                    </div>
                    {!isCreateMode && canManage && (
                        <div className="relative" ref={publishMenuRef}>
                            <button
                                onClick={() => isPublished ? togglePublish() : setShowPublishMenu(v => !v)}
                                disabled={saving}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                                    isPublished
                                        ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'
                                        : 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                                style={!isPublished ? { borderColor: 'var(--border-default)' } : {}}
                            >
                                {isPublished ? (
                                    <>
                                        <Check className="w-3.5 h-3.5" />
                                        Published{sharedGroups.length > 0 ? ` (${sharedGroups.length})` : ''}
                                    </>
                                ) : (
                                    <>Publish <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></>
                                )}
                            </button>

                            {showPublishMenu && !isPublished && (
                                <div
                                    className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-2xl z-50 overflow-hidden"
                                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}
                                >
                                    <div className="p-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Publish to…</p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Choose who can see this knowledge base</p>
                                    </div>

                                    <button
                                        onClick={() => togglePublish([])}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
                                            <Building2 className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Entire Organisation</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>All members can access</p>
                                        </div>
                                    </button>

                                    {orgGroups.length > 0 && (
                                        <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Or specific groups</p>
                                        </div>
                                    )}

                                    <div className="max-h-48 overflow-auto">
                                        {orgGroups.map((group) => (
                                            <label
                                                key={group.id}
                                                className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={sharedGroups.includes(group.id)}
                                                    onChange={() => toggleGroup(group.id)}
                                                    className="accent-[var(--accent-primary)] w-4 h-4"
                                                />
                                                <div className="flex-1">
                                                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{group.name}</p>
                                                    {group.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{group.description}</p>}
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    {sharedGroups.length > 0 && (
                                        <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                            <button
                                                onClick={() => togglePublish(sharedGroups)}
                                                className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                                            >
                                                Publish to {sharedGroups.length} group{sharedGroups.length > 1 ? 's' : ''}
                                            </button>
                                        </div>
                                    )}

                                    <div className="p-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                        <button
                                            onClick={() => setShowPublishMenu(false)}
                                            className="w-full px-3 py-1.5 rounded-lg text-xs text-center"
                                            style={{ color: 'var(--text-muted)' }}
                                        >Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b -mb-px" style={{ borderColor: 'var(--border-subtle)' }}>
                    {[
                        { id: 'documents', label: 'Documents', icon: FileText, disabled: isCreateMode },
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
                            {/* Toolbar: Re-index */}
                            {canManage && (
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Documents ({docs.length})</h3>
                                    <div className="flex items-center gap-2">
                                        {reindexStatus && (
                                            <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                                                {reindexing && <Loader2 className="w-3 h-3 animate-spin" />}
                                                {reindexStatus}
                                            </span>
                                        )}
                                        <button
                                            onClick={reindexKB}
                                            disabled={reindexing || docs.length === 0}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                                            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                            title="Re-fetch URLs and re-embed all documents"
                                        >
                                            <RefreshCcw className={`w-3 h-3 ${reindexing ? 'animate-spin' : ''}`} />
                                            {reindexing ? 'Re-indexing…' : 'Re-index'}
                                        </button>
                                        <button onClick={refreshDocs} className="text-[11px] hover:underline" style={{ color: 'var(--text-muted)' }} disabled={docsLoading}>
                                            {docsLoading ? 'Refreshing…' : 'Refresh'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Ingest controls */}
                            {canManage && (
                                <div className="p-3 rounded-xl border space-y-3" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Add a source</h3>
                                        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                            {[
                                                { id: 'text', label: '📝 Text' },
                                                { id: 'url', label: '🌐 URL' },
                                                { id: 'n8n', label: '⚙️ n8n' },
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
                                        <div className="space-y-2">
                                            <input
                                                type="url"
                                                value={urlInput}
                                                onChange={e => setUrlInput(e.target.value)}
                                                placeholder={sitemapMode ? 'https://example.com/sitemap.xml' : 'https://example.com/page'}
                                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                                onKeyDown={e => { if (e.key === 'Enter' && !ingesting) ingestUrl(); }}
                                            />
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                                                    <input type="checkbox" checked={sitemapMode} onChange={e => setSitemapMode(e.target.checked)} className="rounded" />
                                                    Sitemap (crawl multiple pages)
                                                </label>
                                                {sitemapMode && (
                                                    <div className="flex items-center gap-1.5 ml-3" style={{ color: 'var(--text-muted)' }}>
                                                        Max pages
                                                        <input
                                                            type="number"
                                                            value={sitemapMaxPages}
                                                            onChange={e => setSitemapMaxPages(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
                                                            className="w-14 px-1.5 py-0.5 rounded border text-xs text-center"
                                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                                            min={1} max={200}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {ingestMode === 'n8n' && (
                                        <div className="space-y-3">
                                            <div className="flex p-1 rounded-lg border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                                                <button
                                                    onClick={() => setN8nIngestMode('data')}
                                                    className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-md transition-all ${n8nIngestMode === 'data' ? 'bg-[var(--bg-primary)] shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                                                    style={{ color: n8nIngestMode === 'data' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                                                >Execute & Ingest Output Data</button>
                                                <button
                                                    onClick={() => setN8nIngestMode('definition')}
                                                    className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-md transition-all ${n8nIngestMode === 'definition' ? 'bg-[var(--bg-primary)] shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                                                    style={{ color: n8nIngestMode === 'definition' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                                                >Import Workflow Definition</button>
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
                                                            <button
                                                                disabled={ingesting}
                                                                onClick={() => ingestN8n(wf.id)}
                                                                className="px-2 py-1 text-[10px] font-medium rounded text-white disabled:opacity-50 transition-opacity hover:opacity-80 flex-shrink-0"
                                                                style={{ background: 'var(--accent-primary)' }}
                                                            >{n8nIngestMode === 'data' ? 'Execute' : 'Ingest'}</button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end items-center gap-2">
                                        {ingestStatus && (
                                            <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                {ingestStatus}
                                            </span>
                                        )}
                                        {ingestMode !== 'n8n' && (
                                            <>
                                                <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 hover:bg-[var(--bg-tertiary)]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                                                    <input type="file" accept=".pdf,.txt,.md,.docx,.csv" className="hidden" onChange={ingestFile} disabled={ingesting} />
                                                    <Paperclip className="w-3.5 h-3.5" /> Upload file
                                                </label>
                                                <button
                                                    onClick={ingestMode === 'url' ? ingestUrl : ingestText}
                                                    disabled={ingesting || (ingestMode === 'text' ? !textContent.trim() : !urlInput.trim())}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 hover:brightness-110"
                                                    style={{ background: 'var(--accent-primary)' }}
                                                >{ingesting ? 'Processing…' : 'Add'}</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Documents list */}
                            <div>
                                {docs.length === 0 ? (
                                    <div className="text-center py-10 text-xs rounded-xl border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                        No documents yet. Upload a file, paste text, add a URL, or ingest from n8n above.
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

                    {/* Settings tab */}
                    {tab === 'settings' && (
                        <div className="space-y-4">
                            {/* Icon + Name + Description */}
                            <div className="relative">
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Icon</label>
                                <div className="flex items-center gap-3">
                                    <div
                                        onClick={() => canManage && setShowIconPicker(v => !v)}
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl cursor-pointer transition-all overflow-hidden border"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                                        title="Click to change icon"
                                    >
                                        {hasImageIcon ? <img src={icon} alt="" className="w-full h-full object-cover" /> : (icon || '📚')}
                                    </div>
                                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                        <p>Click to select an emoji or upload an image</p>
                                        <p className="text-xs opacity-70">Supports emoji, PNG, JPG, or SVG (max 512KB)</p>
                                    </div>
                                </div>

                                {showIconPicker && (
                                    <div ref={iconPickerRef} className="absolute left-0 top-full mt-2 rounded-xl border shadow-2xl z-50" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', width: '400px' }}>
                                        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                            {Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setEmojiCategory(key)}
                                                    className={`flex-1 py-1.5 rounded-md text-sm transition-all ${emojiCategory === key ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]/50'}`}
                                                    title={cat.title}
                                                >{cat.label}</button>
                                            ))}
                                        </div>
                                        <div className="p-2">
                                            <div className="grid grid-cols-8 gap-0.5">
                                                {(EMOJI_CATEGORIES[emojiCategory]?.emojis || []).map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => pickIcon(emoji)}
                                                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl hover:bg-[var(--bg-tertiary)] transition-colors ${icon === emoji ? 'bg-[var(--bg-tertiary)] ring-2 ring-emerald-500' : ''}`}
                                                    >{emoji}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                            <input
                                                type="text"
                                                value={hasImageIcon ? '' : icon}
                                                onChange={(e) => setIcon(e.target.value.slice(-2) || '📚')}
                                                className="flex-1 py-1 text-center text-xl rounded border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                                placeholder="📚"
                                                maxLength={2}
                                            />
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                                                className="hidden"
                                                id="kb-icon-upload"
                                                onChange={uploadIconImage}
                                            />
                                            <button
                                                onClick={() => document.getElementById('kb-icon-upload')?.click()}
                                                className="px-3 py-1 text-xs font-medium rounded-lg flex items-center gap-1.5 border hover:bg-[var(--bg-tertiary)] transition-colors"
                                                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                                title="Upload an image as icon"
                                            >📷 Upload</button>
                                            <button
                                                onClick={() => setShowIconPicker(false)}
                                                className="px-3 py-1 text-xs font-medium rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >Done</button>
                                        </div>
                                    </div>
                                )}
                            </div>

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

                            {/* Category with inline create */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Category</label>
                                <div className="flex items-center gap-2">
                                    {!showNewCategory ? (
                                        <>
                                            <select
                                                value={categoryId || ''}
                                                onChange={e => setCategoryId(e.target.value || '')}
                                                disabled={!canManage}
                                                className="flex-1 px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60"
                                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                            >
                                                <option value="">Uncategorised</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.icon || '📚'} {c.name}</option>
                                                ))}
                                            </select>
                                            {canManage && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewCategory(true)}
                                                    className="p-2 rounded-lg border hover:bg-[var(--bg-tertiary)] transition-colors"
                                                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                                    title="Create new category"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                value={newCategoryName}
                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                                                className="flex-1 px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                                placeholder="Category name..."
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCreateCategory}
                                                disabled={!newCategoryName.trim()}
                                                className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40"
                                            >Create</button>
                                            <button
                                                type="button"
                                                onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }}
                                                className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                                style={{ color: 'var(--text-muted)' }}
                                            ><X className="w-4 h-4" /></button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Sharing summary */}
                            {!isCreateMode && (
                                <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                                    <h3 className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Sharing</h3>
                                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                        {organizationId
                                            ? (isPublished
                                                ? (sharedGroups.length > 0
                                                    ? `Published to ${sharedGroups.length} group${sharedGroups.length > 1 ? 's' : ''}.`
                                                    : 'Published to the entire organisation.')
                                                : 'Personal draft. Use the Publish button (top-right) to share.')
                                            : 'Personal KB — only you can see it.'}
                                    </div>
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
                                        >{saving ? 'Saving…' : (isCreateMode ? 'Create' : 'Save')}</button>
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
