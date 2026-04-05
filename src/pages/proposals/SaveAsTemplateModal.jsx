import React, { useState } from 'react';
import { X, LayoutTemplate, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * SaveAsTemplateModal — dialog to save an existing proposal as a reusable template.
 */
export default function SaveAsTemplateModal({ open, onClose, proposalId, proposalName }) {
    const [name, setName] = useState(`${proposalName || 'Offerte'} Template`);
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/api/proposals/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceProposalId: proposalId,
                    name: name.trim() || 'Nieuwe Template',
                    description: description.trim(),
                }),
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => {
                    onClose();
                    // Reset state for next open
                    setTimeout(() => {
                        setSaved(false);
                        setName(`${proposalName || 'Offerte'} Template`);
                        setDescription('');
                    }, 300);
                }, 1200);
            }
        } catch (err) {
            console.error('Save as template error:', err);
        } finally {
            setSaving(false);
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
                    width: '90%', maxWidth: '440px',
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
                            background: 'linear-gradient(135deg, #10b98120, #059e6d20)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <LayoutTemplate size={18} style={{ color: '#10b981' }} />
                        </div>
                        <div>
                            <h2 style={{
                                fontSize: '16px', fontWeight: 700,
                                color: 'var(--text-primary)', margin: 0,
                            }}>
                                Opslaan als Template
                            </h2>
                            <p style={{
                                fontSize: '12px', color: 'var(--text-muted)',
                                margin: '2px 0 0',
                            }}>
                                Hergebruik deze opmaak bij nieuwe offertes
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '6px', borderRadius: '8px', color: 'var(--text-muted)',
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <div style={{ padding: '20px 24px' }}>
                    {saved ? (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '24px 0', gap: '10px',
                        }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: '#10b98120', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                fontSize: '24px',
                            }}>
                                ✓
                            </div>
                            <span style={{
                                fontSize: '14px', fontWeight: 600,
                                color: 'var(--text-primary)',
                            }}>
                                Template opgeslagen!
                            </span>
                            <span style={{
                                fontSize: '12px', color: 'var(--text-muted)',
                            }}>
                                Beschikbaar bij het aanmaken van nieuwe offertes
                            </span>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{
                                    display: 'block', fontSize: '12px', fontWeight: 600,
                                    color: 'var(--text-secondary)', marginBottom: '6px',
                                }}>
                                    Template naam
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Bijv. Standaard Offerte..."
                                    style={{
                                        width: '100%', padding: '9px 12px',
                                        borderRadius: '8px', border: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-secondary)', fontSize: '13px',
                                        color: 'var(--text-primary)', outline: 'none',
                                        transition: 'border-color 0.15s',
                                        boxSizing: 'border-box',
                                    }}
                                    autoFocus
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block', fontSize: '12px', fontWeight: 600,
                                    color: 'var(--text-secondary)', marginBottom: '6px',
                                }}>
                                    Beschrijving <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optioneel)</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Bijv. Template voor website projecten..."
                                    rows={2}
                                    style={{
                                        width: '100%', padding: '9px 12px',
                                        borderRadius: '8px', border: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-secondary)', fontSize: '13px',
                                        color: 'var(--text-primary)', outline: 'none',
                                        resize: 'vertical', fontFamily: 'inherit',
                                        transition: 'border-color 0.15s',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            {/* Info box */}
                            <div style={{
                                padding: '10px 12px', borderRadius: '8px',
                                background: '#6366f110', border: '1px solid #6366f120',
                                fontSize: '11px', color: 'var(--text-secondary)',
                                lineHeight: 1.5, marginBottom: '20px',
                            }}>
                                💡 De volledige blok-structuur en opmaak wordt opgeslagen.
                                Klant-specifieke gegevens (naam, datum) worden leeg gemaakt.
                            </div>

                            {/* Actions */}
                            <div style={{
                                display: 'flex', gap: '8px', justifyContent: 'flex-end',
                            }}>
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: '8px 16px', borderRadius: '8px',
                                        border: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                    }}
                                >
                                    Annuleren
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !name.trim()}
                                    style={{
                                        padding: '8px 16px', borderRadius: '8px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #10b981, #059e6d)',
                                        color: '#fff', fontSize: '13px', fontWeight: 600,
                                        cursor: saving ? 'wait' : 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        opacity: (!name.trim() || saving) ? 0.6 : 1,
                                        boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                                    }}
                                >
                                    {saving && <Loader2 size={14} className="animate-spin" />}
                                    Opslaan als Template
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
