import { ChevronDown, ChevronRight, Database, MousePointer2, Clock, Webhook, Zap, Sparkles, GitBranch, Repeat, Code, Bell, Workflow, GripVertical, Globe, ClipboardList } from 'lucide-react';
import React, { useState } from 'react';
import { previewValue, walkPath } from '../../../../../utils/bindingHelpers';
import { startPathDrag } from './bindingDnd';

// Resolve the value to SHOW for a path: prefer the real last-run / pinned
// value (from previewSample) so the user sees actual data, falling back to the
// typed sample placeholder when there's no run yet.
function shownValue(path, sample, previewSample) {
    if (previewSample) {
        const v = walkPath(path, previewSample);
        if (v !== undefined) return v;
    }
    return sample;
}

/**
 * Start an HTML5 drag carrying a binding path — dropped onto a BindingField /
 * TemplateField it inserts the reference (whole-node output or a leaf field).
 *
 * BOTH MIME types matter: `application/x-binding-path` is what bindingDnd.js
 * reads, `text/plain` is what a plain <input> gets when the drop lands on a
 * control that has no binding handler.
 *
 * Moved to bindingDnd.js (the drag/drop plumbing module) now that the
 * VariablePicker popover is a drag source too; re-exported here so the existing
 * importers keep resolving.
 */
export { startPathDrag };

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
export default function VariableTree({ groups = [], onInsert, activeFieldLabel = null, previewSample = null }) {
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
            <div className="flex-1 overflow-auto custom-scrollbar py-1">
                {groups.map(group => (
                    <GroupNode key={group.id} group={group} onInsert={onInsert} previewSample={previewSample} />
                ))}
            </div>
            <div className="px-3 py-2 border-t border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)]">
                Click a value to insert it, or drag it into a field. Drag a step's row to use its whole output.
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
    http_request:       () => <Globe size={12} />,
    form_page:          () => <ClipboardList size={12} />,
};

function triggerIcon(group) {
    const label = String(group.label || '').toLowerCase();
    if (label.includes('schedule')) return <Clock size={12} />;
    if (label.includes('webhook')) return <Webhook size={12} />;
    if (label.includes('manual')) return <MousePointer2 size={12} />;
    if (label.includes('app_event') || label.includes('gmail') || label.includes('calendar') || label.includes('drive') || label.includes('nextcloud')) return <Zap size={12} />;
    return <Workflow size={12} />;
}

/**
 * The group label already names the step; the caption is just a hint of the
 * base path. Strip the `steps.<id>.` prefix so the cryptic id never shows
 * (e.g. `steps.ai_87e358.output` → `output`); trigger/loop bases are kept.
 * Full id-bearing path stays available via the element `title`.
 */
function friendlyBasePath(basePath) {
    return String(basePath || '').replace(/^steps\.[^.]+\./, '');
}

function GroupNode({ group, onInsert, previewSample }) {
    const [open, setOpen] = useState(true);
    const Icon = KIND_ICON[group.kind] ? KIND_ICON[group.kind](group) : <Workflow size={12} />;
    // Drag the whole node row to reference its ENTIRE output (e.g.
    // steps.<id>.output); click toggles the field list.
    return (
        <div className="border-b border-[var(--border-default)] last:border-b-0 group/grp">
            <div
                draggable
                onDragStart={(e) => startPathDrag(e, group.basePath)}
                onClick={() => setOpen(o => !o)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
                title={`Drag to use the whole output (${group.basePath})`}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-[var(--bg-secondary)] cursor-grab active:cursor-grabbing select-none"
            >
                <GripVertical size={11} className="shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/grp:opacity-60" />
                {open ? <ChevronDown size={12} className="shrink-0 text-[var(--text-tertiary)]" /> : <ChevronRight size={12} className="shrink-0 text-[var(--text-tertiary)]" />}
                <span className="text-[var(--text-secondary)]">{Icon}</span>
                <span className="text-[var(--text-primary)] font-medium truncate">{group.label}</span>
                <span className="ml-auto text-[10px] text-[var(--text-tertiary)] font-mono truncate max-w-[120px]" title={group.basePath}>
                    {friendlyBasePath(group.basePath)}
                </span>
            </div>
            {open && (
                <div className="pb-1">
                    {(group.fields || []).map(f => (
                        <FieldRow key={f.path} field={f} onInsert={onInsert} depth={1} previewSample={previewSample} />
                    ))}
                    {(group.fields || []).length === 0 && (
                        <div className="px-6 py-1 text-[11px] text-[var(--text-tertiary)] italic">No fields</div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * One field row: drag it into a parameter, or click to insert. Children-bearing
 * rows expand from the chevron only, so clicking the row still maps the parent
 * path. Shared with the NDV's INPUT panel — the tree IS the input panel now
 * (BFSF-329), so this is the single row implementation for both.
 */
export function FieldRow({ field, onInsert, depth, previewSample }) {
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

    const value = shownValue(field.path, field.sample, previewSample);

    return (
        <div>
            <div
                draggable
                onDragStart={(e) => startPathDrag(e, field.path)}
                onClick={onClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInsert?.(field.path); } }}
                className="group flex items-center gap-2 py-1 text-[11px] cursor-grab active:cursor-grabbing select-none hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] focus:outline-none"
                style={{ paddingLeft: indent, paddingRight: 8 }}
                title={typeof value === 'string' ? `${field.path}\n${value}` : field.path}
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
                <span className="ml-auto text-[10px] text-[var(--text-secondary)] truncate max-w-[150px] font-mono">
                    {previewValue(value, 40)}
                </span>
            </div>
            {hasChildren && open && field.children.map(c => (
                <FieldRow key={c.path} field={c} onInsert={onInsert} depth={depth + 1} previewSample={previewSample} />
            ))}
        </div>
    );
}
