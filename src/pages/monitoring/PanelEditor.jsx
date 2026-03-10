import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { VIZ_TYPES, VIZ_COMPONENTS } from './ChartComponents';
import {
    Plus, X, Play, Save, Loader2,
    AlertCircle, Database
} from 'lucide-react';



// ── Visual Query Builder ──────────────────────────────

const OPERATORS = [
    { value: '=', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: '>', label: 'greater than' },
    { value: '<', label: 'less than' },
    { value: '>=', label: '>= ' },
    { value: '<=', label: '<=' },
    { value: 'like', label: 'contains' },
    { value: 'is_null', label: 'is empty' },
    { value: 'not_null', label: 'is not empty' },
];

const AGGREGATIONS = [
    { value: 'none', label: 'No aggregation' },
    { value: 'count', label: 'Count' },
    { value: 'sum', label: 'Sum' },
    { value: 'avg', label: 'Average' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
];

const SelectField = ({ label, value, onChange, options, placeholder }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
        {label && <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</label>}
        <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    </div>
);

const QueryBuilder = ({ queryConfig, onChange, tables }) => {
    const qc = queryConfig || {};
    const selectedTable = tables.find(t => t.name === qc.table);
    const columns = selectedTable?.columns || [];
    const update = (field, val) => onChange({ ...qc, [field]: val });

    const addFilter = () => update('filters', [...(qc.filters || []), { column: '', operator: '=', value: '' }]);
    const updateFilter = (i, f) => { const fs = [...(qc.filters || [])]; fs[i] = { ...fs[i], ...f }; update('filters', fs); };
    const removeFilter = (i) => update('filters', (qc.filters || []).filter((_, j) => j !== i));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Table selection — auto-detects data source */}
            <div style={{ display: 'flex', gap: 10 }}>
                <SelectField label="Table" value={qc.table || ''} onChange={v => {
                    const t = tables.find(tb => tb.name === v);
                    update('table', v);
                    if (t) update('dataSource', t.source);
                }} options={tables.map(t => ({ value: t.name, label: t.displayName }))} placeholder="Choose table" style={{ flex: 1 }} />
            </div>

            {selectedTable && <>
                {/* Columns */}
                <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 6 }}>Columns</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {columns.map(col => {
                            const selected = (qc.columns || []).includes(col.name);
                            return (
                                <button key={col.name} onClick={() => {
                                    const cols = qc.columns || [];
                                    update('columns', selected ? cols.filter(c => c !== col.name) : [...cols, col.name]);
                                }} style={{
                                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                    border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                    background: selected ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                                    color: selected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                }}>{col.label}</button>
                            );
                        })}
                        {(qc.columns || []).length > 0 && (
                            <button onClick={() => update('columns', [])} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Clear all</button>
                        )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{(qc.columns || []).length === 0 ? 'All columns selected' : `${(qc.columns || []).length} selected`}</div>
                </div>

                {/* Aggregation + Group By */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <SelectField label="Aggregation" value={qc.aggregation || 'none'} onChange={v => update('aggregation', v)} options={AGGREGATIONS} />
                    {qc.aggregation && qc.aggregation !== 'none' && qc.aggregation !== 'count' && (
                        <SelectField label="Aggregate Column" value={qc.aggregationColumn || ''} onChange={v => update('aggregationColumn', v)}
                            options={columns.filter(c => c.type === 'number').map(c => ({ value: c.name, label: c.label }))} placeholder="Pick column" />
                    )}
                    <SelectField label="Group By" value={qc.groupBy || ''} onChange={v => update('groupBy', v)}
                        options={[{ value: '', label: 'None' }, ...columns.map(c => ({ value: c.name, label: c.label }))]} />
                </div>

                {/* Filters */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)' }}>Filters</label>
                        <button onClick={addFilter} style={{ fontSize: 11, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Plus style={{ width: 12, height: 12 }} />Add filter
                        </button>
                    </div>
                    {(qc.filters || []).map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                            <select value={f.column} onChange={e => updateFilter(i, { column: e.target.value })} style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12 }}>
                                <option value="">Column</option>
                                {columns.map(c => <option key={c.name} value={c.name}>{c.label}</option>)}
                            </select>
                            <select value={f.operator} onChange={e => updateFilter(i, { operator: e.target.value })} style={{ width: 110, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12 }}>
                                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {!['is_null', 'not_null'].includes(f.operator) && (
                                <input value={f.value || ''} onChange={e => updateFilter(i, { value: e.target.value })} placeholder="Value"
                                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
                            )}
                            <button onClick={() => removeFilter(i)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: 14, height: 14, color: '#f43f5e' }} /></button>
                        </div>
                    ))}
                </div>

                {/* Sort + Limit */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <SelectField label="Sort By" value={qc.sortBy || ''} onChange={v => update('sortBy', v)}
                        options={[{ value: '', label: 'Default' }, ...columns.map(c => ({ value: c.name, label: c.label }))]} />
                    <SelectField label="Direction" value={qc.sortDir || 'DESC'} onChange={v => update('sortDir', v)}
                        options={[{ value: 'DESC', label: '↓ Descending' }, { value: 'ASC', label: '↑ Ascending' }]} />
                    <div style={{ width: 100 }}>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>Limit</label>
                        <input type="number" value={qc.limit || 100} onChange={e => update('limit', parseInt(e.target.value) || 100)} min={1} max={10000}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                    </div>
                </div>
            </>}
        </div>
    );
};

