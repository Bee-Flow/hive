import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDataContext } from '../DataContext';
import { useFormField } from '../formContext';
import { resolveBinding, walkPath } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { Field, INPUT_CLASS, displayValue, inputStyle } from '../uiBits';
import useAppDataSource from '../useAppDataSource';

/**
 * App Studio runtime — 'input_relation'. Spec: server/appStudio/componentSpecs.js.
 *
 * A combobox over the candidate records of a data table. Candidates come from a
 * `records` binding resolved against the shared dataState (the same seam
 * AppTable/AppList read record bindings through — useAppDataSource fetches into
 * dataState, resolveBinding reads it out), narrowed by the `filter` formula
 * server-side. `displayField` labels each option. SUBMITS the picked record
 * id, or an id[] when `multiple`.
 *
 * The binding is built HERE from props, so AppDataScope's static screen scan
 * never sees it and never fetches it — this input owns its own fetch, into the
 * SAME DataContext cache the scan writes to (one query per cache key).
 */

function candidateId(row) {
    return row?.id ?? row?._id ?? row?.uuid ?? null;
}

/** Fetch-only: mirrors the candidate query into the shared data cache. */
function CandidateLoader({ binding, sample }) {
    useAppDataSource(binding, { sample });
    return null;
}

/** Fetching needs a react-query provider; previews/tests render without one. */
function useHasQueryClient() {
    try {
        return !!useQueryClient();
    } catch {
        return false;
    }
}

// How many candidate rows the picker loads. The server's own ceiling is
// MAX_RESULT_ROWS (1000); this stays well under it while covering the
// tables a relation input realistically points at.
export const CANDIDATE_LIMIT = 500;

