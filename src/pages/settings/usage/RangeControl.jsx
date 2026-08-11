// Single global date-range control for the Usage & Monitoring dashboard.
// Replaces the old top-level 7d/30d/90d buttons AND the per-panel
// Today/7d/30d/All/Custom selectors that Feedback & Terminations carried.
// Controlled: owns no state — parent holds `range` and re-fetches on change.

import { Calendar } from 'lucide-react';
import React from 'react';
import { toLocalInput } from './format';

const PRESETS = [
    { id: 'today', key: 'usage.range_today', label: 'Today' },
    { id: '24h', key: 'usage.range_24h', label: '24h' },
    { id: '7d', key: 'usage.range_7d', label: '7d' },
    { id: '30d', key: 'usage.range_30d', label: '30d' },
    { id: '90d', key: 'usage.range_90d', label: '90d' },
    { id: 'all', key: 'usage.range_all', label: 'All' },
    { id: 'custom', key: 'usage.range_custom', label: 'Custom' },
];

// Initial range object. Custom start/end seed the pickers (last 30 days) but are
// only used once the user selects the Custom preset.
export function defaultRange(preset = '30d') {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { preset, customStart: toLocalInput(start), customEnd: toLocalInput(end) };
}

const DATE_INPUT = {
    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
    borderRadius: 6, padding: '3px 6px', fontSize: 11,
    color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
};

export default function RangeControl({ range, onChange, t, presets }) {
    const tr = (k, fb) => (t ? t(k, fb) : fb);
    const setPreset = (preset) => onChange({ ...range, preset });
    const setCustom = (patch) => onChange({ ...range, ...patch, preset: 'custom' });
    // Optional subset (array of preset ids) for compact hosts — the Privacy
    // Shield Activity tab shows 7d/30d/90d only. Default: all presets.
    const shown = Array.isArray(presets) ? PRESETS.filter(p => presets.includes(p.id)) : PRESETS;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                {tr('usage.range', 'Range')}
            </span>
            <div style={{ display: 'flex', padding: 2, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                {shown.map(p => {
                    const active = range.preset === p.id;
                    return (
                        <button key={p.id} onClick={() => setPreset(p.id)} style={{
                            padding: '6px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: active ? 'var(--accent-primary, #10b981)' : 'transparent',
                            color: active ? '#fff' : 'var(--text-muted)',
                            boxShadow: active ? '0 1px 4px rgba(16,185,129,0.35)' : 'none',
                            display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                        }}>
                            {p.id === 'custom' && <Calendar style={{ width: 11, height: 11 }} />}
                            {tr(p.key, p.label)}
                        </button>
                    );
                })}
            </div>
            {range.preset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <input type="datetime-local" value={range.customStart} max={range.customEnd} onChange={e => setCustom({ customStart: e.target.value })} style={DATE_INPUT} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→</span>
                    <input type="datetime-local" value={range.customEnd} min={range.customStart} onChange={e => setCustom({ customEnd: e.target.value })} style={DATE_INPUT} />
                </div>
            )}
        </div>
    );
}
