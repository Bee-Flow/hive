import React, { useEffect, useState } from 'react';
import { Plus, Play, Pause, Trash2, Edit3, Sparkles } from 'lucide-react';
import useAutomationApi from '../../../../hooks/useAutomationApi';

/**
 * List of saved automations + "Build with AI" button.
 *
 * Calls the parent (`onOpenBuilder`) with either no id (new draft)
 * or an existing automation id (resume/edit).
 */
export default function AutomationList({ onOpenBuilder }) {
    const api = useAutomationApi();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    const refresh = async () => {
        setLoading(true);
        try { const r = await api.listAutomations(); setItems(r.automations || []); }
        catch (e) { console.warn('[AutomationList]', e.message); }
        setLoading(false);
    };

    useEffect(() => { refresh(); }, []); // eslint-disable-line

    const toggle = async (a) => {
        if (a.isActive) await api.deactivate(a.id); else await api.activate(a.id);
        refresh();
    };
    const remove = async (a) => {
        if (!window.confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
        await api.deleteAutomation(a.id);
        refresh();
    };
    const runNow = async (a) => {
        await api.run(a.id);
        // Quick visual confirmation; runs surface in run history.
    };

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>Automations</h2>
                <span style={{ flex: 1 }} />
                <button onClick={() => onOpenBuilder(null)} style={{
                    background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                }}>
                    <Sparkles size={16} /> Build with AI
                </button>
            </div>
            {loading && <div style={{ color: '#6b7280' }}>Loading…</div>}
            {!loading && items.length === 0 && (
                <div style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>
                    No automations yet. Click <strong>Build with AI</strong> to describe one in chat.
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(a => (
                    <div key={a.id} style={{
                        border: '1px solid #e5e7eb', borderRadius: 8, padding: 12,
                        display: 'flex', alignItems: 'center', gap: 12, background: a.isDraft ? '#fefce8' : '#fff',
                    }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>
                                {a.title}
                                {a.isDraft && <span style={{ marginLeft: 8, fontSize: 11, color: '#a16207', background: '#fef3c7', padding: '2px 6px', borderRadius: 999 }}>DRAFT</span>}
                                {a.needsFirstRunConfirm && !a.isDraft && <span style={{ marginLeft: 8, fontSize: 11, color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: 999 }}>Needs first-run confirm</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                                {a.triggerType}
                                {a.scheduleCron ? ` · ${a.scheduleCron} (${a.scheduleTz})` : ''}
                                {a.lastStatus ? ` · last: ${a.lastStatus}` : ''}
                            </div>
                        </div>
                        <button onClick={() => toggle(a)} title={a.isActive ? 'Deactivate' : 'Activate'} style={iconBtn}>
                            {a.isActive ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button onClick={() => runNow(a)} title="Run now" style={iconBtn}>▶</button>
                        <button onClick={() => onOpenBuilder(a.id)} title="Edit in builder" style={iconBtn}><Edit3 size={16} /></button>
                        <button onClick={() => remove(a)} title="Delete" style={{ ...iconBtn, color: '#dc2626' }}><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}

const iconBtn = {
    background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: 6,
    cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center',
};
