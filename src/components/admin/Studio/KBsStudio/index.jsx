import React, { useState, useEffect, useCallback } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import KBDetailPage from '../../../KBDetailPage';

export default function KBsStudio({ user, initialKbId = null, onNavigate, hasPermission = () => true }) {
    const [kbs, setKbs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedKbId, setSelectedKbId] = useState(initialKbId || null);

    const fetchKBs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb`);
            if (res.ok) {
                const data = await res.json();
                setKbs(Array.isArray(data) ? data : (data.kbs || []));
            }
        } catch (e) { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchKBs(); }, [fetchKBs]);

    useEffect(() => {
        if (initialKbId) setSelectedKbId(initialKbId);
    }, [initialKbId]);

    const isCreating = selectedKbId === 'new';
    const isEditing = selectedKbId && selectedKbId !== 'new';

    const selectKb = (id) => {
        setSelectedKbId(id);
        if (onNavigate) onNavigate(`studio/knowledge/${id}`);
    };

    const startCreate = () => {
        setSelectedKbId('new');
        if (onNavigate) onNavigate('studio/knowledge/new');
    };

    const handleClose = () => {
        setSelectedKbId(null);
        if (onNavigate) onNavigate('studio/knowledge');
    };

    const handleSaved = async (savedKb) => {
        await fetchKBs();
        if (savedKb?.id) {
            setSelectedKbId(savedKb.id);
            if (onNavigate) onNavigate(`studio/knowledge/${savedKb.id}`);
        }
    };

    return (
        <div className="flex h-full bg-[var(--bg-primary)]">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-[var(--border-default)] flex flex-col">
                <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Knowledge Bases</span>
                    {hasPermission('manage_knowledge') && (
                        <button
                            onClick={startCreate}
                            title="New knowledge base"
                            className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
                        >
                            <Plus size={16} />
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-1.5">
                    {loading && <div className="text-xs text-[var(--text-tertiary)] p-3">…</div>}
                    {!loading && kbs.length === 0 && (
                        <div className="text-xs text-[var(--text-tertiary)] p-4 text-center">
                            No knowledge bases yet
                        </div>
                    )}
                    {/* "New KB" placeholder when in create mode */}
                    {isCreating && (
                        <div className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                            <span className="text-base flex-shrink-0">📚</span>
                            <span className="truncate flex-1 italic text-[var(--text-tertiary)]">New knowledge base</span>
                        </div>
                    )}
                    {kbs.map((kb) => {
                        const isSel = selectedKbId === kb.id;
                        const isImg = typeof kb.icon === 'string' && (kb.icon.startsWith('data:') || kb.icon.startsWith('http'));
                        return (
                            <div
                                key={kb.id}
                                onClick={() => selectKb(kb.id)}
                                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm transition ${isSel ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                            >
                                {isImg ? (
                                    <img src={kb.icon} className="w-5 h-5 rounded-sm object-cover flex-shrink-0" alt="" />
                                ) : (
                                    <span className="text-base flex-shrink-0">{kb.icon || '📚'}</span>
                                )}
                                <span className="truncate flex-1">{kb.name}</span>
                                {(kb.doc_count > 0 || kb.document_count > 0) && (
                                    <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">
                                        {kb.doc_count || kb.document_count}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </aside>

            {/* Content */}
            <section className="flex-1 min-w-0 overflow-y-auto">
                {!selectedKbId && (
                    <EmptyState onCreate={startCreate} canCreate={hasPermission('manage_knowledge')} />
                )}
                {(isCreating || isEditing) && (
                    <KBDetailPage
                        key={selectedKbId}
                        kbId={isCreating ? null : selectedKbId}
                        user={user}
                        onClose={handleClose}
                        onSaved={handleSaved}
                    />
                )}
            </section>
        </div>
    );
}

function EmptyState({ onCreate, canCreate }) {
    return (
        <div className="h-full flex flex-col items-center justify-center px-6 py-12">
            <BookOpen size={32} className="mb-4" style={{ color: 'var(--accent-primary)', opacity: 0.5 }} />
            <div className="text-lg font-semibold text-[var(--text-primary)] mb-2">Knowledge Bases</div>
            <div className="text-sm text-[var(--text-tertiary)] mb-6 max-w-md text-center leading-relaxed">
                Store documents, web pages, and text that your agents can reference in conversations.
                Create a knowledge base to get started.
            </div>
            {canCreate && (
                <button
                    onClick={onCreate}
                    className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    <Plus size={15} />
                    New Knowledge Base
                </button>
            )}
        </div>
    );
}
