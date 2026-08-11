import React from 'react';
import BindingField from './BindingField';
import { TextField , usePatch } from './kit';
import Toggle from '../../../../../shared/Toggle';
import { RepeatableList, inputCls } from '../../../../ProductWebsite/fields';
import { ConfigureDataButton } from '../../bi/QueryBuilder';
import { registerInspector } from '../registry';

const AGGS = ['sum', 'avg', 'count', 'min', 'max'];
const FORMATS = ['number', 'percent', 'currency', 'date'];

function DimList({ label, addLabel, items, onChange, disabled }) {
    return (
        <fieldset disabled={disabled} className="min-w-0">
            <RepeatableList
                label={label}
                items={items || []}
                onChange={onChange}
                makeNew={() => ({ key: '', label: '' })}
                addLabel={addLabel}
                itemLabel={(d) => d.label || d.key}
                renderItem={(d, update) => (
                    <div className="flex flex-col gap-2">
                        <input type="text" className={inputCls} value={d.key || ''} onChange={(e) => update({ ...d, key: e.target.value })} placeholder="Field key" spellCheck={false} />
                        <input type="text" className={inputCls} value={d.label || ''} onChange={(e) => update({ ...d, label: e.target.value })} placeholder="Heading (optional)" />
                    </div>
                )}
            />
        </fieldset>
    );
}

/** Content panel for pivot. Props mirror componentSpecs.js (authoritative). */
export default function PivotInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    return (
        <div className="flex flex-col gap-4">
            <ConfigureDataButton node={node} definition={definition} patch={patch} componentType="pivot" disabled={disabled} />
            <BindingField
                label="Source"
                value={props.source}
                onChange={(v) => patch({ source: v })}
                definition={definition}
                hint="Pick a dataset above, or bind an array of objects to cross-tabulate."
                placeholder='[{"region":"EU","amount":10}]'
                disabled={disabled}
            />
            <DimList label="Row groups" addLabel="Add row dimension" items={props.rows} onChange={(rows) => patch({ rows })} disabled={disabled} />
            <DimList label="Column groups" addLabel="Add column dimension" items={props.columns} onChange={(columns) => patch({ columns })} disabled={disabled} />
            <fieldset disabled={disabled} className="min-w-0">
                <RepeatableList
                    label="Values"
                    items={props.values || []}
                    onChange={(values) => patch({ values })}
                    makeNew={() => ({ key: '', agg: 'sum', label: '', format: 'number' })}
                    addLabel="Add value"
                    itemLabel={(v) => v.label || v.key}
                    renderItem={(v, update) => (
                        <div className="flex flex-col gap-2">
                            <input type="text" className={inputCls} value={v.key || ''} onChange={(e) => update({ ...v, key: e.target.value })} placeholder="Field key" spellCheck={false} />
                            <input type="text" className={inputCls} value={v.label || ''} onChange={(e) => update({ ...v, label: e.target.value })} placeholder="Heading (optional)" />
                            <div className="grid grid-cols-2 gap-2">
                                <select className={inputCls} value={v.agg || 'sum'} onChange={(e) => update({ ...v, agg: e.target.value })} aria-label="Aggregation">
                                    {AGGS.map((a) => <option key={a} value={a}>{a}</option>)}
                                </select>
                                <select className={inputCls} value={v.format || 'number'} onChange={(e) => update({ ...v, format: e.target.value })} aria-label="Value format">
                                    {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                />
            </fieldset>
            <Toggle label="Show totals" checked={props.showTotals !== false} onChange={(v) => patch({ showTotals: v })} disabled={disabled} size="sm" />
            <TextField label="Empty text" value={props.emptyText} onChange={(v) => patch({ emptyText: v })} disabled={disabled} />
        </div>
    );
}

registerInspector('pivot', PivotInspector);
