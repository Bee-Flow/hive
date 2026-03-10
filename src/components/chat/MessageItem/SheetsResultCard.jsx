import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { FileSpreadsheet, ExternalLink, Table2, Plus, Pencil, ChevronDown, ChevronUp, Check, Loader, X, Trash2, PlusCircle, Columns3, FunctionSquare, ArrowUpDown, MessageSquarePlus, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, ToggleLeft, ToggleRight } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { API_BASE, authFetch } from '../../../utils/helpers';

// ─── Chart Colors ──────────────────────────────────────────────
const CHART_COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D01', '#46BDC6', '#7B61FF', '#E91E63', '#00BCD4', '#8BC34A'];

// ─── Operation config ──────────────────────────────────────────
const OP_CONFIG = {
    create: { label: 'New Spreadsheet', icon: FileSpreadsheet, color: '#34A853', draftLabel: 'Review Spreadsheet' },
    read:   { label: 'Spreadsheet Data', icon: Table2, color: '#34A853' },
    append: { label: 'Rows to Add',      icon: Plus, color: '#1A73E8', draftLabel: 'Review Rows' },
    update: { label: 'Cells to Update',  icon: Pencil, color: '#EA8600', draftLabel: 'Review Updates' },
};

// ─── Simple Formula Evaluator ──────────────────────────────────
function evaluateFormula(formula, values) {
    if (!formula || typeof formula !== 'string' || !formula.startsWith('=')) return formula;

    try {
        const expr = formula.substring(1).trim();

        // Cell reference parser: A1 → [row, col]
        const cellRef = (ref) => {
            const m = ref.match(/^([A-Z]+)(\d+)$/i);
            if (!m) return null;
            const col = m[1].toUpperCase().split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
            const row = parseInt(m[2], 10) - 1;
            return values?.[row]?.[col];
        };

        const cellVal = (ref) => {
            const v = cellRef(ref);
            if (v === undefined || v === null || v === '') return 0;
            const n = parseFloat(v);
            return isNaN(n) ? 0 : n;
        };

        // Range parser: A1:A5 → array of values
        const rangeValues = (rangeStr) => {
            const [start, end] = rangeStr.split(':');
            const ms = start.match(/^([A-Z]+)(\d+)$/i);
            const me = end.match(/^([A-Z]+)(\d+)$/i);
            if (!ms || !me) return [];
            const sc = ms[1].toUpperCase().charCodeAt(0) - 65;
            const sr = parseInt(ms[2], 10) - 1;
            const ec = me[1].toUpperCase().charCodeAt(0) - 65;
            const er = parseInt(me[2], 10) - 1;
            const vals = [];
            for (let r = sr; r <= er; r++) {
                for (let c = sc; c <= ec; c++) {
                    const v = values?.[r]?.[c];
                    if (v !== undefined && v !== null && v !== '') {
                        const n = parseFloat(v);
                        if (!isNaN(n)) vals.push(n);
                    }
                }
            }
            return vals;
        };

        // SUM(range)
        const sumMatch = expr.match(/^SUM\(([^)]+)\)$/i);
        if (sumMatch) {
            const vals = rangeValues(sumMatch[1]);
            return vals.reduce((a, b) => a + b, 0);
        }

        // AVERAGE(range)
        const avgMatch = expr.match(/^AVERAGE\(([^)]+)\)$/i);
        if (avgMatch) {
            const vals = rangeValues(avgMatch[1]);
            return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        }

        // COUNT(range)
        const countMatch = expr.match(/^COUNT\(([^)]+)\)$/i);
        if (countMatch) {
            return rangeValues(countMatch[1]).length;
        }

        // MIN/MAX(range)
        const minMatch = expr.match(/^MIN\(([^)]+)\)$/i);
        if (minMatch) {
            const vals = rangeValues(minMatch[1]);
            return vals.length ? Math.min(...vals) : 0;
        }
        const maxMatch = expr.match(/^MAX\(([^)]+)\)$/i);
        if (maxMatch) {
            const vals = rangeValues(maxMatch[1]);
            return vals.length ? Math.max(...vals) : 0;
        }

        // Simple arithmetic: replace cell refs with values, then eval
        let evalExpr = expr.replace(/([A-Z]+\d+)/gi, (ref) => {
            const v = cellVal(ref);
            return v.toString();
        });

        // Only allow safe chars
        if (/^[\d+\-*/().\s]+$/.test(evalExpr)) {
            const result = Function('"use strict"; return (' + evalExpr + ')')();
            if (typeof result === 'number' && !isNaN(result)) {
                return Math.round(result * 100) / 100;
            }
        }

        return formula; // can't evaluate, show raw
    } catch {
        return formula;
    }
}

