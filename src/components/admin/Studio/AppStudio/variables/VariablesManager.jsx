import { Braces, Lock, Plus, Trash2, TriangleAlert } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import ConfirmDialog from '../../../../shared/ConfirmDialog';
import FormField from '../../../../shared/FormField';
import IconButton from '../../../../shared/IconButton';
import Toggle from '../../../../shared/Toggle';
import { INPUT_CLS } from '../inspector/panels/kit';
import {
    MAX_VARIABLES, RESERVED_VARIABLE_NAMES, VARIABLE_NAME_RE, VARIABLE_TYPES,
    coerceVariableDefault,
} from '../runtime/appVariables';
import { listVariables, removeVariable, renameVariable, setVariable } from '../state/definitionOps';
import { collectVariableUsage, declarableUnknowns, describeSite } from '../state/variableUsage';

/**
 * The app's shared values, in one place.
 *
 * `vars` used to come into existence by accident — a filter_bar field name, a
 * set_variable step, a resultVar — so nothing listed what an app actually used,
 * nothing gave a name a starting value, and a typo resolved to undefined in
 * silence while the component showed the wrong rows.
 *
 * Shaped like RolesManager (a panel; EditorHeader owns the modal) but WITHOUT
 * its draft staging: every edit commits straight through definitionOps, so ⌘Z
 * undoes it like any other change and there is no "close without saving?"
 * branch to get wrong.
 */

const TYPE_LABELS = {
    text: 'Text', number: 'Number', yesno: 'Yes / no', date: 'Date',
    record: 'A record', list: 'A list', any: 'Anything',
};

/** Why a name is refused, in the words of someone who has to fix it. */
function nameProblem(name, taken) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return 'Give it a name.';
    if (RESERVED_VARIABLE_NAMES.includes(trimmed)) {
        return trimmed === 'filters'
            ? '“filters” belongs to the filter bar — add a filter bar and read vars.filters.<field>.'
            : `“${trimmed}” is a reserved word.`;
    }
    if (!VARIABLE_NAME_RE.test(trimmed)) {
        return 'One word: a letter or _ first, then letters, digits or _. A formula has to be able to write vars.<name>.';
    }
    if (taken.includes(trimmed)) return 'Another variable already has that name.';
    return null;
}

function uniqueName(taken) {
    for (let i = 1; i < 1000; i++) {
        const candidate = i === 1 ? 'newVariable' : `newVariable${i}`;
        if (!taken.includes(candidate)) return candidate;
    }
    return `v${taken.length + 1}`;
}

