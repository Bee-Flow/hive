import { Copy, Trash2, Play, Power, Unlink, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Right-click menu for a node on the flow canvas (BFSF-319).
 *
 * The canvas had no `onContextMenu` at all: delete was bound to the
 * Delete/Backspace key and nothing else, so unless you already knew the
 * shortcut there was no way to discover that removing a node was even
 * possible — and no way at all to duplicate one.
 *
 * Rendered in a portal at viewport coordinates so it escapes the React Flow
 * transform (a menu inside the pane would scale and translate with the canvas).
 */
export default function NodeContextMenu({ x, y, canDelete, canDuplicate, canDetach, onDuplicate, onDetach, onDelete, onExecute, onToggleDisabled, disabled, onToggleInline, inlineExpanded = false, onClose }) {
    const ref = useRef(null);

    // Dismiss on outside click, Escape, scroll, or canvas pan.
    useEffect(() => {
        const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', onClose);
        window.addEventListener('wheel', onClose, { passive: true });
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onClose);
            window.removeEventListener('wheel', onClose);
        };
    }, [onClose]);

    // Keep the menu on screen when the click lands near an edge of the viewport.
    const MENU_W = 200;
    const MENU_H = 200;
    const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1920) - MENU_W - 8);
    const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 1080) - MENU_H - 8);

    const item = 'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition disabled:opacity-40 disabled:cursor-not-allowed';

    return createPortal(
        <div
            ref={ref}
            role="menu"
            style={{ left, top }}
            className="fixed z-[1000] min-w-[200px] py-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg"
            onContextMenu={(e) => e.preventDefault()}
        >
            {onExecute && (
                <button
                    type="button" role="menuitem" className={`${item} text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]`}
                    onClick={() => { onClose(); onExecute(); }}
                >
                    <Play size={12} /> Execute step
                </button>
            )}
            {onToggleInline && (
                <button
                    type="button" role="menuitem" className={`${item} text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]`}
                    title={inlineExpanded
                        ? 'Show this flowlet as a single step again'
                        : "Show this flowlet's steps here, inside the flow that uses it"}
                    onClick={() => { onClose(); onToggleInline(); }}
                >
                    {inlineExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {inlineExpanded ? 'Collapse flowlet' : 'Expand flowlet'}
                </button>
            )}
            {onToggleDisabled && (
                <button
                    type="button" role="menuitem" className={`${item} text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]`}
                    onClick={() => { onClose(); onToggleDisabled(); }}
                >
                    <Power size={12} /> {disabled ? 'Enable' : 'Disable'}
                </button>
            )}
            <button
                type="button" role="menuitem" disabled={!canDuplicate}
                className={`${item} text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]`}
                title={canDuplicate ? 'Copy this node and its settings' : 'Triggers cannot be duplicated'}
                onClick={() => { onClose(); onDuplicate(); }}
            >
                <Copy size={12} /> Duplicate
            </button>
            {onDetach && (
                <button
                    type="button" role="menuitem" disabled={!canDetach}
                    className={`${item} text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]`}
                    title={canDetach
                        ? 'Take this step out of the flow — it stays on the canvas and its neighbours reconnect'
                        : 'This step is not part of the flow'}
                    onClick={() => { onClose(); onDetach(); }}
                >
                    <Unlink size={12} /> Disconnect
                </button>
            )}
            <div className="my-1 h-px bg-[var(--border-default)]" />
            <button
                type="button" role="menuitem" disabled={!canDelete}
                className={`${item} text-red-500 hover:bg-red-500/10`}
                title={canDelete ? 'Remove this node and reconnect its neighbours' : 'The primary trigger cannot be removed'}
                onClick={() => { onClose(); onDelete(); }}
            >
                <Trash2 size={12} /> Delete
                <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">Del</span>
            </button>
        </div>,
        document.body,
    );
}
