/**
 * NotebookWorkspace — the universal, editor-agnostic workspace shell for
 * Notebooks + Legal (+ the embedded variant). It owns layout only: a unified
 * header, toggleable left/right drawers, a centered editor column (children), a
 * ⌘K command palette, banners and an overlays slot. It never imports a concrete
 * editor — the page passes the editor as `children` — so both engines work.
 *
 * The "bold" distraction-free feel comes from the drawers collapsing away to
 * leave the centered editor canvas; the editor centres its own content.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    ArrowLeft, Loader2, AlertCircle, CheckCircle2,
    PanelLeft, MessageSquare, Command as CommandIcon,
} from 'lucide-react';
import useTranslation from '../../hooks/useTranslation';
import useViewport from '../../hooks/useViewport';
import useDrawerState from './hooks/useDrawerState';
import useResizableWidth from './hooks/useResizableWidth';
import Drawer from './shell/Drawer';
import CommandPalette from './shell/CommandPalette';
import buildCommands from './shell/buildCommands';

const LEFT_WIDTH = 248;

/* ── Save-state indicator (extracted from both pages) ─────────── */
function SaveStateIndicator({ saveState, lastSavedAt, onRetry, t }) {
    if (saveState === 'saving') {
        return (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <Loader2 className="w-3 h-3 animate-spin" />{t('notebooks.saving', 'Saving…')}
            </span>
        );
    }
    if (saveState === 'error') {
        return (
            <button onClick={onRetry} className="flex items-center gap-1 text-xs text-red-500 hover:underline" title={t('notebooks.retry', 'Retry')}>
                <AlertCircle className="w-3 h-3" />{t('notebooks.save_failed_retry', 'Save failed — retry')}
            </button>
        );
    }
    if (saveState === 'idle' && lastSavedAt && (Date.now() - lastSavedAt < 4000)) {
        return (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <CheckCircle2 className="w-3 h-3" />{t('notebooks.saved', 'Saved')}
            </span>
        );
    }
    return null;
}

