import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { authFetch, API_BASE } from '../../../utils/helpers';

export default function SupportToolsTab() {
    const [v2Enabled, setV2Enabled] = useState(false);
    const [threshold, setThreshold] = useState(0.78);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/support/config`);
                if (res.ok) {
                    const d = await res.json();
                    setV2Enabled(!!d.v2Enabled);
                    setThreshold(d.autoResolveThreshold ?? 0.78);
                }
            } catch (e) { setError(e.message); }
        })();
    }, []);

    const save = async () => {
        setBusy(true); setError(null); setSaved(false);
        try {
            const res = await authFetch(`${API_BASE}/api/support/config`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ v2Enabled, autoResolveThreshold: Number(threshold) }),
            });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Save failed'); }
            setSaved(true);
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>AI behaviour</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Controls for the deeper AI handling. These apply to the live auto-responder.
            </p>
            {error && <div className="text-xs mb-3 px-3 py-2 rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>{error}</div>}

            <div className="rounded-lg border p-4 mb-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={v2Enabled} onChange={e => setV2Enabled(e.target.checked)} className="mt-1" />
                    <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Enable tool-using AI (v2)</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Lets the support agent call read-only lookups (customer profile, organization, subscription status, recent threads, knowledge base) before replying. Costs more per reply. When off, the agent answers from injected KB context only.
                        </div>
                    </div>
                </label>
            </div>

            <div className="rounded-lg border p-4 mb-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Auto-resolve confidence threshold</div>
                <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                    When the AI signals it fully resolved an issue and the top knowledge-base match scores above this, the thread is marked resolved and the customer gets a confirmation + CSAT email.
                </div>
                <div className="flex items-center gap-3">
                    <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))} className="flex-1" />
                    <span className="text-sm tabular-nums w-12 text-right" style={{ color: 'var(--text-primary)' }}>{Number(threshold).toFixed(2)}</span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={save} disabled={busy} className="px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 disabled:opacity-50" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                    <Save className="w-3.5 h-3.5" /> {busy ? 'Saving…' : 'Save'}
                </button>
                {saved && <span className="text-xs" style={{ color: '#059669' }}>Saved</span>}
            </div>
        </div>
    );
}
