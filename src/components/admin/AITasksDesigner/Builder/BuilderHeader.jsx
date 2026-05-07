import React, { useEffect, useRef, useState } from 'react';
import {
    ArrowLeft, Power, Eye, Stethoscope, ChevronDown,
    Mail, Clock, Webhook, MousePointer2, Sparkles, Check, Loader2, AlertTriangle,
} from 'lucide-react';

/**
 * Studio-style detail-view header for the automation builder.
 *
 * Mirrors KBDetailPage / SkillEditor chrome:
 *   back arrow • trigger icon avatar • inline-editable title • saving pill
 *   • status badge • action cluster (Diagnose / Dry-run / Pause-Activate)
 *
 * Below the header lives the tabs strip (Build / Settings / Run history /
 * JSON). Caller passes `tab` + `onTabChange` so the active tab is owned by
 * BuilderShell — easier to coordinate with floating panels and Focus mode.
 *
 * The Diagnose button gets a `ref` exposed via `diagnoseAnchorRef` so the
 * popover anchors to it instead of floating top-right.
 */
export default function BuilderHeader({
    title,
    triggerKind,
    isActive,
    isDraft,
    statusLabel,
    statusBadgeClass,
    canDiagnose,
    busy,
    onBack,
    onActivate,
    onDeactivate,
    onDryRun,
    onDiagnose,
    onRename,
    diagnoseAnchorRef,
    savingState = 'idle', // idle | saving | saved | error
    tab,
    onTabChange,
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(title || '');
    const inputRef = useRef(null);
    useEffect(() => { if (!editing) setDraft(title || ''); }, [title, editing]);
    useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

    const TriggerIcon = pickTriggerIcon(triggerKind);

    const commit = () => {
        const next = (draft || '').trim();
        setEditing(false);
        if (!next || next === title) { setDraft(title || ''); return; }
        onRename?.(next);
    };

    const onKey = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { setDraft(title || ''); setEditing(false); }
    };

    return (
        <div className="border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
            <div className="flex items-center gap-3 px-6 py-3">
                <button
                    onClick={onBack}
                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition"
                    title="Back to list"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="w-9 h-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] flex items-center justify-center flex-shrink-0">
                    <TriggerIcon size={16} className="text-[var(--text-primary)]" />
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
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
                            {title || 'Untitled automation'}
                        </button>
                    )}
                    <SavingPill state={savingState} />
                </div>
                <span className={`text-[11px] uppercase tracking-wide font-medium px-2 py-1 rounded-full ${statusBadgeClass}`}>
                    {statusLabel}
                </span>
                <button
                    onClick={onDryRun}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition disabled:opacity-50"
                >
                    <Eye size={14} /> Dry-run
                </button>
                {canDiagnose && (
                    <button
                        ref={diagnoseAnchorRef}
                        onClick={onDiagnose}
                        disabled={busy}
                        title="Probe the trigger pipeline (subscription, credentials, Gmail, filter)"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition disabled:opacity-50"
                    >
                        <Stethoscope size={14} /> Diagnose
                    </button>
                )}
                {isActive ? (
                    <button
                        onClick={onDeactivate}
                        disabled={busy}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/40 hover:bg-[var(--accent)]/25 transition disabled:opacity-50"
                    >
                        <Power size={14} /> Pause
                        <ChevronDown size={12} className="opacity-60" />
                    </button>
                ) : (
                    <button
                        onClick={onActivate}
                        disabled={busy || isDraft}
                        title={isDraft ? 'Finalise the draft via the chat first' : 'Activate'}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 ring-1 ring-[var(--accent)] transition disabled:opacity-50 shadow-sm"
                    >
                        <Power size={14} /> Activate
                    </button>
                )}
            </div>

            {/* Tabs strip — matches SkillEditor / KBDetailPage borders. */}
            <div className="flex items-center gap-0 px-6 -mb-px text-sm">
                <Tab id="build"    active={tab} onClick={onTabChange}>Build</Tab>
                <Tab id="settings" active={tab} onClick={onTabChange}>Settings</Tab>
                <Tab id="history"  active={tab} onClick={onTabChange}>Run history</Tab>
                <Tab id="json"     active={tab} onClick={onTabChange}>JSON</Tab>
            </div>
        </div>
    );
}

function Tab({ id, active, onClick, children }) {
    const isActive = active === id;
    return (
        <button
            onClick={() => onClick(id)}
            className={`px-3 py-2 border-b-2 transition ${
                isActive
                    ? 'border-[var(--accent-primary,var(--accent))] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            }`}
        >
            {children}
        </button>
    );
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
    if (kind === 'manual') return MousePointer2;
    if (kind === 'app_event') return Mail; // today: only Gmail
    return Sparkles;
}