// ─── Format number nicely ──────────────────────────────────────
function formatCellValue(val) {
    if (val === null || val === undefined || val === '') return '';
    const str = String(val);
    const num = parseFloat(str);
    if (!isNaN(num) && str === num.toString()) {
        if (Number.isInteger(num)) return num.toLocaleString();
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return str;
}

// ─── Format cell based on column type ──────────────────────────
function formatTypedCellValue(val, columnType) {
    if (!columnType || val === null || val === undefined || val === '') return formatCellValue(val);
    const num = parseFloat(val);
    if (isNaN(num)) return String(val);

    switch (columnType) {
        case 'currency':
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
        case 'currency_eur':
            return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);
        case 'percent':
            // If value is already a decimal like 0.25, show as 25%
            // If value looks like a whole number > 1, show with % sign
            if (Math.abs(num) <= 1 && String(val).includes('.')) return `${(num * 100).toFixed(1)}%`;
            return `${num.toFixed(1)}%`;
        case 'integer':
            return Math.round(num).toLocaleString();
        case 'decimal':
            return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        case 'date':
            try {
                const d = new Date(val);
                if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            } catch { }
            return String(val);
        default:
            return formatCellValue(val);
    }
}

// ─── Editable Cell ─────────────────────────────────────────────
function EditableCell({ value, displayValue, onChange, isHeader, isSelected, onSelect, readOnly, columnType }) {
    const [editing, setEditing] = useState(false);
    const [localVal, setLocalVal] = useState(value);

    useEffect(() => { setLocalVal(value); }, [value]);

    const commit = () => {
        setEditing(false);
        if (localVal !== value) onChange?.(localVal);
    };

    const cellIsFormula = typeof value === 'string' && value.startsWith('=');
    const computed = displayValue !== undefined ? displayValue : value;
    const formattedDisplay = cellIsFormula
        ? formatTypedCellValue(formatCellValue(computed), columnType)
        : (isHeader ? formatCellValue(value) : formatTypedCellValue(value, columnType));

    if (editing && !readOnly) {
        return (
            <input
                autoFocus
                value={localVal}
                onChange={e => setLocalVal(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setLocalVal(value); setEditing(false); } }}
                className="w-full bg-white text-[var(--text-primary)] px-2 py-1 text-xs border-2 border-blue-400 rounded outline-none font-mono"
                style={{ minWidth: 60 }}
            />
        );
    }

    return (
        <div
            onClick={(e) => {
                if (!readOnly) { if (e.detail === 2) setEditing(true); }
                onSelect?.(e);
            }}
            onDoubleClick={() => !readOnly && setEditing(true)}
            className={`px-3 py-1.5 min-h-[28px] flex items-center gap-1 text-xs transition-colors select-none ${
                isHeader ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            } ${isSelected ? 'bg-blue-100/60 ring-2 ring-blue-400/50 ring-inset' : readOnly ? '' : 'hover:bg-blue-50/30 cursor-cell'}`}
            title={cellIsFormula ? `Formula: ${value}\nResult: ${computed}` : String(value ?? '')}
        >
            {cellIsFormula && <FunctionSquare className="w-3 h-3 flex-shrink-0 text-purple-500" />}
            <span className={cellIsFormula ? 'text-purple-600 font-mono text-[11px]' : ''}>
                {cellIsFormula ? (
                    <span className="flex items-center gap-1.5">
                        <span className="opacity-60 text-[10px]">{value}</span>
                        <span className="text-purple-800 font-semibold">= {formattedDisplay}</span>
                    </span>
                ) : (formattedDisplay || '\u00A0')}
            </span>
        </div>
    );
}

// ─── Column Auto-Sum Footer ────────────────────────────────────
function AutoSumFooter({ values }) {
    if (!values || values.length < 3) return null; // need header + at least 2 data rows

    const maxCols = Math.max(...values.map(r => r.length), 1);
    const sums = [];
    let hasNumeric = false;

    for (let c = 0; c < maxCols; c++) {
        let sum = 0;
        let count = 0;
        for (let r = 1; r < values.length; r++) {
            const v = values[r]?.[c];
            const n = parseFloat(v);
            if (!isNaN(n) && typeof v !== 'boolean' && !(typeof v === 'string' && v.startsWith('='))) {
                sum += n;
                count++;
            }
        }
        if (count >= 2) {
            sums.push(formatCellValue(Math.round(sum * 100) / 100));
            hasNumeric = true;
        } else {
            sums.push(null);
        }
    }

    if (!hasNumeric) return null;

    return (
        <tr className="bg-[var(--bg-tertiary)] border-t-2 border-[var(--border-subtle)]">
            <td className="px-1 py-1.5 text-[10px] text-[var(--text-tertiary)] font-bold">Σ</td>
            {sums.map((s, i) => (
                <td key={i} className="px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                    {s !== null ? s : ''}
                </td>
            ))}
        </tr>
    );
}

