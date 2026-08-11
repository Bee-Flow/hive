import { Plus, Sparkles, X } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import AccordionSection from '../AccordionSection';
import { inputClass, textareaClass, FormRow } from './formPrimitives';
import useAutomationApi from '../../../../../../hooks/useAutomationApi';
import { walkPath, walkRelativePath, previewValue, suggestKeyFromPath } from '../../../../../../utils/bindingHelpers';
import JsonTreePicker from '../../mapping/JsonTreePicker';
import PathField from '../../mapping/PathField';

/**
 * Settings editor for the parse_json step.
 *
 * Draft shape (formState.js): { sourceRef, mode: 'paths'|'ai', fields: [
 *   { name, path, description?, fallback? } ] }.
 *
 * The live preview resolves each field with walkRelativePath against the
 * SAME sample plumbing every other editor uses (previewSample = pinned →
 * last-run → catalog overlay), so what the user sees here is exactly what
 * the runtime will extract.
 */
const FIELD_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Suggest a unique, identifier-safe field name from a picked path. */
export function suggestFieldName(path, existingNames = []) {
    let base = suggestKeyFromPath(path);
    if (!/^[A-Za-z_]/.test(base)) base = `_${base}`;
    if (!FIELD_NAME_RE.test(base)) base = 'field';
    const taken = new Set((existingNames || []).filter(Boolean));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}_${i}`)) i++;
    return `${base}_${i}`;
}

/** Parse a resolved source for preview: strings are JSON.parsed (BOM/space
 *  tolerated, like the runtime); objects/arrays pass through; else undefined. */
export function parseSampleSource(sourceValue) {
    if (typeof sourceValue === 'string') {
        try { return JSON.parse(sourceValue.replace(/^\uFEFF/, '').trim()); }
        catch { return undefined; }
    }
    if (sourceValue !== null && typeof sourceValue === 'object') return sourceValue;
    return undefined;
}

export default function ParseJsonFields({ step, draft, set, groups = [], onFocusField, previewSample, errorSections = new Set() }) {
    const api = useAutomationApi();
    const fields = Array.isArray(draft.fields) ? draft.fields : [];
    const aiMode = draft.mode === 'ai';

    // Nearest upstream node = LAST group (collectUpstream returns execution
    // order); skip the current step's own forEach item group.
    const nearest = useMemo(() => {
        for (let i = groups.length - 1; i >= 0; i--) {
            const g = groups[i];
            if (g && g.id !== `${step.id}__foreach`) return g;
        }
        return null;
    }, [groups, step.id]);

    const sourceValue = useMemo(() => {
        if (!previewSample) return undefined;
        const ref = (draft.sourceRef || '').trim();
        if (ref) return walkPath(ref, previewSample);
        // Empty sourceRef = the runtime's "previous step's output" default.
        return nearest ? walkPath(nearest.basePath, previewSample) : undefined;
    }, [draft.sourceRef, previewSample, nearest]);
    const parsedSample = useMemo(() => parseSampleSource(sourceValue), [sourceValue]);
    const usableSample = parsedSample !== undefined;

    // ── Grouping ("one row per entry") ─────────────────────────────────
    // Without it, a path like results[*].attendees[*].email flattens every
    // entry into one list and you lose which entry each value came from.
    const itemsRef = (draft.itemsRef || '').trim();
    const groupItems = useMemo(() => {
        if (!usableSample || !itemsRef) return null;
        const v = walkRelativePath(itemsRef, parsedSample);
        return Array.isArray(v) ? v : null;
    }, [usableSample, itemsRef, parsedSample]);
    const grouped = !!groupItems;
    const groupRefBroken = !!itemsRef && usableSample && !grouped;
    // Field paths (and the picker) are relative to ONE entry when grouped.
    const previewRoot = grouped ? groupItems[0] : parsedSample;
    const previewUsable = usableSample && (!grouped || groupItems.length > 0);

    // Array-valued paths in the sample, offered as one-click grouping targets.
    const groupCandidates = useMemo(() => {
        if (!usableSample || parsedSample === null || typeof parsedSample !== 'object') return [];
        const out = [];
        if (Array.isArray(parsedSample)) return out; // root array → itemsRef '$'
        for (const [k, v] of Object.entries(parsedSample)) {
            if (Array.isArray(v) && v.length && v[0] !== null && typeof v[0] === 'object') out.push(k);
            if (out.length >= 4) break;
        }
        return out;
    }, [usableSample, parsedSample]);

    // ── Field-row helpers ──────────────────────────────────────────────
    const updateField = (i, patch) => {
        const next = fields.slice();
        next[i] = { ...next[i], ...patch };
        set('fields', next);
    };
    const setFallback = (i, text) => {
        const next = fields.slice();
        const row = { ...next[i] };
        // Stored verbatim as a string literal; empty clears it (missing
        // extraction then yields null, the runtime default).
        if (text === '') delete row.fallback;
        else row.fallback = text;
        next[i] = row;
        set('fields', next);
    };
    const removeField = (i) => set('fields', fields.filter((_, idx) => idx !== i));
    const addField = () => set('fields', [...fields, { name: '', path: '' }]);

    // Which row's PATH input has focus — a tree pick then fills that row
    // instead of appending a new one (same delayed-clear pattern as
    // PathField's onBlur so the click still sees the focus).
    const pathFocusRef = useRef(null);
    const onPickPath = (path) => {
        const focusIdx = pathFocusRef.current;
        if (focusIdx != null && fields[focusIdx]) {
            updateField(focusIdx, { path });
            return;
        }
        const name = suggestFieldName(path, fields.map(f => f?.name));
        set('fields', [...fields, { name, path }]);
    };

    // ── Map with AI ────────────────────────────────────────────────────
    const [instruction, setInstruction] = useState('');
    const [mapping, setMapping] = useState(false);
    const [mapError, setMapError] = useState(null);
    // Names the endpoint could NOT verify against the sample (amber badge).
    // UI-only state — `verified` is not part of the step schema.
    const [unverified, setUnverified] = useState(() => new Set());

    const runMapWithAi = async () => {
        setMapping(true);
        setMapError(null);
        try {
            const existingFields = fields
                .filter(f => f && f.name)
                .map(f => ({ name: f.name, path: f.path || '', description: f.description || '' }));
            const res = await api.mapJsonFields(parsedSample, instruction.trim(), existingFields);
            // The endpoint proposes grouping when the request implies "per
            // entry"; it only returns a ref it verified against the sample.
            if (typeof res?.itemsRef === 'string' && res.itemsRef && res.itemsRef !== itemsRef) {
                set('itemsRef', res.itemsRef);
            }
            const taken = new Set(fields.map(f => f?.name).filter(Boolean));
            const added = [];
            const amber = new Set(unverified);
            for (const f of (res?.fields || [])) {
                if (!f?.name || taken.has(f.name)) continue;
                taken.add(f.name);
                const row = { name: f.name, path: typeof f.path === 'string' ? f.path : '' };
                if (f.description) row.description = f.description;
                added.push(row);
                if (f.verified === false) amber.add(f.name);
            }
            if (added.length) set('fields', [...fields, ...added]);
            setUnverified(amber);
        } catch (e) {
            setMapError(e?.message || 'Mapping failed');
        } finally {
            setMapping(false);
        }
    };

    return (
        <>
            {/* parse_json is retired from the palette — its extraction ability
                lives in the Edit data step now (parseJson() expressions +
                "Pick fields from it"). Existing steps keep working untouched;
                this banner just points authors at the current home. */}
            <div className="mb-2 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)]">
                This step type has moved into <span className="font-medium text-[var(--text-primary)]">Edit data</span> — this existing step keeps working.
                For new extractions, add an Edit data step and use “Pick fields from it”.
            </div>
            <AccordionSection stepType="parse_json" sectionKey="source" title="Source" defaultOpen forceOpen={errorSections.has('source')}>
                <FormRow label="Source" hint="Where the JSON comes from. Empty = the previous step's output. Text is parsed as JSON automatically.">
                    <PathField
                        value={draft.sourceRef || ''}
                        onChange={(next) => set('sourceRef', next)}
                        placeholder="steps.step1.output.body"
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                    />
                    {nearest?.kind === 'http_request' && (
                        <button
                            type="button"
                            onClick={() => set('sourceRef', `${nearest.basePath}.body`)}
                            className="mt-1 text-xs font-medium text-[var(--accent)] hover:underline"
                        >
                            Use HTTP response body
                        </button>
                    )}
                </FormRow>
                <FormRow
                    label="Group by list"
                    hint="Optional. Point this at a list to get one row per entry — field paths are then relative to a single entry, and the output becomes items + count. Leave empty for one flat set of values."
                >
                    <input
                        type="text"
                        value={draft.itemsRef || ''}
                        onChange={(e) => set('itemsRef', e.target.value)}
                        placeholder="results"
                        aria-label="Group by list"
                        className={inputClass() + ' font-mono'}
                    />
                    {groupCandidates.length > 0 && !itemsRef && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">lists found</span>
                            {groupCandidates.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => set('itemsRef', c)}
                                    className="px-1.5 py-0.5 rounded-full border border-[var(--border-default)] text-[10px] font-mono text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition"
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    )}
                    {groupRefBroken && (
                        <div className="mt-1 text-[10px] text-amber-500">
                            This path is not a list in the sample — the step will fail at run time.
                        </div>
                    )}
                    {grouped && (
                        <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                            {groupItems.length} {groupItems.length === 1 ? 'entry' : 'entries'} — one output row each. Bind downstream as <span className="font-mono">steps.{step.id}.output.items</span>.
                        </div>
                    )}
                </FormRow>
            </AccordionSection>

            <AccordionSection stepType="parse_json" sectionKey="fields" title="Fields" defaultOpen forceOpen={errorSections.has('fields')}>
                {fields.length === 0 && (
                    <div className="text-xs text-[var(--text-tertiary)] italic mb-2">
                        No fields yet — add one, pick from the sample below, or describe what you want and map with AI.
                    </div>
                )}
                {fields.map((f, i) => {
                    const resolved = previewUsable ? walkRelativePath(f?.path ?? '', previewRoot) : undefined;
                    // How many entries actually carry a value — a path can be
                    // valid yet empty for most rows (e.g. an attendee's name,
                    // which Google only fills for external guests).
                    let matched = null;
                    if (grouped) {
                        matched = 0;
                        for (const it of groupItems) {
                            const v = walkRelativePath(f?.path ?? '', it);
                            if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) matched++;
                        }
                    }
                    return (
                        <div key={i} className="rounded-lg border border-[var(--border-default)] p-2 mb-2 space-y-1.5">
                            <div className="flex items-start gap-2">
                                <input
                                    type="text"
                                    value={f?.name || ''}
                                    onChange={(e) => updateField(i, { name: e.target.value })}
                                    placeholder="field_name"
                                    aria-label="Field name"
                                    className={inputClass() + ' w-36 shrink-0 font-mono'}
                                />
                                <input
                                    type="text"
                                    value={f?.path || ''}
                                    onChange={(e) => updateField(i, { path: e.target.value })}
                                    onFocus={() => { pathFocusRef.current = i; }}
                                    onBlur={() => setTimeout(() => { if (pathFocusRef.current === i) pathFocusRef.current = null; }, 150)}
                                    placeholder="order.customer.email"
                                    aria-label="Field path"
                                    className={inputClass() + ' flex-1 font-mono'}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeField(i)}
                                    title="Remove field"
                                    className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-tertiary)] transition"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="flex items-start gap-2">
                                <input
                                    type="text"
                                    value={f?.fallback === undefined ? '' : (typeof f.fallback === 'string' ? f.fallback : JSON.stringify(f.fallback))}
                                    onChange={(e) => setFallback(i, e.target.value)}
                                    placeholder="fallback (optional)"
                                    aria-label="Field fallback"
                                    className={inputClass() + ' w-36 shrink-0'}
                                />
                                <textarea
                                    rows={1}
                                    value={f?.description || ''}
                                    onChange={(e) => updateField(i, { description: e.target.value })}
                                    placeholder={aiMode ? 'Description (required in AI mode)' : 'Description (optional)'}
                                    aria-label="Field description"
                                    className={textareaClass() + ' flex-1'}
                                />
                            </div>
                            {unverified.has(f?.name) && (
                                <div className="text-[10px] text-amber-500">not found in sample</div>
                            )}
                            {previewUsable && (
                                <div className={`text-[10px] flex items-center gap-1.5 ${resolved === undefined ? 'text-amber-500' : 'text-[var(--text-tertiary)]'}`}>
                                    <span className="uppercase tracking-wide">{resolved === undefined ? '!' : (grouped ? 'row 1' : 'example')}</span>
                                    <span className={`truncate ${resolved === undefined ? '' : 'font-mono text-[var(--text-secondary)]'}`}>
                                        {resolved === undefined ? 'no match in sample' : previewValue(resolved, 60)}
                                    </span>
                                    {matched !== null && (
                                        <span className={matched === 0 ? 'text-amber-500' : ''}>
                                            · filled in {matched}/{groupItems.length}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                <button
                    type="button"
                    onClick={addField}
                    className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 transition"
                >
                    <Plus size={12} /> Add field
                </button>

                {previewUsable && (
                    <div className="mt-3 space-y-1">
                        <div className="text-[11px] font-medium text-[var(--text-secondary)]">Pick from sample</div>
                        <div className="text-[10px] text-[var(--text-tertiary)]">
                            {grouped
                                ? 'Showing the first entry — clicked paths apply to every entry.'
                                : 'Preview from the latest available sample. Click a value to add it as a field.'}
                        </div>
                        <JsonTreePicker value={previewRoot} onPick={onPickPath} />
                    </div>
                )}

                <div className="mt-3 space-y-1.5">
                    <div className="text-[11px] font-medium text-[var(--text-secondary)]">Map with AI</div>
                    <textarea
                        rows={2}
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="Describe the fields you want, e.g. the customer's email and the total of each order line."
                        className={textareaClass()}
                    />
                    <button
                        type="button"
                        onClick={runMapWithAi}
                        disabled={!usableSample || !instruction.trim() || mapping}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition"
                    >
                        <Sparkles size={12} /> {mapping ? 'Mapping…' : 'Map with AI'}
                    </button>
                    {!usableSample && (
                        <div className="text-[10px] text-[var(--text-tertiary)]">
                            Run or pin the previous step's output first.
                        </div>
                    )}
                    {mapError && (
                        <div className="text-[10px] text-red-500">{mapError}</div>
                    )}
                </div>
            </AccordionSection>

            <AccordionSection stepType="parse_json" sectionKey="options" title="Options" defaultOpen={aiMode} forceOpen={errorSections.has('options')}>
                <FormRow label="Extraction">
                    <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                        <input
                            type="checkbox"
                            checked={aiMode}
                            onChange={(e) => set('mode', e.target.checked ? 'ai' : 'paths')}
                        />
                        Extract with AI on every run
                    </label>
                    <div className="text-xs text-[var(--text-tertiary)] mt-1">
                        For payloads whose shape changes run to run. Uses the fast AI model on every run
                        (token cost); each field needs a description. Otherwise leave off — path
                        extraction is instant and free.
                    </div>
                </FormRow>
            </AccordionSection>
        </>
    );
}
