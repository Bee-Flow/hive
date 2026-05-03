import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Trash2, FileText, Globe, Paperclip, Settings as SettingsIcon, Loader2, Plus, X, RefreshCcw, Building2, Check, ChevronDown, ChevronRight, Search as SearchIcon } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import { useTranslation } from '../hooks/useTranslation';

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
    const { t } = useTranslation();
    const isCreateMode = !initialKbId;
    const [kbId, setKbId] = useState(initialKbId || null);
    const [kb, setKb] = useState(null);
    const [loading, setLoading] = useState(!isCreateMode);
    const [tab, setTab] = useState(isCreateMode ? 'settings' : 'documents');

    // Settings form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('📚');
    const [usageContexts, setUsageContexts] = useState(['agent', 'direct_chat']);
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

    // Chunks viewer (per-document)
    const [expandedDocId, setExpandedDocId] = useState(null);
    const [chunksByDoc, setChunksByDoc] = useState({});      // docId → { loading, chunks, remoteOnly, error }

    // Search test
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState(null);
    const [searchError, setSearchError] = useState('');

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
                setIcon(data.icon || '📚');
                // Studio surfaces only the agent + direct-chat toggles; the 'webpage'
                // context is owned by the webpage UI, so we strip it from the editable
                // value here. Existing 'webpage' entries left over from older defaults
                // are quietly removed on next save.
                const rawContexts = Array.isArray(data.usage_contexts)
                    ? data.usage_contexts
                    : (typeof data.usage_contexts === 'string'
                        ? (() => { try { const v = JSON.parse(data.usage_contexts); return Array.isArray(v) ? v : ['agent', 'direct_chat']; } catch { return ['agent', 'direct_chat']; } })()
                        : ['agent', 'direct_chat']);
                const studioContexts = rawContexts.filter(c => c === 'agent' || c === 'direct_chat');
                setUsageContexts(studioContexts.length > 0 ? studioContexts : ['agent', 'direct_chat']);
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
                        icon: icon || null,
                        categoryId: categoryId || null,
                        usageContexts,
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
                    alert(t('kb_detail.create_failed', { error: err.error || res.status }));
                }
            } else {
                const res = await authFetch(`${API_BASE}/api/kb/${kbId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name.trim(),
                        description,
                        icon: icon || null,
                        categoryId: categoryId || null,
                        usageContexts,
                    }),
                });
                if (res.ok) {
                    const updated = await res.json();
                    setKb(prev => ({ ...prev, ...updated }));
                    onSaved?.(updated);
                } else {
                    alert(t('kb_detail.save_settings_failed'));
                }
            }
        } catch (e) { alert(t('kb_detail.save_failed', { message: e.message })); }
        finally { setSaving(false); }
    }

    async function togglePublish(groups) {
        if (!kbId) return;
        const next = !isPublished;
        if (next && !organizationId) {
            alert(t('kb_detail.must_be_in_org'));
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
                alert(t('kb_detail.publish_failed', { error: err.error || res.status }));
            }
        } catch (e) { alert(t('kb_detail.publish_failed', { error: e.message })); }
        finally { setSaving(false); }
    }

    async function handleDeleteKB() {
        if (!kbId) return;
        if (!confirm(t('kb_detail.delete_confirm', { name }))) return;
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}`, { method: 'DELETE' });
            if (res.ok) { onSaved?.(null); onClose?.(); }
            else { alert(t('kb_detail.delete_failed')); }
        } catch (e) { alert(`${t('kb_detail.delete_failed')}: ${e.message}`); }
    }

    async function ingestText() {
        if (!kbId || !textContent.trim()) return;
        setIngesting(true); setIngestStatus(t('kb_docs.processing_status'));
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/ingest/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: textContent, title: textTitle || 'Text' }),
            });
            if (res.ok) { setTextContent(''); setTextTitle(''); setIngestStatus(''); refreshDocs(); }
            else { const err = await res.json().catch(() => ({})); alert(t('kb_docs.ingest_error', { error: err.error || res.status })); setIngestStatus(''); }
        } catch (e) { setIngestStatus(''); alert(t('kb_docs.ingest_failed', { message: e.message })); }
        finally { setIngesting(false); }
    }

    async function ingestUrl() {
        if (!kbId || !urlInput.trim()) return;
        setIngesting(true);
        const isSitemap = sitemapMode;
        setIngestStatus(isSitemap ? t('kb_docs.crawling_sitemap') : t('kb_docs.fetching_url'));
        try {
            const endpoint = isSitemap ? `${API_BASE}/api/kb/${kbId}/ingest/sitemap` : `${API_BASE}/api/kb/${kbId}/ingest/url`;
            const body = isSitemap ? { url: urlInput.trim(), maxPages: sitemapMaxPages } : { url: urlInput.trim() };
            const res = await authFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) { setUrlInput(''); setIngestStatus(''); refreshDocs(); }
            else { const err = await res.json().catch(() => ({})); alert(t('kb_docs.ingest_error', { error: err.error || res.status })); setIngestStatus(''); }
        } catch (e) { setIngestStatus(''); alert(t('kb_docs.ingest_failed', { message: e.message })); }
        finally { setIngesting(false); }
    }

    async function ingestFile(e) {
        const file = e.target.files?.[0];
        if (!file || !kbId) return;
        setIngesting(true); setIngestStatus(t('kb_docs.uploading'));
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/ingest/file`, { method: 'POST', body: formData });
            if (res.ok) { setIngestStatus(''); refreshDocs(); }
            else { const err = await res.json().catch(() => ({})); alert(t('kb_docs.ingest_error', { error: err.error || res.status })); setIngestStatus(''); }
        } catch (e2) { setIngestStatus(''); alert(t('kb_docs.ingest_failed', { message: e2.message })); }
        finally { setIngesting(false); e.target.value = ''; }
    }

    async function ingestN8n(workflowId) {
        if (!kbId || !workflowId) return;
        setIngesting(true); setIngestStatus(t('kb_docs.ingesting_workflow'));
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/ingest/n8n`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflowId, mode: n8nIngestMode }),
            });
            if (res.ok) {
                const data = await res.json();
                setIngestStatus(t('kb_docs.ingest_done', { chunks: data.chunks || 0 }));
                refreshDocs();
                setTimeout(() => setIngestStatus(''), 5000);
            } else {
                const err = await res.json().catch(() => ({}));
                setIngestStatus(''); alert(t('kb_docs.ingest_error', { error: err.error || res.status }));
            }
        } catch (e) { setIngestStatus(''); alert(t('kb_docs.ingest_failed', { message: e.message })); }
        finally { setIngesting(false); }
    }

    async function reindexKB() {
        if (!kbId) return;
        if (!confirm(t('kb_docs.reindex_confirm', { name }))) return;
        setReindexing(true); setReindexStatus(t('kb_docs.reindex_starting'));
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/reindex`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
            });
            if (res.ok) {
                const data = await res.json();
                const msg = data.failed
                    ? t('kb_docs.reindex_done_failed', { reindexed: data.reindexed, total: data.total, failed: data.failed })
                    : t('kb_docs.reindex_done', { reindexed: data.reindexed, total: data.total });
                setReindexStatus(msg);
                refreshDocs();
                setTimeout(() => setReindexStatus(''), 8000);
            } else {
                const err = await res.json().catch(() => ({}));
                setReindexStatus(''); alert(t('kb_docs.reindex_failed', { error: err.error || res.status }));
            }
        } catch (e) { setReindexStatus(''); alert(t('kb_docs.reindex_failed', { error: e.message })); }
        finally { setReindexing(false); }
    }

    async function deleteDoc(docId) {
        if (!kbId) return;
        if (!confirm(t('kb_docs.delete_confirm'))) return;
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) {
                refreshDocs();
                setChunksByDoc(prev => { const next = { ...prev }; delete next[docId]; return next; });
                if (expandedDocId === docId) setExpandedDocId(null);
            }
        } catch (e) { /* ignore */ }
    }

    async function toggleDocChunks(docId) {
        if (expandedDocId === docId) {
            setExpandedDocId(null);
            return;
        }
        setExpandedDocId(docId);
        if (chunksByDoc[docId]?.chunks) return; // cached
        setChunksByDoc(prev => ({ ...prev, [docId]: { loading: true, chunks: [], remoteOnly: false } }));
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/documents/${docId}/chunks`);
            if (res.ok) {
                const data = await res.json();
                setChunksByDoc(prev => ({ ...prev, [docId]: { loading: false, chunks: data.chunks || [], remoteOnly: !!data.remote_only } }));
            } else {
                const err = await res.json().catch(() => ({}));
                setChunksByDoc(prev => ({ ...prev, [docId]: { loading: false, chunks: [], error: err.error || `HTTP ${res.status}` } }));
            }
        } catch (e) {
            setChunksByDoc(prev => ({ ...prev, [docId]: { loading: false, chunks: [], error: e.message } }));
        }
    }

    async function runSearch() {
        if (!kbId || !searchQuery.trim()) return;
        setSearching(true);
        setSearchError('');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kb_ids: [kbId], query: searchQuery.trim(), top_k: 8 }),
            });
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
            } else {
                const err = await res.json().catch(() => ({}));
                setSearchError(err.error || `HTTP ${res.status}`);
                setSearchResults(null);
            }
        } catch (e) {
            setSearchError(e.message);
            setSearchResults(null);
        } finally {
            setSearching(false);
        }
    }

    function toggleGroup(gid) {
        setSharedGroups(prev => prev.includes(gid) ? prev.filter(g => g !== gid) : [...prev, gid]);
    }

    function toggleUsageContext(ctx) {
        setUsageContexts(prev => {
            const next = prev.includes(ctx) ? prev.filter(c => c !== ctx) : [...prev, ctx];
            // Keep at least one context selected so the KB stays reachable somewhere.
            return next.length > 0 ? next : prev;
        });
    }

    function pickIcon(emoji) {
        setIcon(emoji);
        setShowIconPicker(false);
    }

    function uploadIconImage(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 512 * 1024) {
            alert(t('kb_detail.icon_too_large'));
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
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('kb_detail.not_found')}</p>
                <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{t('kb_detail.back')}</button>
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
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]" title={t('kb_detail.back')}>
                                <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            </button>
                        )}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 overflow-hidden" style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-primary)' }}>
                            {hasImageIcon ? <img src={icon} alt="" className="w-full h-full object-cover" /> : (icon || <BookOpen className="w-5 h-5" />)}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                {isCreateMode ? t('kb_detail.new_title') : (name || t('kb_detail.untitled'))}
                            </h1>
                            {!isCreateMode && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {t('kb_detail.documents_chunks', { docs: (kb?.document_count ?? docs.length) || 0, chunks: kb?.total_chunks || 0 })}
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
                                        {sharedGroups.length > 0 ? t('kb_detail.published_n_groups', { count: sharedGroups.length }) : t('kb_detail.published')}
                                    </>
                                ) : (
                                    <>{t('kb_detail.publish')} <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></>
                                )}
                            </button>

                            {showPublishMenu && !isPublished && (
                                <div
                                    className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-2xl z-50 overflow-hidden"
                                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}
                                >
                                    <div className="p-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('kb_detail.publish_to')}</p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('kb_detail.publish_choose_who')}</p>
                                    </div>

                                    <button
                                        onClick={() => togglePublish([])}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
                                            <Building2 className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('kb_detail.entire_org')}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('kb_detail.entire_org_desc')}</p>
                                        </div>
                                    </button>

                                    {orgGroups.length > 0 && (
                                        <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('kb_detail.or_specific_groups')}</p>
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
                                                {sharedGroups.length > 1
                                                    ? t('kb_detail.publish_to_n_groups_plural', { count: sharedGroups.length })
                                                    : t('kb_detail.publish_to_n_groups', { count: sharedGroups.length })}
                                            </button>
                                        </div>
                                    )}

                                    <div className="p-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                        <button
                                            onClick={() => setShowPublishMenu(false)}
                                            className="w-full px-3 py-1.5 rounded-lg text-xs text-center"
                                            style={{ color: 'var(--text-muted)' }}
                                        >{t('kb_detail.cancel')}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b -mb-px" style={{ borderColor: 'var(--border-subtle)' }}>
                    {[
                        { id: 'documents', label: t('kb_detail.tab_documents'), icon: FileText, disabled: isCreateMode },
                        { id: 'search', label: t('kb_detail.tab_search'), icon: SearchIcon, disabled: isCreateMode },
                        { id: 'settings', label: t('kb_detail.tab_settings'), icon: SettingsIcon },
                    ].map(tabDef => (
                        <button
                            key={tabDef.id}
                            onClick={() => !tabDef.disabled && setTab(tabDef.id)}
                            disabled={tabDef.disabled}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${tab === tabDef.id ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'} ${tabDef.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            <tabDef.icon className="w-4 h-4" />
                            {tabDef.label}
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
                                    <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('kb_docs.heading', { count: docs.length })}</h3>
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
                                            title={t('kb_docs.reindex_title')}
                                        >
                                            <RefreshCcw className={`w-3 h-3 ${reindexing ? 'animate-spin' : ''}`} />
                                            {reindexing ? t('kb_docs.reindexing') : t('kb_docs.reindex')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Ingest controls */}
                            {canManage && (
                                <div className="p-3 rounded-xl border space-y-3" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('kb_docs.add_source')}</h3>
                                        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                            {[
                                                { id: 'text', label: t('kb_docs.tab_text') },
                                                { id: 'url', label: t('kb_docs.tab_url') },
                                                { id: 'n8n', label: t('kb_docs.tab_n8n') },
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
                                            <div>
                                                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('kb_docs.doc_title_label')}</label>
                                                <input
                                                    value={textTitle}
                                                    onChange={e => setTextTitle(e.target.value)}
                                                    placeholder={t('kb_docs.doc_title_placeholder')}
                                                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('kb_docs.doc_content_label')}</label>
                                                <textarea
                                                    value={textContent}
                                                    onChange={e => setTextContent(e.target.value)}
                                                    placeholder={t('kb_docs.text_placeholder')}
                                                    rows={4}
                                                    className="w-full px-3 py-2 rounded-lg border text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {ingestMode === 'url' && (
                                        <div className="space-y-2">
                                            <input
                                                type="url"
                                                value={urlInput}
                                                onChange={e => setUrlInput(e.target.value)}
                                                placeholder={sitemapMode ? t('kb_docs.sitemap_placeholder') : t('kb_docs.url_placeholder')}
                                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                                onKeyDown={e => { if (e.key === 'Enter' && !ingesting) ingestUrl(); }}
                                            />
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                                                    <input type="checkbox" checked={sitemapMode} onChange={e => setSitemapMode(e.target.checked)} className="rounded" />
                                                    {t('kb_docs.sitemap_toggle')}
                                                </label>
                                                {sitemapMode && (
                                                    <div className="flex items-center gap-1.5 ml-3" style={{ color: 'var(--text-muted)' }}>
                                                        {t('kb_docs.sitemap_max_pages')}
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
                                                >{t('kb_docs.n8n_data')}</button>
                                                <button
                                                    onClick={() => setN8nIngestMode('definition')}
                                                    className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-md transition-all ${n8nIngestMode === 'definition' ? 'bg-[var(--bg-primary)] shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                                                    style={{ color: n8nIngestMode === 'definition' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                                                >{t('kb_docs.n8n_definition')}</button>
                                            </div>
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                {n8nWorkflows.length === 0 ? (
                                                    <div className="text-xs p-3 text-center rounded border border-dashed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                                                        {t('kb_docs.n8n_empty')}
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
                                                            >{n8nIngestMode === 'data' ? t('kb_docs.n8n_execute') : t('kb_docs.n8n_ingest')}</button>
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
                                                    <Paperclip className="w-3.5 h-3.5" /> {t('kb_docs.upload_file')}
                                                </label>
                                                <button
                                                    onClick={ingestMode === 'url' ? ingestUrl : ingestText}
                                                    disabled={ingesting || (ingestMode === 'text' ? !textContent.trim() : !urlInput.trim())}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 hover:brightness-110"
                                                    style={{ background: 'var(--accent-primary)' }}
                                                >{ingesting ? t('kb_docs.processing') : t('kb_docs.add')}</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Documents list */}
                            <div>
                                {docs.length === 0 ? (
                                    <div className="text-center py-10 text-xs rounded-xl border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                        {t('kb_docs.empty')}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {docs.map(doc => {
                                            const isOpen = expandedDocId === doc.id;
                                            const docChunks = chunksByDoc[doc.id];
                                            return (
                                                <div key={doc.id} className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                    <div className="flex items-center justify-between px-3 py-2 group hover:bg-[var(--bg-tertiary)]">
                                                        <button
                                                            onClick={() => toggleDocChunks(doc.id)}
                                                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                                                            title={t('kb_docs.view_chunks')}
                                                        >
                                                            {isOpen ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />}
                                                            <span className="text-base flex-shrink-0">{sourceEmoji(doc.source_type)}</span>
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title || t('kb_detail.untitled')}</div>
                                                                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                                    {doc.chunk_count || 0} chunks · {formatDate(doc.created_at)}
                                                                    {doc.source_uri && <span className="ml-1.5 truncate">· {doc.source_uri.replace(/^https?:\/\//, '').slice(0, 40)}</span>}
                                                                </div>
                                                            </div>
                                                        </button>
                                                        {canManage && (
                                                            <button onClick={() => deleteDoc(doc.id)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10" title="Delete">
                                                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {isOpen && (
                                                        <div className="px-3 py-2.5 border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                                            {docChunks?.loading && (
                                                                <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                                    <Loader2 className="w-3 h-3 animate-spin" /> {t('kb_docs.chunks_loading')}
                                                                </div>
                                                            )}
                                                            {docChunks?.error && (
                                                                <div className="text-[11px] text-red-500">{docChunks.error}</div>
                                                            )}
                                                            {!docChunks?.loading && !docChunks?.error && (docChunks?.chunks || []).length === 0 && (
                                                                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                                    {docChunks?.remoteOnly ? t('kb_docs.chunks_remote_only') : t('kb_docs.chunks_empty')}
                                                                </div>
                                                            )}
                                                            {(docChunks?.chunks || []).length > 0 && (
                                                                <div className="space-y-1.5">
                                                                    <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                                                        {t('kb_docs.chunks_heading', { count: docChunks.chunks.length })}
                                                                    </div>
                                                                    {docChunks.chunks.map((c, idx) => (
                                                                        <div key={`${doc.id}-${c.chunk_id ?? idx}`} className="rounded-lg p-2.5 text-[12px] whitespace-pre-wrap font-mono" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', maxHeight: '320px', overflow: 'auto' }}>
                                                                            <div className="flex items-center gap-2 mb-1.5 font-sans">
                                                                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>#{c.chunk_id ?? idx}</span>
                                                                                {c.chunk_type && c.chunk_type !== 'content' && (
                                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{c.chunk_type}</span>
                                                                                )}
                                                                                {c.lang && c.lang !== 'unknown' && (
                                                                                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.lang}</span>
                                                                                )}
                                                                            </div>
                                                                            {c.content}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Search tab — test what the agent retrieves from this KB */}
                    {tab === 'search' && !isCreateMode && (
                        <div className="space-y-4">
                            <div className="p-3 rounded-xl border space-y-3" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                                <div>
                                    <h3 className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('kb_search.title')}</h3>
                                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('kb_search.subtitle')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                        <input
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !searching) runSearch(); }}
                                            placeholder={t('kb_search.placeholder')}
                                            className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <button
                                        onClick={runSearch}
                                        disabled={searching || !searchQuery.trim()}
                                        className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 hover:brightness-110 flex items-center gap-1.5"
                                        style={{ background: 'var(--accent-primary)' }}
                                    >
                                        {searching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                        {searching ? t('kb_search.searching') : t('kb_search.run')}
                                    </button>
                                </div>
                            </div>

                            {searchError && (
                                <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                                    {searchError}
                                </div>
                            )}

                            {searchResults && (() => {
                                const chunks = searchResults.chunks || searchResults.results || [];
                                const metrics = chunks._metrics || searchResults._metrics;
                                return (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                                {t('kb_search.results_heading', { count: chunks.length })}
                                            </h3>
                                            {metrics && (
                                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                    {t('kb_search.metrics', {
                                                        ms: metrics.latencyMs ?? '?',
                                                        vec: metrics.vecCandidates ?? 0,
                                                        fts: metrics.ftsCandidates ?? 0,
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                        {chunks.length === 0 ? (
                                            <div className="text-center py-10 text-xs rounded-xl border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                                {t('kb_search.empty')}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {chunks.map((c, idx) => (
                                                    <div key={c.id ?? `${c.document_id}-${c.chunk_id}-${idx}`} className="rounded-lg p-3" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>#{idx + 1}</span>
                                                                {c.title && (
                                                                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                                                                )}
                                                                {c.source_uri && (
                                                                    <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>· {c.source_uri.replace(/^https?:\/\//, '').slice(0, 50)}</span>
                                                                )}
                                                            </div>
                                                            {typeof c.score === 'number' && (
                                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-primary)' }}>
                                                                    {c.score.toFixed(3)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[12px] whitespace-pre-wrap font-mono" style={{ color: 'var(--text-primary)', maxHeight: '260px', overflow: 'auto' }}>
                                                            {c.content}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Settings tab */}
                    {tab === 'settings' && (
                        <div className="space-y-4">
                            {/* Icon + Name + Description */}
                            <div className="relative">
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('kb_detail.icon_label')}</label>
                                <div className="flex items-center gap-3">
                                    <div
                                        onClick={() => canManage && setShowIconPicker(v => !v)}
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl cursor-pointer transition-all overflow-hidden border"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                                        title={t('kb_detail.icon_hint')}
                                    >
                                        {hasImageIcon ? <img src={icon} alt="" className="w-full h-full object-cover" /> : (icon || '📚')}
                                    </div>
                                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                        <p>{t('kb_detail.icon_hint')}</p>
                                        <p className="text-xs opacity-70">{t('kb_detail.icon_supports')}</p>
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
                                                title={t('kb_detail.icon_hint')}
                                            >📷 {t('kb_detail.upload')}</button>
                                            <button
                                                onClick={() => setShowIconPicker(false)}
                                                className="px-3 py-1 text-xs font-medium rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >{t('kb_detail.done')}</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('kb_detail.name_label')}</label>
                                <input
                                    ref={nameRef}
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder={t('kb_detail.name_placeholder')}
                                    disabled={!canManage}
                                    className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('kb_detail.description_label')}</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder={t('kb_detail.description_placeholder')}
                                    rows={2}
                                    disabled={!canManage}
                                    className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none resize-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            {/* Usage contexts — where this KB shows up in pickers */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('kb_detail.usage_label')}</label>
                                <div className="rounded-xl border divide-y" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                                    {[
                                        { id: 'agent', label: t('kb_detail.usage_agents'), hint: t('kb_detail.usage_agents_hint') },
                                        { id: 'direct_chat', label: t('kb_detail.usage_direct_chat'), hint: t('kb_detail.usage_direct_chat_hint') },
                                    ].map(ctx => (
                                        <label
                                            key={ctx.id}
                                            className={`flex items-start gap-3 px-3 py-2.5 ${canManage ? 'cursor-pointer hover:bg-[var(--bg-tertiary)]' : 'opacity-60'} transition-colors`}
                                            style={{ borderColor: 'var(--border-subtle)' }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={usageContexts.includes(ctx.id)}
                                                onChange={() => toggleUsageContext(ctx.id)}
                                                disabled={!canManage}
                                                className="mt-0.5 accent-[var(--accent-primary)] w-4 h-4"
                                            />
                                            <div className="min-w-0">
                                                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{ctx.label}</div>
                                                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{ctx.hint}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Category with inline create */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('kb_detail.category_label')}</label>
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
                                                <option value="">{t('kb_detail.category_uncategorised')}</option>
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
                                                    title={t('kb_detail.category_new_title')}
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
                                                placeholder={t('kb_detail.category_new_placeholder')}
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCreateCategory}
                                                disabled={!newCategoryName.trim()}
                                                className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40"
                                            >{t('kb_detail.create')}</button>
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
                                    <h3 className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('kb_detail.sharing')}</h3>
                                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                        {organizationId
                                            ? (isPublished
                                                ? (sharedGroups.length > 1
                                                    ? t('kb_detail.sharing_groups_plural', { count: sharedGroups.length })
                                                    : (sharedGroups.length === 1
                                                        ? t('kb_detail.sharing_groups', { count: sharedGroups.length })
                                                        : t('kb_detail.sharing_org')))
                                                : t('kb_detail.sharing_draft'))
                                            : t('kb_detail.sharing_personal')}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2">
                                {!isCreateMode && canManage && (
                                    <button
                                        onClick={handleDeleteKB}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> {t('kb_detail.delete_kb')}
                                    </button>
                                )}
                                <div className="ml-auto flex gap-2">
                                    {onClose && (
                                        <button
                                            onClick={onClose}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-[var(--bg-tertiary)]"
                                            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                        >{t('kb_detail.cancel')}</button>
                                    )}
                                    {canManage && (
                                        <button
                                            onClick={handleSaveSettings}
                                            disabled={saving || !name.trim()}
                                            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 hover:brightness-110"
                                            style={{ background: 'var(--accent-primary)' }}
                                        >{saving ? t('kb_detail.saving') : (isCreateMode ? t('kb_detail.create') : t('kb_detail.save'))}</button>
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
