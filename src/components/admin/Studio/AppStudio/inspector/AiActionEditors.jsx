import { X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { INPUT_CLS } from './panels/kit';
import ExpressionInput from './logic/ExpressionInput';
import FormField from '../../../../shared/FormField';
import SegmentedControl from '../../../../shared/SegmentedControl';
import Toggle from '../../../../shared/Toggle';
import IconButton from '../../../../shared/IconButton';
import ModelTierSelector from '../../../../ModelTierSelector';
import useModelTierSelection from '../../../../../hooks/useModelTierSelection';
import useAppTables, { fieldsForTable } from '../bi/useAppTables';
import { useEditorChrome } from '../editor/EditorChromeContext';
import { API_BASE, authFetch } from '../../../../../utils/helpers';
import {
    autoMapping, bindingForField, extractableColumns, fieldNameFromBinding,
    isUntouchedSchema, sanitizeVarName, schemaFromColumns, writableColumns,
} from './aiFieldMatching';

/**
 * Inline editors for the native AI action kinds (ai_extract / ai_generate /
 * kb_query — server contract in server/appStudio/componentSpecs.js). Kept out of
 * ActionsSection so that file stays focused on event wiring; ActionsSection
 * renders <AiActionEditor/> for these kinds and passes the same `commit`.
 *
 * Reuse of existing pieces (per the plan): the shared <ModelTierSelector/> +
 * useModelTierSelection for the model tier, useAppTables for the write-to table
 * picker, GET /api/kb for the (owner-scoped, since only the owner edits)
 * knowledge-base grounding list. File/query sources are stored as a `formula`
 * binding `{kind:'formula', expr:'form.<field>'}` — the only binding kind that
 * both validates (BINDING_KINDS) and resolves a raw form value server-side.
 */

const SCHEMA_TYPE_OPTIONS = [
    { value: 'string', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Yes / No' },
    { value: 'date', label: 'Date' },
    { value: 'array', label: 'List' },
    { value: 'object', label: 'Object' },
];

// ── Model tier ───────────────────────────────────────────────────────────────

export function ModelTierRow({ value, onChange, disabled }) {
    const { modelTiers } = useModelTierSelection({ storageKey: 'appStudioAiTier', taskType: 'direct_chat' });
    return (
        <FormField label="Model" hint="Runs on the app owner's model tier.">
            {/* portal: the inspector scrolls, so an absolute panel gets clipped. */}
            <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
                <ModelTierSelector tiers={modelTiers} value={value || 'auto'} onChange={onChange} dropDirection="down" portal />
            </div>
        </FormField>
    );
}

// ── File / text source picker (formula binding over a form field) ────────────

function FieldSourcePicker({ label, hint, binding, formFields, onChange, disabled, ariaLabel }) {
    const current = fieldNameFromBinding(binding);
    const rawExpr = (binding && binding.kind === 'formula' && typeof binding.expr === 'string') ? binding.expr : '';
    // An expression that is not `form.<field>` can only be edited as text — and
    // it is the ONLY way to reach a document that did not come from a form
    // input, e.g. `item.file` inside a loop over a table of attachments. The
    // picker used to hardcode form fields, which made "extract the invoice
    // attached to this ticket" unauthorable.
    const [expert, setExpert] = useState(Boolean(rawExpr) && !current);

    return (
        <FormField label={label} hint={hint}>
            {expert ? (
                <div className="flex flex-col gap-1">
                    {/* No definition/node: the variable groups come from the
                        StudioScopeProvider around the Actions section, and a
                        document source is never a boolean, so the condition
                        builder has no business here. */}
                    <ExpressionInput
                        variant="inline"
                        value={rawExpr}
                        placeholder="item.file"
                        onChange={(expr) => onChange(expr ? { kind: 'formula', expr } : null)}
                        disabled={disabled}
                        ariaLabel={`${ariaLabel} expression`}
                    />
                    <button
                        type="button"
                        className="self-start text-[11px] text-[var(--text-tertiary)] underline"
                        onClick={() => { setExpert(false); onChange(null); }}
                        disabled={disabled}
                    >
                        Pick a form input instead
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-1">
                    {formFields.length ? (
                        <select
                            className={INPUT_CLS}
                            value={current}
                            onChange={(e) => onChange(bindingForField(e.target.value))}
                            disabled={disabled}
                            aria-label={ariaLabel}
                        >
                            <option value="">Pick an input…</option>
                            {formFields.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                        </select>
                    ) : (
                        <p className="text-xs text-[var(--text-tertiary)]">Add an input to the enclosing form to feed this.</p>
                    )}
                    <button
                        type="button"
                        className="self-start text-[11px] text-[var(--text-tertiary)] underline"
                        onClick={() => setExpert(true)}
                        disabled={disabled}
                    >
                        Use an expression (e.g. a row from a list)
                    </button>
                </div>
            )}
        </FormField>
    );
}

// ── Output schema (declared fields) ──────────────────────────────────────────

function SchemaFieldsEditor({ fields, onChange, disabled, hint }) {
    const list = Array.isArray(fields) ? fields : [];
    // onChange(next, meta) — `meta.renamed` lets the caller carry a write-to
    // mapping across a rename instead of silently orphaning that column.
    const update = (i, patch, meta) => onChange(list.map((f, idx) => (idx === i ? { ...f, ...patch } : f)), meta);
    const rename = (i, next) => update(i, { name: next }, list[i]?.name && next ? { renamed: { from: list[i].name, to: next } } : undefined);
    const remove = (i) => onChange(list.filter((_, idx) => idx !== i), { removed: list[i]?.name });
    const add = () => {
        const taken = new Set(list.map((f) => f.name));
        let name = 'field';
        let n = 1;
        while (taken.has(name)) name = `field${++n}`;
        onChange([...list, { name, type: 'string', description: '', required: false }]);
    };
    return (
        <FormField label="Fields to return" hint={hint || 'The typed fields the AI should output.'}>
            <div className="flex flex-col gap-2">
                {list.map((f, i) => (
                    <div key={i} className="rounded-md border border-[var(--border-subtle)] p-2.5 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                className={`${INPUT_CLS} font-mono text-xs`}
                                value={f.name || ''}
                                onChange={(e) => rename(i, sanitizeVarName(e.target.value))}
                                placeholder="field_name"
                                disabled={disabled}
                                spellCheck={false}
                                aria-label={`Field ${i + 1} name`}
                            />
                            <select
                                className={`${INPUT_CLS} max-w-[8rem]`}
                                value={f.type || 'string'}
                                onChange={(e) => update(i, { type: e.target.value })}
                                disabled={disabled}
                                aria-label={`Field ${i + 1} type`}
                            >
                                {SCHEMA_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <IconButton ariaLabel={`Remove field ${f.name}`} onClick={() => remove(i)} disabled={disabled} variant="danger" size="sm">
                                <X />
                            </IconButton>
                        </div>
                        <input
                            type="text"
                            className={INPUT_CLS}
                            value={f.description || ''}
                            onChange={(e) => update(i, { description: e.target.value })}
                            placeholder="Description (helps the AI, optional)"
                            disabled={disabled}
                            aria-label={`Field ${i + 1} description`}
                        />
                        <Toggle
                            label="Required"
                            checked={!!f.required}
                            onChange={(v) => update(i, { required: v })}
                            disabled={disabled}
                            size="sm"
                        />
                    </div>
                ))}
                <button
                    type="button"
                    onClick={add}
                    disabled={disabled}
                    className="px-3 py-1.5 text-xs rounded-md border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
                >
                    + Add field
                </button>
            </div>
        </FormField>
    );
}

// ── Knowledge-base grounding multiselect ─────────────────────────────────────

export function KbMultiSelect({ value, onChange, disabled }) {
    const [kbs, setKbs] = useState(null); // null = loading
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const r = await authFetch(`${API_BASE}/api/kb`);
                const body = r.ok ? await r.json() : [];
                if (alive) setKbs(Array.isArray(body) ? body : (body?.knowledge_bases || body?.kbs || []));
            } catch { if (alive) setKbs([]); }
        })();
        return () => { alive = false; };
    }, []);
    const selected = new Set(Array.isArray(value) ? value : []);
    const toggle = (id) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        onChange([...next]);
    };
    return (
        <FormField label="Knowledge bases" hint="Ground the AI in these (optional).">
            {kbs === null ? (
                <p className="text-xs text-[var(--text-tertiary)]">Loading…</p>
            ) : kbs.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)]">No knowledge bases yet.</p>
            ) : (
                <div className="flex flex-col gap-1.5 max-h-40 overflow-auto">
                    {kbs.map((kb) => (
                        <label key={kb.id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selected.has(kb.id)}
                                onChange={() => toggle(kb.id)}
                                disabled={disabled}
                                aria-label={`Ground in ${kb.name || kb.id}`}
                            />
                            <span className="truncate">{kb.name || kb.id}</span>
                        </label>
                    ))}
                </div>
            )}
        </FormField>
    );
}

