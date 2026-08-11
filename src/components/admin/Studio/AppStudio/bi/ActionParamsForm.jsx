import { AlertTriangle, Link2, Lock, User } from 'lucide-react';
import React, { useMemo, useState } from 'react';

/**
 * App Studio — an action's parameters, as a real form.
 *
 * Before this, an action's parameters were a raw `fixedArgs` JSON textarea and a
 * separate key/type list for viewer input. Picking `gmail_read` — which REQUIRES
 * a `messageId` — gave you an empty JSON box and then "Connector failed to run",
 * with nothing on screen saying what was missing. The action's own JSON Schema
 * was in the catalog the whole time; this renders it.
 *
 * Each parameter gets a control matching its declared type, its description as
 * help text, a required marker that actually blocks saving, and — the part that
 * matters for a connector — a choice of WHERE its value comes from:
 *
 *   Pinned          → connector.fixedArgs[key]. The author fixes it; viewers
 *                     cannot change it. This is the safe default, because
 *                     fixedArgs always win over viewer input at dispatch.
 *   Ask the viewer  → connector.params[] declares it. It becomes part of the
 *                     app's surface; whatever the viewer sends is narrowed to
 *                     these declared keys server-side.
 *   From a step     → bound by a chain step (read-only here; the chain editor
 *                     owns those bindings). Shown so a parameter that IS already
 *                     satisfied doesn't look missing.
 *
 * The raw JSON escape hatch stays in ConnectorsManager's Advanced disclosure for
 * a parameter the schema doesn't describe.
 */

const INPUT = 'w-full rounded-md px-2 py-1.5 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)]';
const LABEL = 'text-xs font-medium text-[var(--text-secondary)]';

const SOURCES = [
    { value: 'pinned', label: 'Pinned', Icon: Lock, hint: 'You set the value; viewers cannot change it.' },
    { value: 'viewer', label: 'Ask the viewer', Icon: User, hint: 'The app asks each viewer for this value.' },
];

/** The parameter names an action declares, required ones first. */
export function paramsOfAction(action) {
    const schema = action?.inputSchema;
    const props = (schema && typeof schema.properties === 'object' && schema.properties) ? schema.properties : null;
    if (!props) return [];
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    return Object.entries(props)
        .map(([key, spec]) => ({ key, spec: spec && typeof spec === 'object' ? spec : {}, required: required.has(key) }))
        .sort((a, b) => Number(b.required) - Number(a.required) || a.key.localeCompare(b.key));
}

/** Where a parameter's value comes from right now. */
export function sourceOf(connector, key) {
    if (connector?.fixedArgs && Object.hasOwn(connector.fixedArgs, key)) return 'pinned';
    if (Array.isArray(connector?.params) && connector.params.some((p) => p?.key === key)) return 'viewer';
    const chain = Array.isArray(connector?.chain) ? connector.chain : [];
    if (chain.some((s) => s?.argsFrom && Object.hasOwn(s.argsFrom, key))) return 'chain';
    return 'unset';
}

/**
 * Required parameters of `action` that nothing supplies. Consumed by
 * connectorProblem, so a connector that would fail at runtime is caught at save
 * time — and before a doomed "Test it" — instead of surfacing as a 502.
 *
 * A parameter counts as satisfied when it is pinned (even to an empty string,
 * which is a deliberate choice), declared for the viewer, or bound by a chain.
 */
export function missingRequiredParams(action, connector) {
    return paramsOfAction(action)
        .filter((p) => p.required && sourceOf(connector, p.key) === 'unset')
        .map((p) => p.key);
}

function typeOf(spec) {
    if (Array.isArray(spec.enum) && spec.enum.length) return 'enum';
    if (spec.type === 'boolean') return 'boolean';
    if (spec.type === 'integer' || spec.type === 'number') return 'number';
    if (spec.type === 'array') return (spec.items && spec.items.type && spec.items.type !== 'object') ? 'list' : 'json';
    if (spec.type === 'object') return 'json';
    return 'string';
}

/** A pinned value → the control's display value, and back. */
function ValueControl({ spec, value, onChange, disabled, id }) {
    const kind = typeOf(spec);
    const [jsonText, setJsonText] = useState(() => (value === undefined ? '' : JSON.stringify(value, null, 2)));
    const [jsonError, setJsonError] = useState(null);

    if (kind === 'enum') {
        return (
            <select id={id} className={INPUT} value={value ?? ''} disabled={disabled}
                onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}>
                <option value="">Not set</option>
                {spec.enum.map((opt) => <option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
            </select>
        );
    }
    if (kind === 'boolean') {
        return (
            <select id={id} className={INPUT} value={value === undefined ? '' : String(!!value)} disabled={disabled}
                onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}>
                <option value="">Not set</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
            </select>
        );
    }
    if (kind === 'number') {
        return (
            <input id={id} type="number" className={INPUT} value={value ?? ''} disabled={disabled}
                onChange={(e) => {
                    if (e.target.value === '') return onChange(undefined);
                    const n = Number(e.target.value);
                    onChange(Number.isFinite(n) ? n : undefined);
                }} />
        );
    }
    if (kind === 'list') {
        // A list of scalars is far friendlier as comma-separated text than as
        // JSON — `INBOX, UNREAD` rather than `["INBOX","UNREAD"]`.
        const asText = Array.isArray(value) ? value.join(', ') : (value ?? '');
        return (
            <input id={id} className={INPUT} value={asText} disabled={disabled} placeholder="value, another value"
                onChange={(e) => {
                    const parts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    onChange(parts.length ? parts : undefined);
                }} />
        );
    }
    if (kind === 'json') {
        return (
            <>
                <textarea id={id} className={`${INPUT} font-mono min-h-[4rem]`} value={jsonText} disabled={disabled} spellCheck={false}
                    onChange={(e) => {
                        setJsonText(e.target.value);
                        const raw = e.target.value.trim();
                        if (!raw) { setJsonError(null); onChange(undefined); return; }
                        try { onChange(JSON.parse(raw)); setJsonError(null); } catch { setJsonError('Invalid JSON'); }
                    }} />
                {jsonError ? <span className="text-xs text-[var(--error)]">{jsonError}</span> : null}
            </>
        );
    }
    return (
        <input id={id} className={INPUT} value={value ?? ''} disabled={disabled} spellCheck={false}
            onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)} />
    );
}

