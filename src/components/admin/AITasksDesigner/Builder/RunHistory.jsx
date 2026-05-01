import React, { useEffect, useState } from 'react';
import { ChevronRight, Play, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import useAutomationApi from '../../../../hooks/useAutomationApi';

const statusIcon = (s) => {
    if (s === 'success') return <CheckCircle2 size={14} color="#16a34a" />;
    if (s === 'error') return <AlertTriangle size={14} color="#dc2626" />;
    if (s === 'running') return <Clock size={14} color="#d97706" />;
    if (s === 'awaiting_confirm') return <AlertTriangle size={14} color="#d97706" />;
    return <Play size={14} color="#6b7280" />;
};

export default function RunHistory({ automationId }) {
    const api = useAutomationApi();
    const [runs, setRuns] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [steps, setSteps] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!automationId) return;
        let alive = true;
        setLoading(true);
        api.listRuns(automationId).then(d => {
            if (alive) setRuns(d.runs || []);
        }).catch(() => {}).finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [automationId]); // eslint-disable-line react-hooks/exhaustive-deps

    const open = async (run) => {
        if (openId === run.id) { setOpenId(null); setSteps([]); return; }
        setOpenId(run.id);
        const d = await api.getRunSteps(run.id);
        setSteps(d.steps || []);
    };

    const approve = async (run, e) => {
        e.stopPropagation();
        await api.approveRun(run.id);
        const d = await api.listRuns(automationId);
        setRuns(d.runs || []);
    };

    if (loading) return <div style={{ padding: 12, color: '#6b7280' }}>Loading runs…</div>;
    if (runs.length === 0) return <div style={{ padding: 12, color: '#9ca3af' }}>No runs yet.</div>;

    return (
        <div>
            {runs.map(run => (
                <div key={run.id}>
                    <button
                        onClick={() => open(run)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                            padding: '8px 12px', border: 'none', background: openId === run.id ? '#f3f4f6' : 'transparent', cursor: 'pointer',
                            borderBottom: '1px solid #f3f4f6', fontSize: 13,
                        }}
                    >
                        <ChevronRight size={14} style={{ transform: openId === run.id ? 'rotate(90deg)' : 'none' }} />
                        {statusIcon(run.status)}
                        <span style={{ flex: 1 }}>{run.mode === 'dry_run' ? 'Dry-run' : run.triggerKind} — {run.status}</span>
                        <span style={{ color: '#6b7280', fontSize: 12 }}>
                            {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
                        </span>
                        {run.status === 'awaiting_confirm' && (
                            <button onClick={(e) => approve(run, e)} style={{ marginLeft: 8, background: '#16a34a', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                                Approve
                            </button>
                        )}
                    </button>
                    {openId === run.id && (
                        <div style={{ padding: 8, background: '#fafafa' }}>
                            {run.summary && <div style={{ marginBottom: 6, fontSize: 12, color: '#374151' }}>{run.summary}</div>}
                            {steps.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af' }}>(no step records)</div>}
                            {steps.map(s => (
                                <details key={`${s.stepId}-${s.attempts}`} style={{ marginBottom: 4 }}>
                                    <summary style={{ cursor: 'pointer', fontSize: 12, padding: 4 }}>
                                        {statusIcon(s.status)} <code style={{ marginLeft: 6 }}>{s.stepId}</code> ({s.stepType})
                                    </summary>
                                    <pre style={{ fontSize: 11, padding: 8, background: '#fff', overflow: 'auto', maxHeight: 240 }}>
                                        {JSON.stringify({ input: s.input, output: s.output, error: s.error }, null, 2)}
                                    </pre>
                                </details>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
