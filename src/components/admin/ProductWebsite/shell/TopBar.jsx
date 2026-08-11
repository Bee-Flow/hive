import React from 'react';
import AppIcon from '../../../AppIcon';
import SegmentedControl from '../../../shared/SegmentedControl';
import Tooltip from '../../../shared/Tooltip';
import SaveBadge from './SaveBadge';
import SiteVersionMenu from './SiteVersionMenu';
import LocaleMenu from './LocaleMenu';
import PublishMenu from './PublishMenu';
import Dropdown from './Dropdown';
import DeviceToggle from './DeviceToggle';

function IconBtn({ name, title, onClick, active = false }) {
    return (
        <Tooltip content={title}>
            <button
                type="button"
                onClick={onClick}
                aria-label={title}
                className={`p-1.5 rounded-md border ${active
                    ? 'border-[var(--border-default)] text-[var(--text-primary)] bg-[var(--bg-tertiary)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
            >
                <AppIcon name={name} className="w-4 h-4" />
            </button>
        </Tooltip>
    );
}

/**
 * Builder TopBar — the single chrome strip of the full-screen CMS editor.
 *
 * Left:   back to admin · site/version menu · translation-mode chip
 * Center: Preview | Sitemap | AI view switch
 * Right:  panel toggles · save badge · locale menu · publish · overflow
 */
export default function TopBar({
    onExit,
    siteMenuProps,
    localeMenuProps,
    publishProps,
    saveStatus,
    onRetrySave,
    view,
    onViewChange,
    device,
    onDeviceChange,
    assistantOpen,
    onToggleAssistant,
    assistantRunning = false,
    history,
    translationMode,
    translatingLocaleName,
    onExitTranslationMode,
    navOpen,
    onToggleNav,
    inspectorOpen,
    onToggleInspector,
    focusMode,
    onToggleFocusMode,
    onOpenAnalytics,
    onManageLanguages,
    isLive,
}) {
    return (
        <div className="h-12 shrink-0 flex items-center gap-2 px-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            {/* Left cluster */}
            <div className="flex items-center gap-1 min-w-0">
                {onExit && <IconBtn name="ArrowLeft" title="Back to admin" onClick={onExit} />}
                {onToggleAssistant && (
                    <button
                        type="button"
                        onClick={onToggleAssistant}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm border
                            ${assistantOpen
                                ? 'border-[var(--accent-primary)]/50 text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-subtle)]'}`}
                        title={assistantOpen ? 'Hide the AI assistant' : 'Build pages with the AI assistant'}
                    >
                        <AppIcon name="Sparkles" className={`w-4 h-4 ${assistantRunning ? 'animate-pulse' : ''}`} />
                        <span className="hidden sm:inline font-medium">Assistant</span>
                    </button>
                )}
                <SiteVersionMenu {...siteMenuProps} />
                {translationMode && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30 whitespace-nowrap">
                        <AppIcon name="Flag" className="w-3 h-3" />
                        Translating {translatingLocaleName}
                        <button
                            type="button"
                            onClick={onExitTranslationMode}
                            className="ml-0.5 hover:text-amber-300"
                            title="Back to the source language"
                        >
                            <AppIcon name="X" className="w-3 h-3" />
                        </button>
                    </span>
                )}
            </div>

            {/* Center cluster */}
            <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
                <SegmentedControl
                    size="sm"
                    ariaLabel="Editor view"
                    value={view}
                    onChange={onViewChange}
                    options={[
                        { value: 'preview', label: 'Preview' },
                        { value: 'sitemap', label: 'Sitemap' },
                    ]}
                />
                {view === 'preview' && onDeviceChange && (
                    <DeviceToggle value={device} onChange={onDeviceChange} />
                )}
            </div>

            {/* Right cluster */}
            <div className="flex items-center gap-1.5 shrink-0">
                <IconBtn name="PanelLeft" title={navOpen ? 'Hide pages & blocks' : 'Show pages & blocks'} active={navOpen} onClick={onToggleNav} />
                <IconBtn name="PanelRight" title={inspectorOpen ? 'Hide inspector' : 'Show inspector'} active={inspectorOpen} onClick={onToggleInspector} />
                {onToggleFocusMode && (
                    <IconBtn
                        name={focusMode ? 'Minimize2' : 'Maximize2'}
                        title="Focus mode (\)"
                        active={focusMode}
                        onClick={onToggleFocusMode}
                    />
                )}
                {history && !translationMode && (
                    <>
                        <div className="w-px h-5 bg-[var(--border-subtle)] mx-0.5" />
                        <span className={history.canUndo ? '' : 'opacity-40 pointer-events-none'}>
                            <IconBtn name="Undo2" title="Undo (Ctrl+Z)" onClick={history.onUndo} />
                        </span>
                        <span className={history.canRedo ? '' : 'opacity-40 pointer-events-none'}>
                            <IconBtn name="Redo2" title="Redo (Ctrl+Shift+Z)" onClick={history.onRedo} />
                        </span>
                    </>
                )}
                <div className="w-px h-5 bg-[var(--border-subtle)] mx-0.5" />
                <SaveBadge status={saveStatus} onRetry={onRetrySave} />
                <LocaleMenu {...localeMenuProps} />
                <PublishMenu {...publishProps} saveStatus={saveStatus} onRetrySave={onRetrySave} />
                <Dropdown
                    align="right"
                    width={224}
                    trigger={() => (
                        <button
                            type="button"
                            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                            title="More"
                            aria-label="More"
                        >
                            <AppIcon name="MoreHorizontal" className="w-4 h-4" />
                        </button>
                    )}
                >
                    {({ close }) => (
                        <ul className="py-1">
                            {isLive && (
                                <li>
                                    <a
                                        href="/"
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={close}
                                        className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                                    >
                                        <AppIcon name="ExternalLink" className="w-3.5 h-3.5" />
                                        Open live site
                                    </a>
                                </li>
                            )}
                            {onOpenAnalytics && (
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => { close(); onOpenAnalytics(); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] text-left"
                                    >
                                        <AppIcon name="BarChart3" className="w-3.5 h-3.5" />
                                        Website analytics →
                                    </button>
                                </li>
                            )}
                            {onManageLanguages && (
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => { close(); onManageLanguages(); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] text-left"
                                    >
                                        <AppIcon name="Languages" className="w-3.5 h-3.5" />
                                        Manage languages →
                                    </button>
                                </li>
                            )}
                        </ul>
                    )}
                </Dropdown>
            </div>
        </div>
    );
}
