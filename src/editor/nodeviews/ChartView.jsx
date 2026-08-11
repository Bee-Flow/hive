/**
 * ChartView — renders a `chart` atom node with recharts (already a dependency).
 * The chart is a snapshot built from a table; its spec is JSON
 * { type, title, labels, series:[{name,data}] } stored on the node and round-tripped
 * via a ```chart fenced block. Themed via tokens — no purple per the design rule.
 */
import React, { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Trash2 } from 'lucide-react';

// Categorical palette — blues/greens/warm/teal/pink, no violet/indigo.
const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#14b8a6', '#ef4444', '#06b6d4', '#ec4899'];

export default function ChartView({ node, view, editable }) {
  const spec = useMemo(() => { try { return JSON.parse(node.attrs?.spec || '{}'); } catch (e) { return {}; } }, [node.attrs?.spec]);
  const type = spec.type || 'bar';
  const labels = Array.isArray(spec.labels) ? spec.labels : [];
  // The spec is unvalidated content: it can arrive from an ingested document or
  // an AI write, so entries may be null/strings/anything. Drop what we can't
  // plot rather than throwing mid-render. Names are de-duplicated because
  // recharts keys series by dataKey — two columns sharing a header used to
  // collapse into one series plus duplicate React keys.
  const series = useMemo(() => {
    const raw = Array.isArray(spec.series) ? spec.series : [];
    const seen = new Set();
    return raw.filter((s) => s && typeof s === 'object').map((s, i) => {
      let name = String(s.name || `Series ${i + 1}`);
      while (seen.has(name)) name = `${name} (${i + 1})`;
      seen.add(name);
      return { name, data: Array.isArray(s.data) ? s.data : [] };
    });
  }, [spec.series]);

  const data = useMemo(() => labels.map((lab, i) => {
    const row = { name: String(lab) };
    series.forEach((s) => { row[s.name] = Number(s.data[i]) || 0; });
    return row;
  }), [labels, series]);

  const pieData = useMemo(() => labels.map((lab, i) => ({ name: String(lab), value: Number((series[0]?.data || [])[i]) || 0 })), [labels, series]);

  const axis = { fontSize: 11, stroke: 'var(--text-tertiary)' };
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />;
  const tooltip = <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} />;

  let chart = null;
  if (!series.length || !labels.length) {
    chart = <div className="flex items-center justify-center h-full text-[12px]" style={{ color: 'var(--text-muted)' }}>No chart data</div>;
  } else if (type === 'line') {
    chart = (
      <LineChart data={data}><XAxis dataKey="name" {...axis} /><YAxis {...axis} />{grid}{tooltip}<Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s, i) => <Line key={s.name} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />)}
      </LineChart>
    );
  } else if (type === 'area') {
    chart = (
      <AreaChart data={data}><XAxis dataKey="name" {...axis} /><YAxis {...axis} />{grid}{tooltip}<Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s, i) => <Area key={s.name} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} strokeWidth={2} />)}
      </AreaChart>
    );
  } else if (type === 'pie') {
    chart = (
      <PieChart>{tooltip}<Legend wrapperStyle={{ fontSize: 11 }} />
        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 11 }}>
          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
      </PieChart>
    );
  } else {
    chart = (
      <BarChart data={data}><XAxis dataKey="name" {...axis} /><YAxis {...axis} />{grid}{tooltip}<Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s, i) => <Bar key={s.name} dataKey={s.name} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />)}
      </BarChart>
    );
  }

  return (
    <div className="bf-chart group relative my-3 rounded-xl border p-3"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}
      onMouseDown={() => view.selectAtom(node)}>
      {spec.title && <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{spec.title}</div>}
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
      </div>
      {editable && (
        <button
          type="button"
          title="Delete chart"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); view.deleteAtom(node); }}
          className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:bg-red-500/10">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
