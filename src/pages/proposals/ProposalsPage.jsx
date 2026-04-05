import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    ArrowLeft, Plus, FileText, Trash2, Loader2, Search, X,
    MessageSquare, PanelRightClose, PanelRightOpen, LayoutTemplate,
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import ProposalEditor from './ProposalEditor';
import ProposalChat from './ProposalChat';
import TemplatePickerModal from './TemplatePickerModal';
import SaveAsTemplateModal from './SaveAsTemplateModal';
import useChatEngine from '../../hooks/useChatEngine';

/* ── Time helper ─────────────────────────────────────────────────── */
function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'zojuist';
    if (diff < 3600) return `${Math.floor(diff / 60)}m geleden`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}u geleden`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d geleden`;
    return d.toLocaleDateString('nl-NL');
}

export default function ProposalsPage({ user, onProposalChange }) {
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeProposal, setActiveProposal] = useState(null);
    const [creating, setCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [exporting, setExporting] = useState(null);
    const [showChat, setShowChat] = useState(true);
    const [modelTier, setModelTier] = useState('auto');
    const [modelTiers, setModelTiers] = useState({});
    const editorBlocksRef = useRef([]);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);

    // ── Load model tiers ──────────────────────────────────────────
    useEffect(() => {
        authFetch(`${API_BASE}/ai/config/chat-models`).then(res => res.ok && res.json()).then(data => {
            if (data) setModelTiers(data);
        }).catch(() => {});
    }, []);

    // ── Load proposals ────────────────────────────────────────────
    const loadProposals = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/proposals`);
            if (res.ok) {
                const data = await res.json();
                setProposals(data);
            }
        } catch (err) {
            console.error('[Proposals] Load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadProposals(); }, [loadProposals]);

    // ── Create proposal ───────────────────────────────────────────
    const handleCreate = async () => {
        setCreating(true);
        try {
            const res = await authFetch(`${API_BASE}/api/proposals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Nieuwe Offerte' }),
            });
            if (res.ok) {
                const proposal = await res.json();
                setProposals(prev => [proposal, ...prev]);
                openProposal(proposal);
            }
        } catch (err) {
            console.error('[Proposals] Create error:', err);
        } finally {
            setCreating(false);
        }
    };

    // ── Create from template ──────────────────────────────────────
    const handleCreateFromTemplate = async (templateId) => {
        setCreating(true);
        try {
            const res = await authFetch(`${API_BASE}/api/proposals/templates/${templateId}/use`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Nieuwe Offerte' }),
            });
            if (res.ok) {
                const proposal = await res.json();
                setProposals(prev => [proposal, ...prev]);
                openProposal(proposal);
            }
        } catch (err) {
            console.error('[Proposals] Create from template error:', err);
        } finally {
            setCreating(false);
        }
    };

    // ── Open proposal ─────────────────────────────────────────────
    const openProposal = async (proposal) => {
        try {
            const res = await authFetch(`${API_BASE}/api/proposals/${proposal.id}`);
            if (res.ok) {
                const full = await res.json();
                setActiveProposal(full);
                if (onProposalChange) onProposalChange(full.id);
            }
        } catch (err) {
            console.error('[Proposals] Open error:', err);
        }
    };

    // ── Save proposal ─────────────────────────────────────────────
    const handleSave = async (updates) => {
        if (!activeProposal) return;
        try {
            await authFetch(`${API_BASE}/api/proposals/${activeProposal.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            setActiveProposal(prev => ({ ...prev, ...updates }));
        } catch (err) {
            console.error('[Proposals] Save error:', err);
        }
    };

    // ── Delete proposal ───────────────────────────────────────────
    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Weet je zeker dat je deze offerte wilt verwijderen?')) return;
        try {
            await authFetch(`${API_BASE}/api/proposals/${id}`, { method: 'DELETE' });
            setProposals(prev => prev.filter(p => p.id !== id));
            if (activeProposal?.id === id) {
                setActiveProposal(null);
                if (onProposalChange) onProposalChange(null);
            }
        } catch (err) {
            console.error('[Proposals] Delete error:', err);
        }
    };

    // ── Back to list ──────────────────────────────────────────────
    const handleBack = () => {
        setActiveProposal(null);
        if (onProposalChange) onProposalChange(null);
        loadProposals();
    };

    // ── Chat Engine (useChatEngine with directMode + customEndpoint) ──
    const handleProposalBlocksUpdate = useCallback((blocks) => {
        // AI sent updated blocks — update the editor
        if (!blocks || !Array.isArray(blocks)) return;
        setActiveProposal(prev => {
            if (!prev) return prev;
            const updatedContent = { ...(prev.documentContent || {}), blocks };
            // Also persist
            authFetch(`${API_BASE}/api/proposals/${prev.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentContent: updatedContent }),
            }).catch(err => console.error('[Proposals] Auto-save after AI update failed:', err));
            return { ...prev, documentContent: updatedContent };
        });
    }, []);

    const getProposalPayload = useCallback(() => {
        if (!activeProposal) return {};
        return {
            proposalId: activeProposal.id,
            blocks: editorBlocksRef.current,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
    }, [activeProposal]);

    const {
        messages, isLoading: chatLoading, submittedFormIds, setSubmittedFormIds,
        sendMessage, stopGenerating, retryMessage, editMessage,
    } = useChatEngine({
        selectedAgent: null,
        currentConversation: null,
        onConversationCreated: () => {},
        getNotebookPayload: getProposalPayload,
        onNotebookDocUpdate: handleProposalBlocksUpdate,
        directMode: {
            enabled: true,
            modelTier,
            customEndpoint: '/ai/chat/proposal/stream',
        },
    });

    // ── Filter proposals ──────────────────────────────────────────
    const filtered = proposals.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ═══════════════════════════════════════════════════════════════
    // Render: Proposal Editor + Chat
    // ═══════════════════════════════════════════════════════════════
    if (activeProposal) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-primary)',
                }}>
                    <button onClick={handleBack} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
                        padding: '4px 8px', borderRadius: '6px',
                    }}>
                        <ArrowLeft size={16} /> Terug
                    </button>

                    <div style={{ height: '20px', width: '1px', background: 'var(--border-subtle)' }} />

                    {/* Editable title */}
                    <input
                        type="text"
                        value={activeProposal.name}
                        onChange={e => {
                            const name = e.target.value;
                            setActiveProposal(prev => ({ ...prev, name }));
                        }}
                        onBlur={e => handleSave({ name: e.target.value })}
                        style={{
                            flex: 1, border: 'none', background: 'transparent',
                            fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)',
                            outline: 'none',
                        }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Save as Template */}
                        <button
                            onClick={() => setShowSaveAsTemplate(true)}
                            title="Opslaan als template"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', borderRadius: '8px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-secondary)',
                                fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            <LayoutTemplate size={14} />
                            Template opslaan
                        </button>

                        {/* Chat toggle */}
                        <button
                            onClick={() => setShowChat(!showChat)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', borderRadius: '8px',
                                border: '1px solid var(--border-subtle)',
                                background: showChat ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                color: showChat ? '#fff' : 'var(--text-secondary)',
                                fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            {showChat ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                            {showChat ? 'Chat' : 'AI Chat'}
                        </button>
                    </div>
                </div>

                {/* Editor + Chat */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Editor */}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <ProposalEditor
                            proposal={activeProposal}
                            onSave={handleSave}
                            onExport={(format) => setExporting(format)}
                            exporting={exporting}
                            onBlocksChange={(blocks) => { editorBlocksRef.current = blocks; }}
                        />
                    </div>

                    {/* Chat Panel */}
                    {showChat && (
                        <div style={{
                            width: '380px', minWidth: '320px', flexShrink: 0,
                            borderLeft: '1px solid var(--border-subtle)',
                            display: 'flex', flexDirection: 'column',
                        }}>
                            <ProposalChat
                                messages={messages}
                                isLoading={chatLoading}
                                onSend={(text, attachments) => sendMessage(text, attachments)}
                                onStop={stopGenerating}
                                onRetry={retryMessage}
                                onEdit={editMessage}
                                modelTiers={modelTiers}
                                selectedTier={modelTier}
                                onTierChange={setModelTier}
                                submittedFormIds={submittedFormIds}
                                setSubmittedFormIds={setSubmittedFormIds}
                            />
                        </div>
                    )}
                </div>

                {/* Save as Template Modal */}
                <SaveAsTemplateModal
                    open={showSaveAsTemplate}
                    onClose={() => setShowSaveAsTemplate(false)}
                    proposalId={activeProposal.id}
                    proposalName={activeProposal.name}
                />
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // Render: Proposals List
    // ═══════════════════════════════════════════════════════════════
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            background: 'var(--bg-primary)',
        }}>
            {/* Header */}
            <div style={{
                padding: '24px 32px 16px',
                borderBottom: '1px solid var(--border-subtle)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                        <h1 style={{
                            fontSize: '22px', fontWeight: 700,
                            color: 'var(--text-primary)', margin: 0,
                        }}>
                            Offertes
                        </h1>
                        <p style={{
                            fontSize: '13px', color: 'var(--text-muted)',
                            margin: '4px 0 0',
                        }}>
                            Maak professionele offertes en voorstellen
                        </p>
                    </div>

                    <button
                        onClick={() => setShowTemplatePicker(true)}
                        disabled={creating}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            color: '#fff', border: 'none', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600,
                            boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                            transition: 'all 0.15s',
                            opacity: creating ? 0.7 : 1,
                        }}
                    >
                        {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                        Nieuwe Offerte
                    </button>
                </div>

                {/* Search */}
                {proposals.length > 3 && (
                    <div style={{ position: 'relative', maxWidth: '320px' }}>
                        <Search size={14} style={{
                            position: 'absolute', left: '10px', top: '50%',
                            transform: 'translateY(-50%)', color: 'var(--text-muted)',
                        }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Zoek offertes..."
                            style={{
                                width: '100%', padding: '7px 10px 7px 30px',
                                borderRadius: '8px', border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-secondary)', fontSize: '13px',
                                color: 'var(--text-primary)', outline: 'none',
                            }}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{
                                position: 'absolute', right: '8px', top: '50%',
                                transform: 'translateY(-50%)', background: 'none',
                                border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                            }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 32px' }}>
                {loading ? (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: '200px', color: 'var(--text-muted)',
                    }}>
                        <Loader2 size={24} className="animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState onSearch={searchQuery} onCreate={() => setShowTemplatePicker(true)} creating={creating} />
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '12px',
                    }}>
                        {filtered.map(p => (
                            <ProposalCard
                                key={p.id}
                                proposal={p}
                                onClick={() => openProposal(p)}
                                onDelete={(e) => handleDelete(p.id, e)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Template Picker Modal */}
            <TemplatePickerModal
                open={showTemplatePicker}
                onClose={() => setShowTemplatePicker(false)}
                onCreateBlank={handleCreate}
                onCreateFromTemplate={handleCreateFromTemplate}
            />
        </div>
    );
}

/* ── Proposal Card ─────────────────────────────────────────────────── */

function ProposalCard({ proposal, onClick, onDelete }) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '20px', borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                background: hovered ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                cursor: 'pointer', transition: 'all 0.15s',
                position: 'relative',
                boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
            }}
        >
            {/* Icon */}
            <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f115, #8b5cf615)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '12px', fontSize: '18px',
            }}>
                📄
            </div>

            <div style={{
                fontSize: '14px', fontWeight: 600,
                color: 'var(--text-primary)', marginBottom: '4px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
                {proposal.name}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {timeAgo(proposal.updatedAt || proposal.createdAt)}
            </div>

            {/* Delete button */}
            {hovered && (
                <button
                    onClick={onDelete}
                    style={{
                        position: 'absolute', top: '12px', right: '12px',
                        background: '#fee2e2', border: 'none', borderRadius: '6px',
                        cursor: 'pointer', padding: '4px', color: '#ef4444',
                        transition: 'all 0.1s',
                    }}
                    title="Verwijderen"
                >
                    <Trash2 size={13} />
                </button>
            )}
        </div>
    );
}

