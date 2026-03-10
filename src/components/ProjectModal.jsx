import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Users, UserPlus, FolderOpen, Palette, Share2, Database, ChevronDown, ChevronRight, FileText, Globe, Upload, Paperclip, Brain } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import MemoryPanel from './MemoryPanel';

const COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const ICONS = ['📁', '🚀', '💡', '🎯', '📊', '🔬', '🎨', '📝', '🏗️', '⚡', '🌟', '🔧'];

export default function ProjectModal({ project, onClose, onSaved, onDeleted, users = [], groups = [] }) {
    const [name, setName] = useState(project?.name || '');
    const [description, setDescription] = useState(project?.description || '');
    const [customInstructions, setCustomInstructions] = useState(project?.customInstructions || '');
    const [extractMemories, setExtractMemories] = useState(project?.extractMemories || false);
    const [color, setColor] = useState(project?.color || '#6366f1');
    const [icon, setIcon] = useState(project?.icon || '📁');
    const [shares, setShares] = useState([]);
    const [knowledgeBaseIds, setKnowledgeBaseIds] = useState(project?.knowledgeBaseIds || []);
    const [availableKBs, setAvailableKBs] = useState([]);
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState('general');
    const [shareType, setShareType] = useState('user');
    const [shareId, setShareId] = useState('');
    const [sharePermission, setSharePermission] = useState('view');
    const nameRef = useRef(null);

    // KB management state
    const [showCreateKB, setShowCreateKB] = useState(false);
    const [newKBName, setNewKBName] = useState('');
    const [newKBDesc, setNewKBDesc] = useState('');
    const [creatingKB, setCreatingKB] = useState(false);
    const [selectedKB, setSelectedKB] = useState(null);
    const [kbDocs, setKbDocs] = useState([]);
    const [kbInputMode, setKbInputMode] = useState('text');
    const [kbTextContent, setKbTextContent] = useState('');
    const [kbTextTitle, setKbTextTitle] = useState('');
    const [kbUrlInput, setKbUrlInput] = useState('');
    const [kbIngesting, setKbIngesting] = useState(false);
    const [kbIngestStatus, setKbIngestStatus] = useState('');

    const isEdit = !!project?.id;

    useEffect(() => {
        if (isEdit) loadShares();
        loadKBs();
        setTimeout(() => nameRef.current?.focus(), 100);
    }, []);

    const loadKBs = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/kb`);
            if (res.ok) setAvailableKBs(await res.json());
        } catch (e) { console.error('Failed to load KBs:', e); }
    };

    const loadShares = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/projects/${project.id}`);
            if (res.ok) {
                const data = await res.json();
                setShares(data.shares || []);
            }
        } catch (e) { console.error('Failed to load shares:', e); }
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const body = { name: name.trim(), description, customInstructions, color, icon, knowledgeBaseIds, extractMemories };
            const url = isEdit ? `${API_BASE}/api/projects/${project.id}` : `${API_BASE}/api/projects`;
            const method = isEdit ? 'PUT' : 'POST';
            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                const data = await res.json();
                onSaved?.(data);
                onClose();
            }
        } catch (e) { console.error('Save project failed:', e); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!isEdit) return;
        if (!confirm('Delete this project? Chats will be unassigned but not deleted.')) return;
        try {
            await authFetch(`${API_BASE}/api/projects/${project.id}`, { method: 'DELETE' });
            onDeleted?.(project.id);
            onClose();
        } catch (e) { console.error('Delete project failed:', e); }
    };

    const handleShare = async () => {
        if (!shareId) return;
        try {
            const res = await authFetch(`${API_BASE}/api/projects/${project.id}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sharedWithType: shareType, sharedWithId: shareId, permission: sharePermission }),
            });
            if (res.ok) {
                const data = await res.json();
                setShares(data.shares || []);
                setShareId('');
            }
        } catch (e) { console.error('Share failed:', e); }
    };

    const handleUnshare = async (shareRecordId) => {
        try {
            const res = await authFetch(`${API_BASE}/api/projects/${project.id}/share/${shareRecordId}`, { method: 'DELETE' });
            if (res.ok) {
                const data = await res.json();
                setShares(data.shares || []);
            }
        } catch (e) { console.error('Unshare failed:', e); }
    };

    const resolveShareName = (share) => {
        if (share.sharedWithType === 'user') {
            const u = users.find(u => u.id === share.sharedWithId);
            return u ? (u.displayName || u.username) : share.sharedWithId.slice(0, 8);
        } else {
            const g = groups.find(g => g.id === share.sharedWithId);
            return g ? g.name : share.sharedWithId.slice(0, 8);
        }
    };

    // ── KB Management ────────────────────────────────────────────
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
                loadKBs();
                setSelectedKB(kb);
                // Auto-link new KB to this project
                setKnowledgeBaseIds(prev => [...prev, kb.id]);
            }
        } catch (e) { console.error('Failed to create KB:', e); }
        finally { setCreatingKB(false); }
    };

    const deleteKB = async (kbId) => {
        if (!confirm('Delete this knowledge base and all its documents?')) return;
        try {
            await authFetch(`${API_BASE}/api/kb/${kbId}`, { method: 'DELETE' });
            if (selectedKB?.id === kbId) { setSelectedKB(null); setKbDocs([]); }
            setKnowledgeBaseIds(prev => prev.filter(id => id !== kbId));
            loadKBs();
        } catch (e) { console.error('Failed to delete KB:', e); }
    };

    const fetchKBDocs = async (kbId) => {
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/documents`);
            if (res.ok) setKbDocs(await res.json());
        } catch (e) { console.error('Failed to fetch docs:', e); }
    };

    const deleteDoc = async (docId) => {
        if (!selectedKB || !confirm('Delete this document?')) return;
        try {
            await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/documents/${docId}`, { method: 'DELETE' });
            fetchKBDocs(selectedKB.id);
            loadKBs();
        } catch (e) { console.error('Failed to delete doc:', e); }
    };

    useEffect(() => {
        if (selectedKB) fetchKBDocs(selectedKB.id);
    }, [selectedKB?.id]);

    const toggleKBLink = (kbId) => {
        setKnowledgeBaseIds(prev =>
            prev.includes(kbId) ? prev.filter(id => id !== kbId) : [...prev, kbId]
        );
    };

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
                fetchKBDocs(selectedKB.id); loadKBs();
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
                fetchKBDocs(selectedKB.id); loadKBs();
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
                fetchKBDocs(selectedKB.id); loadKBs();
            } else {
                const err = await res.json();
                setKbIngestStatus(''); alert('Error: ' + err.error);
            }
        } catch (e2) { setKbIngestStatus(''); alert('Failed: ' + e2.message); }
        finally { setKbIngesting(false); e.target.value = ''; }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: color + '18' }}>
                            {icon}
                        </div>
                        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                            {isEdit ? 'Edit Project' : 'New Project'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                        <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                </div>

                {/* Tabs */}
                {isEdit && (
                    <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        {[{ id: 'general', label: 'General', icon: FolderOpen }, { id: 'sharing', label: 'Sharing', icon: Share2 }, { id: 'memories', label: 'Memories', icon: Brain }].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${tab === t.id ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                            >
                                <t.icon className="w-4 h-4" />
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Body */}
                <div className={`px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar ${tab === 'memories' ? 'px-0 py-0 overflow-hidden min-h-[500px]' : ''}`}>
                    {tab === 'general' && (
                        <>
                            {/* Name */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Project Name</label>
                                <input
                                    ref={nameRef}
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Marketing Campaign Q2"
                                    className="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
                                <input
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Brief description..."
                                    className="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            {/* Custom Instructions */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Custom Instructions</label>
                                <textarea
                                    value={customInstructions}
                                    onChange={e => setCustomInstructions(e.target.value)}
                                    placeholder="Instructions for AI in all chats within this project..."
                                    rows={3}
                                    className="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none resize-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                />
                                <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                    These instructions will be applied to every chat started within this project.
                                </p>
                            </div>

                            {/* Extract Memories */}
                            <label className="flex items-start gap-2.5 cursor-pointer mt-2 p-3 rounded-xl border border-dashed transition-colors hover:bg-[var(--bg-tertiary)]" style={{ borderColor: 'var(--border-subtle)' }}>
                                <input
                                    type="checkbox"
                                    checked={extractMemories}
                                    onChange={e => setExtractMemories(e.target.checked)}
                                    className="mt-0.5 rounded text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] border-[var(--border-default)]"
                                    style={{ background: 'var(--bg-primary)' }}
                                />
                                <div>
                                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Extract Project Memories</div>
                                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                        Automatically learn and recall user facts from conversations within this project context.
                                    </div>
                                </div>
                            </label>

                            {/* ═══ Knowledge Bases — Full Management ═══ */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        <Database className="w-3.5 h-3.5" />Knowledge Bases
                                    </label>
                                    <button
                                        onClick={() => setShowCreateKB(!showCreateKB)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-white transition-all hover:brightness-110"
                                        style={{ background: 'var(--accent-primary)' }}
                                    >
                                        <Plus className="w-3 h-3" />Create KB
                                    </button>
                                </div>

                                {/* Create KB Form */}
                                {showCreateKB && (
                                    <div className="p-3 rounded-xl border mb-3 space-y-2 animate-in slide-in-from-top-2 duration-200" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                                        <input
                                            value={newKBName}
                                            onChange={e => setNewKBName(e.target.value)}
                                            placeholder="KB Name (e.g. Product Docs)"
                                            autoFocus
                                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        />
                                        <input
                                            value={newKBDesc}
                                            onChange={e => setNewKBDesc(e.target.value)}
                                            placeholder="Description (optional)"
                                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={() => { setShowCreateKB(false); setNewKBName(''); setNewKBDesc(''); }}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--bg-secondary)]"
                                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                            >Cancel</button>
                                            <button
                                                onClick={createKB}
                                                disabled={creatingKB || !newKBName.trim()}
                                                className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-all hover:brightness-110"
                                                style={{ background: 'var(--accent-primary)' }}
                                            >
                                                {creatingKB ? 'Creating...' : 'Create'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* KB List */}
                                {availableKBs.length === 0 ? (
                                    <div className="text-center py-4 text-xs rounded-xl border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                        No knowledge bases yet. Create one to get started.
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                                        {availableKBs.map(kb => {
                                            const isLinked = knowledgeBaseIds.includes(kb.id);
                                            const isExpanded = selectedKB?.id === kb.id;
                                            return (
                                                <div key={kb.id}>
                                                    <div
                                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all group ${isExpanded ? 'ring-2 ring-[var(--accent-primary)]/40' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                                        style={{ background: isExpanded ? 'var(--bg-tertiary)' : (isLinked ? 'var(--bg-tertiary)' : 'transparent') }}
                                                        onClick={() => setSelectedKB(isExpanded ? null : kb)}
                                                    >
                                                        {isExpanded
                                                            ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                                                            : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                                                        }
                                                        <input
                                                            type="checkbox"
                                                            checked={isLinked}
                                                            onChange={(e) => { e.stopPropagation(); toggleKBLink(kb.id); }}
                                                            className="rounded flex-shrink-0"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>📚 {kb.name}</div>
                                                            <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                                                {kb.document_count || 0} docs · {kb.total_chunks || 0} chunks
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); deleteKB(kb.id); }}
                                                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all flex-shrink-0"
                                                            title="Delete KB"
                                                        >
                                                            <Trash2 className="w-3 h-3 text-red-500" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Selected KB — Ingest + Documents */}
                                {selectedKB && (
                                    <div className="mt-3 p-3 rounded-xl border space-y-3 animate-in slide-in-from-top-1 duration-150" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                📚 {selectedKB.name}
                                            </h4>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(16,185,129,0.08)', color: 'rgb(16,185,129)' }}>bge-m3</span>
                                        </div>

                                        {/* Ingest mode tabs */}
                                        <div className="flex gap-1 p-0.5 rounded-lg w-fit" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                                            {[{ id: 'text', label: '📝 Text', icon: FileText }, { id: 'url', label: '🌐 URL', icon: Globe }].map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setKbInputMode(t.id)}
                                                    className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${kbInputMode === t.id
                                                        ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}
                                                >
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Text input */}
                                        {kbInputMode === 'text' && (
                                            <div className="space-y-2">
                                                <input
                                                    value={kbTextTitle}
                                                    onChange={e => setKbTextTitle(e.target.value)}
                                                    placeholder="Title (optional)"
                                                    className="w-full px-3 py-1.5 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                                    style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                />
                                                <textarea
                                                    value={kbTextContent}
                                                    onChange={e => setKbTextContent(e.target.value)}
                                                    placeholder="Paste text content here..."
                                                    rows={3}
                                                    className="w-full px-3 py-1.5 rounded-lg border text-xs outline-none resize-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                                    style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                />
                                            </div>
                                        )}

                                        {/* URL input */}
                                        {kbInputMode === 'url' && (
                                            <input
                                                type="url"
                                                value={kbUrlInput}
                                                onChange={e => setKbUrlInput(e.target.value)}
                                                placeholder="https://example.com/page"
                                                className="w-full px-3 py-1.5 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                onKeyDown={e => { if (e.key === 'Enter' && !kbIngesting) ingestUrl(); }}
                                            />
                                        )}

                                        {/* Action buttons */}
                                        <div className="flex gap-2 justify-end items-center">
                                            {kbIngestStatus && (
                                                <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                                                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="44" strokeDashoffset="8" />
                                                    </svg>
                                                    {kbIngestStatus}
                                                </span>
                                            )}
                                            <label className="cursor-pointer px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors hover:bg-[var(--bg-tertiary)]"
                                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                                <input type="file" accept=".pdf,.txt,.md,.docx,.csv" className="hidden" onChange={ingestFile} disabled={kbIngesting} />
                                                <Paperclip className="w-3 h-3" /> File
                                            </label>
                                            <button
                                                onClick={kbInputMode === 'url' ? ingestUrl : ingestText}
                                                disabled={kbIngesting || (kbInputMode === 'text' ? !kbTextContent.trim() : !kbUrlInput.trim())}
                                                className="px-3 py-1 rounded-lg text-[11px] font-medium text-white disabled:opacity-50 transition-all hover:brightness-110"
                                                style={{ background: 'var(--accent-primary)' }}
                                            >
                                                {kbIngesting ? 'Processing...' : 'Ingest'}
                                            </button>
                                        </div>

                                        {/* Documents list */}
                                        <div>
                                            <h5 className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                                Documents ({kbDocs.length})
                                            </h5>
                                            {kbDocs.length === 0 ? (
                                                <div className="text-center py-3 text-[11px] rounded-lg border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                                    No documents yet. Ingest text, files, or URLs above.
                                                </div>
                                            ) : (
                                                <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                                                    {kbDocs.map(doc => (
                                                        <div key={doc.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg group" style={{ background: 'var(--bg-tertiary)' }}>
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="text-xs flex-shrink-0">
                                                                    {doc.source_type === 'web' ? '🌐' : doc.source_type === 'upload' ? '📄' : '📝'}
                                                                </span>
                                                                <div className="min-w-0">
                                                                    <div className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title || 'Untitled'}</div>
                                                                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                                        {doc.chunk_count || 0} chunks · {new Date(doc.created_at).toLocaleDateString()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => deleteDoc(doc.id)}
                                                                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 flex-shrink-0 transition-opacity"
                                                            >
                                                                <X className="w-3 h-3 text-red-500" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                                    Linked KBs will be searched automatically when chatting in this project.
                                </p>
                            </div>

                            {/* Color + Icon */}
                            <div className="flex gap-6">
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Color</label>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {COLORS.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setColor(c)}
                                                className={`w-7 h-7 rounded-lg transition-all ${color === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'}`}
                                                style={{ background: c, ringColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Icon</label>
                                    <div className="flex gap-1 flex-wrap">
                                        {ICONS.map(i => (
                                            <button
                                                key={i}
                                                onClick={() => setIcon(i)}
                                                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${icon === i ? 'bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/30 scale-110' : 'hover:bg-[var(--bg-secondary)]'}`}
                                            >
                                                {i}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 'sharing' && isEdit && (
                        <>
                            {/* Add share */}
                            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Share With</label>
                                <div className="flex gap-2 mb-2">
                                    <select
                                        value={shareType}
                                        onChange={e => { setShareType(e.target.value); setShareId(''); }}
                                        className="px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="user">User</option>
                                        <option value="group">Group</option>
                                    </select>
                                    <select
                                        value={shareId}
                                        onChange={e => setShareId(e.target.value)}
                                        className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="">Select {shareType}...</option>
                                        {shareType === 'user'
                                            ? users.map(u => <option key={u.id} value={u.id}>{u.displayName || u.username}</option>)
                                            : groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)
                                        }
                                    </select>
                                    <select
                                        value={sharePermission}
                                        onChange={e => setSharePermission(e.target.value)}
                                        className="px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="view">View</option>
                                        <option value="edit">Edit</option>
                                    </select>
                                    <button
                                        onClick={handleShare}
                                        disabled={!shareId}
                                        className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
                                        style={{ background: 'var(--accent-primary)' }}
                                    >
                                        <UserPlus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Current shares */}
                            <div>
                                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    Shared With ({shares.length})
                                </label>
                                {shares.length === 0 ? (
                                    <p className="text-sm py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                                        Not shared with anyone yet
                                    </p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {shares.map(s => (
                                            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                                                <div className="flex items-center gap-2">
                                                    {s.sharedWithType === 'group' ? <Users className="w-4 h-4 text-[var(--text-tertiary)]" /> : <UserPlus className="w-4 h-4 text-[var(--text-tertiary)]" />}
                                                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{resolveShareName(s)}</span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium">{s.permission}</span>
                                                </div>
                                                <button onClick={() => handleUnshare(s.id)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {tab === 'memories' && isEdit && (
                        <div className="w-full h-full min-h-[500px] mt-[-1.25rem] -mx-6 w-[calc(100%+3rem)]">
                            <MemoryPanel projectId={project.id} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                {tab !== 'memories' && (
                    <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div>
                        {isEdit && (
                            <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium">
                                Delete Project
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!name.trim() || saving}
                            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ background: color }}
                        >
                            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Project'}
                        </button>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}
