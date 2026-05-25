import { ChevronDown, ChevronRight, Database, MousePointer2, Clock, Webhook, Zap, Sparkles, GitBranch, Repeat, Code, Bell, Workflow } from 'lucide-react';
import React, { useState } from 'react';
import { previewValue } from '../../../../../utils/bindingHelpers';

/**
 * Right-side variable browser inside the StepInspector. Lists all
 * upstream nodes (trigger + reachable steps) with their output fields
 * and sample values, n8n-style. Clicking a leaf calls onInsert(path)
 * with the bare dotted path; the parent decides whether to wrap it as
 * `{{...}}` (template) or insert raw (expression).
 *
 * Props:
 *   groups    — output of useUpstreamVariables(definition, currentStepId, catalog)
 *   onInsert  — (path: string) => void
 *   activeFieldLabel — optional string shown at the top so the user knows
 *                     which field the insert will target
 */
export default function VariableTree({ groups = [], onInsert, activeFieldLabel = null }) {
    if (!groups || groups.length === 0) {
        return (
            <div className="h-full flex flex-col">
                <TreeHeader activeFieldLabel={activeFieldLabel} />
                <div className="flex-1 px-4 py-6 text-xs text-[var(--text-tertiary)] italic">
                    No upstream data yet. Connect this step to a previous one to see its output here.
                </div>
            </div>
        );
    }
    return (
        <div className="h-full flex flex-col">
            <TreeHeader activeFieldLabel={activeFieldLabel} />
            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
                {groups.map(group => (
                    <GroupNode key={group.id} group={group} onInsert={onInsert} />
                ))}
            </div>
            <div className="px-3 py-2 border-t border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)]">
                Click a value to insert it. Sample values are placeholders, not real run data.
            </div>
        </div>
    );
}

function TreeHeader({ activeFieldLabel }) {
    return (
        <div className="px-3 py-2 border-b border-[var(--border-default)]">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
                Variables
            </div>
            {activeFieldLabel && (
                <div className="mt-0.5 text-[11px] text-[var(--text-secondary)] truncate">
                    insert into <span className="font-mono">{activeFieldLabel}</span>
                </div>
            )}
        </div>
    );
}

const KIND_ICON = {
    trigger:            (k) => triggerIcon(k),
    integration_action: () => <Database size={12} />,
    ai_step:            () => <Sparkles size={12} />,
    condition:          () => <GitBranch size={12} />,
    loop:               () => <Repeat size={12} />,
    code:               () => <Code size={12} />,
    notification:       () => <Bell size={12} />,
};

function triggerIcon(group) {
    const label = String(group.label || '').toLowerCase();
    if (label.includes('schedule')) return <Clock size={12} />;
    if (label.includes('webhook')) return <Webhook size={12} />;
    if (label.includes('manual')) return <MousePointer2 size={12} />;
    if (label.includes('app_event') || label.includes('gmail') || label.includes('calendar') || label.includes('drive') || label.includes('nextcloud')) return <Zap size={12} />;
    return <Workflow size={12} />;
}

function GroupNode({ group, onInsert }) {
    const [open, setOpen] = useState(true);
    const Icon = KIND_ICON[group.kind] ? KIND_ICON[group.kind](group) : <Workflow size={12} />;
    return (
        <div className="border-b border-[var(--border-default)] last:border-b-0">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--bg-secondary)]"
            >
                {open ? <ChevronDown size={12} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={12} className="text-[var(--text-tertiary)]" />}
                <span className="text-[var(--text-secondary)]">{Icon}</span>
                <span className="text-[var(--text-primary)] font-medium truncate">{group.label}</span>
                <span className="ml-auto text-[10px] text-[var(--text-tertiary)] font-mono truncate max-w-[140px]" title={group.basePath}>
                    {group.basePath}
                </span>
            </button>
            {open && (
                <div className="pb-1">
                    {(group.fields || []).map(f => (
                        <FieldLeaf key={f.path} field={f} onInsert={onInsert} depth={1} />
                    ))}
                    {(group.fields || []).length === 0 && (
                        <div className="px-6 py-1 text-[11px] text-[var(--text-tertiary)] italic">No fields</div>
                    )}
                </div>
            )}
        </div>
    );
}

function FieldLeaf({ field, onInsert, depth }) {
    const [open, setOpen] = useState(false);
    const indent = 12 + depth * 14;
    const hasChildren = Array.isArray(field.children) && field.children.length > 0;

    const onClick = (e) => {
        // For children-bearing rows clicking the chevron expands; clicking
        // the rest of the row inserts the parent path.
        if (hasChildren && e.target.closest('[data-expand-btn]')) {
            setOpen(o => !o);
            return;
        }
        onInsert?.(field.path);
    };

    const handleDragStart = (e) => {
        e.dataTransfer.setData('text/plain', field.path);
        e.dataTransfer.setData('application/x-binding-path', field.path);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div>
            <div
                draggable
                onDragStart={handleDragStart}
                onClick={onClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInsert?.(field.path); } }}
                className="group flex items-center gap-2 py-1 text-[11px] cursor-pointer select-none hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] focus:outline-none"
                style={{ paddingLeft: indent, paddingRight: 8 }}
                title={field.path}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        data-expand-btn
                        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                        className="shrink-0 p-0.5 -m-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                ) : (
                    <span className="shrink-0 w-3" />
                )}
                <span className="text-[var(--text-primary)] truncate min-w-0">{field.key}</span>
                <span className="ml-auto text-[10px] text-[var(--text-tertiary)] truncate max-w-[140px] font-mono">
                    {previewValue(field.sample, 30)}
                </span>
            </div>
            {hasChildren && open && field.children.map(c => (
                <FieldLeaf key={c.path} field={c} onInsert={onInsert} depth={depth + 1} />
            ))}
        </div>
    );
}
