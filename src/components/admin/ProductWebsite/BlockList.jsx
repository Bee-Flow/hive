import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AppIcon from '../../AppIcon';
import { BLOCK_CATALOGUE } from './editors';

// Derive the row label shown in the left sidebar. Defaults to the block
// catalogue's static label, but a few block types expose a more useful
// title from their content (e.g. Social Proof's title / eyebrow). Add new
// branches here when other blocks want the same treatment — keep the
// switch tightly scoped so a typo in one block's content can't affect
// another block's row label.
function deriveBlockLabel(block, meta) {
    const fallback = meta?.label || block.type;
    const content = block?.content;
    if (!content || typeof content !== 'object') return fallback;
    if (block.type === 'socialProof') {
        const title   = typeof content.title   === 'string' ? content.title.trim()   : '';
        const eyebrow = typeof content.eyebrow === 'string' ? content.eyebrow.trim() : '';
        return title || eyebrow || fallback;
    }
    return fallback;
}

// ── Single draggable block row ────────────────────────────────────────

function BlockRow({ block, isActive, onClick, onToggle, onDuplicate, onDelete }) {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const meta = BLOCK_CATALOGUE[block.type] || { label: block.type, icon: 'Square' };
    const displayLabel = deriveBlockLabel(block, meta);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer select-none
                ${isActive
                    ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }
                ${!block.enabled ? 'opacity-50' : ''}`}
            onClick={() => onClick(block.id)}
        >
            {/* drag handle */}
            <span
                {...attributes}
                {...listeners}
                className="text-[var(--text-muted)] cursor-grab active:cursor-grabbing p-0.5 shrink-0"
                onClick={e => e.stopPropagation()}
                title="Drag to reorder"
            >
                <AppIcon name="GripVertical" className="w-3.5 h-3.5" />
            </span>

            {/* block icon + label */}
            <span className={`flex items-center gap-1.5 flex-1 min-w-0 ${isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
                <AppIcon name={meta.icon} className="w-3.5 h-3.5 shrink-0" />
                <span className="text-sm text-[var(--text-primary)] truncate">{displayLabel}</span>
            </span>

            {/* visibility toggle */}
            <button
                type="button"
                onClick={e => { e.stopPropagation(); onToggle(block.id); }}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors shrink-0
                    ${block.enabled
                        ? 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] opacity-0 group-hover:opacity-100'
                        : 'text-[var(--text-muted)] opacity-100'
                    }`}
                title={block.enabled ? 'Hide block' : 'Show block'}
            >
                <AppIcon name={block.enabled ? 'Eye' : 'EyeOff'} className="w-3.5 h-3.5" />
            </button>

            {/* actions: duplicate + delete */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0" onClick={e => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={() => onDuplicate(block.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    title="Duplicate block"
                >
                    <AppIcon name="Copy" className="w-3 h-3" />
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(block.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10"
                    title="Delete block"
                >
                    <AppIcon name="Trash2" className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}

// ── Add block picker ─────────────────────────────────────────────────

function AddBlockPicker({ onAdd, onCancel }) {
    const categories = React.useMemo(() => {
        const out = {};
        for (const meta of Object.values(BLOCK_CATALOGUE)) {
            if (!out[meta.category]) out[meta.category] = [];
            out[meta.category].push(meta);
        }
        return out;
    }, []);

    // Escape closes the modal. Outside-click is handled via the backdrop's
    // onClick — clicking the modal box itself stopPropagation()s the
    // event so a click inside the modal isn't treated as an outside click.
    React.useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onCancel]);

    // Portal to document.body so the modal escapes the sidebar's overflow
    // / z-index stack entirely. Backdrop covers the whole viewport;
    // sidebar content stays exactly where it is and is fully visible
    // (just darkened) behind it.
    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
            onMouseDown={onCancel}
            role="presentation"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Add block"
                onMouseDown={e => e.stopPropagation()}
                className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-2xl flex flex-col overflow-hidden"
                style={{ width: 'min(600px, 92vw)', height: 'min(500px, 86vh)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Add block</span>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-7 h-7 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                        title="Close"
                        aria-label="Close add block dialog"
                    >
                        <AppIcon name="X" className="w-4 h-4" />
                    </button>
                </div>
                {/* Body — categories + block grid (unchanged) */}
                <div className="flex-1 overflow-y-auto p-4">
                    {Object.entries(categories).map(([cat, items]) => (
                        <div key={cat} className="mb-4 last:mb-0">
                            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2 px-1">{cat}</p>
                            <div className="grid grid-cols-2 gap-2">
                                {items.map(meta => (
                                    <button
                                        key={meta.type}
                                        type="button"
                                        onClick={() => onAdd(meta.type)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left
                                            text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]
                                            border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 transition-colors"
                                    >
                                        <AppIcon name={meta.icon} className="w-4 h-4 shrink-0 text-[var(--accent-primary)]" />
                                        {meta.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body,
    );
}

// ── BlockList ────────────────────────────────────────────────────────

export default function BlockList({ blocks, activeBlockId, onSelect, onAdd, onToggle, onDuplicate, onDelete, onReorder }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
    const [picking, setPicking] = useState(false);

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIdx = blocks.findIndex(b => b.id === active.id);
            const newIdx = blocks.findIndex(b => b.id === over.id);
            onReorder(arrayMove(blocks, oldIdx, newIdx));
        }
    };

    return (
        // The Add-block picker is portal-rendered to document.body as a
        // centered modal, so the sidebar layout here doesn't need to
        // reserve any space or act as a positioning anchor — `flex-col
        // h-full` is the original layout.
        <div className="flex flex-col h-full">
            <div className="px-4 py-2 flex items-center justify-between border-b border-[var(--border-subtle)] shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    Blocks
                </span>
                <button
                    type="button"
                    onClick={() => setPicking(v => !v)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    title="Add block"
                >
                    <AppIcon name={picking ? 'X' : 'Plus'} className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                        {blocks.map(block => (
                            <BlockRow
                                key={block.id}
                                block={block}
                                isActive={block.id === activeBlockId}
                                onClick={onSelect}
                                onToggle={onToggle}
                                onDuplicate={onDuplicate}
                                onDelete={onDelete}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
                {blocks.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] text-center py-6">
                        No blocks yet. Add one above.
                    </p>
                )}
            </div>

            {/* Floating overlay — rendered last so it stacks on top of
                the list. Position is `absolute` inset-x-0 top-0 so it
                anchors to the BlockList container, not the document.
                Block list + editor below stay in place and remain
                visible underneath the panel. */}
            {picking && (
                <AddBlockPicker
                    onAdd={type => { onAdd(type); setPicking(false); }}
                    onCancel={() => setPicking(false)}
                />
            )}
        </div>
    );
}
