import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRuntime } from '../RuntimeContext';
import { EmptyText, INPUT_CLASS, inputStyle } from '../uiBits';

/**
 * App Studio runtime — 'filter_bar'. Spec: server/appStudio/componentSpecs.js.
 *
 * A row of filter controls. A change publishes the WHOLE filters object as
 * the shared runtime variable `filters` (runtime.setVar('filters', {...})), so
 * formulas — most importantly records-binding filter values — read
 * `vars.filters.<name>`. When the surface hasn't wired setVar into the
 * RuntimeContext yet, the default no-op applies and the bar degrades
 * gracefully to purely local state (controls still work, nothing observes
 * them). Unset/empty controls are OMITTED from the object so formulas can use
 * `vars.filters.q == null` for "no filter".
 *
 * Typing publishes on a TRAILING DEBOUNCE: a filters change moves every bound
 * component's data cache key, so publishing per keystroke means one server
 * query per character. Discrete controls (select/toggle/date) can't storm and
 * publish at once — which also flushes any text still waiting.
 */

const noop = () => {};
const PUBLISH_DEBOUNCE_MS = 300;

export default function AppFilterBar({ node }) {
    const runtime = useRuntime();
    const setVar = typeof runtime.setVar === 'function' ? runtime.setVar : noop;
    const disabled = runtime.mode === 'edit';
    const fields = (Array.isArray(node.props?.fields) ? node.props.fields : [])
        .filter((f) => f && typeof f.name === 'string' && f.name);

    const [values, setValues] = useState({});
    const timerRef = useRef(null);
    const pendingRef = useRef(null);
    // Read at fire time: setVar's identity changes with the runtime value.
    const setVarRef = useRef(setVar);
    useEffect(() => { setVarRef.current = setVar; });
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    if (fields.length === 0) return <EmptyText text="No filters configured yet." />;

    const publish = (next, immediate) => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        if (immediate) { setVarRef.current('filters', next); return; }
        pendingRef.current = next;
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            setVarRef.current('filters', pendingRef.current);
        }, PUBLISH_DEBOUNCE_MS);
    };

    const commit = (name, value, immediate = false) => {
        const next = { ...values };
        if (value === '' || value === null || value === undefined) delete next[name];
        else next[name] = value;
        setValues(next);
        publish(next, immediate);
    };

    const size = node.style?.size || 'md';
    const ctlCls = `${INPUT_CLASS} ${size === 'sm' ? 'text-xs px-2 py-1' : ''}`;

    return (
        <div className="flex flex-wrap items-end gap-3" data-app-filterbar="true">
            {fields.map((field) => {
                const { name, label = null, type = 'search', options = [] } = field;
                const value = values[name];
                const id = `${node.id}-flt-${name}`;
                const control = (() => {
                    switch (type) {
                        case 'select':
                            return (
                                <select
                                    id={id}
                                    className={ctlCls}
                                    style={inputStyle()}
                                    value={value ?? ''}
                                    onChange={(e) => commit(name, e.target.value, true)}
                                    disabled={disabled}
                                    aria-label={label || name}
                                >
                                    <option value="">All</option>
                                    {(Array.isArray(options) ? options : []).map((o, i) => (
                                        <option key={i} value={o?.value ?? ''}>{o?.label || o?.value}</option>
                                    ))}
                                </select>
                            );
                        case 'toggle':
                            return (
                                <label className="inline-flex items-center gap-2 text-sm cursor-pointer py-1.5" htmlFor={id}>
                                    <input
                                        id={id}
                                        type="checkbox"
                                        checked={!!value}
                                        onChange={(e) => commit(name, e.target.checked ? true : '', true)}
                                        disabled={disabled}
                                        className="accent-[var(--app-primary)]"
                                    />
                                    <span style={{ color: 'var(--text-primary)' }}>{label || name}</span>
                                </label>
                            );
                        case 'date':
                            return (
                                <input
                                    id={id}
                                    type="date"
                                    className={ctlCls}
                                    style={inputStyle()}
                                    value={value ?? ''}
                                    onChange={(e) => commit(name, e.target.value, true)}
                                    disabled={disabled}
                                    aria-label={label || name}
                                />
                            );
                        case 'search':
                        default:
                            return (
                                <div className="relative">
                                    <Search
                                        className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2"
                                        style={{ color: 'var(--text-muted)' }}
                                        aria-hidden="true"
                                    />
                                    <input
                                        id={id}
                                        type="text"
                                        className={`${ctlCls} pl-8`}
                                        style={inputStyle()}
                                        value={value ?? ''}
                                        onChange={(e) => commit(name, e.target.value)}
                                        placeholder={label || 'Search…'}
                                        disabled={disabled}
                                        aria-label={label || name}
                                    />
                                </div>
                            );
                    }
                })();

                return (
                    <div key={name} className="flex flex-col gap-1 min-w-0" data-app-filter={name}>
                        {label && type !== 'toggle' ? (
                            <label htmlFor={id} className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                {label}
                            </label>
                        ) : null}
                        {control}
                    </div>
                );
            })}
        </div>
    );
}
