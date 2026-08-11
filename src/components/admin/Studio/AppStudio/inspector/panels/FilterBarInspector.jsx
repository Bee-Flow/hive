import React from 'react';
import { usePatch } from './kit';
import { RepeatableList, inputCls } from '../../../../ProductWebsite/fields';
import { registerInspector } from '../registry';

/**
 * Content panel for filter_bar. Props mirror componentSpecs.js (authoritative):
 * fields: [{ name, label?, type: search|select|toggle|date, options? }] — each
 * control writes vars.filters.<name> at runtime, for use in records-binding
 * filter formulas. Bespoke because the nested options list (select type) is
 * beyond the generic SpecPanel list editor.
 */

const FIELD_TYPES = ['search', 'select', 'toggle', 'date'];

export default function FilterBarInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <fieldset disabled={disabled} className="min-w-0">
                <RepeatableList
                    label="Filters"
                    items={props.fields || []}
                    onChange={(fields) => patch({ fields })}
                    makeNew={() => ({ name: '', label: '', type: 'search', options: [] })}
                    addLabel="Add filter"
                    collapsible
                    itemLabel={(f) => f.label || f.name}
                    renderItem={(field, update) => (
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                className={inputCls}
                                value={field.name || ''}
                                onChange={(e) => update({ ...field, name: e.target.value })}
                                placeholder="Name (vars.filters.<name>)"
                                spellCheck={false}
                                aria-label="Filter name"
                            />
                            <input
                                type="text"
                                className={inputCls}
                                value={field.label || ''}
                                onChange={(e) => update({ ...field, label: e.target.value })}
                                placeholder="Label (optional)"
                                aria-label="Filter label"
                            />
                            <select
                                className={inputCls}
                                value={field.type || 'search'}
                                onChange={(e) => update({ ...field, type: e.target.value })}
                                aria-label="Filter type"
                            >
                                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                            </select>
                            {field.type === 'select' ? (
                                <RepeatableList
                                    label="Options"
                                    items={field.options || []}
                                    onChange={(options) => update({ ...field, options })}
                                    makeNew={() => ({ value: '', label: '' })}
                                    addLabel="Add option"
                                    itemLabel={(o) => o.label || o.value}
                                    renderItem={(opt, updateOpt) => (
                                        <div className="flex flex-col gap-2">
                                            <input
                                                type="text"
                                                className={inputCls}
                                                value={opt.value || ''}
                                                onChange={(e) => updateOpt({ ...opt, value: e.target.value })}
                                                placeholder="Value"
                                                spellCheck={false}
                                                aria-label="Option value"
                                            />
                                            <input
                                                type="text"
                                                className={inputCls}
                                                value={opt.label || ''}
                                                onChange={(e) => updateOpt({ ...opt, label: e.target.value })}
                                                placeholder="Label (optional)"
                                                aria-label="Option label"
                                            />
                                        </div>
                                    )}
                                />
                            ) : null}
                        </div>
                    )}
                />
            </fieldset>
            <p className="text-xs text-[var(--text-muted)]">
                Each control publishes <code>vars.filters.&lt;name&gt;</code> — use it in a records
                binding&rsquo;s filter formula, e.g. <code>vars.filters.status</code>.
            </p>
        </div>
    );
}

registerInspector('filter_bar', FilterBarInspector);