/* ── Empty State ───────────────────────────────────────────────────── */

function EmptyState({ onSearch, onCreate, creating }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '64px 20px',
            textAlign: 'center',
        }}>
            <div style={{
                width: '72px', height: '72px', borderRadius: '20px',
                background: 'linear-gradient(135deg, #6366f115, #8b5cf615)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '32px', marginBottom: '16px',
            }}>
                📄
            </div>

            <h3 style={{
                fontSize: '16px', fontWeight: 600,
                color: 'var(--text-primary)', margin: '0 0 6px',
            }}>
                {onSearch ? 'Geen resultaten' : 'Nog geen offertes'}
            </h3>

            <p style={{
                fontSize: '13px', color: 'var(--text-muted)',
                margin: '0 0 20px', maxWidth: '300px',
            }}>
                {onSearch
                    ? 'Probeer een andere zoekterm'
                    : 'Maak je eerste offerte met onze blok-editor'
                }
            </p>

            {!onSearch && (
                <button
                    onClick={onCreate}
                    disabled={creating}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 16px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: '#fff', border: 'none', cursor: 'pointer',
                        fontSize: '13px', fontWeight: 600,
                        boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                    }}
                >
                    <Plus size={15} /> Nieuwe Offerte
                </button>
            )}
        </div>
    );
}
