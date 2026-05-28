import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { authFetch, API_BASE } from '../../../utils/helpers';

export default function SupportTagsTab() {
    const [tags, setTags] = useState([]);
    const [name, setName] = useState('');
    const [color, setColor] = useState('#64748b');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/support/tags`);
            if (res.ok) setTags((await res.json()).tags || []);
        } catch (e) { setError(e.message); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const create = async () => {
        if (!name.trim()) return;
        setBusy(true); setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/support/tags`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), color }),
            });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Create failed'); }
            setName('');
            await load();
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const remove = async (id) => {
        const res = await authFetch(`${API_BASE}/api/support/tags/${id}`, { method: 'DELETE' });
        if (res.ok) await load();
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Tag taxonomy</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                The catalogue of tags the AI may auto-assign and staff can apply to threads.
            </p>
            {error && <div className="text-xs mb-3 px-3 py-2 rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>{error}</div>}

            <div className="flex items-center gap-2 mb-4">
                <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} placeholder="New tag name"
                    className="flex-1 px-2 py-1.5 rounded border text-sm" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-9 h-9 rounded border" style={{ borderColor: 'var(--border-default)' }} />
                <button onClick={create} disabled={busy || !name.trim()} className="px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 disabled:opacity-50" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                    <Plus className="w-3.5 h-3.5" /> Add
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {tags.length === 0 && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No tags yet.</div>}
                {tags.map(t => (
                    <span key={t.id} className="text-sm px-2 py-1 rounded inline-flex items-center gap-1.5 border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color || '#64748b' }} />
                        #{t.name}
                        {t.organization_id == null && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(system)</span>}
                        <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100" style={{ color: '#dc2626' }}><Trash2 className="w-3 h-3" /></button>
                    </span>
                ))}
            </div>
        </div>
    );
}
