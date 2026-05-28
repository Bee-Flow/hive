import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { authFetch, API_BASE } from '../../../utils/helpers';

const VARS = ['{{requester_name}}', '{{requester_email}}', '{{org_name}}', '{{thread_subject}}', '{{staff_first_name}}'];

export default function SupportCannedResponsesTab() {
    const [items, setItems] = useState([]);
    const [error, setError] = useState(null);
    const [draft, setDraft] = useState({ title: '', shortcut: '', body: '' });
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/support/canned`);
            if (res.ok) setItems((await res.json()).responses || []);
        } catch (e) { setError(e.message); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const create = async () => {
        if (!draft.title.trim() || !draft.body.trim()) return;
        setBusy(true); setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/support/canned`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Create failed'); }
            setDraft({ title: '', shortcut: '', body: '' });
            await load();
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const remove = async (id) => {
        const res = await authFetch(`${API_BASE}/api/support/canned/${id}`, { method: 'DELETE' });
        if (res.ok) await load();
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Canned responses</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Reusable reply templates. Staff insert them with the <code>/</code> picker in the composer. Variables are substituted on send: {VARS.join(' ')}.
            </p>
            {error && <div className="text-xs mb-3 px-3 py-2 rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>{error}</div>}

            <div className="rounded-lg border p-3 mb-4 space-y-2" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                <div className="flex gap-2">
                    <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Title"
                        className="flex-1 px-2 py-1.5 rounded border text-sm" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                    <input value={draft.shortcut} onChange={e => setDraft({ ...draft, shortcut: e.target.value })} placeholder="/shortcut"
                        className="w-32 px-2 py-1.5 rounded border text-sm" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                </div>
                <textarea value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} rows={3} placeholder="Template body — use variables like {{requester_name}}"
                    className="w-full px-2 py-1.5 rounded border text-sm resize-y" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                <div className="flex justify-end">
                    <button onClick={create} disabled={busy || !draft.title.trim() || !draft.body.trim()}
                        className="px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)', color: 'white' }}>
                        <Plus className="w-3.5 h-3.5" /> Add template
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {items.length === 0 && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No templates yet.</div>}
                {items.map(c => (
                    <div key={c.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                {c.title}
                                {c.shortcut && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{c.shortcut}</span>}
                                {c.organization_id == null && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>system</span>}
                            </div>
                            <button onClick={() => remove(c.id)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]" style={{ color: '#dc2626' }}>
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="text-xs mt-1 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{c.body}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
