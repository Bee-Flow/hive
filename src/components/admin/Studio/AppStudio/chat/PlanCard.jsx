import { Database, HelpCircle, Layers, Plus, Shield, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

/**
 * App Studio AI builder — the editable PLAN card (Wave 5, plan-first UX).
 *
 * For a big ask the AI proposes a plan artifact instead of building blind; it
 * streams as an `plan` SSE event and lands here as an editable card in the
 * transcript. The user tweaks it (rename / delete / add rows across Screens,
 * Data, Roles, Datasets), answers any open questions in the composer, then
 * hits "Build it" — which approves the EDITED artifact so the AI builds what
 * the user actually confirmed.
 *
 * Props:
 *   pendingPlan { planId, plan }  — the artifact to render/edit (rehydrates
 *                                   from the builder-session snapshot after a
 *                                   mid-approval refresh)
 *   onBuild(editedPlan)           — approve; the pane wraps this into
 *                                   send({ plan:{ planId, action:'approve', plan } })
 *   onDiscuss()                   — focus the composer to talk it over first
 *   disabled                      — a turn is already running
 *
 * The plan artifact is intentionally loose (the model authors it): rows may be
 * bare strings or objects, so every accessor/setter tolerates both and
 * preserves an object's other keys on rename.
 */

// ---- shape-tolerant accessors -------------------------------------------------
const labelOf = (row, ...keys) => {
    if (typeof row === 'string') return row;
    if (row && typeof row === 'object') {
        for (const k of keys) if (typeof row[k] === 'string' && row[k]) return row[k];
    }
    return '';
};
/** Rename a row, preserving its object shape (or staying a bare string). */
const renameRow = (row, value, key) => {
    if (typeof row === 'string' || !row || typeof row !== 'object') return value;
    return { ...row, [key]: value };
};

/**
 * WHICH FIELD IS THE ROW'S IDENTITY.
 *
 * The approved artifact is bounded server-side (builderTools.boundPlanArtifact)
 * before the model ever sees it, and that bounder keeps a fixed set of keys per
 * list and DROPS any row missing its identity one:
 *
 *   tables   → key (+ name)          fields → key (+ type, options, relationTo)
 *   roles    → key (+ label)         screens/datasets → name
 *
 * This card was editing `name` on all of them. On screens and datasets that is
 * the right field; on tables, fields and roles it is a field the bounder does
 * not read — so renaming a role did nothing, and every row ADDED here vanished
 * on approval for having no key. Both silently: the card still showed the edit,
 * and the app was built from the plan as the model had written it.
 */
const IDENTITY = { tables: 'name', fields: 'key', roles: 'label', screens: 'name', datasets: 'name' };

/** A key the bounder will keep, in the shape the model emits them. */
function slugKey(value) {
    const slug = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
    return slug || `item_${(rowSeq += 1)}`;
}

// Stable React keys. Rows are edited in place, so an index key hands a deleted
// row's live state — a half-typed "Add field" — to whatever row slides up into
// its slot. Each object row carries a client-only id under a SYMBOL: object
// spread (renameRow, setTableFields) preserves it, while JSON.stringify drops
// it, so the artifact that reaches the server stays exactly as the model wrote
// it. Bare-string rows have nowhere to hold an id and keep the index.
const ROW_ID = Symbol('planRowId');
let rowSeq = 0;
const tagRow = (row) => (row && typeof row === 'object' && !row[ROW_ID]
    ? { ...row, [ROW_ID]: `row${(rowSeq += 1)}` }
    : row);
const tagRows = (list) => (Array.isArray(list) ? list.map(tagRow) : []);
const rowKey = (row, i) => (row && typeof row === 'object' && row[ROW_ID]) || `i${i}`;

function normalizePlan(plan) {
    const p = plan && typeof plan === 'object' ? plan : {};
    return {
        // Anything else the model emitted (actions, phases, baseTemplateId…)
        // rides along untouched so the approved artifact stays complete — the
        // normalized fields below override its editable slices.
        ...p,
        title: typeof p.title === 'string' ? p.title : '',
        summary: typeof p.summary === 'string' ? p.summary : '',
        tables: tagRows(p.tables).map((t) => (t && typeof t === 'object' && Array.isArray(t.fields)
            ? { ...t, fields: tagRows(t.fields) }
            : t)),
        roles: tagRows(p.roles),
        datasets: tagRows(p.datasets),
        screens: tagRows(p.screens),
        openQuestions: Array.isArray(p.openQuestions) ? p.openQuestions : [],
    };
}

export default function PlanCard({ pendingPlan, onBuild, onDiscuss, disabled = false }) {
    const planId = pendingPlan?.planId ?? null;
    const [draft, setDraft] = useState(() => normalizePlan(pendingPlan?.plan));

    // Re-seed when a NEW plan arrives (planId changes) — but keep in-progress
    // edits while the same plan is on screen.
    useEffect(() => {
        setDraft(normalizePlan(pendingPlan?.plan));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planId]);

    const openQuestions = useMemo(
        () => (draft.openQuestions || []).map((q) => (typeof q === 'string' ? q : labelOf(q, 'question', 'text'))).filter(Boolean),
        [draft.openQuestions],
    );

    // ---- generic list ops (immutable) ----------------------------------------
    const updateList = (field, next) => setDraft((d) => ({ ...d, [field]: next }));
    const renameAt = (field, i, value, key) => updateList(field, draft[field].map((row, j) => (j === i ? renameRow(row, value, key) : row)));
    /**
     * Rename a TABLE. Its human name is what the bounder keeps, but the row is
     * only kept at all if it has a `key` — so a table the model emitted without
     * one (or a bare string) gets one here rather than disappearing on approval.
     */
    const renameTable = (i, value) => updateList('tables', draft.tables.map((t, j) => {
        if (j !== i) return t;
        const row = (t && typeof t === 'object') ? t : { fields: [] };
        return { ...row, name: value, key: row.key || slugKey(value) };
    }));
    const removeAt = (field, i) => updateList(field, draft[field].filter((_, j) => j !== i));
    const addRow = (field, row) => updateList(field, [...draft[field], tagRow(row)]);

    // Fields live inside a table row; edit them in place, preserving shape.
    const tableFields = (t) => (Array.isArray(t?.fields) ? t.fields : []);
    const setTableFields = (ti, fields) => updateList('tables', draft.tables.map((t, j) => {
        if (j !== ti) return t;
        return typeof t === 'string' ? { name: t, fields } : { ...t, fields };
    }));

    const build = () => {
        if (disabled) return;
        onBuild?.(draft);
    };

    return (
        <div
            className="flex w-full flex-col gap-3 rounded-xl border p-3 text-xs"
            data-plan-card=""
            style={{ borderColor: 'var(--accent-primary)', background: 'var(--bg-secondary)' }}
        >
            {/* Title + summary */}
            <div className="flex flex-col gap-1.5">
                <input
                    type="text"
                    value={draft.title}
                    disabled={disabled}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    aria-label="Plan title"
                    placeholder="Untitled plan"
                    className="w-full bg-transparent text-sm font-semibold outline-none disabled:opacity-60"
                    style={{ color: 'var(--text-primary)' }}
                />
                {draft.summary ? (
                    <p className="leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{draft.summary}</p>
                ) : null}
            </div>

            {/* Open questions — amber prompts to answer in the composer */}
            {openQuestions.length ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
                    <div className="mb-1 flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        A few questions
                    </div>
                    <ul className="flex list-disc flex-col gap-0.5 pl-4 text-amber-700/90 dark:text-amber-300/90">
                        {openQuestions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                </div>
            ) : null}

            {/* Screens */}
            <Section icon={Layers} title="Screens">
                {draft.screens.map((s, i) => (
                    <Row
                        key={rowKey(s, i)}
                        value={labelOf(s, 'name', 'title')}
                        placeholder="Screen name"
                        ariaLabel="Screen name"
                        subtitle={labelOf(s, 'purpose')}
                        disabled={disabled}
                        onChange={(v) => renameAt('screens', i, v, 'name')}
                        onRemove={() => removeAt('screens', i)}
                    />
                ))}
                <AddRow label="Add screen" disabled={disabled} onAdd={(v) => addRow('screens', { name: v })} />
            </Section>

            {/* Data — tables with their fields */}
            <Section icon={Database} title="Data">
                {draft.tables.map((t, ti) => (
                    <div key={rowKey(t, ti)} className="rounded-lg border p-2" style={{ borderColor: 'var(--border-default)' }}>
                        <Row
                            value={labelOf(t, 'name', 'key')}
                            placeholder="Table name"
                            ariaLabel="Table name"
                            subtitle={typeof t?.seedCount === 'number' ? `${t.seedCount} sample rows` : ''}
                            disabled={disabled}
                            onChange={(v) => renameTable(ti, v)}
                            onRemove={() => removeAt('tables', ti)}
                        />
                        <div className="mt-1.5 flex flex-col gap-1 pl-2">
                            {tableFields(t).map((f, fi) => (
                                <Row
                                    key={rowKey(f, fi)}
                                    value={labelOf(f, 'key', 'name')}
                                    placeholder="Field"
                                    ariaLabel="Field name"
                                    subtitle={labelOf(f, 'type')}
                                    small
                                    disabled={disabled}
                                    onChange={(v) => setTableFields(ti, tableFields(t).map((row, j) => (j === fi ? renameRow(row, slugKey(v), IDENTITY.fields) : row)))}
                                    onRemove={() => setTableFields(ti, tableFields(t).filter((_, j) => j !== fi))}
                                />
                            ))}
                            <AddRow
                                label="Add field"
                                small
                                disabled={disabled}
                                onAdd={(v) => setTableFields(ti, [...tableFields(t), tagRow({ key: slugKey(v), type: 'text' })])}
                            />
                        </div>
                    </div>
                ))}
                <AddRow label="Add table" disabled={disabled} onAdd={(v) => addRow('tables', { key: slugKey(v), name: v, fields: [] })} />
            </Section>

            {/* Roles */}
            <Section icon={Shield} title="Roles">
                {draft.roles.map((r, i) => (
                    <Row
                        key={rowKey(r, i)}
                        value={labelOf(r, 'label', 'key')}
                        placeholder="Role"
                        ariaLabel="Role name"
                        disabled={disabled}
                        onChange={(v) => renameAt('roles', i, v, IDENTITY.roles)}
                        onRemove={() => removeAt('roles', i)}
                    />
                ))}
                <AddRow label="Add role" disabled={disabled} onAdd={(v) => addRow('roles', { key: slugKey(v), label: v })} />
            </Section>

            {/* Datasets */}
            <Section icon={Users} title="Datasets">
                {draft.datasets.map((ds, i) => (
                    <Row
                        key={rowKey(ds, i)}
                        value={labelOf(ds, 'name', 'key')}
                        placeholder="Dataset"
                        ariaLabel="Dataset name"
                        disabled={disabled}
                        onChange={(v) => renameAt('datasets', i, v, 'name')}
                        onRemove={() => removeAt('datasets', i)}
                    />
                ))}
                <AddRow label="Add dataset" disabled={disabled} onAdd={(v) => addRow('datasets', { name: v })} />
            </Section>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onDiscuss?.()}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                    Discuss
                </button>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={build}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    Build it
                </button>
            </div>
        </div>
    );
}