// ── Write-to-table target (ai_extract) ───────────────────────────────────────

/** One "output field → column" row per declared field. */
function MappingRows({ fields, targets, columnForField, onPick, disabled }) {
    return (
        <div className="flex flex-col gap-1.5">
            {fields.map((f) => (
                <div key={f.name} className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[var(--text-tertiary)] w-24 truncate" title={f.name}>{f.name}</span>
                    <span className="text-[var(--text-tertiary)]">→</span>
                    <select
                        className={INPUT_CLS}
                        value={columnForField(f.name)}
                        onChange={(e) => onPick(f.name, e.target.value)}
                        disabled={disabled}
                        aria-label={`Column for ${f.name}`}
                    >
                        <option value="">(don't save)</option>
                        {targets.map((c) => <option key={c.key} value={c.key}>{c.name || c.key}</option>)}
                    </select>
                </div>
            ))}
        </div>
    );
}

/** What the current mapping will actually save — an unmapped step saves nothing. */
function MappingSummary({ mapped, total }) {
    if (!total) return null;
    const text = mapped === total
        ? `All ${mapped} field${mapped === 1 ? '' : 's'} match a column.`
        : mapped
            ? `${mapped} of ${total} fields are saved — the rest are ignored.`
            : 'No field matches a column, so nothing would be saved.';
    return <p className={`text-xs ${mapped ? 'text-[var(--text-tertiary)]' : 'text-amber-600'}`}>{text}</p>;
}

const MATCH_BTN_CLS = 'px-2.5 py-1 text-xs rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50';

function WriteToEditor({ writeTo, schemaFields, tables, onApply, disabled }) {
    const enabled = !!(writeTo && writeTo.tableId);
    const columns = fieldsForTable(tables, writeTo?.tableId);
    const targets = useMemo(() => writableColumns(columns), [columns]);
    const fields = useMemo(() => (Array.isArray(schemaFields) ? schemaFields : []).filter((f) => f.name), [schemaFields]);

    /**
     * Picking the table IS the configuration. An untouched schema is replaced by
     * the table's own columns (their names, types and select options), and every
     * field is matched to its column — so the common case needs no mapping work
     * at all. A schema the builder actually wrote is left alone and only matched.
     */
    const chooseTable = (tableId) => {
        if (!tableId) { onApply({ writeTo: undefined }); return; }
        const cols = fieldsForTable(tables, tableId);
        const derived = isUntouchedSchema(fields) ? schemaFromColumns(cols) : [];
        const schema = derived.length ? derived : fields;
        onApply({
            ...(derived.length ? { schema: derived } : {}),
            writeTo: { tableId, mapping: autoMapping(schema, cols) },
        });
    };

    const rematch = () => onApply({ writeTo: { tableId: writeTo.tableId, mapping: autoMapping(fields, columns) } });
    const adoptColumns = () => {
        const derived = schemaFromColumns(columns);
        if (!derived.length) return;
        onApply({ schema: derived, writeTo: { tableId: writeTo.tableId, mapping: autoMapping(derived, columns) } });
    };

    // mapping is { [columnKey]: schemaFieldName }; the UI is one row per output
    // field → target column, so we invert on write.
    const mapping = writeTo?.mapping || {};
    const columnForField = (fieldName) => Object.keys(mapping).find((col) => mapping[col] === fieldName) || '';
    const setFieldColumn = (fieldName, col) => {
        const next = { ...mapping };
        for (const c of Object.keys(next)) if (next[c] === fieldName) delete next[c];
        if (col) next[col] = fieldName;
        onApply({ writeTo: { tableId: writeTo.tableId, mapping: next } });
    };

    const mapped = fields.filter((f) => columnForField(f.name)).length;
    const canAdopt = enabled && extractableColumns(columns).length > 0;

    return (
        <FormField label="Save results to a table" hint="Insert one row per extracted record.">
            <div className="flex flex-col gap-2">
                <Toggle
                    label="Write extracted rows to a data table"
                    checked={enabled}
                    onChange={(v) => chooseTable(v ? (tables[0]?.id || '') : '')}
                    disabled={disabled || !tables.length}
                    size="sm"
                />
                {!tables.length ? (
                    <p className="text-xs text-[var(--text-tertiary)]">This app has no data tables yet.</p>
                ) : enabled ? (
                    <>
                        <select
                            className={INPUT_CLS}
                            value={writeTo.tableId}
                            onChange={(e) => chooseTable(e.target.value)}
                            disabled={disabled}
                            aria-label="Target table"
                        >
                            {tables.map((t) => <option key={t.id} value={t.id}>{t.name || t.key}</option>)}
                        </select>
                        <MappingRows
                            fields={fields}
                            targets={targets}
                            columnForField={columnForField}
                            onPick={setFieldColumn}
                            disabled={disabled}
                        />
                        <MappingSummary mapped={mapped} total={fields.length} />
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={rematch}
                                disabled={disabled || !fields.length}
                                className={MATCH_BTN_CLS}
                            >
                                Match to columns
                            </button>
                            <button
                                type="button"
                                onClick={adoptColumns}
                                disabled={disabled || !canAdopt}
                                className={MATCH_BTN_CLS}
                                title="Replace the fields above with one per column of this table"
                            >
                                Use this table's columns
                            </button>
                        </div>
                    </>
                ) : null}
            </div>
        </FormField>
    );
}

// ── resultVar ────────────────────────────────────────────────────────────────

function ResultVarField({ value, onChange, disabled, required }) {
    return (
        <FormField label="Store result as" hint={required ? 'A variable name to reference the result in later steps.' : 'Optional variable name for later steps.'}>
            <input
                type="text"
                className={`${INPUT_CLS} font-mono text-xs`}
                value={value || ''}
                onChange={(e) => onChange(sanitizeVarName(e.target.value))}
                placeholder="result"
                disabled={disabled}
                spellCheck={false}
                aria-label="Result variable name"
            />
        </FormField>
    );
}

// ── Per-kind editors ─────────────────────────────────────────────────────────

function AiExtractEditor({ action, commit, formFields, disabled }) {
    const set = (patch) => commit({ ...action, ...patch });
    const chrome = useEditorChrome();
    const { tables } = useAppTables(chrome?.appId ?? null);
    const fileFields = useMemo(() => formFields.filter((f) => f.type === 'input_file'), [formFields]);
    const sourceName = fieldNameFromBinding(action.source);

    // `source` is required, so a step wired up before its form had a file input
    // sits there showing a red "missing required source". When the choice is
    // unambiguous, make it — ONCE. Clearing the field is a deliberate act; a
    // second seed would refill it before the user can pick anything else.
    const sourceSettled = useRef(false);
    useEffect(() => {
        if (sourceName) { sourceSettled.current = true; return; }
        if (disabled || sourceSettled.current || fileFields.length !== 1) return;
        sourceSettled.current = true;
        set({ source: bindingForField(fileFields[0].name) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disabled, sourceName, fileFields]);

    /**
     * Schema edits keep the write-to mapping honest: a renamed field follows its
     * column (and adopts one if its new name now matches a free column), and a
     * removed field releases it. Without this the mapping points at a name that
     * no longer exists and the column silently writes null.
     */
    const setSchema = (schema, meta) => {
        const patch = { schema };
        const w = action.writeTo;
        if (w?.tableId && meta) {
            const columns = fieldsForTable(tables, w.tableId);
            const next = {};
            for (const [col, fieldName] of Object.entries(w.mapping || {})) {
                if (meta.removed && fieldName === meta.removed) continue;
                next[col] = meta.renamed && fieldName === meta.renamed.from ? meta.renamed.to : fieldName;
            }
            // A rename onto a still-free column is an explicit "put it here".
            if (meta.renamed && !Object.values(next).includes(meta.renamed.to)) {
                const hit = autoMapping([{ name: meta.renamed.to }], columns.filter((c) => !(c.key in next)));
                Object.assign(next, hit);
            }
            patch.writeTo = { tableId: w.tableId, mapping: next };
        }
        set(patch);
    };

    return (
        <>
            <FieldSourcePicker
                label="Document input"
                hint="A File upload input holding the document(s) to read."
                binding={action.source}
                formFields={fileFields}
                onChange={(b) => set({ source: b })}
                disabled={disabled}
                ariaLabel="Document input field"
            />
            <SchemaFieldsEditor
                fields={action.schema}
                onChange={setSchema}
                disabled={disabled}
                hint={action.writeTo?.tableId ? 'The AI returns these; matching columns are filled in below.' : 'The typed fields the AI should output.'}
            />
            <ModelTierRow value={action.modelTier} onChange={(t) => set({ modelTier: t })} disabled={disabled} />
            <KbMultiSelect value={action.knowledgeBaseIds} onChange={(ids) => set({ knowledgeBaseIds: ids })} disabled={disabled} />
            <WriteToEditor
                writeTo={action.writeTo}
                schemaFields={action.schema}
                tables={tables}
                onApply={({ writeTo, ...rest }) => {
                    const next = { ...action, ...rest };
                    if (writeTo) next.writeTo = writeTo; else delete next.writeTo;
                    commit(next);
                }}
                disabled={disabled}
            />
            <ResultVarField value={action.resultVar} onChange={(v) => set({ resultVar: v })} disabled={disabled} />
        </>
    );
}

function AiGenerateEditor({ action, commit, formFields, disabled }) {
    const set = (patch) => commit({ ...action, ...patch });
    const fileFields = useMemo(() => formFields.filter((f) => f.type === 'input_file'), [formFields]);
    const output = action.output === 'structured' ? 'structured' : 'text';
    return (
        <>
            <FormField label="Prompt" hint="Use {{form.fieldName}} to insert form values.">
                <textarea
                    className={`${INPUT_CLS} min-h-[80px]`}
                    value={action.prompt || ''}
                    onChange={(e) => set({ prompt: e.target.value })}
                    placeholder="Summarize {{form.notes}} in three bullet points."
                    disabled={disabled}
                    aria-label="AI prompt"
                />
            </FormField>
            <FormField label="Output">
                <SegmentedControl
                    value={output}
                    onChange={(o) => set({ output: o })}
                    options={[{ value: 'text', label: 'Text' }, { value: 'structured', label: 'Structured' }]}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel="Output type"
                />
            </FormField>
            {output === 'structured' && (
                <SchemaFieldsEditor fields={action.schema} onChange={(s) => set({ schema: s })} disabled={disabled} />
            )}
            {fileFields.length > 0 && (
                <FieldSourcePicker
                    label="Attach a document (optional)"
                    binding={action.attachments}
                    formFields={fileFields}
                    onChange={(b) => set({ attachments: b || undefined })}
                    disabled={disabled}
                    ariaLabel="Attachment field"
                />
            )}
            <ModelTierRow value={action.modelTier} onChange={(t) => set({ modelTier: t })} disabled={disabled} />
            <KbMultiSelect value={action.knowledgeBaseIds} onChange={(ids) => set({ knowledgeBaseIds: ids })} disabled={disabled} />
            <ResultVarField value={action.resultVar} onChange={(v) => set({ resultVar: v })} disabled={disabled} required />
        </>
    );
}

function KbQueryEditor({ action, commit, formFields, disabled }) {
    const set = (patch) => commit({ ...action, ...patch });
    const q = action.query || null;
    const mode = q?.kind === 'static' ? 'static' : 'field';
    return (
        <>
            <FormField label="Question">
                <SegmentedControl
                    value={mode}
                    onChange={(m) => set({ query: m === 'field' ? bindingForField(formFields[0]?.name || '') : { kind: 'static', value: '' } })}
                    options={[{ value: 'field', label: 'Form field' }, { value: 'static', label: 'Static' }]}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel="Query source"
                />
            </FormField>
            {mode === 'field' ? (
                <FieldSourcePicker
                    label="From input"
                    binding={q}
                    formFields={formFields}
                    onChange={(b) => set({ query: b || { kind: 'static', value: '' } })}
                    disabled={disabled}
                    ariaLabel="Query field"
                />
            ) : (
                <FormField label="Text">
                    <input
                        type="text"
                        className={INPUT_CLS}
                        value={q?.value || ''}
                        onChange={(e) => set({ query: { kind: 'static', value: e.target.value } })}
                        placeholder="What is the refund policy?"
                        disabled={disabled}
                        aria-label="Query text"
                    />
                </FormField>
            )}
            <KbMultiSelect value={action.knowledgeBaseIds} onChange={(ids) => set({ knowledgeBaseIds: ids })} disabled={disabled} />
            <FormField label="Max results">
                <input
                    type="number"
                    min={1}
                    max={20}
                    className={INPUT_CLS}
                    value={action.topK ?? 6}
                    onChange={(e) => { const n = parseInt(e.target.value, 10); set({ topK: Number.isFinite(n) ? Math.min(20, Math.max(1, n)) : 6 }); }}
                    disabled={disabled}
                    aria-label="Max results"
                />
            </FormField>
            <ResultVarField value={action.resultVar} onChange={(v) => set({ resultVar: v })} disabled={disabled} required />
        </>
    );
}

export default function AiActionEditor({ action, commit, formFields, disabled }) {
    if (action.kind === 'ai_extract') return <AiExtractEditor action={action} commit={commit} formFields={formFields} disabled={disabled} />;
    if (action.kind === 'ai_generate') return <AiGenerateEditor action={action} commit={commit} formFields={formFields} disabled={disabled} />;
    if (action.kind === 'kb_query') return <KbQueryEditor action={action} commit={commit} formFields={formFields} disabled={disabled} />;
    return null;
}
