import React, { useState, useRef } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

/**
 * TimelineBlock — Vertical timeline with phases, icons, and bullet items.
 * Matches the Gamma-style implementation plan layout.
 */
export default function TimelineBlock({ block, onChange, brandColors }) {
    const data = block.data || {};
    const heading = data.heading || 'Implementatie programma';
    const phases = data.phases || [
        {
            icon: '📋',
            title: 'Fase 1',
            items: [
                { title: 'Stap 1', description: 'Beschrijving van de stap' },
            ],
        },
    ];

    const updateField = (field, value) => {
        onChange({ ...block, data: { ...data, [field]: value } });
    };

    const updatePhase = (phaseIndex, updates) => {
        const updated = [...phases];
        updated[phaseIndex] = { ...updated[phaseIndex], ...updates };
        updateField('phases', updated);
    };

    const updatePhaseItem = (phaseIndex, itemIndex, updates) => {
        const updated = [...phases];
        const items = [...updated[phaseIndex].items];
        items[itemIndex] = { ...items[itemIndex], ...updates };
        updated[phaseIndex] = { ...updated[phaseIndex], items };
        updateField('phases', updated);
    };

    const addPhase = () => {
        updateField('phases', [...phases, {
            icon: '🔧',
            title: `Fase ${phases.length + 1}`,
            items: [{ title: 'Nieuwe stap', description: 'Beschrijving' }],
        }]);
    };

    const removePhase = (index) => {
        if (phases.length <= 1) return;
        updateField('phases', phases.filter((_, i) => i !== index));
    };

    const addItem = (phaseIndex) => {
        const updated = [...phases];
        updated[phaseIndex] = {
            ...updated[phaseIndex],
            items: [...updated[phaseIndex].items, { title: 'Nieuwe stap', description: 'Beschrijving' }],
        };
        updateField('phases', updated);
    };

    const removeItem = (phaseIndex, itemIndex) => {
        const updated = [...phases];
        const items = updated[phaseIndex].items.filter((_, i) => i !== itemIndex);
        if (items.length === 0) return; // keep at least 1
        updated[phaseIndex] = { ...updated[phaseIndex], items };
        updateField('phases', updated);
    };

    const accent = brandColors?.accent || '#1a1a2e';

    return (
        <div style={{
            background: '#fff',
            padding: '48px 40px',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}>
            {/* Main heading */}
            <h2
                contentEditable
                suppressContentEditableWarning
                onBlur={e => updateField('heading', e.target.innerText)}
                style={{
                    fontSize: '26px', fontWeight: 800, color: '#1a1a2e',
                    margin: '0 0 32px', outline: 'none', lineHeight: 1.3,
                }}
            >
                {heading}
            </h2>

            {/* Timeline */}
            <div style={{ position: 'relative', paddingLeft: '60px' }}>
                {/* Vertical line */}
                <div style={{
                    position: 'absolute', left: '27px', top: '0',
                    bottom: '0', width: '3px',
                    background: `linear-gradient(180deg, ${accent}, ${accent}88)`,
                    borderRadius: '2px',
                }} />

                {phases.map((phase, phaseIdx) => (
                    <div key={phaseIdx} style={{ position: 'relative', marginBottom: '32px' }}>
                        {/* Phase icon circle */}
                        <div style={{
                            position: 'absolute', left: '-60px', top: '0',
                            width: '54px', height: '54px', borderRadius: '12px',
                            background: accent,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '22px', color: '#fff',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 2,
                        }}>
                            <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={e => updatePhase(phaseIdx, { icon: e.target.innerText.trim() || '📋' })}
                                style={{ outline: 'none', cursor: 'text' }}
                            >
                                {phase.icon}
                            </span>
                        </div>

                        {/* Phase content */}
                        <div style={{ paddingLeft: '12px' }}>
                            {/* Phase title */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <h3
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={e => updatePhase(phaseIdx, { title: e.target.innerText })}
                                    style={{
                                        fontSize: '18px', fontWeight: 700, color: '#1a1a2e',
                                        margin: 0, outline: 'none', flex: 1,
                                    }}
                                >
                                    {phase.title}
                                </h3>
                                {phases.length > 1 && (
                                    <button
                                        onClick={() => removePhase(phaseIdx)}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#d1d5db', padding: '2px',
                                            opacity: 0.5, transition: 'opacity 0.15s',
                                        }}
                                        onMouseEnter={e => e.target.style.opacity = 1}
                                        onMouseLeave={e => e.target.style.opacity = 0.5}
                                        title="Fase verwijderen"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Items */}
                            <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
                                {phase.items.map((item, itemIdx) => (
                                    <li key={itemIdx} style={{
                                        marginBottom: '12px', color: '#374151',
                                        fontSize: '13px', lineHeight: 1.6,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                            <div style={{ flex: 1 }}>
                                                <strong
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    onBlur={e => updatePhaseItem(phaseIdx, itemIdx, { title: e.target.innerText })}
                                                    style={{ outline: 'none', display: 'block', marginBottom: '2px' }}
                                                >
                                                    {item.title}
                                                </strong>
                                                <span
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    onBlur={e => updatePhaseItem(phaseIdx, itemIdx, { description: e.target.innerText })}
                                                    style={{
                                                        outline: 'none', display: 'block',
                                                        color: '#6b7280', fontSize: '12.5px',
                                                    }}
                                                >
                                                    {item.description}
                                                </span>
                                            </div>
                                            {phase.items.length > 1 && (
                                                <button
                                                    onClick={() => removeItem(phaseIdx, itemIdx)}
                                                    style={{
                                                        background: 'none', border: 'none', cursor: 'pointer',
                                                        color: '#d1d5db', padding: '2px', flexShrink: 0,
                                                        marginTop: '2px',
                                                    }}
                                                    title="Item verwijderen"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            {/* Add item button */}
                            <button
                                onClick={() => addItem(phaseIdx)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    background: 'none', border: '1px dashed #d1d5db',
                                    borderRadius: '6px', padding: '4px 10px',
                                    fontSize: '11px', color: '#9ca3af', cursor: 'pointer',
                                    transition: 'all 0.15s', marginTop: '4px',
                                }}
                                onMouseEnter={e => { e.target.style.borderColor = accent; e.target.style.color = accent; }}
                                onMouseLeave={e => { e.target.style.borderColor = '#d1d5db'; e.target.style.color = '#9ca3af'; }}
                            >
                                <Plus size={11} /> Item toevoegen
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add phase button */}
                <button
                    onClick={addPhase}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'none', border: '1px dashed #d1d5db',
                        borderRadius: '8px', padding: '8px 14px',
                        fontSize: '12px', color: '#9ca3af', cursor: 'pointer',
                        transition: 'all 0.15s', marginLeft: '12px',
                    }}
                    onMouseEnter={e => { e.target.style.borderColor = accent; e.target.style.color = accent; }}
                    onMouseLeave={e => { e.target.style.borderColor = '#d1d5db'; e.target.style.color = '#9ca3af'; }}
                >
                    <Plus size={13} /> Fase toevoegen
                </button>
            </div>
        </div>
    );
}
