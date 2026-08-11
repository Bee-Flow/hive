import { ArrowDown, Lightbulb, Plus, Split, Table2, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { paramsOfAction } from './ActionParamsForm';
import useIntegrationCatalog from './useIntegrationCatalog';

/**
 * App Studio — combine actions into one connector.
 *
 * Some actions cannot be used alone. `gmail_read` needs a `messageId`, and the
 * only thing that produces one is `gmail_search`. `gmail_download_attachment`
 * needs an `attachmentId`, which only `gmail_read` produces. A chain says
 * "run this for every row the step before produced, binding its parameters to
 * fields of that row" — which is the only way to express those.
 *
 * The editor leads with SUGGESTIONS, not a blank form: /inspect already worked
 * out which sibling action supplies each missing parameter, so adding a step is
 * accepting a sentence ("gmail read needs messageId — gmail search gives one as
 * `id`") rather than reading two API docs. Everything a suggestion sets stays
 * editable underneath.
 *
 * Three things a step can do with its result — the choice is really "is this the
 * same thing as the row, or a different thing?":
 *   • its own table (default) — a different thing, stored beside the parent and
 *                        joined to it. `gmail search` gives messages, `gmail
 *                        read` gives their content: two tables, one link.
 *   • merge            — the same thing, widened: one row in, one row out with
 *                        the result's fields folded on.
 *   • fan out          — one row per element of a chosen field, for "a row per
 *                        attachment". After a fan-out the row IS the element:
 *                        its `id` wins and the parent's is kept as `parent_id`.
 *
 * All three leave the FLAT rows merged, so a grid bound straight to the
 * connector is unaffected — the choice only decides how many tables the rows are
 * stored in.
 *
 * Props
 *   connector       — the connector being edited
 *   onChange        — (patch) => void
 *   availableFields — [{ sourcePath, key }] from the last /inspect, so bindings
 *                     offer real field names instead of free text
 *   suggestions     — [{ param, tool, label, field, why }] from /inspect
 */

const INPUT = 'w-full rounded-md px-2 py-1.5 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)]';
const LABEL = 'text-xs font-medium text-[var(--text-secondary)]';

// The Result select is one control over two model fields (`expand` is a field
// path, `ownTable` a flag), so "its own table" needs a value that can never be a
// field path. The `$` is not legal in SOURCE_PATH_RE, which is what makes it safe.
const OWN_TABLE = '$own';

// Fields a chain step can bind to. After an expand the element's own fields
// replace the parent's, and the parent is reachable under `parent_`; both are
// offered so a later step can reach either.
function bindableFields(availableFields, chain, upToIndex) {
    const base = (availableFields || []).map((f) => f.sourcePath || f.key).filter(Boolean);
    const expanded = (chain || []).slice(0, upToIndex).some((s) => s?.expand);
    if (!expanded) return base;
    return [...new Set([...base, ...base.map((f) => `parent_${f}`)])];
}

function StepCard({ step, index, chain, connector, catalog, availableFields, onPatch, onRemove, disabled }) {
    const hit = catalog.lookup(step.tool);
    const action = hit?.action || null;
    const params = useMemo(() => paramsOfAction(action), [action]);
    const fields = bindableFields(availableFields, chain, index);

    const setArg = (param, path) => {
        const argsFrom = { ...(step.argsFrom || {}) };
        if (!path) delete argsFrom[param]; else argsFrom[param] = path;
        onPatch({ argsFrom: Object.keys(argsFrom).length ? argsFrom : undefined });
    };

    // Fields of THIS step's output worth fanning out over. Derived from its
    // declared output sample: an array of objects is a list you can expand.
    const expandable = useMemo(() => {
        const sample = action?.outputSample;
        const src = Array.isArray(sample) ? sample.find((v) => v && typeof v === 'object') : sample;
        if (!src || typeof src !== 'object') return [];
        return Object.entries(src)
            .filter(([, v]) => Array.isArray(v))
            .map(([k]) => k);
    }, [action]);

    return (
        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border-default)' }}>
            <div className="flex items-start gap-2">
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                    Step {index + 2}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {action?.label || step.tool}
                    </p>
                    {action?.description ? (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{action.description}</p>
                    ) : null}
                </div>
                <button type="button" onClick={onRemove} disabled={disabled}
                    aria-label={`Remove step ${index + 2}`}
                    className="p-1 rounded hover:bg-[var(--bg-card-hover)]" style={{ color: 'var(--error)' }}>
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>

            {params.length ? (
                <div className="mt-2 flex flex-col gap-1.5">
                    {params.map(({ key, spec, required }) => (
                        <div key={key} className="flex items-center gap-2">
                            <span className="w-32 shrink-0 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {key}{required ? <span style={{ color: '#d97706' }}> *</span> : null}
                            </span>
                            <select
                                className={`${INPUT} flex-1`}
                                value={step.argsFrom?.[key] || ''}
                                disabled={disabled}
                                aria-label={`Where ${key} of step ${index + 2} comes from`}
                                onChange={(e) => setArg(key, e.target.value)}
                            >
                                <option value="">
                                    {connector.fixedArgs && Object.hasOwn(connector.fixedArgs, key)
                                        ? 'Not from a row' : 'Not set'}
                                </option>
                                {fields.map((f) => <option key={f} value={f}>each row’s {f}</option>)}
                            </select>
                            {spec?.description ? (
                                <span className="hidden sm:block w-40 shrink-0 truncate text-[11px]" style={{ color: 'var(--text-tertiary)' }}
                                    title={spec.description}>
                                    {spec.description}
                                </span>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="mt-2 flex items-center gap-2">
                <span className={LABEL}>Result</span>
                <select
                    className={`${INPUT} max-w-[18rem]`}
                    value={step.expand || (step.ownTable ? OWN_TABLE : '')}
                    disabled={disabled}
                    aria-label={`How step ${index + 2} folds its result back`}
                    onChange={(e) => {
                        const v = e.target.value;
                        // The two are mutually exclusive — expanding already gives
                        // the step a table of its own — and the model says so, so
                        // never leave both set.
                        onPatch({
                            expand: (v && v !== OWN_TABLE) ? v : undefined,
                            ownTable: v === OWN_TABLE ? true : undefined,
                        });
                    }}
                >
                    <option value={OWN_TABLE}>Keep it in its own linked table</option>
                    <option value="">Add its fields to each row</option>
                    {expandable.map((f) => (
                        <option key={f} value={f}>One row per {f}</option>
                    ))}
                </select>
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {step.expand ? (
                        <>
                            <Split className="h-3 w-3" aria-hidden="true" />
                            each row becomes one {step.expand.replace(/s$/, '')}, in its own table linked back to the step above
                        </>
                    ) : step.ownTable ? (
                        <>
                            <Table2 className="h-3 w-3" aria-hidden="true" />
                            its own table, one row per row of the step above, linked to it
                        </>
                    ) : (
                        <>one wide table — these columns sit next to the ones above</>
                    )}
                </span>
            </div>
        </div>
    );
}

export default function ConnectorChainEditor({
    connector, onChange, availableFields = [], suggestions = [], disabled = false, maxSteps = 3,
}) {
    const catalog = useIntegrationCatalog();
    const chain = Array.isArray(connector.chain) ? connector.chain : [];
    const [adding, setAdding] = useState(false);

    const siblings = useMemo(() => catalog.siblingsOf(connector.tool), [catalog, connector.tool]);
    const baseAction = catalog.lookup(connector.tool)?.action || null;

    const setChain = (next) => onChange({ chain: next.length ? next : undefined });
    const patchStep = (i, patch) => setChain(chain.map((s, j) => {
        if (j !== i) return s;
        const merged = { ...s, ...patch };
        for (const [k, v] of Object.entries(patch)) if (v === undefined) delete merged[k];
        return merged;
    }));
    // A follow-up action returns a different KIND of thing from the one before it
    // — that is why it needed chaining at all — so it starts out in a table of its
    // own, joined to the previous step. Steps saved before this existed carry no
    // `ownTable` flag and keep merging, so nothing changes underneath anyone.
    const addStep = (step) => { setChain([...chain, { ownTable: true, ...step }]); setAdding(false); };

    // A suggestion already carries the binding, so accepting one is a click.
    const openSuggestions = suggestions.filter((s) => s.tool && !chain.some((c) => c.tool === s.tool));

    if (connector.kind !== 'integration_tool' || !connector.tool) return null;

    return (
        <div className="flex flex-col gap-2">
            <div>
                <span className={LABEL}>Combine actions</span>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Run another action for every row this one returns — that is how an action gets an id it can only
                    learn from a different action.
                </p>
            </div>

            <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Step 1</span>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {baseAction?.label || connector.tool}
                </p>
            </div>

            {chain.map((step, i) => (
                <React.Fragment key={`${step.tool}-${i}`}>
                    <ArrowDown className="mx-auto h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
                    <StepCard
                        step={step}
                        index={i}
                        chain={chain}
                        connector={connector}
                        catalog={catalog}
                        availableFields={availableFields}
                        onPatch={(patch) => patchStep(i, patch)}
                        onRemove={() => setChain(chain.filter((_, j) => j !== i))}
                        disabled={disabled}
                    />
                </React.Fragment>
            ))}

            {chain.length >= maxSteps ? (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    That’s the most steps one connector can chain ({maxSteps}).
                </p>
            ) : adding ? (
                <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border-default)' }}>
                    <label className="flex flex-col gap-1">
                        <span className={LABEL}>Which action should run for each row?</span>
                        <select
                            className={INPUT}
                            defaultValue=""
                            disabled={disabled}
                            aria-label="Follow-up action"
                            onChange={(e) => {
                                if (!e.target.value) return;
                                const action = siblings.find((a) => a.name === e.target.value);
                                // Pre-bind whatever obviously matches, so the step
                                // arrives half-configured rather than empty.
                                const argsFrom = {};
                                for (const s of suggestions) {
                                    if (s.tool === e.target.value && s.field) argsFrom[s.param] = s.field;
                                }
                                addStep({ tool: action.name, ...(Object.keys(argsFrom).length ? { argsFrom } : {}) });
                            }}
                        >
                            <option value="">Choose an action…</option>
                            {siblings.filter((a) => !a.sideEffect).map((a) => (
                                <option key={a.name} value={a.name}>{a.label || a.name}</option>
                            ))}
                        </select>
                    </label>
                    <button type="button" onClick={() => setAdding(false)} className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Cancel
                    </button>
                </div>
            ) : (
                <>
                    {openSuggestions.map((s) => (
                        <button
                            key={`${s.param}-${s.tool}`}
                            type="button"
                            disabled={disabled}
                            onClick={() => addStep({ tool: s.tool, argsFrom: s.field ? { [s.param]: s.field } : undefined })}
                            className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-xs"
                            style={{ borderColor: 'var(--accent-primary)', color: 'var(--text-primary)' }}
                        >
                            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                            <span>
                                <span className="font-medium">{s.why}</span>
                                <span className="block mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Add it as a step.</span>
                            </span>
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        disabled={disabled || !siblings.length}
                        className="self-start inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs disabled:opacity-50"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add a follow-up step
                    </button>
                </>
            )}
        </div>
    );
}