/* ── A header toggle button with active highlight ─────────────── */
function HeaderToggle({ icon: Icon, label, active, disabled, onClick }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-40"
            title={label}
            aria-label={label}
            aria-pressed={!!active}
            style={{ background: active ? 'var(--bg-tertiary)' : 'transparent' }}
        >
            <Icon className="w-4 h-4" style={{ color: active ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
        </button>
    );
}

export default function NotebookWorkspace({
    variant = 'notebook',
    icon: Icon,
    iconColor = 'var(--brand-primary)',
    title,
    meta,
    onBack,
    saveState,
    lastSavedAt,
    onRetrySave,
    headerActions,
    headerExtras = [],          // [{ id, icon, label, active, disabled, onClick }]
    leftDrawer,                 // { label, icon, node } | null
    rightDrawer,                // { label, icon, node } | null
    secondaryLeft = null,       // optional node between left drawer and editor (e.g. TOC)
    commandContext = null,      // passed to buildCommands; shell injects view toggles
    banners = null,
    overlays = null,
    children,                   // the editor
}) {
    const { t } = useTranslation();
    const { isDesktop } = useViewport();
    const { leftOpen, rightOpen, toggleLeft: toggleLeftDesktop, toggleRight: toggleRightDesktop } = useDrawerState(variant);
    const { width: rightWidth, startDrag } = useResizableWidth({
        initial: 320, min: 280, max: 760, side: 'right', storageKey: `bf.workspace.${variant}.rightWidth`,
    });
    const [paletteOpen, setPaletteOpen] = useState(false);

    // Below desktop the drawers become overlays, one at a time, defaulting closed
    // so the editor canvas owns the screen. On desktop they're persistent push
    // panels remembered per surface.
    const [overlayDrawer, setOverlayDrawer] = useState(null); // 'left' | 'right' | null
    const drawerMode = isDesktop ? 'push' : 'overlay';
    const leftEffectiveOpen = isDesktop ? leftOpen : overlayDrawer === 'left';
    const rightEffectiveOpen = isDesktop ? rightOpen : overlayDrawer === 'right';
    const closeOverlay = useCallback(() => setOverlayDrawer(null), []);
    const toggleLeft = useCallback(() => {
        if (isDesktop) toggleLeftDesktop();
        else setOverlayDrawer((d) => (d === 'left' ? null : 'left'));
    }, [isDesktop, toggleLeftDesktop]);
    const toggleRight = useCallback(() => {
        if (isDesktop) toggleRightDesktop();
        else setOverlayDrawer((d) => (d === 'right' ? null : 'right'));
    }, [isDesktop, toggleRightDesktop]);

    // ⌘K / Ctrl+K toggles the palette from anywhere in the workspace.
    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                setPaletteOpen((p) => !p);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const commands = useMemo(() => {
        if (!commandContext) return [];
        return buildCommands({
            ...commandContext,
            t,
            onToggleLeft: leftDrawer ? toggleLeft : undefined,
            onToggleRight: rightDrawer ? toggleRight : undefined,
        });
    }, [commandContext, t, leftDrawer, rightDrawer, toggleLeft, toggleRight]);

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* ── Header ── */}
            <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                {onBack && (
                    <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors shrink-0" title={t('notebooks.back', 'Back')} aria-label={t('notebooks.back', 'Back')}>
                        <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                )}
                {Icon && (
                    <div className="w-10 h-10 rounded-xl border-[1.5px] flex items-center justify-center shrink-0" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                        <Icon className="w-5 h-5" style={{ color: iconColor }} />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    {typeof title === 'string'
                        ? <h2 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }} title={title}>{title}</h2>
                        : title}
                    {meta && <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{meta}</p>}
                </div>

                <div className="shrink-0 flex items-center">
                    <SaveStateIndicator saveState={saveState} lastSavedAt={lastSavedAt} onRetry={onRetrySave} t={t} />
                </div>

                {/* View toggles */}
                <div className="flex items-center gap-0.5 shrink-0 pl-2 ml-1 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
                    {leftDrawer && (
                        <HeaderToggle icon={leftDrawer.icon || PanelLeft} label={leftDrawer.label || t('notebooks.toggle_sources', 'Toggle Sources')} active={leftEffectiveOpen} onClick={toggleLeft} />
                    )}
                    {headerExtras.map((x) => (
                        <HeaderToggle key={x.id} icon={x.icon} label={x.label} active={x.active} disabled={x.disabled} onClick={x.onClick} />
                    ))}
                    {rightDrawer && (
                        <HeaderToggle icon={rightDrawer.icon || MessageSquare} label={rightDrawer.label || t('notebooks.toggle_chat', 'Toggle AI Chat')} active={rightEffectiveOpen} onClick={toggleRight} />
                    )}
                    {commandContext && (
                        <HeaderToggle icon={CommandIcon} label={t('notebooks.command_palette', 'Command palette (⌘K)')} active={paletteOpen} onClick={() => setPaletteOpen(true)} />
                    )}
                </div>

                {headerActions}
            </div>

            {/* ── Banners ── */}
            {banners}

            {/* ── Body ── */}
            <div className="flex-1 flex overflow-hidden relative">
                {leftDrawer && (
                    <Drawer side="left" open={leftEffectiveOpen} width={LEFT_WIDTH} mode={drawerMode} onClose={closeOverlay} label={leftDrawer.label}>
                        {leftDrawer.node}
                    </Drawer>
                )}
                {secondaryLeft}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                    {children}
                </div>
                {rightDrawer && (
                    <Drawer side="right" open={rightEffectiveOpen} width={isDesktop ? rightWidth : Math.min(rightWidth, 380)} resizable={isDesktop} mode={drawerMode} onResizeStart={startDrag} onClose={closeOverlay} label={rightDrawer.label}>
                        {rightDrawer.node}
                    </Drawer>
                )}
            </div>

            {/* ── Command palette ── */}
            {commandContext && (
                <CommandPalette
                    open={paletteOpen}
                    onClose={() => setPaletteOpen(false)}
                    commands={commands}
                    placeholder={t('notebooks.command_palette_placeholder', 'Type a command…')}
                    emptyText={t('notebooks.command_palette_empty', 'No matching commands')}
                />
            )}

            {overlays}
        </div>
    );
}
