import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, Trash2, Copy, GripVertical, MoreHorizontal } from 'lucide-react';
import {
    CoverBlock, SpecsBlock, TextSection, PricingTable,
    SignatureBlock, IconSection, TimelineBlock, createBlock
} from './blocks';
import ProposalToolbar from './ProposalToolbar';

/**
 * ProposalEditor — Custom block-based proposal editor.
 * Manages an ordered list of blocks, each rendered by its type component.
 * Supports drag re-ordering, add/remove/duplicate, and auto-save.
 */
export default function ProposalEditor({ proposal, onSave, onExport, exporting, onBlocksChange }) {
    const settings = proposal?.settings || {};
    const proposalMeta = settings.proposal || {};
    const brandColors = proposalMeta.brandColors || { primary: '#1a1a2e', accent: '#6366f1' };
    const logo = proposalMeta.logoUrl || null;

    // Parse blocks from documentContent (JSON string)
    const parseBlocks = () => {
        try {
            const parsed = JSON.parse(proposal?.documentContent || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    };

    const [blocks, setBlocks] = useState(() => {
        const existing = parseBlocks();
        if (existing.length > 0) return existing;
        // Default template for new proposals
        return [
            createBlock('cover'),
            createBlock('specs'),
            createBlock('text'),
            createBlock('pricing'),
            createBlock('signature'),
        ];
    });

    const [hoveredBlock, setHoveredBlock] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);
    const saveTimer = useRef(null);

    // Auto-save after changes
    const saveBlocks = useCallback((updatedBlocks) => {
        setBlocks(updatedBlocks);
        onBlocksChange?.(updatedBlocks);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            if (onSave) {
                onSave({ documentContent: JSON.stringify(updatedBlocks) });
            }
        }, 1500);
    }, [onSave, onBlocksChange]);

    // Sync blocks when proposal changes externally (e.g. AI updates)
    useEffect(() => {
        try {
            const dc = proposal?.documentContent;
            if (!dc) return;
            const parsed = typeof dc === 'string' ? JSON.parse(dc) : dc;
            // If documentContent has a blocks property (object format), use that
            const newBlocks = parsed?.blocks || (Array.isArray(parsed) ? parsed : null);
            if (newBlocks && Array.isArray(newBlocks) && newBlocks.length > 0) {
                setBlocks(newBlocks);
                onBlocksChange?.(newBlocks);
            }
        } catch {}
    }, [proposal?.documentContent]);

    // Initial sync
    useEffect(() => {
        onBlocksChange?.(blocks);
    }, []); // eslint-disable-line

    const updateBlock = useCallback((index, updatedBlock) => {
        const updated = [...blocks];
        updated[index] = updatedBlock;
        saveBlocks(updated);
    }, [blocks, saveBlocks]);

    const addBlock = useCallback((type, afterIndex) => {
        const insertAt = afterIndex !== undefined ? afterIndex + 1 : blocks.length;
        const newBlock = createBlock(type);
        const updated = [...blocks];
        updated.splice(insertAt, 0, newBlock);
        saveBlocks(updated);
    }, [blocks, saveBlocks]);

    const removeBlock = useCallback((index) => {
        if (blocks.length <= 1) return;
        saveBlocks(blocks.filter((_, i) => i !== index));
    }, [blocks, saveBlocks]);

    const duplicateBlock = useCallback((index) => {
        const clone = { ...JSON.parse(JSON.stringify(blocks[index])), id: crypto.randomUUID() };
        const updated = [...blocks];
        updated.splice(index + 1, 0, clone);
        saveBlocks(updated);
    }, [blocks, saveBlocks]);

    const moveBlock = useCallback((index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= blocks.length) return;
        const updated = [...blocks];
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
        saveBlocks(updated);
    }, [blocks, saveBlocks]);

    const addBlockFromToolbar = useCallback((type) => {
        addBlock(type);
    }, [addBlock]);

    const renderBlock = (block, index) => {
        const commonProps = {
            block,
            onChange: (updated) => updateBlock(index, updated),
            brandColors,
            logo,
        };

        switch (block.type) {
            case 'cover': return <CoverBlock {...commonProps} />;
            case 'specs': return <SpecsBlock {...commonProps} />;
            case 'text': return <TextSection {...commonProps} />;
            case 'pricing': return <PricingTable {...commonProps} />;
            case 'icon-section': return <IconSection {...commonProps} />;
            case 'timeline': return <TimelineBlock {...commonProps} />;
            case 'signature': return <SignatureBlock {...commonProps} />;
            default: return <div style={{ padding: 16, color: '#999' }}>Onbekend bloktype: {block.type}</div>;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <ProposalToolbar
                onAddBlock={addBlockFromToolbar}
                onExport={onExport}
                exporting={exporting}
                hasBlocks={blocks.length > 0}
            />

            {/* Block canvas */}
            <div style={{
                flex: 1, overflow: 'auto', padding: '32px',
                background: '#e5e7eb',
            }}>
                {/* Paper container */}
                <div style={{
                    maxWidth: '820px', margin: '0 auto',
                    display: 'flex', flexDirection: 'column', gap: '2px',
                }}>
                    {blocks.map((block, index) => (
                        <div
                            key={block.id}
                            style={{ position: 'relative' }}
                            onMouseEnter={() => setHoveredBlock(index)}
                            onMouseLeave={() => { setHoveredBlock(null); setActiveMenu(null); }}
                        >
                            {/* Block controls (visible on hover) */}
                            {hoveredBlock === index && (
                                <div style={{
                                    position: 'absolute', left: '-44px', top: '8px',
                                    display: 'flex', flexDirection: 'column', gap: '2px',
                                    zIndex: 10,
                                }}>
                                    <button
                                        onClick={() => moveBlock(index, -1)}
                                        disabled={index === 0}
                                        style={controlBtnStyle}
                                        title="Omhoog"
                                    >
                                        <ChevronUp size={14} />
                                    </button>
                                    <button
                                        onClick={() => moveBlock(index, 1)}
                                        disabled={index === blocks.length - 1}
                                        style={controlBtnStyle}
                                        title="Omlaag"
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                    <button
                                        onClick={() => setActiveMenu(activeMenu === index ? null : index)}
                                        style={controlBtnStyle}
                                        title="Meer opties"
                                    >
                                        <MoreHorizontal size={14} />
                                    </button>

                                    {/* Context menu */}
                                    {activeMenu === index && (
                                        <div style={{
                                            position: 'absolute', left: '36px', top: '52px',
                                            background: '#fff', borderRadius: '10px',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                            border: '1px solid #e5e7eb', padding: '4px',
                                            width: '160px', zIndex: 50,
                                        }}>
                                            <button onClick={() => { duplicateBlock(index); setActiveMenu(null); }} style={menuItemStyle}>
                                                <Copy size={13} /> Dupliceren
                                            </button>
                                            <button
                                                onClick={() => { removeBlock(index); setActiveMenu(null); }}
                                                style={{ ...menuItemStyle, color: '#ef4444' }}
                                                disabled={blocks.length <= 1}
                                            >
                                                <Trash2 size={13} /> Verwijderen
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* The actual block */}
                            {renderBlock(block, index)}

                            {/* Insert-between button */}
                            {hoveredBlock === index && (
                                <div style={{
                                    position: 'absolute', bottom: '-14px', left: '50%',
                                    transform: 'translateX(-50%)', zIndex: 10,
                                }}>
                                    <InsertButton onAdd={(type) => addBlock(type, index)} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ── Insert-between button ─────────────────────────────────────────── */

function InsertButton({ onAdd }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    React.useEffect(() => {
        const handleOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpen(!open)} style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: '#6366f1', color: '#fff', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '16px',
                boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                transition: 'transform 0.15s',
                transform: open ? 'rotate(45deg)' : 'none',
            }}>
                +
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: '32px', left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#fff', borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    border: '1px solid #e5e7eb', width: '220px',
                    padding: '4px', zIndex: 50,
                }}>
                    {BLOCK_TYPES.map(bt => (
                        <button
                            key={bt.type}
                            onClick={() => { onAdd(bt.type); setOpen(false); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                width: '100%', padding: '6px 10px', borderRadius: '6px',
                                border: 'none', background: 'transparent', cursor: 'pointer',
                                textAlign: 'left', fontSize: '12px', color: '#374151',
                            }}
                            onMouseEnter={e => e.target.style.background = '#f3f4f6'}
                            onMouseLeave={e => e.target.style.background = 'transparent'}
                        >
                            <span style={{ fontSize: '16px' }}>{bt.icon}</span>
                            {bt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Shared styles ─────────────────────────────────────────────────── */

const controlBtnStyle = {
    width: '30px', height: '30px', borderRadius: '8px',
    background: '#fff', border: '1px solid #e5e7eb',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#6b7280',
    transition: 'all 0.1s', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const menuItemStyle = {
    display: 'flex', alignItems: 'center', gap: '8px',
    width: '100%', padding: '8px 10px', borderRadius: '6px',
    border: 'none', background: 'transparent', cursor: 'pointer',
    textAlign: 'left', fontSize: '12px', color: '#374151',
    fontWeight: 500,
};