function ParamRow({ param, connector, onChange, disabled }) {
    const { key, spec, required } = param;
    const source = sourceOf(connector, key);
    const controlId = `param-${key}`;

    const setSource = (next) => {
        const fixedArgs = { ...(connector.fixedArgs || {}) };
        const params = (Array.isArray(connector.params) ? connector.params : []).filter((p) => p?.key !== key);
        delete fixedArgs[key];
        if (next === 'pinned') {
            fixedArgs[key] = spec.type === 'boolean' ? false : (spec.type === 'array' ? [] : '');
        } else if (next === 'viewer') {
            params.push({ key, type: typeOf(spec) === 'number' ? 'number' : (typeOf(spec) === 'boolean' ? 'boolean' : 'text'), required });
        }
        onChange({
            fixedArgs: Object.keys(fixedArgs).length ? fixedArgs : undefined,
            params,
        });
    };

    const setValue = (value) => {
        const fixedArgs = { ...(connector.fixedArgs || {}) };
        if (value === undefined) delete fixedArgs[key]; else fixedArgs[key] = value;
        onChange({ fixedArgs: Object.keys(fixedArgs).length ? fixedArgs : undefined });
    };

    const chainStep = source === 'chain'
        ? (connector.chain || []).find((s) => s?.argsFrom && Object.hasOwn(s.argsFrom, key))
        : null;

    return (
        <div className="rounded-md border px-2.5 py-2" style={{
            borderColor: required && source === 'unset' ? 'rgba(217, 119, 6, 0.5)' : 'var(--border-default)',
            background: required && source === 'unset' ? 'rgba(217, 119, 6, 0.06)' : 'transparent',
        }}>
            <div className="flex items-start gap-2">
                <label htmlFor={controlId} className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{key}</span>
                        {required ? <span className="text-xs" style={{ color: '#d97706' }} aria-label="required">required</span> : null}
                        <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                            {Array.isArray(spec.enum) ? 'choice' : (spec.type || 'text')}
                        </span>
                    </span>
                    {spec.description ? (
                        <span className="block text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{spec.description}</span>
                    ) : null}
                </label>
                <div className="shrink-0">
                    <select
                        className="rounded-md px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)]"
                        value={source === 'chain' ? 'chain' : source}
                        disabled={disabled || source === 'chain'}
                        aria-label={`Where ${key} comes from`}
                        onChange={(e) => setSource(e.target.value)}
                    >
                        {source === 'unset' ? <option value="unset">Not set</option> : null}
                        {source === 'chain' ? <option value="chain">From a previous step</option> : null}
                        {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
            </div>

            {source === 'pinned' ? (
                <div className="mt-1.5">
                    <ValueControl id={controlId} spec={spec} value={connector.fixedArgs?.[key]} onChange={setValue} disabled={disabled} />
                </div>
            ) : null}

            {source === 'viewer' ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <User className="h-3 w-3" aria-hidden="true" />
                    The app asks each viewer for this.
                </p>
            ) : null}

            {source === 'chain' ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <Link2 className="h-3 w-3" aria-hidden="true" />
                    Filled from <code>{chainStep?.argsFrom?.[key]}</code> of each row from the step before.
                </p>
            ) : null}

            {required && source === 'unset' ? (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs" style={{ color: '#d97706' }}>
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    This action needs {key}. Pin a value, ask the viewer for it, or get it from another action under
                    “Combine actions”.
                </p>
            ) : null}
        </div>
    );
}

export default function ActionParamsForm({ action, connector, onChange, disabled = false, catalogUnavailable = false }) {
    const params = useMemo(() => paramsOfAction(action), [action]);

    // Values the author pinned that the schema doesn't describe — a hand-typed
    // fixedArg, or a parameter the action dropped. Surfaced rather than hidden,
    // because an unexplained argument is still being sent upstream.
    const extras = useMemo(() => {
        const declared = new Set(params.map((p) => p.key));
        return Object.keys(connector.fixedArgs || {}).filter((k) => !declared.has(k));
    }, [params, connector.fixedArgs]);

    if (catalogUnavailable) {
        return (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                We couldn’t load this action’s parameters. You can still set them as JSON under Advanced settings.
            </p>
        );
    }
    if (!action) {
        return (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Pick an app and an action to see what it needs.
            </p>
        );
    }
    if (!params.length) {
        return (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                This action takes no parameters — it runs as-is.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-1.5">
            <span className={LABEL}>What this action needs</span>
            {params.map((param) => (
                <ParamRow key={param.key} param={param} connector={connector} onChange={onChange} disabled={disabled} />
            ))}
            {extras.length ? (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Also sending: {extras.join(', ')} — set under Advanced settings.
                </p>
            ) : null}
        </div>
    );
}
