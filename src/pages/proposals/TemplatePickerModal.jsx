import React, { useState, useEffect } from 'react';
import { X, Plus, FileText, Loader2, Trash2, Copy, LayoutTemplate } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * TemplatePickerModal — modal for creating a new proposal from scratch or from a template.
 *
 * Features:
 *   • "Leeg beginnen" card to create a blank proposal
 *   • Grid of user's saved templates with block counts
 *   • Delete template inline
 */
export default function TemplatePickerModal({ open, onClose, onCreateBlank, onCreateFromTemplate }) {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(null); // templateId or 'blank'

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        authFetch(`${API_BASE}/api/proposals/templates/list`)
            .then(res => res.ok ? res.json() : [])
            .then(data => setTemplates(Array.isArray(data) ? data : []))
            .catch(() => setTemplates([]))
            .finally(() => setLoading(false));
    }, [open]);

    const handleDeleteTemplate = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Template verwijderen?')) return;
        try {
            await authFetch(`${API_BASE}/api/proposals/templates/${id}`, { method: 'DELETE' });
            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            console.error('Delete template error:', err);
        }
    };

    const handleUseTemplate = async (templateId) => {
        setCreating(templateId);
        try {
            await onCreateFromTemplate(templateId);
            onClose();
        } catch (err) {
            console.error('Use template error:', err);
        } finally {
            setCreating(null);
        }
    };

    const handleBlank = async () => {
        setCreating('blank');
        try {
            await onCreateBlank();
            onClose();
        } catch (err) {
            console.error('Create blank error:', err);
        } finally {
            setCreating(null);
        }
    };

    if (!open) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--bg-primary)',
                    borderRadius: '16px', border: '1px solid var(--border-subtle)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
                    width: '90%', maxWidth: '680px', maxHeight: '80vh',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'fadeInScale 0.2s ease-out',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 24px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-subtle)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #6366f120, #8b5cf620)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <LayoutTemplate size={18} style={{ color: '#6366f1' }} />
                        </div>
                        <div>
                            <h2 style={{
                                fontSize: '16px', fontWeight: 700,
                                color: 'var(--text-primary)', margin: 0,
                            }}>
                                Nieuwe Offerte
                            </h2>
                            <p style={{
                                fontSize: '12px', color: 'var(--text-muted)',
                                margin: '2px 0 0',
                            }}>
                                Begin leeg of kies een template
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '6px', borderRadius: '8px', color: 'var(--text-muted)',
                            transition: 'all 0.1s',
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1, overflow: 'auto', padding: '20px 24px',
                }} className="custom-scrollbar">
                    {loading ? (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: '150px', color: 'var(--text-muted)',
                        }}>
                            <Loader2 size={24} className="animate-spin" />
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: '12px',
                        }}>
                            {/* Blank card */}
                            <TemplateCard
                                isBlank
                                onClick={handleBlank}
                                isCreating={creating === 'blank'}
                            />

                            {/* Template cards */}
                            {templates.map(t => (
                                <TemplateCard
                                    key={t.id}
                                    template={t}
                                    onClick={() => handleUseTemplate(t.id)}
                                    onDelete={(e) => handleDeleteTemplate(t.id, e)}
                                    isCreating={creating === t.id}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* CSS animation */}
            <style>{`
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}


/* ── Template Card ─────────────────────────────────────────────────── */

function TemplateCard({ isBlank, template, onClick, onDelete, isCreating }) {
    const [hovered, setHovered] = useState(false);

    // Get block type icons summary
    const getBlockSummary = () => {
        if (!template?.documentContent?.blocks) return null;
        const blocks = template.documentContent.blocks;
        const types = {};
        blocks.forEach(b => { types[b.type] = (types[b.type] || 0) + 1; });
        return Object.entries(types).map(([type, count]) => {
            const icons = {
                cover: '🎨', text: '📝', specs: '📋', pricing: '💰',
                timeline: '📅', image: '🖼️', divider: '─',
            };
            return `${icons[type] || '📦'} ${count}`;
        }).join('  ');
    };

    return (
        <div
            onClick={isCreating ? undefined : onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '16px', borderRadius: '12px',
                border: isBlank
                    ? '2px dashed var(--border-primary)'
                    : `1px solid ${hovered ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                background: hovered ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                cursor: isCreating ? 'wait' : 'pointer',
                transition: 'all 0.15s',
                position: 'relative',
                display: 'flex', flexDirection: 'column',
                alignItems: isBlank ? 'center' : 'flex-start',
                justifyContent: isBlank ? 'center' : 'flex-start',
                minHeight: '130px',
                boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
                opacity: isCreating ? 0.7 : 1,
            }}
        >
            {isCreating && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(var(--bg-rgb, 0,0,0), 0.3)', borderRadius: '12px',
                    zIndex: 2,
                }}>
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                </div>
            )}

            {isBlank ? (
                <>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #6366f115, #8b5cf615)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '10px',
                    }}>
                        <Plus size={20} style={{ color: '#6366f1' }} />
                    </div>
                    <span style={{
                        fontSize: '13px', fontWeight: 600,
                        color: 'var(--text-primary)',
                    }}>
                        Leeg beginnen
                    </span>
                    <span style={{
                        fontSize: '11px', color: 'var(--text-muted)',
                        marginTop: '2px',
                    }}>
                        Start met een lege offerte
                    </span>
                </>
            ) : (
                <>
                    {/* Icon */}
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, #10b98120, #059e6d20)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '10px', fontSize: '16px',
                    }}>
                        <LayoutTemplate size={16} style={{ color: '#10b981' }} />
                    </div>

                    {/* Name */}
                    <div style={{
                        fontSize: '13px', fontWeight: 600,
                        color: 'var(--text-primary)', marginBottom: '4px',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', width: '100%',
                    }}>
                        {template.name}
                    </div>

                    {/* Block summary */}
                    {template.blockCount > 0 && (
                        <div style={{
                            fontSize: '10px', color: 'var(--text-muted)',
                            marginBottom: '4px',
                        }}>
                            {template.blockCount} blok{template.blockCount !== 1 ? 'ken' : ''}
                            {getBlockSummary() && (
                                <span style={{ marginLeft: '6px' }}>{getBlockSummary()}</span>
                            )}
                        </div>
                    )}

                    {/* Description */}
                    {template.description && (
                        <div style={{
                            fontSize: '11px', color: 'var(--text-muted)',
                            lineHeight: 1.4, overflow: 'hidden',
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                        }}>
                            {template.description}
                        </div>
                    )}

                    {/* Delete button */}
                    {hovered && onDelete && (
                        <button
                            onClick={onDelete}
                            style={{
                                position: 'absolute', top: '8px', right: '8px',
                                background: '#fee2e2', border: 'none', borderRadius: '6px',
                                cursor: 'pointer', padding: '4px', color: '#ef4444',
                                transition: 'all 0.1s', zIndex: 3,
                            }}
                            title="Verwijderen"
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
