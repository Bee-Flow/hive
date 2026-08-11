import { useDroppable } from '@dnd-kit/core';
import { Home, MoreHorizontal, PanelsTopLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { screenTabDroppableId } from './dnd';
import NavGroupsDialog from './NavGroupsDialog';
import AppIcon from '../../../../AppIcon';
import ConfirmDialog from '../../../../shared/ConfirmDialog';
import { useAppEditor } from '../state/AppEditorContext';
import { addScreen, removeScreen, updateScreen } from '../state/definitionOps';

/**
 * A screen tab wrapped as a drop target: dragging a canvas node (or a palette
 * component) onto it moves/inserts into that screen's first section (see
 * dnd.js computeDragEnd). The accent tint on hover reads as "drop here".
 */
function DroppableTab({ screenId, active, children }) {
    const { setNodeRef, isOver } = useDroppable({
        id: screenTabDroppableId(screenId),
        data: { type: 'screentab', screenId },
    });
    return (
        <div
            ref={setNodeRef}
            data-screentab-over={isOver || undefined}
            className="group relative flex items-center shrink-0 transition-colors"
            style={{
                ...(active ? { boxShadow: 'inset 0 -2px 0 var(--editor-accent)' } : undefined),
                ...(isOver ? { background: 'color-mix(in srgb, var(--editor-accent) 14%, transparent)' } : undefined),
            }}
        >
            {children}
        </div>
    );
}

/**
 * App Studio editor — the screen tab strip under the header.
 *
 * One tab per screen (icon + name, accent underline on the active one, a
 * little Home badge on the home screen), a + button appending a screen, and
 * a per-tab kebab menu: inline rename, set-as-home, delete (disabled on the
 * last screen — removeScreen refuses it anyway). All edits build the next
 * definition via definitionOps and go through onCommit.
 */

export default function ScreenTabs({ onCommit }) {
    const { definition, screenId, streamLock, dispatch } = useAppEditor();
    const screens = definition?.screens || [];

    const [menuFor, setMenuFor] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [managingNav, setManagingNav] = useState(false);
    const menuRef = useRef(null);
    const renameInputRef = useRef(null);

    // Close the kebab menu on any outside pointerdown.
    useEffect(() => {
        if (!menuFor) return undefined;
        const onDown = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFor(null);
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, [menuFor]);

    useEffect(() => {
        if (renamingId) renameInputRef.current?.select();
    }, [renamingId]);

    const handleAdd = () => {
        const { def, screenId: newScreenId } = addScreen(definition, {
            name: `Screen ${screens.length + 1}`,
        });
        onCommit?.(def);
        dispatch({ type: 'set_screen', screenId: newScreenId });
    };

    const startRename = (screen) => {
        setMenuFor(null);
        setRenamingId(screen.id);
        setRenameValue(screen.name || '');
    };

    const commitRename = () => {
        const id = renamingId;
        setRenamingId(null);
        if (!id) return;
        const name = renameValue.trim();
        if (!name) return;
        const next = updateScreen(definition, id, { name });
        if (next !== definition) onCommit?.(next);
    };

    const handleSetHome = (id) => {
        setMenuFor(null);
        if (definition.homeScreenId === id) return;
        onCommit?.({ ...definition, homeScreenId: id });
    };

    const handleDelete = () => {
        const id = confirmDeleteId;
        setConfirmDeleteId(null);
        if (!id) return;
        const next = removeScreen(definition, id);
        if (next !== definition) onCommit?.(next);
    };

    const deletingScreen = screens.find((s) => s.id === confirmDeleteId) || null;

    return (
        /*
         * The scrolling lives on the INNER row, not on the strip.
         *
         * With overflow-x on the strip itself, CSS forces overflow-y to `auto`
         * too — so the per-tab kebab menu, positioned `top-full`, was clipped by
         * the ~40px strip instead of overlaying the canvas. Half the menu simply
         * could not be reached.
         */
        <div
            className="border-b shrink-0"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-primary)' }}
        >
        <div className="flex items-center gap-0.5 px-2 overflow-x-auto overflow-y-visible">
            {screens.map((screen) => {
                const active = screen.id === screenId;
                const isHome = definition?.homeScreenId === screen.id;
                return (
                    <DroppableTab key={screen.id} screenId={screen.id} active={active}>
                        {renamingId === screen.id ? (
                            <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitRename();
                                    else if (e.key === 'Escape') setRenamingId(null);
                                }}
                                aria-label="Screen name"
                                className="mx-1 my-1 w-32 rounded border px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                                style={{
                                    background: 'var(--bg-secondary)',
                                    borderColor: 'var(--editor-accent)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        ) : (
                            <>
                                <button
                                    type="button"
                                    disabled={streamLock}
                                    onClick={() => dispatch({ type: 'set_screen', screenId: screen.id })}
                                    onDoubleClick={() => !streamLock && startRename(screen)}
                                    className="inline-flex items-center gap-1.5 pl-3 pr-1 py-2.5 text-sm font-medium whitespace-nowrap disabled:opacity-50"
                                    style={{ color: active ? 'var(--editor-accent)' : 'var(--text-secondary)' }}
                                    aria-current={active ? 'page' : undefined}
                                >
                                    {screen.icon ? <AppIcon name={screen.icon} className="w-3.5 h-3.5 shrink-0" /> : null}
                                    <span className="truncate max-w-[10rem]">{screen.name || 'Screen'}</span>
                                    {isHome ? (
                                        <Home
                                            className="w-3 h-3 shrink-0"
                                            aria-label="Home screen"
                                            style={{ color: active ? 'var(--editor-accent)' : 'var(--text-tertiary)' }}
                                        />
                                    ) : null}
                                </button>
                                <button
                                    type="button"
                                    disabled={streamLock}
                                    aria-label={`Screen options for ${screen.name || 'Screen'}`}
                                    title="Screen options"
                                    onClick={() => setMenuFor(menuFor === screen.id ? null : screen.id)}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className={`mr-1 p-0.5 rounded hover:bg-[var(--bg-card-hover)] transition-opacity disabled:opacity-0 ${active || menuFor === screen.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                    style={{ color: 'var(--text-tertiary)' }}
                                >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}

                        {menuFor === screen.id ? (
                            <div
                                ref={menuRef}
                                role="menu"
                                className="absolute left-0 top-full z-40 mt-1 w-44 rounded-lg border py-1 shadow-xl"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                            >
                                <MenuItem icon={Pencil} label="Rename" onClick={() => startRename(screen)} />
                                <MenuItem
                                    icon={Home}
                                    label="Set as home screen"
                                    disabled={isHome}
                                    onClick={() => handleSetHome(screen.id)}
                                />
                                <MenuItem
                                    icon={PanelsTopLeft}
                                    label="Manage navigation…"
                                    onClick={() => {
                                        setMenuFor(null);
                                        setManagingNav(true);
                                    }}
                                />
                                <MenuItem
                                    icon={Trash2}
                                    label="Delete screen"
                                    danger
                                    disabled={screens.length <= 1}
                                    title={screens.length <= 1 ? 'An app needs at least one screen' : undefined}
                                    onClick={() => {
                                        setMenuFor(null);
                                        setConfirmDeleteId(screen.id);
                                    }}
                                />
                            </div>
                        ) : null}
                    </DroppableTab>
                );
            })}

            <button
                type="button"
                onClick={handleAdd}
                disabled={streamLock}
                aria-label="Add screen"
                title="Add screen"
                className="ml-1 p-1.5 rounded-md hover:bg-[var(--bg-card-hover)] disabled:opacity-50 shrink-0"
                style={{ color: 'var(--text-tertiary)' }}
            >
                <Plus className="w-4 h-4" />
            </button>
            </div>

            <NavGroupsDialog
                open={managingNav}
                definition={definition}
                onCommit={onCommit}
                onClose={() => setManagingNav(false)}
            />

            <ConfirmDialog
                open={!!confirmDeleteId}
                title={`Delete “${deletingScreen?.name || 'this screen'}”?`}
                description="The screen and everything on it are removed from the app. You can undo this."
                confirmLabel="Delete screen"
                destructive
                onConfirm={handleDelete}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    );
}

function MenuItem({ icon, label, onClick, disabled = false, danger = false, title }) {
    const Icon = icon;
    return (
        <button
            type="button"
            role="menuitem"
            disabled={disabled}
            title={title}
            onClick={onClick}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--bg-card-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: danger ? 'var(--error)' : 'var(--text-primary)' }}
        >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
        </button>
    );
}