export default function AppInputRelation({ node }) {
    const { mode, actionState, dataState, scope } = useRuntime();
    const { appId, dataState: scopedDataState } = useDataContext();
    const hasQueryClient = useHasQueryClient();
    const {
        name, label = 'Related', tableId = null, displayField = null,
        multiple = false, required = false, filter = null,
    } = node.props || {};
    const { value, setValue, error } = useFormField({
        name, defaultValue: multiple ? [] : null, required, label,
    });
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const id = `${node.id}-input`;
    // Which option the arrow keys are on. The list was pointer-only: the
    // options listened on mouseDown alone and the input had no key
    // handling, so a relation could not be picked from the keyboard at all.
    const [activeIndex, setActiveIndex] = useState(-1);

    // Candidate records from the bound table (via the shared data cache).
    // An explicit limit, because the server clamps a MISSING one to 50: a
    // relation picker over a real table silently only ever saw the first fifty
    // rows, and then searched inside those — so a record past row 50 could not
    // be picked at all, with nothing on screen to say so.
    const recordsBinding = useMemo(
        () => (tableId ? { kind: 'records', tableId, filter: filter || undefined, limit: CANDIDATE_LIMIT } : null),
        [tableId, filter],
    );
    // Own fetch first, screen-scan result second — in the run view both land on
    // the same cache key, so this only matters before the scan has any entry.
    const mergedDataState = { ...scopedDataState, ...dataState };
    // `loadError` was dropped on the floor, so a 403/500 — or a connector that
    // needs reconnecting, whose typed "Connect … in Settings → Integrations"
    // message resolveBinding already carries — reached the user as the words
    // "No matching records.". They concluded the table was empty.
    const { value: rows, isLoading, error: loadError } = resolveBinding(recordsBinding, { actionState, dataState: mergedDataState, scope });
    const canFetch = !!recordsBinding && !!appId && hasQueryClient;

    const candidates = useMemo(() => {
        const list = Array.isArray(rows) ? rows : [];
        return list
            .map((row) => {
                const cid = candidateId(row);
                const labelValue = displayField ? walkPath(row, displayField) : (row?.name ?? row?.title ?? row?.label ?? cid);
                return cid == null ? null : { id: cid, label: displayValue(labelValue) };
            })
            .filter(Boolean);
    }, [rows, displayField]);

    const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c.label])), [candidates]);
    const selectedIds = multiple ? (Array.isArray(value) ? value : []) : (value != null ? [value] : []);
    const labelFor = (cid) => byId.get(cid) ?? String(cid);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return candidates
            .filter((c) => !selectedIds.includes(c.id))
            .filter((c) => !q || String(c.label).toLowerCase().includes(q))
            .slice(0, 50);
    }, [candidates, query, selectedIds]);

    const pick = (cid) => {
        if (multiple) { if (!selectedIds.includes(cid)) setValue([...selectedIds, cid]); }
        else { setValue(cid); setOpen(false); }
        setQuery('');
    };
    const remove = (cid) => {
        if (multiple) setValue(selectedIds.filter((x) => x !== cid));
        else setValue(null);
    };

    return (
        <Field id={id} label={label} required={required} error={error}>
            <div className="flex flex-col gap-2">
                {canFetch ? <CandidateLoader binding={recordsBinding} sample={mode !== 'run'} /> : null}
                {selectedIds.length ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label={`${label} selected`}>
                        {selectedIds.map((cid) => (
                            <li
                                key={cid}
                                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs font-medium"
                                style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)', borderRadius: 'var(--app-radius)' }}
                            >
                                {labelFor(cid)}
                                <button type="button" onClick={() => remove(cid)} aria-label={`Remove ${labelFor(cid)}`} style={{ color: 'inherit' }}>
                                    <X className="w-3 h-3" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}
                <div className="relative">
                    <input
                        id={id}
                        type="text"
                        value={query}
                        placeholder={tableId ? 'Search records…' : 'No table selected'}
                        aria-label={`Search ${label}`}
                        aria-required={required || undefined}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${id}-error` : undefined}
                        disabled={!tableId}
                        role="combobox"
                        aria-expanded={open}
                        aria-controls={`${id}-listbox`}
                        aria-activedescendant={open && activeIndex >= 0 && filtered[activeIndex] ? `${id}-opt-${filtered[activeIndex].id}` : undefined}
                        autoComplete="off"
                        onFocus={() => setOpen(true)}
                        onBlur={() => setTimeout(() => setOpen(false), 150)}
                        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                e.preventDefault();
                                if (!open) { setOpen(true); return; }
                                const step = e.key === 'ArrowDown' ? 1 : -1;
                                const count = filtered.length;
                                if (!count) return;
                                setActiveIndex((i) => (i + step + count) % count);
                                return;
                            }
                            if (e.key === 'Enter' && open && activeIndex >= 0 && filtered[activeIndex]) {
                                e.preventDefault();
                                pick(filtered[activeIndex].id);
                                setActiveIndex(-1);
                                return;
                            }
                            if (e.key === 'Escape' && open) {
                                e.preventDefault();
                                setOpen(false);
                                setActiveIndex(-1);
                            }
                        }}
                        className={`${INPUT_CLASS} pr-7`}
                        style={inputStyle(error)}
                    />
                    <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    {open ? (
                        <div
                            className="absolute z-20 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto border shadow-lg"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)' }}
                            role="listbox"
                            id={`${id}-listbox`}
                        >
                            {loadError ? (
                                <div
                                    className="px-2.5 py-2 text-xs"
                                    role="alert"
                                    style={{ color: 'var(--error)' }}
                                    data-app-relation-error="true"
                                >
                                    {String(loadError)}
                                </div>
                            ) : isLoading ? (
                                <div className="px-2.5 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</div>
                            ) : filtered.length ? (
                                filtered.map((c, i) => (
                                    <button
                                        key={c.id}
                                        id={`${id}-opt-${c.id}`}
                                        type="button"
                                        role="option"
                                        aria-selected={i === activeIndex}
                                        // mouseDown so the input's blur cannot
                                        // close the list before the pick lands.
                                        onMouseDown={(e) => { e.preventDefault(); pick(c.id); }}
                                        onMouseEnter={() => setActiveIndex(i)}
                                        className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-[var(--bg-tertiary)]"
                                        style={{
                                            color: 'var(--text-primary)',
                                            background: i === activeIndex ? 'var(--bg-tertiary)' : undefined,
                                        }}
                                    >
                                        {c.label}
                                    </button>
                                ))
                            ) : (
                                <div className="px-2.5 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {tableId ? 'No matching records.' : 'Pick a data table in the inspector.'}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        </Field>
    );
}