export default function VariablesManager({ definition, onCommit, onRevealNode = null, disabled = false }) {
    const variables = listVariables(definition);
    const usage = useMemo(() => collectVariableUsage(definition), [definition]);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [nameErrors, setNameErrors] = useState({});

    const names = variables.map((v) => v.name);
    const unknowns = declarableUnknowns(usage);
    const atCeiling = variables.length >= MAX_VARIABLES;

    const patch = (name, changes) => onCommit(setVariable(definition, { name, ...changes }));

    const commitName = (from, raw) => {
        const to = String(raw || '').trim();
        if (to === from) { setNameErrors((p) => ({ ...p, [from]: null })); return; }
        const problem = nameProblem(to, names.filter((n) => n !== from));
        if (problem) { setNameErrors((p) => ({ ...p, [from]: problem })); return; }
        setNameErrors((p) => ({ ...p, [from]: null }));
        onCommit(renameVariable(definition, from, to));
    };

    const addVariable = () => {
        if (atCeiling) return;
        onCommit(setVariable(definition, {
            name: uniqueName(names), label: '', type: 'text', default: '', description: '',
        }));
    };

    const doDelete = (name) => {
        setConfirmDelete(null);
        onCommit(removeVariable(definition, name));
    };

    const askDelete = (name) => {
        if (usage.countOf(name) === 0) { doDelete(name); return; }
        setConfirmDelete(name);
    };

    const deleteSites = confirmDelete
        ? [...(usage.reads.get(confirmDelete) || []), ...(usage.writes.get(confirmDelete) || [])]
        : [];

    return (
        <div className="flex flex-col gap-4">
            <p className="text-xs text-[var(--text-secondary)]">
                A variable is a named value your screens and actions share. Formulas read it as{' '}
                <code className="font-mono text-[var(--text-primary)]">vars.name</code>. Giving one a starting
                value means a list filtered on it filters straight away, instead of showing everything until
                something sets it.
            </p>

            {unknowns.length ? (
                <div
                    className="rounded-md border border-[var(--warning)] bg-[var(--bg-secondary)] p-3 flex flex-col gap-2"
                    data-unknown-vars
                >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                        <TriangleAlert className="w-3.5 h-3.5 shrink-0 text-[var(--warning)]" aria-hidden="true" />
                        {unknowns.length === 1
                            ? 'One formula reads a variable that does not exist'
                            : `${unknowns.length} formulas read variables that do not exist`}
                    </span>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                        Nothing gives {unknowns.map((n) => `vars.${n}`).join(', ')} a value, so it resolves to
                        nothing — and a filter using it is dropped, which shows every row instead of none.
                    </p>
                    <button
                        type="button"
                        disabled={disabled || atCeiling}
                        onClick={() => {
                            let next = definition;
                            for (const name of unknowns.slice(0, MAX_VARIABLES - variables.length)) {
                                next = setVariable(next, { name, label: '', type: 'any', default: null, description: '' });
                            }
                            onCommit(next);
                        }}
                        className="self-start px-2.5 py-1 text-[11px] font-medium rounded border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                    >
                        {unknowns.length === 1 ? 'Declare it' : 'Declare them all'}
                    </button>
                </div>
            ) : null}

            {variables.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                    No variables yet.
                </p>
            ) : null}

            <div className="flex flex-col gap-3">
                {variables.map((variable) => {
                    const used = usage.countOf(variable.name);
                    const locked = used > 0;
                    const problem = nameErrors[variable.name];
                    return (
                        <div
                            key={variable.name}
                            className="rounded-md border border-[var(--border-subtle)] p-3 flex flex-col gap-2.5"
                            data-variable={variable.name}
                        >
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <FormField
                                        label="Name"
                                        hint={locked
                                            ? 'In use, so the name is fixed — nothing rewrites the formulas that read it.'
                                            : 'How a formula refers to it: vars.<name>.'}
                                        error={problem || undefined}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="text"
                                                className={`${INPUT_CLS} font-mono`}
                                                defaultValue={variable.name}
                                                onBlur={(e) => commitName(variable.name, e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                disabled={disabled || locked}
                                                spellCheck={false}
                                                aria-label={`Name of ${variable.name}`}
                                            />
                                            {locked ? (
                                                <Lock className="w-3.5 h-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden="true" />
                                            ) : null}
                                        </div>
                                    </FormField>
                                </div>
                                <div className="flex items-center gap-1.5 pt-6 shrink-0">
                                    <span
                                        className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap"
                                        title={used ? 'Read or written this many times' : 'Nothing uses this yet'}
                                    >
                                        {used ? `used ${used}×` : 'unused'}
                                    </span>
                                    {/* Never behind a hover: destructiveAffordances.test.js
                                        scans for exactly that. */}
                                    <IconButton
                                        ariaLabel={`Delete ${variable.name}`}
                                        variant="danger"
                                        size="sm"
                                        disabled={disabled}
                                        onClick={() => askDelete(variable.name)}
                                    >
                                        <Trash2 />
                                    </IconButton>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <FormField label="Shown as">
                                    <input
                                        type="text"
                                        className={INPUT_CLS}
                                        value={variable.label ?? ''}
                                        onChange={(e) => patch(variable.name, { label: e.target.value })}
                                        placeholder={variable.name}
                                        disabled={disabled}
                                        aria-label={`Label of ${variable.name}`}
                                    />
                                </FormField>
                                <FormField label="Holds">
                                    <select
                                        className={INPUT_CLS}
                                        value={variable.type}
                                        onChange={(e) => {
                                            const type = e.target.value;
                                            // Re-coerce, or a text default would
                                            // survive onto a number variable and
                                            // the server would reject the save.
                                            patch(variable.name, { type, default: coerceVariableDefault(type, variable.default).value });
                                        }}
                                        disabled={disabled}
                                        aria-label={`Type of ${variable.name}`}
                                    >
                                        {VARIABLE_TYPES.map((t) => (
                                            <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
                                        ))}
                                    </select>
                                </FormField>
                            </div>

                            <DefaultField
                                variable={variable}
                                onChange={(value) => patch(variable.name, { default: value })}
                                disabled={disabled}
                            />

                            <FormField label="What it is for" hint="Shown to whoever edits this app next.">
                                <input
                                    type="text"
                                    className={INPUT_CLS}
                                    value={variable.description ?? ''}
                                    onChange={(e) => patch(variable.name, { description: e.target.value })}
                                    placeholder="Which status the list shows"
                                    disabled={disabled}
                                    aria-label={`Description of ${variable.name}`}
                                />
                            </FormField>

                            {used && onRevealNode ? (
                                <UsageList
                                    sites={[...(usage.reads.get(variable.name) || []), ...(usage.writes.get(variable.name) || [])]}
                                    onRevealNode={onRevealNode}
                                />
                            ) : null}
                        </div>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={addVariable}
                disabled={disabled || atCeiling}
                title={atCeiling ? `An app can hold ${MAX_VARIABLES} variables.` : undefined}
                className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
            >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> New variable
            </button>

            <ConfirmDialog
                open={!!confirmDelete}
                title={`Delete “${confirmDelete}”?`}
                description={
                    confirmDelete
                        ? `${deleteSites.length} place${deleteSites.length === 1 ? '' : 's'} still use it, and will start resolving to nothing:\n\n`
                          + deleteSites.slice(0, 5).map((s) => `• ${describeSite(s)}`).join('\n')
                          + (deleteSites.length > 5 ? `\n• …and ${deleteSites.length - 5} more` : '')
                        : ''
                }
                confirmLabel="Delete anyway"
                destructive
                onConfirm={() => doDelete(confirmDelete)}
                onCancel={() => setConfirmDelete(null)}
            />
        </div>
    );
}

/** The starting-value control, following the declared type. */
function DefaultField({ variable, onChange, disabled }) {
    const { name, type } = variable;
    const label = 'Starts out as';
    const aria = `Starting value of ${name}`;

    if (type === 'yesno') {
        return (
            <Toggle
                size="sm"
                label={label}
                checked={variable.default === true}
                onChange={(v) => onChange(v)}
                ariaLabel={aria}
                disabled={disabled}
            />
        );
    }
    if (type === 'number') {
        return (
            <FormField label={label}>
                <input
                    type="number"
                    className={INPUT_CLS}
                    value={variable.default ?? 0}
                    onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                    disabled={disabled}
                    aria-label={aria}
                />
            </FormField>
        );
    }
    if (type === 'date') {
        return (
            <FormField label={label} hint="Left empty means “no date yet”. Use the today function where you read it if you want today.">
                <input
                    type="date"
                    className={INPUT_CLS}
                    value={typeof variable.default === 'string' ? variable.default : ''}
                    onChange={(e) => onChange(e.target.value || null)}
                    disabled={disabled}
                    aria-label={aria}
                />
            </FormField>
        );
    }
    if (type === 'record' || type === 'list' || type === 'any') {
        return <JsonDefaultField variable={variable} onChange={onChange} disabled={disabled} label={label} aria={aria} />;
    }
    return (
        <FormField label={label}>
            <input
                type="text"
                className={INPUT_CLS}
                value={variable.default ?? ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                aria-label={aria}
            />
        </FormField>
    );
}

/**
 * A JSON starting value, edited as text. The parsed value is only committed
 * when it parses — typing `{` must not blow away what was there.
 */
function JsonDefaultField({ variable, onChange, disabled, label, aria }) {
    const [text, setText] = useState(() => {
        try { return JSON.stringify(variable.default ?? null); } catch { return 'null'; }
    });
    const [error, setError] = useState(null);

    return (
        <FormField label={label} hint="Written as JSON." error={error || undefined}>
            <div className="flex items-stretch gap-1.5">
                <input
                    type="text"
                    className={`${INPUT_CLS} font-mono text-xs`}
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        try {
                            const parsed = JSON.parse(e.target.value);
                            setError(null);
                            onChange(parsed);
                        } catch {
                            setError('Not valid JSON yet.');
                        }
                    }}
                    disabled={disabled}
                    spellCheck={false}
                    aria-label={aria}
                />
                <span className="shrink-0 px-2 flex items-center text-[var(--text-tertiary)]" aria-hidden="true">
                    <Braces size={13} />
                </span>
            </div>
        </FormField>
    );
}

/** Where a variable is used, each row jumping to the place. */
function UsageList({ sites, onRevealNode }) {
    const shown = sites.slice(0, 5);
    return (
        <div className="flex flex-col gap-1 pt-1 border-t border-[var(--border-subtle)]">
            {shown.map((site, i) => (
                <button
                    key={i}
                    type="button"
                    onClick={() => site.nodeId && onRevealNode({ nodeId: site.nodeId, screenId: site.screenId })}
                    disabled={!site.nodeId}
                    className="text-left text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:hover:text-[var(--text-secondary)] disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] rounded px-1 -mx-1"
                >
                    {describeSite(site)}
                </button>
            ))}
            {sites.length > shown.length ? (
                <span className="text-[11px] text-[var(--text-tertiary)]">…and {sites.length - shown.length} more</span>
            ) : null}
        </div>
    );
}