// ─── Editable Data Table ───────────────────────────────────────
function EditableDataTable({ values, onChange, readOnly = false, selection, onSelectionChange, showAutoSum = true, columnTypes }) {
    const [expanded, setExpanded] = useState(false);
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('asc');

    if (!values || values.length === 0) {
        if (readOnly) return null;
        return (
            <div className="mt-2">
                <button
                    onClick={() => onChange([[''], ['']])}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add table data
                </button>
            </div>
        );
    }

    const maxCols = Math.max(...values.map(r => r.length), 1);

    // Evaluate all formulas for display
    const evaluatedValues = useMemo(() => {
        return values.map(row => row.map(cell => {
            if (typeof cell === 'string' && cell.startsWith('=')) {
                return evaluateFormula(cell, values);
            }
            return cell;
        }));
    }, [values]);

    // Sort data rows (not header) if sort is active
    const displayValues = useMemo(() => {
        if (sortCol === null || readOnly) return values;
        const header = values[0];
        const dataRows = values.slice(1);
        const sorted = [...dataRows].sort((a, b) => {
            const av = a[sortCol] ?? '';
            const bv = b[sortCol] ?? '';
            const an = parseFloat(av);
            const bn = parseFloat(bv);
            if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an;
            return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
        return [header, ...sorted];
    }, [values, sortCol, sortDir, readOnly]);

    const visibleRows = expanded || readOnly ? displayValues : displayValues.slice(0, 15);
    const hasMore = !readOnly && displayValues.length > 15;

    const updateCell = (rowIdx, colIdx, newVal) => {
        const updated = values.map((row, ri) =>
            ri === rowIdx ? row.map((cell, ci) => ci === colIdx ? newVal : cell) : [...row]
        );
        onChange(updated);
    };

    const addRow = () => {
        onChange([...values, new Array(maxCols).fill('')]);
    };

    const removeRow = (rowIdx) => {
        if (values.length <= 1) return;
        onChange(values.filter((_, i) => i !== rowIdx));
    };

    const addColumn = () => {
        onChange(values.map(row => [...row, '']));
    };

    const removeColumn = (colIdx) => {
        if (maxCols <= 1) return;
        onChange(values.map(row => row.filter((_, i) => i !== colIdx)));
    };

    const handleSort = (colIdx) => {
        if (sortCol === colIdx) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(colIdx);
            setSortDir('asc');
        }
    };

    const isSelected = (r, c) => {
        if (!selection) return false;
        if (selection.type === 'cell') return selection.row === r && selection.col === c;
        if (selection.type === 'row') return selection.row === r;
        if (selection.type === 'col') return selection.col === c;
        if (selection.type === 'range') {
            return r >= selection.startRow && r <= selection.endRow && c >= selection.startCol && c <= selection.endCol;
        }
        return false;
    };

    const handleCellSelect = (r, c, e) => {
        if (!onSelectionChange) return;
        if (e.shiftKey && selection?.type === 'cell') {
            // Range select
            onSelectionChange({
                type: 'range',
                startRow: Math.min(selection.row, r),
                endRow: Math.max(selection.row, r),
                startCol: Math.min(selection.col, c),
                endCol: Math.max(selection.col, c),
            });
        } else {
            onSelectionChange({ type: 'cell', row: r, col: c });
        }
    };

    const handleRowSelect = (r) => {
        if (!onSelectionChange) return;
        onSelectionChange({ type: 'row', row: r });
    };

    const handleColSelect = (c) => {
        if (!onSelectionChange) return;
        onSelectionChange({ type: 'col', col: c });
    };

    return (
        <div className="mt-2 rounded-lg border border-[var(--border-subtle)] overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-xs border-collapse" style={{ minWidth: '100%' }}>
                    <thead>
                        <tr className="bg-[var(--bg-tertiary)]">
                            {!readOnly && <th className="w-6 sticky top-0 bg-[var(--bg-tertiary)] z-10" />}
                            {Array.from({ length: maxCols }).map((_, ci) => (
                                <th key={ci} className={`border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-tertiary)] z-10 relative group ${isSelected(0, ci) ? 'bg-blue-100/60' : ''}`}>
                                    <div className="flex items-center">
                                        {readOnly ? (
                                            <div
                                                className={`px-3 py-2 text-left font-semibold text-[var(--text-primary)] whitespace-nowrap flex-1 cursor-pointer ${isSelected(0, ci) ? 'bg-blue-100/60' : ''}`}
                                                onClick={() => handleColSelect(ci)}
                                            >
                                                {displayValues[0]?.[ci] ?? ''}
                                            </div>
                                        ) : (
                                            <EditableCell
                                                value={displayValues[0]?.[ci] ?? ''}
                                                onChange={v => updateCell(0, ci, v)}
                                                isHeader
                                                isSelected={isSelected(0, ci)}
                                                onSelect={(e) => handleColSelect(ci)}
                                            />
                                        )}
                                        <button
                                            onClick={() => handleSort(ci)}
                                            className={`p-0.5 rounded transition-colors ${sortCol === ci ? 'text-blue-500' : 'opacity-0 group-hover:opacity-60 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                                            title={`Sort by ${displayValues[0]?.[ci] || 'column'}`}
                                        >
                                            <ArrowUpDown className="w-3 h-3" />
                                        </button>
                                        {!readOnly && maxCols > 1 && (
                                            <button
                                                onClick={() => removeColumn(ci)}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600 transition-all"
                                                title="Remove column"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </th>
                            ))}
                            {!readOnly && (
                                <th className="w-8 border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-tertiary)] z-10">
                                    <button
                                        onClick={addColumn}
                                        className="p-1 text-green-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                        title="Add column"
                                    >
                                        <Columns3 className="w-3.5 h-3.5" />
                                    </button>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleRows.slice(1).map((row, ri) => {
                            const actualIdx = ri + 1;
                            const rowSelected = selection?.type === 'row' && selection.row === actualIdx;
                            return (
                                <tr key={ri} className={`${rowSelected ? 'bg-blue-50/60' : ri % 2 === 0 ? 'bg-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)]'} hover:bg-blue-50/20 transition-colors`}>
                                    {!readOnly && (
                                        <td className="border-b border-[var(--border-subtle)]/50 text-center">
                                            <button
                                                onClick={() => handleRowSelect(actualIdx)}
                                                className={`w-5 h-5 text-[9px] rounded flex items-center justify-center transition-colors ${rowSelected ? 'bg-blue-500 text-white' : 'text-[var(--text-tertiary)] hover:bg-blue-100 hover:text-blue-600'}`}
                                                title={`Select row ${actualIdx}`}
                                            >
                                                {actualIdx}
                                            </button>
                                        </td>
                                    )}
                                    {Array.from({ length: maxCols }).map((_, ci) => (
                                        <td key={ci} className={`border-b border-[var(--border-subtle)]/50 whitespace-nowrap ${isSelected(actualIdx, ci) ? 'bg-blue-100/60' : ''}`}>
                                            <EditableCell
                                                value={row[ci] ?? ''}
                                                displayValue={evaluatedValues[actualIdx]?.[ci]}
                                                onChange={v => updateCell(actualIdx, ci, v)}
                                                isSelected={isSelected(actualIdx, ci)}
                                                onSelect={(e) => handleCellSelect(actualIdx, ci, e)}
                                                readOnly={readOnly}
                                                columnType={columnTypes?.[ci]}
                                            />
                                        </td>
                                    ))}
                                    {!readOnly && <td className="border-b border-[var(--border-subtle)]/50" />}
                                </tr>
                            );
                        })}
                        {showAutoSum && <AutoSumFooter values={evaluatedValues} />}
                    </tbody>
                </table>
            </div>

            {!readOnly && (
                <div className="flex items-center border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                    <button
                        onClick={addRow}
                        className="flex items-center gap-1.5 py-1.5 px-3 text-[10px] font-medium text-green-600 hover:text-green-700 transition-colors hover:bg-green-50/30"
                    >
                        <PlusCircle className="w-3 h-3" /> Add row
                    </button>
                    {values.length > 1 && selection?.type === 'row' && (
                        <button
                            onClick={() => removeRow(selection.row)}
                            className="flex items-center gap-1 py-1.5 px-2 text-[10px] font-medium text-red-500 hover:text-red-600 transition-colors hover:bg-red-50/30 ml-auto"
                        >
                            <Trash2 className="w-3 h-3" /> Delete row {selection.row}
                        </button>
                    )}
                </div>
            )}

            {readOnly && hasMore && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] transition-colors"
                >
                    {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all {values.length} rows</>}
                </button>
            )}
        </div>
    );
}

// ─── Selection Info Bar ────────────────────────────────────────
function SelectionBar({ selection, values, onAskAI }) {
    if (!selection) return null;

    const getSelectionLabel = () => {
        if (selection.type === 'cell') {
            const colLetter = String.fromCharCode(65 + selection.col);
            return `Cell ${colLetter}${selection.row + 1}`;
        }
        if (selection.type === 'row') return `Row ${selection.row}`;
        if (selection.type === 'col') {
            const header = values?.[0]?.[selection.col] || String.fromCharCode(65 + selection.col);
            return `Column "${header}"`;
        }
        if (selection.type === 'range') {
            const sc = String.fromCharCode(65 + selection.startCol);
            const ec = String.fromCharCode(65 + selection.endCol);
            return `Range ${sc}${selection.startRow + 1}:${ec}${selection.endRow + 1}`;
        }
        return '';
    };

    const getSelectedData = () => {
        if (!values) return '';
        if (selection.type === 'cell') return values[selection.row]?.[selection.col] || '';
        if (selection.type === 'row') return (values[selection.row] || []).join(', ');
        if (selection.type === 'col') return values.map(r => r[selection.col] || '').join(', ');
        return '';
    };

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/50 border border-blue-200/30 rounded-lg text-[11px]">
            <span className="text-blue-600 font-semibold">{getSelectionLabel()}</span>
            <span className="text-[var(--text-tertiary)]">selected</span>
            <div className="ml-auto flex items-center gap-1">
                <button
                    onClick={() => onAskAI?.(`Modify the selected ${selection.type} (${getSelectionLabel()}): `)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-blue-600 hover:bg-blue-100 transition-colors font-medium"
                >
                    <MessageSquarePlus className="w-3 h-3" />
                    Ask AI about selection
                </button>
            </div>
        </div>
    );
}

// ─── Data Chart Component ──────────────────────────────────────
const CHART_TYPES = [
    { key: 'bar', label: 'Bar', icon: BarChart3 },
    { key: 'line', label: 'Line', icon: LineChartIcon },
    { key: 'pie', label: 'Pie', icon: PieChartIcon },
];

function DataChart({ values, evaluatedValues, chartConfig }) {
    // Use AI-provided config or fall back to auto-detect
    const aiType = chartConfig?.type || 'bar';
    const [chartType, setChartType] = useState(aiType);
    const data = evaluatedValues || values;
    if (!data || data.length < 2) return null;

    const headers = data[0] || [];
    const rows = data.slice(1);

    let labelCol, numericCols;

    if (chartConfig && typeof chartConfig.labelColumn === 'number' && chartConfig.dataColumns?.length > 0) {
        // AI-provided config
        labelCol = chartConfig.labelColumn;
        numericCols = chartConfig.dataColumns;
    } else {
        // Auto-detect: first non-numeric column → labels, all numeric columns → data
        numericCols = [];
        labelCol = headers.findIndex((_, ci) => {
            const vals = rows.map(r => r[ci]);
            const numCount = vals.filter(v => !isNaN(parseFloat(v)) && v !== '' && v !== null).length;
            return numCount < rows.length * 0.5;
        });

        for (let ci = 0; ci < headers.length; ci++) {
            if (ci === (labelCol >= 0 ? labelCol : -1)) continue;
            const vals = rows.map(r => r[ci]);
            const numCount = vals.filter(v => !isNaN(parseFloat(v)) && v !== '' && v !== null).length;
            if (numCount >= rows.length * 0.5) {
                numericCols.push(ci);
            }
        }
    }

    if (numericCols.length === 0) return null;

    // Build chart data
    const chartData = rows.map((row, ri) => {
        const entry = { name: labelCol >= 0 ? String(row[labelCol] ?? `Row ${ri + 1}`) : `Row ${ri + 1}` };
        numericCols.forEach(ci => {
            const val = parseFloat(row[ci]);
            entry[headers[ci] || `Col${ci}`] = isNaN(val) ? 0 : Math.round(val * 100) / 100;
        });
        return entry;
    });

    // For pie chart: use first numeric column
    const pieData = chartData.map((d, i) => ({
        name: d.name,
        value: d[headers[numericCols[0]] || `Col${numericCols[0]}`] || 0,
    }));

    const customTooltipStyle = {
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        fontSize: '11px',
        padding: '6px 10px',
    };

    return (
        <div className="mt-2 rounded-lg border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-primary)]">
            {/* Header with chart title and type selector */}
            <div className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)]">
                {chartConfig?.title && (
                    <span className="text-[11px] font-semibold text-[var(--text-primary)] mr-2">{chartConfig.title}</span>
                )}
                {CHART_TYPES.map(ct => {
                    const Icon = ct.icon;
                    return (
                        <button
                            key={ct.key}
                            onClick={() => setChartType(ct.key)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                                chartType === ct.key
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                            }`}
                        >
                            <Icon className="w-3 h-3" />
                            {ct.label}
                        </button>
                    );
                })}
                <span className="ml-auto text-[9px] text-[var(--text-tertiary)]">
                    {numericCols.length} data series · {rows.length} points
                </span>
            </div>

            {/* Chart */}
            <div className="p-3" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                            <Tooltip contentStyle={customTooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            {numericCols.map((ci, idx) => (
                                <Bar key={ci} dataKey={headers[ci] || `Col${ci}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
                            ))}
                        </BarChart>
                    ) : chartType === 'line' ? (
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                            <Tooltip contentStyle={customTooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            {numericCols.map((ci, idx) => (
                                <Line key={ci} type="monotone" dataKey={headers[ci] || `Col${ci}`} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                            ))}
                        </LineChart>
                    ) : (
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                innerRadius={45}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={{ stroke: 'var(--text-tertiary)' }}
                                fontSize={10}
                            >
                                {pieData.map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={customTooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// Utility: check if values have chartable (numeric) data
function hasNumericData(values) {
    if (!values || values.length < 2) return false;
    const rows = values.slice(1);
    for (let ci = 0; ci < (values[0]?.length || 0); ci++) {
        const numCount = rows.filter(r => !isNaN(parseFloat(r[ci])) && r[ci] !== '' && r[ci] !== null).length;
        if (numCount >= rows.length * 0.5) return true;
    }
    return false;
}

// ─── Read-Only Result Card (for sheets_get_values) ─────────────
export function SheetsResultCard({ msg }) {
    if (!msg.sheetsResults || msg.sheetsResults.length === 0) return null;

    return msg.sheetsResults.map((result, i) => (
        <SheetsResultItem key={i} result={result} />
    ));
}

function SheetsResultItem({ result }) {
    const config = OP_CONFIG[result.operation] || OP_CONFIG.read;
    const Icon = config.icon;
    const [showChart, setShowChart] = useState(false);
    const chartable = hasNumericData(result.values);

    return (
        <div className="my-3 rounded-xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-primary)]"
             style={{ borderColor: `${config.color}30` }}>
            <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
                 style={{ color: config.color, backgroundColor: `${config.color}08` }}>
                <Icon className="w-3.5 h-3.5" />
                <span>{config.label}</span>
                {chartable && (
                    <button
                        onClick={() => setShowChart(s => !s)}
                        className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            showChart ? 'bg-blue-100 text-blue-700' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        <BarChart3 className="w-3 h-3" />
                        {showChart ? 'Hide Chart' : 'Chart'}
                    </button>
                )}
            </div>
            <div className="px-4 pb-3">
                {result.range && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-1">
                        <Table2 className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                        <span>Range: <code className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-[11px]">{result.range}</code></span>
                    </div>
                )}
                {result.values && result.values.length > 0 && (
                    <EditableDataTable values={result.values} readOnly columnTypes={result.columnTypes} />
                )}
                {showChart && result.values && (
                    <DataChart values={result.values} chartConfig={result.chartConfig} />
                )}
                {result.truncated && (
                    <div className="text-[10px] text-[var(--text-tertiary)] italic mt-1">
                        Showing {Math.min(50, result.totalRows)} of {result.totalRows} rows
                    </div>
                )}
            </div>
            {result.url && (
                <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                    <a href={result.url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors hover:opacity-90"
                       style={{ backgroundColor: config.color }}>
                        <ExternalLink className="w-3 h-3" />
                        Open in Google Sheets
                    </a>
                </div>
            )}
        </div>
    );
}

// ─── Draft Card (editable, with Confirm/Discard) ───────────────
export function SheetsDraftCard({ msg, sheetsDraftStatuses, setSheetsDraftStatuses }) {
    if (!msg.sheetsDrafts || msg.sheetsDrafts.length === 0) return null;

    return msg.sheetsDrafts.map((draft, i) => (
        <SheetsDraftItem
            key={i}
            draft={draft}
            index={i}
            msgId={msg.id}
            status={sheetsDraftStatuses?.[`${msg.id}_${i}`]}
            setStatus={(status) => setSheetsDraftStatuses(prev => ({ ...prev, [`${msg.id}_${i}`]: status }))}
        />
    ));
}

function SheetsDraftItem({ draft, index, msgId, status, setStatus }) {
    const config = OP_CONFIG[draft.operation] || OP_CONFIG.create;
    const Icon = config.icon;
    const effectiveStatus = status || draft.status || 'pending';

    // Local editable state
    const [editedTitle, setEditedTitle] = useState(draft.title || '');
    const [editedSheetNames, setEditedSheetNames] = useState(draft.sheetNames || ['Sheet1']);
    const [editedData, setEditedData] = useState(draft.initialData || draft.values || []);
    const [newSheetName, setNewSheetName] = useState('');
    const [selection, setSelection] = useState(null);
    const [showChart, setShowChart] = useState(false);
    const chartable = hasNumericData(editedData);

    const handleConfirm = async () => {
        setStatus('executing');
        try {
            const body = { ...draft };
            if (draft.operation === 'create') {
                body.title = editedTitle;
                body.sheetNames = editedSheetNames;
                body.initialData = editedData;
            } else {
                body.values = editedData;
            }

            const res = await authFetch(`${API_BASE}/api/integrations/sheets/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                const result = await res.json();
                setStatus({ state: 'done', result, finalData: editedData });
            } else {
                const err = await res.json();
                setStatus({ state: 'failed', error: err.error });
            }
        } catch (err) {
            setStatus({ state: 'failed', error: err.message });
        }
    };

    const handleDiscard = () => {
        setStatus('discarded');
    };

    const addSheet = () => {
        const name = newSheetName.trim() || `Sheet${editedSheetNames.length + 1}`;
        setEditedSheetNames([...editedSheetNames, name]);
        setNewSheetName('');
    };

    const removeSheet = (idx) => {
        if (editedSheetNames.length <= 1) return;
        setEditedSheetNames(editedSheetNames.filter((_, i) => i !== idx));
    };

    const isDone = effectiveStatus === 'done' || effectiveStatus?.state === 'done';
    const isFailed = effectiveStatus?.state === 'failed';
    const isExecuting = effectiveStatus === 'executing';
    const isDiscarded = effectiveStatus === 'discarded';
    const isPending = effectiveStatus === 'pending';

    // Data to show after confirmation (with formulas evaluated by Google Sheets)
    const finalData = effectiveStatus?.finalData;

    return (
        <div className="my-3 rounded-xl border overflow-hidden bg-[var(--bg-primary)]"
             style={{ borderColor: isDone ? '#34A85330' : isDiscarded ? '#9ca3af30' : `${config.color}40` }}>
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
                 style={{
                     color: isDiscarded ? '#9ca3af' : config.color,
                     backgroundColor: isDiscarded ? '#9ca3af08' : `${config.color}08`
                 }}>
                <Icon className="w-3.5 h-3.5" />
                <span>{isDone ? (draft.operation === 'create' ? 'Spreadsheet Created' : 'Changes Applied') : isDiscarded ? 'Discarded' : config.draftLabel}</span>
                {isPending && chartable && (
                    <button
                        onClick={() => setShowChart(s => !s)}
                        className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            showChart ? 'bg-blue-100 text-blue-700' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        <BarChart3 className="w-3 h-3" />
                        {showChart ? 'Hide Chart' : 'Chart'}
                    </button>
                )}
                {isExecuting && <Loader className="w-3 h-3 animate-spin ml-auto" />}
                {isDone && <Check className="w-3.5 h-3.5 ml-auto text-green-500" />}
            </div>

            <div className={`px-4 pb-3 space-y-2 ${isDiscarded ? 'opacity-50' : ''}`}>
                {/* Title (create) */}
                {draft.operation === 'create' && (
                    <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
                        {isPending ? (
                            <input
                                value={editedTitle}
                                onChange={e => setEditedTitle(e.target.value)}
                                className="text-[var(--text-primary)] font-semibold text-sm bg-transparent border-b border-dashed border-[var(--border-subtle)] focus:border-blue-400 outline-none px-1 py-0.5 flex-1"
                                placeholder="Spreadsheet title..."
                            />
                        ) : (
                            <span className="text-[var(--text-primary)] font-semibold text-sm">{editedTitle}</span>
                        )}
                    </div>
                )}

                {/* Sheet tabs (create) */}
                {draft.operation === 'create' && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {editedSheetNames.map((name, j) => (
                            <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                                {name}
                                {isPending && editedSheetNames.length > 1 && (
                                    <button onClick={() => removeSheet(j)} className="text-red-400 hover:text-red-600 ml-0.5">
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                )}
                            </span>
                        ))}
                        {isPending && (
                            <div className="inline-flex items-center gap-1">
                                <input
                                    value={newSheetName}
                                    onChange={e => setNewSheetName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addSheet(); }}
                                    placeholder="+ Sheet"
                                    className="px-2 py-0.5 rounded text-[11px] bg-transparent border border-dashed border-[var(--border-subtle)] text-[var(--text-secondary)] outline-none w-20 focus:border-blue-400"
                                />
                                <button onClick={addSheet} className="text-green-500 hover:text-green-600">
                                    <PlusCircle className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Range info (append/update) */}
                {(draft.operation === 'append' || draft.operation === 'update') && draft.range && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Table2 className="w-3.5 h-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
                        <span>Range: <code className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-[11px]">{draft.range}</code></span>
                    </div>
                )}

                {/* Formula legend */}
                {isPending && editedData.some(row => row.some(cell => typeof cell === 'string' && cell.startsWith('='))) && (
                    <div className="flex items-center gap-1.5 text-[10px] text-purple-500">
                        <FunctionSquare className="w-3 h-3" />
                        <span>Purple cells show formulas with computed preview. Double-click to edit. Shift+click to select range.</span>
                    </div>
                )}

                {/* Selection info bar */}
                {isPending && selection && (
                    <SelectionBar selection={selection} values={editedData} />
                )}

                {/* Editable data table */}
                <EditableDataTable
                    values={editedData}
                    onChange={isPending ? setEditedData : undefined}
                    readOnly={!isPending}
                    selection={isPending ? selection : null}
                    onSelectionChange={isPending ? setSelection : undefined}
                    showAutoSum
                    columnTypes={draft.columnTypes}
                />

                {/* Optional chart visualization */}
                {showChart && (
                    <DataChart values={editedData} chartConfig={draft.chartConfig} />
                )}

                {/* Success result */}
                {isDone && effectiveStatus?.result && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 text-xs text-green-600 p-2 bg-green-50/50 rounded-lg border border-green-200/30">
                            <Check className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>
                                {effectiveStatus.result.url ? (
                                    <a href={effectiveStatus.result.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                                        {effectiveStatus.result.title || 'Spreadsheet'}
                                    </a>
                                ) : 'Done'}
                                {effectiveStatus.result.rowsWritten > 0 && ` — ${effectiveStatus.result.rowsWritten} rows written`}
                                {effectiveStatus.result.updatedRows && ` — ${effectiveStatus.result.updatedRows} rows updated`}
                                {effectiveStatus.result.updatedCells && ` (${effectiveStatus.result.updatedCells} cells)`}
                            </span>
                        </div>

                        {/* Show final data with computed formula values */}
                        {finalData && finalData.length > 0 && finalData.some(r => r.some(c => typeof c === 'string' && c.startsWith('='))) && (
                            <div className="text-[10px] text-[var(--text-tertiary)] italic">
                                Formula values shown above are locally computed previews. Open in Google Sheets for final values.
                            </div>
                        )}
                    </div>
                )}

                {/* Error result */}
                {isFailed && (
                    <div className="flex items-center gap-2 text-xs text-red-500 mt-1 p-2 bg-red-50/50 rounded-lg border border-red-200/30">
                        <X className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{effectiveStatus.error || 'Failed'}</span>
                    </div>
                )}
            </div>

            {/* Footer buttons */}
            {isPending && (
                <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center gap-2">
                    <button
                        onClick={handleConfirm}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 hover:shadow-md"
                        style={{ backgroundColor: config.color }}
                    >
                        <Check className="w-3 h-3" />
                        {draft.operation === 'create' ? 'Create Spreadsheet' : draft.operation === 'append' ? 'Append Rows' : 'Apply Changes'}
                    </button>
                    <button
                        onClick={handleDiscard}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-red-500 border border-[var(--border-subtle)] hover:border-red-300 transition-all"
                    >
                        <X className="w-3 h-3" />
                        Discard
                    </button>
                    <span className="text-[10px] text-[var(--text-tertiary)] ml-auto italic">
                        Double-click to edit • Shift+click range • Click row # to select row
                    </span>
                </div>
            )}

            {/* Open in Sheets (done state) */}
            {isDone && effectiveStatus?.result?.url && (
                <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                    <a href={effectiveStatus.result.url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors hover:opacity-90"
                       style={{ backgroundColor: '#34A853' }}>
                        <ExternalLink className="w-3 h-3" />
                        Open in Google Sheets
                    </a>
                </div>
            )}
        </div>
    );
}

export default SheetsResultCard;
