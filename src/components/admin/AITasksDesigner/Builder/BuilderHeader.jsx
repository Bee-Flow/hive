import {
    ArrowLeft, Power, Eye, Play, Stethoscope, ChevronDown,
    Mail, Clock, Webhook, MousePointer2, Sparkles, Check, Loader2, AlertTriangle, Bot, ClipboardList,
    Undo2, Redo2, Layers, Trash2, Upload, MessageSquare, Box, FolderOpen,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import useTranslation from '../../../../hooks/useTranslation';
import PublishMenu from '../../AgentWizard/pickers/PublishMenu';
import { IconPicker } from './flow/stepIcons';

/**
 * Studio-style detail-view header for the automation builder.
 *
 * Mirrors KBDetailPage / SkillEditor chrome:
 *   back arrow • trigger icon avatar • inline-editable title • saving pill
 *   • status badge • action cluster (Diagnose / Dry-run / Pause-Activate)
 *
 * The Editor / Settings / Run history / Version history views sit inline in
 * this header row (a compact menu) so the builder gets one less bar above the
 * canvas. Caller passes `tab` + `onTabChange` so the active view is owned by
 * BuilderShell — easier to coordinate with floating panels and Focus mode.
 *
 * The Diagnose button gets a `ref` exposed via `diagnoseAnchorRef` so the
 * popover anchors to it instead of floating top-right.
 *
 * Flowlet scope: when `scope` is set ({key, title, refCount}) the title row
 * becomes a breadcrumb — automation title (click = exit scope) / flowlet
 * title (inline-renamable, commits through the scope-aware onRename) —
 * plus a neutral FLOWLET chip and a delete-flowlet action that's blocked
 * while any call_layer step still references the flowlet. Activate /
 * Dry-run / Diagnose / status stay whole-automation.
 */
export default function BuilderHeader({
    title,
    triggerKind,
    isActive,
    isDraft,
    canActivate = true,
    statusLabel,
    statusBadgeClass,
    canDiagnose,
    busy,
    onBack,
    onActivate,
    onDeactivate,
    onDryRun,
    onRunLive = null,
    onDiagnose,
    onRename,
    scope = null,          // null | { key, title, refCount }
    onExitScope = null,
    onDeleteLayer = null,
    diagnoseAnchorRef,
    savingState = 'idle', // idle | saving | saved | error
    tab,
    onTabChange,
    onUndo = null,
    onRedo = null,
    canUndo = false,
    canRedo = false,
    // Step mode (kind='block'): Publish / Sharing / chat-exposure replace the
    // Activate / Run / Diagnose cluster.
    mode = 'automation',
    step = null,
    orgGroups = [],
    onPublishStep = null,
    onSetStepSharing = null,
    onSetStepExpose = null,
    onSetStepIcon = null,
    onSetStepCategory = null,
    // When true, this bar is the top strip of the unified ribbon (Build tab):
    // it drops its bottom border + tints to match the ribbon group row below,
    // so the command bar and the ribbon read as one Office-style ribbon.
    flush = false,
    // Ribbon tab strip (Home/Apps/Reusable) — rendered inline between the view
    // switcher and the title (Word-style: tabs left, title to their right), so
    // the tabs share this row instead of taking one of their own. Build only.
    tabsSlot = null,
    // Compact "what this automation does" affordance, shown next to the title
    // (Build only) so the summary doesn't take a canvas row.
    infoSlot = null,
}) {
    const isStepMode = mode === 'step';
    // The inline-rename machinery edits whichever title is "current":
    // the flowlet title while scoped, the automation title otherwise.
    // onRename in BuilderShell routes the commit accordingly.
    const displayTitle = scope ? (scope.title || '') : (title || '');
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(displayTitle);
    const inputRef = useRef(null);
    useEffect(() => { if (!editing) setDraft(displayTitle); }, [displayTitle, editing]);
    useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
    // Don't carry an in-flight edit across a scope switch.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEditing(false);
    }, [scope?.key]);

    const TriggerIcon = scope ? Layers : pickTriggerIcon(triggerKind);

    const commit = () => {
        const next = (draft || '').trim();
        setEditing(false);
        if (!next || next === displayTitle) { setDraft(displayTitle); return; }
        onRename?.(next);
    };

    const onKey = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { setDraft(displayTitle); setEditing(false); }
    };

    // An empty flowlet stays deletable however many call steps point at it —
    // there is nothing in it to lose, and the palette creates one WITH a call
    // step, which made every fresh flowlet un-deletable (BFSF-340).
    const layerInUse = (scope?.refCount || 0) > 0 && !scope?.empty;

    return (
        <div className={flush ? 'bg-[var(--bg-secondary)]/40' : 'border-b border-[var(--border-default)] bg-[var(--bg-primary)]'}>
            <div className="flex items-center gap-x-3 gap-y-1 px-5 py-1.5 flex-wrap">
                <button
                    onClick={onBack}
                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition"
                    // Say WHERE back goes — "Back to list" named no destination.
                    title="Back to Routines"
                    aria-label="Back to Routines"
                >
                    <ArrowLeft size={18} />
                </button>
                {/* Ribbon tabs (Build only). The view switcher (Build ▾) sits on
                    the right, next to Run flow. */}
                {tabsSlot}
                {isStepMode ? (
                    <IconPicker
                        value={step?.icon || ''}
                        onChange={(name) => onSetStepIcon?.(name)}
                        title="Choose a symbol for this Step"
                        buttonClassName="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] flex items-center justify-center flex-shrink-0 text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition ml-auto"
                        placeholder={<Box size={15} className="text-[var(--text-primary)]" />}
                    />
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] flex items-center justify-center flex-shrink-0 ml-auto">
                        <TriggerIcon size={15} className="text-[var(--text-primary)]" />
                    </div>
                )}
                <div className="min-w-0 max-w-[22rem] flex items-center gap-2">
                    {scope && (
                        <>
                            <button
                                type="button"
                                onClick={onExitScope}
                                title="Back to the automation canvas"
                                className="text-base font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] truncate hover:bg-[var(--bg-secondary)] rounded px-1 -mx-1 transition text-left flex-shrink min-w-0"
                            >
                                {title || 'Untitled automation'}
                            </button>
                            <span className="text-base text-[var(--text-tertiary)] flex-shrink-0">/</span>
                        </>
                    )}
                    {editing ? (
                        <input
                            ref={inputRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commit}
                            onKeyDown={onKey}
                            className="flex-1 min-w-0 text-base font-semibold bg-transparent border-b border-[var(--accent-primary,var(--text-primary))] outline-none text-[var(--text-primary)]"
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            title="Click to rename"
                            className="text-base font-semibold text-[var(--text-primary)] truncate hover:bg-[var(--bg-secondary)] rounded px-1 -mx-1 transition text-left"
                        >
                            {displayTitle || (scope ? 'Untitled flowlet' : 'Untitled automation')}
                        </button>
                    )}
                    {scope && (
                        // Neutral chip — same styling as the Draft status badge.
                        <span className="text-[11px] uppercase tracking-wide font-medium px-2 py-1 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] flex-shrink-0">
                            Flowlet
                        </span>
                    )}
                    {isStepMode && (
                        <CategoryField value={step?.category || ''} onCommit={onSetStepCategory} />
                    )}
                    {scope && onDeleteLayer && (
                        <button
                            type="button"
                            onClick={layerInUse ? undefined : onDeleteLayer}
                            disabled={layerInUse}
                            title={layerInUse
                                ? `Used by ${scope.refCount} step${scope.refCount === 1 ? '' : 's'} — remove those first`
                                : ((scope?.refCount || 0) > 0
                                    ? `Delete this empty flowlet (and the ${scope.refCount} “Call flowlet” step${scope.refCount === 1 ? '' : 's'} that use${scope.refCount === 1 ? 's' : ''} it)`
                                    : 'Delete this flowlet')}
                            aria-label="Delete flowlet"
                            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-red-600 hover:bg-[var(--bg-secondary)] transition disabled:opacity-40 disabled:hover:text-[var(--text-tertiary)] disabled:hover:bg-transparent flex-shrink-0"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                    <SavingPill state={savingState} />
                </div>
                {/* Step mode keeps its own status pill; automation status is
                    merged into the Activate/Pause control on the right. */}
                {isStepMode && (
                    <span className="text-[11px] uppercase tracking-wide font-medium px-2 py-1 rounded-full flex-shrink-0 bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                        {step?.publishedVersion != null ? 'Published' : 'Draft'}
                    </span>
                )}
                {infoSlot}
                <div className="ml-auto flex items-center gap-2">
                    {/* On Build (flush) undo/redo live at the start of the ribbon
                        groups row instead (Word-style); show them here only on the
                        other views, which have no ribbon row. */}
                    {!flush && onUndo && (
                        <>
                            <div className="flex items-center gap-0.5">
                                <button
                                    type="button"
                                    onClick={onUndo}
                                    disabled={!canUndo}
                                    // Three things in this product are "history";
                                    // this one is the canvas undo, and saying so
                                    // stops it being read as Saved versions.
                                    title="Undo your last canvas change (⌘Z) — this is not a saved version"
                                    aria-label="Undo"
                                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                    <Undo2 size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={onRedo}
                                    disabled={!canRedo}
                                    title="Redo your last undone canvas change (⌘⇧Z)"
                                    aria-label="Redo"
                                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                    <Redo2 size={14} />
                                </button>
                            </div>
                            <Sep />
                        </>
                    )}
                    <BarGroup>
                    {isStepMode ? (
                        <>
                            {onTabChange && <ViewMenu tab={tab} onTabChange={onTabChange} />}
                            <StepActionCluster
                                busy={busy}
                                step={step}
                                orgGroups={orgGroups}
                                onPublishStep={onPublishStep}
                                onSetStepSharing={onSetStepSharing}
                                onSetStepExpose={onSetStepExpose}
                            />
                        </>
                    ) : (
                        <>
                            <RunFlowMenu busy={busy} onDryRun={onDryRun} onRunLive={onRunLive} />
                            {onTabChange && <ViewMenu tab={tab} onTabChange={onTabChange} />}
                            {canDiagnose && (
                                <button
                                    ref={diagnoseAnchorRef}
                                    onClick={onDiagnose}
                                    disabled={busy}
                                    aria-label="Diagnose"
                                    title="Probe the trigger pipeline (subscription, credentials, Gmail, filter)"
                                    className="p-1.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition disabled:opacity-50"
                                >
                                    <Stethoscope size={14} />
                                </button>
                            )}
                            {/* Status label + action merged into one pill: the
                                left segment shows LIVE/PAUSED/DRAFT, the right is
                                the Activate or Pause action. */}
                            <div className="inline-flex items-stretch rounded-full overflow-hidden ring-1 ring-[var(--border-default)] shadow-sm">
                                <span className={`flex items-center px-2.5 text-[11px] uppercase tracking-wide font-medium ${statusBadgeClass}`}>
                                    {statusLabel}
                                </span>
                                {isActive ? (
                                    <button
                                        onClick={onDeactivate}
                                        disabled={busy}
                                        title="Pause this automation"
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition disabled:opacity-50"
                                    >
                                        <Power size={14} /> Pause
                                    </button>
                                ) : (
                                    <button
                                        onClick={onActivate}
                                        disabled={busy || !canActivate}
                                        title={canActivate
                                            ? (isDraft ? 'Activate — finalises this draft and goes live' : 'Activate')
                                            : 'Add a trigger and at least one step first'}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50"
                                    >
                                        <Power size={14} /> Activate
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                    </BarGroup>
                </div>
            </div>
        </div>
    );
}

/**
 * Step (kind='block') category field. The value groups the Step under a
 * heading in every automation's add-step menu. Commits on blur / Enter so we
 * don't write on each keystroke.
 */
function CategoryField({ value, onCommit }) {
    const [draft, setDraft] = useState(value || '');
    useEffect(() => { setDraft(value || ''); }, [value]);
    const commit = () => { if ((draft || '') !== (value || '')) onCommit?.(draft.trim()); };
    return (
        <span className="inline-flex items-center gap-1 flex-shrink-0 text-[var(--text-tertiary)]">
            <FolderOpen size={13} />
            <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                placeholder="Add a category"
                title="Group this Step under a category in the add-step menu"
                maxLength={60}
                className="w-32 px-1.5 py-0.5 text-xs rounded bg-transparent border border-transparent hover:border-[var(--border-default)] focus:border-[var(--accent)] focus:bg-[var(--bg-secondary)] text-[var(--text-secondary)] focus:outline-none transition"
            />
        </span>
    );
}

/**
 * Step (kind='block') header cluster: the shared PublishMenu (Personal /
 * Entire Org / specific groups — identical to Agents & Knowledge Bases), an
 * "Available in chat" toggle, and a Publish button. Publish rolls the current
 * draft out to every automation / chat that uses the Step.
 */
function StepActionCluster({ busy, step, orgGroups = [], onPublishStep, onSetStepSharing, onSetStepExpose }) {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const isShared = !!step?.isPublished;
    const exposed = !!step?.exposeAsTool;
    const sharedGroups = Array.isArray(step?.sharedGroups) ? step.sharedGroups : [];
    // Toggling a group while Personal flips the Step to published (groups only
    // make sense once shared) — mirrors the KB / Agent menu semantics.
    const toggleGroup = (gid) => {
        const next = sharedGroups.includes(gid)
            ? sharedGroups.filter(g => g !== gid)
            : [...sharedGroups, gid];
        onSetStepSharing?.({ isPublished: true, sharedGroups: next });
    };
    return (
        <div className="relative flex items-center gap-2">
            <PublishMenu
                t={t}
                agent={step}
                open={menuOpen}
                onToggle={() => setMenuOpen(v => !v)}
                onClose={() => setMenuOpen(false)}
                isPublished={isShared}
                onSetPersonal={() => { onSetStepSharing?.({ isPublished: false, sharedGroups: [] }); setMenuOpen(false); }}
                onSetEntireOrg={() => { onSetStepSharing?.({ isPublished: true, sharedGroups: [] }); setMenuOpen(false); }}
                embedEnabled={false}
                orgGroups={orgGroups}
                sharedGroups={sharedGroups}
                onToggleGroup={toggleGroup}
            />
            <button
                type="button"
                onClick={() => onSetStepExpose?.(!exposed)}
                disabled={busy}
                title="Make this Step callable as a tool in direct/agent chat"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition disabled:opacity-50 ${
                    exposed
                        ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-tertiary)]'
                }`}
            >
                <MessageSquare size={14} /> In chat
            </button>
            <button
                onClick={onPublishStep}
                disabled={busy}
                title="Publish — automations and chats using this Step pick up the change"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 ring-1 ring-[var(--accent)] transition disabled:opacity-50 shadow-sm"
            >
                <Upload size={14} /> Publish
            </button>
        </div>
    );
}

/**
 * Run-flow split control. One button, two choices picked at click time:
 *   - Dry-run (preview) — synthesises side-effects, no real egress.
 *   - Run live          — executes every step for real (parent confirms first).
 * When no live handler is wired the menu collapses to a plain Dry-run button.
 */
function RunFlowMenu({ busy, onDryRun, onRunLive }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    if (typeof onRunLive !== 'function') {
        return (
            <button
                onClick={onDryRun}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition disabled:opacity-50"
            >
                <Eye size={14} /> Dry-run
            </button>
        );
    }

    const pick = (fn) => { setOpen(false); fn?.(); };
    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                disabled={busy}
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition disabled:opacity-50"
            >
                <Play size={14} /> Run flow <ChevronDown size={12} className="opacity-60" />
            </button>
            {open && (
                <div role="menu" className="absolute right-0 top-full mt-1 z-40 w-56 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg py-1">
                    <button
                        role="menuitem"
                        onClick={() => pick(onDryRun)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] transition flex items-start gap-2"
                    >
                        <Eye size={14} className="mt-0.5 shrink-0 text-[var(--text-secondary)]" />
                        <span className="min-w-0">
                            <span className="block text-[var(--text-primary)]">Dry-run (preview)</span>
                            <span className="block text-[11px] text-[var(--text-tertiary)]">No real actions — safe preview</span>
                        </span>
                    </button>
                    <button
                        role="menuitem"
                        onClick={() => pick(onRunLive)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] transition flex items-start gap-2"
                    >
                        <Play size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                        <span className="min-w-0">
                            <span className="block text-[var(--text-primary)]">Run live</span>
                            <span className="block text-[11px] text-[var(--text-tertiary)]">Executes every step for real</span>
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * View switcher (Editor / Settings / Run history / Version history). Office
 * hides secondary surfaces behind a menu rather than spending bar width on
 * always-visible tabs — this shows the current view as one compact button and
 * reveals the others on click, so the rest stay one click away without
 * crowding the ribbon's command strip.
 *
 * Note the id/label split on the first entry: the label reads "Editor"
 * alongside Settings and Run history, but the id stays `build` — it is the
 * persisted `initialTab` value and is threaded through half a dozen call
 * sites (BFSF-343).
 *
 * Version history is its own view rather than a section at the bottom of
 * Settings: buried there it was hard to find and hard to read, and it kept
 * Settings from growing into what it is for (BFSF-344/341/342).
 */
// Two of the four views were both called "history" — and the undo buttons sat
// beside them as a third. Runs = what happened when it ran; Saved versions =
// earlier versions you can go back to. The ids stay ('history' is a persisted
// initialTab value, BFSF-343); only the words change.
const VIEWS = [
    { id: 'build', label: 'Editor', desc: 'Design the routine on the canvas' },
    { id: 'settings', label: 'Settings', desc: 'Name, sharing and behaviour' },
    { id: 'history', label: 'Runs', desc: 'What happened each time this routine ran' },
    { id: 'versions', label: 'Saved versions', desc: 'Earlier versions of the routine you can go back to' },
];
function ViewMenu({ tab, onTabChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);
    const current = VIEWS.find(v => v.id === tab) || VIEWS[0];
    return (
        <div ref={ref} className="relative flex-shrink-0">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
            >
                {current.label}
                <ChevronDown size={13} className="opacity-60" />
            </button>
            {open && (
                <div role="menu" className="absolute left-0 top-full mt-1 z-40 w-44 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg py-1">
                    {VIEWS.map(v => (
                        <button
                            key={v.id}
                            role="menuitemradio"
                            aria-checked={v.id === tab}
                            // The accessible name is the LABEL alone — the desc
                            // below is display-only (aria-hidden), so name
                            // queries and screen readers stay concise.
                            aria-label={v.label}
                            onClick={() => { onTabChange(v.id); setOpen(false); }}
                            className={`w-full text-left px-3 py-1.5 text-sm flex items-start gap-2 transition ${
                                v.id === tab
                                    ? 'text-[var(--text-primary)] bg-[var(--bg-secondary)]'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <Check size={13} className={`mt-0.5 ${v.id === tab ? 'opacity-100' : 'opacity-0'}`} />
                            <span className="min-w-0">
                                <span className="block">{v.label}</span>
                                <span aria-hidden="true" className="block text-[10px] text-[var(--text-tertiary)] leading-snug">{v.desc}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** A compact header cluster (no under-label) for the run/publish actions. */
function BarGroup({ children }) {
    return <div className="flex items-center gap-2">{children}</div>;
}

/** Thin vertical divider separating command groups in the bar. */
function Sep() {
    return <span aria-hidden="true" className="h-5 w-px bg-[var(--border-default)]" />;
}

function SavingPill({ state }) {
    if (state === 'idle') return null;
    if (state === 'saving') {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                <Loader2 size={11} className="animate-spin" /> Saving…
            </span>
        );
    }
    if (state === 'saved') {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <Check size={11} /> Saved
            </span>
        );
    }
    if (state === 'error') {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400" title="Save failed — try again">
                <AlertTriangle size={11} /> Error
            </span>
        );
    }
    return null;
}

function pickTriggerIcon(kind) {
    if (kind === 'schedule') return Clock;
    if (kind === 'webhook') return Webhook;
    if (kind === 'form') return ClipboardList;
    if (kind === 'manual') return MousePointer2;
    if (kind === 'app_event') return Mail; // today: only Gmail
    if (kind === 'agent_call') return Bot;
    return Sparkles;
}
