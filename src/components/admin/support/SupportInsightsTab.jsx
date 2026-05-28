import React, { useEffect, useState } from 'react';
import { authFetch, API_BASE } from '../../../utils/helpers';

function fmtDuration(secs) {
    if (secs == null) return '—';
    if (secs < 3600) return `${Math.round(secs / 60)}m`;
    if (secs < 86400) return `${(secs / 3600).toFixed(1)}h`;
    return `${(secs / 86400).toFixed(1)}d`;
}

function Stat({ label, value, sub }) {
    return (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
            <div className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
            {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
        </div>
    );
}

export default function SupportInsightsTab() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/support/insights`);
                if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed'); }
                setData(await res.json());
            } catch (e) { setError(e.message); }
        })();
    }, []);

    if (error) return <div className="p-6 text-sm" style={{ color: '#dc2626' }}>{error}</div>;
    if (!data) return <div className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>Loading insights…</div>;

    const { csat, handling } = data;
    return (
        <div className="max-w-3xl mx-auto p-4">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Insights</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
                <Stat label="CSAT (7d avg)" value={csat.avg7d != null ? `${csat.avg7d}/5` : '—'} />
                <Stat label="CSAT (30d avg)" value={csat.avg30d != null ? `${csat.avg30d}/5` : '—'} />
                <Stat label="CSAT response rate" value={`${Math.round((csat.responseRate || 0) * 100)}%`} sub={`${csat.responses} ratings`} />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
                <Stat label="AI-resolved" value={handling.aiResolved} />
                <Stat label="Staff-resolved" value={handling.staffResolved} />
                <Stat label="SLA breaches" value={handling.slaBreaches} sub={`of ${handling.total} threads`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Stat label="Median first response" value={fmtDuration(handling.avgFirstResponseSecs)} />
                <Stat label="Median resolution time" value={fmtDuration(handling.avgResolutionSecs)} />
            </div>
        </div>
    );
}
