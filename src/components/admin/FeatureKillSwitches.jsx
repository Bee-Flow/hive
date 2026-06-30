import React, { useEffect, useState } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { BookOpen, FolderKanban, Sparkles, FileDown, Maximize2, LayoutList, Check, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * FeatureKillSwitches — the global platform feature flags
 * (notebooks / projects / ask-ai / export / open-in-notebook / notebooks-menu),
 * persisted via GET/POST /ai/config (configStore feature_*_enabled).
 *
 * Self-contained (loads + saves its own state) so it can be reused both on the
 * Integrations admin panel and inside the self-hosted Ceiling editor without
 * duplicating the toggle logic. These are operator kill-switches, not
 * entitlement grants — they take effect for everyone on next page load.
 *
 * Emerald + blue only.
 */

const FLAGS = [
    { key: 'notebooksEnabled', label: 'Notebooks', desc: 'AI-powered collaborative notebooks', icon: BookOpen },
    { key: 'projectsEnabled', label: 'Projects', desc: 'Organize chats into shared project folders', icon: FolderKanban },
    { key: 'askAiEnabled', label: 'Ask AI', desc: 'Enable AI assistance in notebooks', icon: Sparkles },
    { key: 'exportEnabled', label: 'Export', desc: 'Enable exporting notebooks to Word/PDF', icon: FileDown },
    { key: 'openInNotebookEnabled', label: 'Open in Notebook', desc: 'Allow opening chats as full notebooks', icon: Maximize2 },
    { key: 'notebooksMenuEnabled', label: 'Notebooks Menu', desc: "Show 'Notebooks' in the sidebar menu", icon: LayoutList },
];

export default function FeatureKillSwitches() {
    const [flags, setFlags] = useState(() => {
        const init = {};
        for (const f of FLAGS) init[f.key] = true;
        return init;
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});
    const [message, setMessage] = useState(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config`);
                if (res.ok) {
                    const data = await res.json();
                    if (!alive) return;
                    setFlags(prev => {
                        const next = { ...prev };
                        for (const f of FLAGS) if (data[f.key] !== undefined) next[f.key] = !!data[f.key];
                        return next;
                    });
                }
            } catch (e) { /* leave defaults */ }
            finally { if (alive) setLoading(false); }
        })();
        return () => { alive = false; };
    }, []);

    useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), 3000); return () => clearTimeout(t); }, [message]);

    const toggle = async (key, label) => {
        const newVal = !flags[key];
        setSaving(s => ({ ...s, [key]: true }));
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: newVal }),
            });
            if (res.ok) {
                setFlags(f => ({ ...f, [key]: newVal }));
                setMessage({ type: 'success', text: `${label} ${newVal ? 'enabled' : 'disabled'}` });
            } else {
                setMessage({ type: 'error', text: `Failed to update ${label}` });
            }
        } catch (e) {
            setMessage({ type: 'error', text: `Failed to update ${label}` });
        }
        setSaving(s => ({ ...s, [key]: false }));
    };

    return (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Feature Flags</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Enable or disable platform features globally. Changes take effect on next page load for all users.
                    </p>
                </div>
                {message ? (
                    <span className="inline-flex items-center gap-1.5 text-xs flex-shrink-0" style={{ color: message.type === 'success' ? '#10b981' : '#dc2626' }}>
                        {message.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{message.text}
                    </span>
                ) : null}
            </div>
            <div className="p-4">
                {loading ? (
                    <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {FLAGS.map(({ key, label, desc, icon: Icon }) => {
                            const on = flags[key];
                            return (
                                <div key={key}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                                    style={{ background: on ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary)', border: `1px solid ${on ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)'}` }}>
                                    <Icon className="w-5 h-5 shrink-0" style={{ color: on ? '#10b981' : 'var(--text-muted)' }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium" style={{ color: on ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</div>
                                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</div>
                                    </div>
                                    <button
                                        onClick={() => toggle(key, label)}
                                        disabled={!!saving[key]}
                                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-green-500' : 'bg-gray-600'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${on ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
