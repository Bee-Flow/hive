/**
 * ChartConfigModal — pick a chart type + which column holds the labels and which
 * column(s) hold the series, then snapshot the table into a `chart` block. Kept
 * self-contained (tokens + lucide only) so the editor stays free of app coupling.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, AreaChart as AreaIcon, X } from 'lucide-react';

const TYPES = [
  { key: 'bar', icon: BarChart3, label: 'Bar' },
  { key: 'line', icon: LineIcon, label: 'Line' },
  { key: 'area', icon: AreaIcon, label: 'Area' },
  { key: 'pie', icon: PieIcon, label: 'Pie' },
];

export default function ChartConfigModal({ columns, rows, t, onCreate, onClose }) {
  const tt = (k, fb) => { const v = t ? t(k) : null; return v && v !== k ? v : fb; };
  const [type, setType] = useState('bar');
  const [labelCol, setLabelCol] = useState(0);
  const [seriesCols, setSeriesCols] = useState(() => columns.map((_, i) => i).filter((i) => i !== 0).slice(0, type === 'pie' ? 1 : undefined));
  const [title, setTitle] = useState('');

  const toggleSeries = (i) => {
    if (type === 'pie') { setSeriesCols([i]); return; }
    setSeriesCols((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]).sort((a, b) => a - b));
  };

  const create = () => {
    const labels = rows.map((r) => r[labelCol] ?? '');
    const cols = type === 'pie' ? seriesCols.slice(0, 1) : seriesCols;
    const series = cols.map((ci) => ({ name: columns[ci] || `Column ${ci + 1}`, data: rows.map((r) => Number(r[ci]) || 0) }));
    onCreate({ type, title: title.trim() || null, labels, series });
  };

  const valid = seriesCols.length > 0 && rows.length > 0 && labelCol != null;

  return createPortal(
    <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onMouseDown={onClose}>
      <div className="w-full max-w-[420px] rounded-2xl border shadow-2xl" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tt('notebooks.create_chart', 'Create chart')}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {TYPES.map(({ key, icon: Icon, label }) => (
              <button key={key}
                onClick={() => { setType(key); if (key === 'pie') setSeriesCols((p) => p.slice(0, 1)); }}
                className="flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] transition-colors"
                style={type === key ? { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'var(--accent-primary)10' } : { borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{tt('notebooks.chart_title', 'Title (optional)')}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-[12px] outline-none"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{tt('notebooks.chart_labels', 'Labels (X axis)')}</span>
            <select value={labelCol} onChange={(e) => setLabelCol(+e.target.value)} className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-[12px] outline-none"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
              {columns.map((c, i) => <option key={i} value={i}>{c || `Column ${i + 1}`}</option>)}
            </select>
          </label>

          <div>
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              {type === 'pie' ? tt('notebooks.chart_value', 'Values') : tt('notebooks.chart_series', 'Series (Y axis)')}
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {columns.map((c, i) => (i === labelCol ? null : (
                <button key={i} onClick={() => toggleSeries(i)}
                  className="px-2.5 py-1 rounded-full border text-[11px] transition-colors"
                  style={seriesCols.includes(i) ? { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'var(--accent-primary)10' } : { borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  {c || `Column ${i + 1}`}
                </button>
              )))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] font-medium hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>{tt('notebooks.cancel', 'Cancel')}</button>
          <button onClick={create} disabled={!valid} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-40" style={{ background: 'var(--accent-primary)' }}>{tt('notebooks.create', 'Create')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
