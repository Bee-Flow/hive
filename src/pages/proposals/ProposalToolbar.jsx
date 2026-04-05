import React, { useState, useRef, useEffect } from 'react';
import {
    Plus, ChevronDown, ChevronUp, Trash2, Copy, GripVertical,
    Eye, Download, Palette, Settings, Undo, FileDown
} from 'lucide-react';
import { BLOCK_TYPES, createBlock } from './blocks';

/**
 * ProposalToolbar — Top toolbar for the proposal editor.
 * - Add Block dropdown
 * - Undo
 * - Theme settings
 * - Export actions
 */
export default function ProposalToolbar({ onAddBlock, onExport, exporting, hasBlocks }) {
    const [showAddMenu, setShowAddMenu] = useState(false);
    const addRef = useRef(null);

    useEffect(() => {
        const handleOutside = (e) => {
            if (addRef.current && !addRef.current.contains(e.target)) setShowAddMenu(false);
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-subtle)',
            position: 'sticky', top: 0, zIndex: 20,
        }}>
            {/* Add Block */}
            <div ref={addRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 14px', borderRadius: '8px', fontSize: '13px',
                        fontWeight: 600, border: '1px solid var(--border-subtle)',
                        background: showAddMenu ? 'var(--bg-secondary)' : 'transparent',
                        color: 'var(--text-primary)', cursor: 'pointer',
                        transition: 'all 0.15s',
                    }}
                >
                    <Plus size={15} />
                    Blok toevoegen
                    <ChevronDown size={13} style={{
                        opacity: 0.5,
                        transform: showAddMenu ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s',
                    }} />
                </button>

                {showAddMenu && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                        background: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        border: '1px solid #e5e7eb', width: '240px', zIndex: 50,
                        padding: '4px', animation: 'slideDown 0.15s ease-out',
                    }}>
                        {BLOCK_TYPES.map(bt => (
                            <button
                                key={bt.type}
                                onClick={() => {
                                    onAddBlock(bt.type);
                                    setShowAddMenu(false);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    width: '100%', padding: '8px 12px', borderRadius: '8px',
                                    border: 'none', background: 'transparent', cursor: 'pointer',
                                    textAlign: 'left', transition: 'background 0.1s',
                                    fontSize: '13px', color: '#111827',
                                }}
                                onMouseEnter={e => e.target.style.background = '#f3f4f6'}
                                onMouseLeave={e => e.target.style.background = 'transparent'}
                            >
                                <span style={{ fontSize: '18px', width: '28px', textAlign: 'center' }}>{bt.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{bt.label}</div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{bt.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ flex: 1 }} />

            {/* Export */}
            <button
                disabled={!hasBlocks || !!exporting}
                onClick={() => onExport && onExport('pdf')}
                style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '8px', fontSize: '12px',
                    fontWeight: 500, border: '1px solid var(--border-subtle)',
                    background: 'transparent', color: 'var(--text-secondary)',
                    cursor: 'pointer', opacity: !hasBlocks ? 0.4 : 1,
                    transition: 'all 0.15s',
                }}
                title="Export als PDF"
            >
                <FileDown size={14} />
                PDF
            </button>
        </div>
    );
}