// ── Panel Editor Modal ──────────────────────────────────

const PanelEditor = ({ panel, tables, onSave, onClose }) => {
    const [title, setTitle] = useState(panel?.title || 'New Panel');
    const [vizType, setVizType] = useState(panel?.visualization_type || 'stat');
    const [queryConfig, setQueryConfig] = useState(panel?.query_config || {});
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [vizCat, setVizCat] = useState('');

    const runPreview = useCallback(async () => {
        if (!queryConfig.table) return;
        setPreviewLoading(true); setPreviewError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/monitoring/query/build`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(queryConfig),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Query failed');
            setPreview(data);
        } catch (err) { setPreviewError(err.message); }
        finally { setPreviewLoading(false); }
    }, [queryConfig]);

    // Auto-preview when table or aggregation changes
    useEffect(() => {
        if (queryConfig.table) {
            const timer = setTimeout(runPreview, 400);
            return () => clearTimeout(timer);
        }
    }, [queryConfig.table, queryConfig.aggregation, queryConfig.groupBy, queryConfig.columns?.length]);

    const handleSave = async () => {
        setSaving(true);
        await onSave({ title, visualizationType: vizType, queryConfig, dataSource: queryConfig.dataSource || 'app' });
        setSaving(false);
    };

    const VizPreview = VIZ_COMPONENTS[vizType] || VIZ_COMPONENTS.stat;
    const vizCategories = [...new Set(VIZ_TYPES.map(v => v.category))];

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
            <div style={{ borderRadius: 16, border: '1px solid var(--border-default)', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', width: '100%', maxWidth: 800, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{panel?.id ? 'Edit Panel' : 'Add Panel'}</h2>
                    <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}><X style={{ width: 20, height: 20, color: 'var(--text-muted)' }} /></button>
                </div>
                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Title */}
                    <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>Title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                    </div>

                    {/* Query Builder */}
                    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Database style={{ width: 14, height: 14, color: 'var(--accent-primary)' }} />
                            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)' }}>Data Query</span>
                            <div style={{ flex: 1 }} />
                            <button onClick={runPreview} disabled={!queryConfig.table || previewLoading}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, color: '#fff', background: queryConfig.table ? 'var(--accent-primary)' : '#999', cursor: queryConfig.table ? 'pointer' : 'default', opacity: previewLoading ? 0.6 : 1 }}>
                                <Play style={{ width: 12, height: 12 }} />Preview
                            </button>
                        </div>
                        <QueryBuilder queryConfig={queryConfig} onChange={setQueryConfig} tables={tables} />
                    </div>

                    {/* Visualization Picker */}
                    <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 8 }}>Visualization</label>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            <button onClick={() => setVizCat('')} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${!vizCat ? 'var(--accent-primary)' : 'var(--border-default)'}`, background: !vizCat ? 'rgba(99,102,241,0.1)' : 'transparent', color: !vizCat ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>All</button>
                            {vizCategories.map(cat => (
                                <button key={cat} onClick={() => setVizCat(cat)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${vizCat === cat ? 'var(--accent-primary)' : 'var(--border-default)'}`, background: vizCat === cat ? 'rgba(99,102,241,0.1)' : 'transparent', color: vizCat === cat ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{cat}</button>
                            ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
                            {VIZ_TYPES.filter(v => !vizCat || v.category === vizCat).map(vt => {
                                const isActive = vizType === vt.id;
                                return (
                                    <button key={vt.id} onClick={() => setVizType(vt.id)}
                                        style={{ padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${isActive ? vt.color : 'var(--border-default)'}`, background: isActive ? `${vt.color}12` : 'var(--bg-primary)', color: isActive ? vt.color : 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'center', lineHeight: 1.3, transition: 'all 0.15s' }}>
                                        <div style={{ fontSize: 18, marginBottom: 2, color: isActive ? vt.color : vt.color + '99' }}>{vt.icon}</div>{vt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Preview — always visible */}
                    <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>Preview</label>
                        <div style={{ borderRadius: 12, border: '1px solid var(--border-default)', height: 220, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                            {previewLoading ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} /></div>
                                : previewError ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: '#f43f5e', fontSize: 13, padding: 16 }}><AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />{previewError}</div>
                                    : preview ? <VizPreview data={preview} />
                                        : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 6, color: 'var(--text-muted)' }}>
                                            <Play style={{ width: 24, height: 24, opacity: 0.3 }} />
                                            <span style={{ fontSize: 12 }}>Select a table to see a preview</span>
                                        </div>}
                        </div>
                    </div>
                </div>
                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '14px 24px', borderTop: '1px solid var(--border-subtle)' }}>
                    <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving || !title.trim()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--accent-primary)', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                        <Save style={{ width: 14, height: 14 }} />{saving ? 'Saving...' : 'Save Panel'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PanelEditor;
