import React, { useEffect, useState, useCallback } from 'react';
import { Save } from 'lucide-react';
import { authFetch, API_BASE } from '../../../utils/helpers';

const PRIORITIES = ['urgent', 'high', 'normal', 'low'];
const DEFAULTS = {
    urgent: { first: 60, resolution: 240 },
    high: { first: 240, resolution: 1440 },
    normal: { first: 720, resolution: 2880 },
    low: { first: 1440, resolution: 5760 },
};

export default function SupportSlaPoliciesTab() {
    const [rows, setRows] = useState({});
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/support/sla-policies`);
            if (!res.ok) return;
            const { policies } = await res.json();
            const map = {};
            for (const p of policies || []) map[p.priority] = p;
            setRows(map);
        } catch (e) { setError(e.message); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async (priority, firstMin, resMin, enabled) => {
        setBusy(priority);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/support/sla-policies`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priority, first_response_minutes: firstMin, resolution_minutes: resMin, enabled }),
            });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Save failed'); }
            await load();
        } catch (e) { setError(e.message); }
        finally { setBusy(null); }
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>SLA policies</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                First-response and resolution targets per priority (in minutes). Threads that breach are flagged and the assignee is notified. The clock pauses while a thread is waiting on the customer.
            </p>
            {error && <div className="text-xs mb-3 px-3 py-2 rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>{error}</div>}
            <div className="space-y-2">
                {PRIORITIES.map(p => {
                    const row = rows[p] || {};
                    return (
                        <SlaRow key={p} priority={p} row={row} busy={busy === p} defaults={DEFAULTS[p]} onSave={save} />
                    );
                })}
            </div>
        </div>
    );
}

function SlaRow({ priority, row, busy, defaults, onSave }) {
    const [first, setFirst] = useState(row.first_response_minutes ?? defaults.first);
    const [res, setRes] = useState(row.resolution_minutes ?? defaults.resolution);
    const [enabled, setEnabled] = useState(row.enabled !== false);
    useEffect(() => {
        setFirst(row.first_response_minutes ?? defaults.first);
        setRes(row.resolution_minutes ?? defaults.resolution);
        setEnabled(row.enabled !== false);
    }, [row, defaults]);

    return (
        <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
            <span className="w-20 text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{priority}</span>
            <label className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                First <input type="number" min="1" value={first} onChange={e => setFirst(parseInt(e.target.value, 10) || 0)} className="w-20 px-2 py-1 rounded border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /> min
            </label>
            <label className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                Resolve <input type="number" min="1" value={res} onChange={e => setRes(parseInt(e.target.value, 10) || 0)} className="w-20 px-2 py-1 rounded border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /> min
            </label>
            <label className="text-xs flex items-center gap-1 ml-auto" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> on
            </label>
            <button onClick={() => onSave(priority, first, res, enabled)} disabled={busy}
                className="px-2.5 py-1 rounded-md text-xs flex items-center gap-1 disabled:opacity-50"
                style={{ background: 'var(--accent-primary)', color: 'white' }}>
                <Save className="w-3 h-3" /> {busy ? '…' : 'Save'}
            </button>
        </div>
    );
}
