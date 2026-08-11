import React, { useState } from 'react';
import useKnowledgeBases from '../../../../hooks/useKnowledgeBases';
import { API_BASE } from '../../../../utils/helpers';
import GoogleDrivePicker from '../../../chat/GoogleDrivePicker';
import CreateKBModal from '../../../knowledge/CreateKBModal';
import KBIngestPanel from '../../../knowledge/KBIngestPanel';

/**
 * Standalone Knowledge Bases management section for the Agent Designer.
 * Full CRUD + document management + ingestion — independent of any agent context.
 * KB data/handlers come from the shared useKnowledgeBases hook; this file owns
 * the admin-specific chrome (search filter, rename inline editor, isReadonly
 * guards, stronger delete confirmations).
 */
const KnowledgeBasesSection = ({ isReadonly }) => {
    const kb = useKnowledgeBases({
        deleteKBConfirm: 'Delete this knowledge base and all its documents? This action cannot be undone.',
        deleteDocConfirm: 'Delete this document and all its chunks?',
        enableDrive: true,
        enableAzureInfo: true,
    });

    // ── Search/Filter (admin-only chrome) ────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const filteredKBs = searchQuery.trim()
        ? kb.kbs.filter(k => k.name.toLowerCase().includes(searchQuery.toLowerCase()) || (k.description || '').toLowerCase().includes(searchQuery.toLowerCase()))
        : kb.kbs;

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
        <div className="space-y-6 animate-fadeIn" data-testid="kb-manager" data-tour="agent-knowledge">
            {/* Google Drive Picker Modal */}
            <GoogleDrivePicker
                isOpen={kb.drivePickerOpen}
                onClose={() => kb.setDrivePickerOpen(false)}
                onFilesSelected={kb.ingestDriveFiles}
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
                        <button onClick={kb.openCreateKB}
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
                {kb.showCreateKB && !isReadonly && (
                    <CreateKBModal
                        name={kb.newKBName} onNameChange={kb.setNewKBName}
                        description={kb.newKBDesc} onDescChange={kb.setNewKBDesc}
                        creating={kb.creatingKB} onCreate={kb.createKB} onCancel={kb.cancelCreateKB}
                        title="Create Knowledge Base"
                        namePlaceholder="Knowledge base name (e.g. Product Documentation)"
                        className="p-4 rounded-xl border bg-[var(--bg-tertiary)] border-[var(--border-default)] space-y-3 mb-4 animate-fadeIn"
                    />
                )}

                {/* KB List */}
                {kb.loadingKbs ? (
                    <div className="text-center py-12 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <div className="spinner-sm mx-auto mb-2"></div>
                        Loading knowledge bases...
                    </div>
                ) : filteredKBs.length === 0 ? (
                    <div className="text-center py-12 text-xs rounded-xl border-2 border-dashed"
                        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                        <span className="text-3xl block mb-3">📚</span>
                        {searchQuery ? 'No knowledge bases match your search.' : `No knowledge bases yet. Create one to get started with ${kb.useAzureKB ? 'Azure OpenAI' : 'bge-m3'} embeddings + hybrid search.`}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredKBs.map(item => {
                            const isSelected = kb.selectedKB?.id === item.id;
                            const isEditing = kb.editingKB === item.id;
                            return (
                                <div key={item.id}
                                    className={`rounded-xl border group transition-all ${isSelected ? 'ring-2 ring-[var(--accent-primary)] border-transparent' : 'hover:border-[var(--border-hover)]'}`}
                                    style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                                    {/* KB Header Row */}
                                    <div className="p-3 cursor-pointer" onClick={() => kb.setSelectedKB(isSelected ? null : item)}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                                                    style={{ background: isSelected ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)' }}>
                                                    📚
                                                </div>
                                                <div className="min-w-0">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                            <input value={kb.editName} onChange={e => kb.setEditName(e.target.value)}
                                                                className="px-2 py-1 rounded border text-sm font-medium"
                                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                                autoFocus />
                                                            <button onClick={kb.updateKB} disabled={kb.savingEdit || !kb.editName.trim()}
                                                                className="px-2 py-1 rounded text-[10px] font-medium text-white disabled:opacity-50"
                                                                style={{ background: 'var(--accent-primary)' }}>
                                                                {kb.savingEdit ? '...' : 'Save'}
                                                            </button>
                                                            <button onClick={() => kb.setEditingKB(null)}
                                                                className="px-2 py-1 rounded text-[10px] font-medium"
                                                                style={{ color: 'var(--text-muted)' }}>Cancel</button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                                            {item.name}
                                                            {item.organization_id ? (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-400" title="Shared with organization">🏢 Org</span>
                                                            ) : (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-white/5 text-[var(--text-muted)]" title="Personal KB">👤</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] flex items-center gap-2 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                        {item.document_count || 0} docs · {item.total_chunks || 0} chunks
                                                        {item.description && <span>· {item.description}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            {!isReadonly && !isEditing && (
                                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                    {/* Edit button */}
                                                    <button onClick={() => kb.startEditKB(item)}
                                                        className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 transition-all" title="Edit KB">
                                                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    {/* Delete button */}
                                                    <button onClick={() => kb.deleteKB(item.id)}
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
                                            {kb.editingKB === item.id && (
                                                <div className="pt-3" onClick={e => e.stopPropagation()}>
                                                    <input value={kb.editDesc} onChange={e => kb.setEditDesc(e.target.value)}
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
                                                    {!isReadonly && (
                                                        <button onClick={kb.reindexKB} disabled={kb.reindexing || kb.kbDocs.length === 0}
                                                            className="text-[10px] px-2.5 py-1 rounded-full font-medium transition-all hover:bg-amber-500/15 disabled:opacity-40"
                                                            style={{ background: 'rgba(245,158,11,0.08)', color: 'rgb(245,158,11)' }}
                                                            title="Re-fetch URLs and re-embed all documents with current model">
                                                            {kb.reindexing ? '⏳ Re-indexing...' : '🔄 Re-index All'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Ingest Section */}
                                            {!isReadonly && (
                                                <KBIngestPanel kb={kb} fieldBg="var(--bg-secondary)" />
                                            )}

                                            {/* Documents List */}
                                            <div>
                                                <h5 className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                                                    Documents ({kb.kbDocs.length})
                                                </h5>
                                                {kb.kbDocs.length === 0 ? (
                                                    <div className="text-center py-6 text-xs rounded-lg border border-dashed"
                                                        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                                        No documents yet. {!isReadonly && 'Ingest text, files, or URLs above.'}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                                        {kb.kbDocs.map(doc => (
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
                                                                    <button onClick={() => kb.deleteDoc(doc.id)}
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
