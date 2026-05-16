import React, { useState } from 'react';
import { Trash2, Copy, Code2, Hash, Pause, Play, Mail, Clock, Webhook, Bot, MousePointer2 } from 'lucide-react';
import ContextMenu from './ContextMenu';

/**
 * One row in the unified Routines sidebar. Used for both Automations and
 * Prompt Tasks; the parent tells us which `kind` so we can render the
 * right meta line and right-click menu items.
 *
 * Visual rules:
 *   - Mirrors SkillsStudio/AgentStudio: icon + name + meta + hover trash.
 *   - Status dot uses emerald/amber/red/neutral matching diagram nodes
 *     and the rest of the studio (no purple — strict).
 *   - DRAFT chip replaces the old yellow row tint so live + draft rows
 *     have the same height and the user's eye lands on the title first.
 */
export default function RoutineRow({
    routine,
    kind,
    selected,
    onSelect,
    onDuplicate,
    onExportJson,
    onCopyId,
    onDelete,
    onToggleActive,
    canManage = true,
    liveRunning = false,
}) {
    const [contextPos, setContextPos] = useState(null);

    const isAutomation = kind === 'automation';
    const isActive = !!routine.isActive;
    const isDraft = !!routine.isDraft;
    const lastStatus = routine.lastStatus;
    // Live-running poll (from getActiveRuns) outranks the persisted
    // lastStatus so we get an n8n-style "● now executing" indicator
    // within ~5s of a run kicking off.
    const dotColor = liveRunning
        ? 'bg-[var(--accent)] animate-pulse'
        : !isActive
            ? 'bg-[var(--text-tertiary)]'
            : lastStatus === 'error'
                ? 'bg-red-500'
                : lastStatus === 'running'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

    // PascalCase makes it explicit this is a React component, not a DOM tag —
    // otherwise a lowercase rename would silently emit a literal HTML tag.
    const TriggerIcon = isAutomation ? triggerIcon(routine) : Bot;
    const title = routine.title || (isAutomation ? 'Untitled automation' : 'Untitled task');
    // Trimmed description coalesces — empty strings should fall through to the
    // title instead of being shown as an empty tooltip.
    const tooltip = (routine.description || '').trim() || title;

    const meta = isAutomation ? automationMeta(routine) : taskMeta(routine);

    // Single source of truth for "can the user mutate this routine". Both the
    // context-menu opener and the hover-delete button honor it so users see
    // a consistent permission story regardless of how they try to act.
    const canMutate = canManage && (
        (isAutomation && !!onToggleActive)
        || !!onDuplicate || !!onExportJson || !!onCopyId || !!onDelete
    );

    const onContextMenu = (e) => {
        if (!canMutate) return;
        e.preventDefault();
        setContextPos({ x: e.clientX, y: e.clientY });
    };

    const menuItems = [];
    if (isAutomation && onToggleActive) {
        menuItems.push({
            label: isActive ? 'Pause' : 'Activate',
            icon: isActive ? <Pause size={13} /> : <Play size={13} />,
            onClick: onToggleActive,
        });
    }
    if (onDuplicate) menuItems.push({ label: 'Duplicate', icon: <Copy size={13} />, onClick: onDuplicate });
    if (onExportJson) menuItems.push({ label: 'Export JSON', icon: <Code2 size={13} />, onClick: onExportJson });
    if (onCopyId) menuItems.push({ label: 'Copy ID', icon: <Hash size={13} />, onClick: onCopyId });
    if (onDelete) {
        if (menuItems.length) menuItems.push({ separator: true });
        menuItems.push({ label: 'Delete', icon: <Trash2 size={13} />, onClick: onDelete, danger: true });
    }

    return (
        <>
            <div
                onClick={onSelect}
                onContextMenu={onContextMenu}
                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm transition ${
                    selected
                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                }`}
                title={tooltip}
            >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                <TriggerIcon size={14} className="flex-shrink-0 text-[var(--text-tertiary)]" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate">{title}</span>
                        {isDraft && (
                            <span className="text-[9px] uppercase tracking-wide font-bold text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1 py-px rounded">
                                draft
                            </span>
                        )}
                    </div>
                    {meta && (
                        <div className="text-[10.5px] text-[var(--text-tertiary)] truncate">
                            {meta}
                        </div>
                    )}
                </div>
                {canMutate && onDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        title="Delete"
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-500 transition flex-shrink-0"
                    >
                        <Trash2 size={13} />
                    </button>
                )}
            </div>
            <ContextMenu
                position={contextPos}
                items={menuItems}
                onClose={() => setContextPos(null)}
            />
        </>
    );
}

function triggerIcon(routine) {
    const kind = routine.triggerType || routine.definition?.trigger?.kind || 'manual';
    if (kind === 'schedule') return Clock;
    if (kind === 'webhook') return Webhook;
    if (kind === 'manual') return MousePointer2;
    if (kind === 'app_event') return Mail; // today: only Gmail mail.new
    return Bot;
}

// Shallow cron syntax check — catches obvious typos (wrong field count, bad
// characters) without pulling in cron-parser. Full semantic validation lives
// server-side via /api/automation/_schedule/preview.
function isCronShapeValid(s) {
    if (!s || typeof s !== 'string') return false;
    const parts = s.trim().split(/\s+/);
    if (parts.length !== 5 && parts.length !== 6) return false;
    const fieldRe = /^[\d*/,\-?LW]+$/i;
    return parts.every(p => fieldRe.test(p));
}

function automationMeta(a) {
    const kind = a.triggerType || a.definition?.trigger?.kind || 'manual';
    if (kind === 'schedule' && a.scheduleCron) {
        if (!isCronShapeValid(a.scheduleCron)) {
            return `⚠ invalid cron: ${a.scheduleCron}`;
        }
        return `${a.scheduleCron} · ${a.scheduleTz || 'UTC'}`;
    }
    if (kind === 'app_event') {
        const ev = a.definition?.trigger?.appEvent;
        if (ev) return `${ev.provider}.${ev.event}${a.lastStatus ? ` · ${a.lastStatus}` : ''}`;
        return `app event${a.lastStatus ? ` · ${a.lastStatus}` : ''}`;
    }
    if (kind === 'manual') return a.lastStatus ? `manual · ${a.lastStatus}` : 'manual';
    return kind;
}

function taskMeta(t) {
    const parts = [];
    if (t.repeatInterval) parts.push(t.repeatInterval);
    if (t.lastStatus) parts.push(t.lastStatus);
    return parts.join(' · ');
}