/** A titled group with a leading icon. */
function Section({ icon: Icon, title, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {Icon ? <Icon className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" /> : null}
                {title}
            </div>
            <div className="flex flex-col gap-1">{children}</div>
        </div>
    );
}

/** One editable row: inline-rename input + optional subtitle + delete. */
function Row({ value, placeholder, ariaLabel, subtitle, small = false, disabled, onChange, onRemove }) {
    return (
        <div className="flex items-center gap-1.5">
            <input
                type="text"
                value={value}
                disabled={disabled}
                placeholder={placeholder}
                aria-label={ariaLabel}
                onChange={(e) => onChange?.(e.target.value)}
                className={`min-w-0 flex-1 rounded border bg-transparent px-1.5 outline-none disabled:opacity-60 ${small ? 'py-0.5 text-[11px]' : 'py-1'}`}
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            />
            {subtitle ? (
                <span className="shrink-0 truncate text-[10px]" style={{ color: 'var(--text-tertiary)' }} title={subtitle}>{subtitle}</span>
            ) : null}
            <button
                type="button"
                disabled={disabled}
                onClick={onRemove}
                aria-label={`Remove ${value || placeholder || 'row'}`}
                className="shrink-0 rounded p-1 text-red-500 transition-opacity hover:bg-red-500/10 disabled:opacity-40"
            >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
            </button>
        </div>
    );
}

/** A tiny inline "add a row" form. */
function AddRow({ label, small = false, disabled, onAdd }) {
    const [value, setValue] = useState('');
    const submit = () => {
        const v = value.trim();
        if (!v || disabled) return;
        onAdd?.(v);
        setValue('');
    };
    return (
        <div className="flex items-center gap-1.5">
            <input
                type="text"
                value={value}
                disabled={disabled}
                placeholder={label}
                aria-label={label}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                className={`min-w-0 flex-1 rounded border border-dashed bg-transparent px-1.5 outline-none disabled:opacity-60 ${small ? 'py-0.5 text-[11px]' : 'py-1'}`}
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            />
            <button
                type="button"
                disabled={disabled || !value.trim()}
                onClick={submit}
                aria-label={label}
                className="shrink-0 rounded p-1 transition-opacity hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
                style={{ color: 'var(--accent-primary)' }}
            >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
        </div>
    );
}
