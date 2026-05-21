import React, { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, Plus, ArrowLeft } from 'lucide-react';
import { authFetch, API_BASE } from '../../utils/helpers';
import {
    NewThreadForm,
    ThreadDetail,
    STATUS_LABELS,
    formatRelative,
} from '../../components/support/SupportDrawer';

/**
 * HelpSupportSection — user-facing support inbox inside AdvancedSettings.
 *
 * Reuses NewThreadForm and ThreadDetail from SupportDrawer.jsx (named
 * exports). The floating Help-drawer was retired; this section is the
 * canonical entry point for a logged-in user to talk to Bee Flow.
 */
export default function HelpSupportSection({ user }) {
    const [threads, setThreads] = useState([]);
    const [view, setView] = useState('list'); // 'list' | 'new' | 'detail'
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchMine = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/support/threads/mine`);
            if (res.ok) {
                const data = await res.json();
                setThreads(data.threads || []);
            }
        } catch {} finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchMine(); }, [fetchMine]);

    return (
        <div className="max-w-3xl mx-auto py-4">
            {/* Header */}
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <LifeBuoy className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Help & Support</h2>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Ask Bee Flow anything. Our AI replies first; a human takes over if needed.
                    </p>
                </div>
                {view === 'list' && (
                    <button
                        onClick={() => setView('new')}
                        className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5"
                        style={{ background: 'var(--accent-primary)', color: 'white' }}
                    >
                        <Plus className="w-3.5 h-3.5" /> New question
                    </button>
                )}
            </div>

            {view === 'list' && (
                <div className="rounded-xl border overflow-hidden"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                    {loading ? (
                        <div className="p-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
                    ) : threads.length === 0 ? (
                        <div className="p-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                            No conversations yet. Click <strong>New question</strong> to ask Bee Flow something — the AI will reply within seconds.
                        </div>
                    ) : threads.map(t => (
                        <button
                            key={t.id}
                            onClick={() => { setActiveId(t.id); setView('detail'); }}
                            className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-[var(--bg-tertiary)]"
                            style={{ borderColor: 'var(--border-default)' }}
                        >
                            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.subject}</div>
                            <div className="text-xs mt-0.5 flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
                                <span>{STATUS_LABELS[t.status] || t.status}</span>
                                <span>{formatRelative(t.last_message_at)}</span>
                            </div>
                            {(t.requester_org_role || t.requester_org_name) && (
                                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                    Posted as <strong style={{ color: 'var(--text-secondary)' }}>{t.requester_org_role || 'member'}</strong>
                                    {t.requester_org_name ? ` at ${t.requester_org_name}` : ''}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {view === 'new' && (
                <div className="rounded-xl border overflow-hidden"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                    <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-default)' }}>
                        <button onClick={() => setView('list')} className="p-1 rounded hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>New question</div>
                    </div>
                    <NewThreadForm
                        onCancel={() => setView('list')}
                        onCreated={(id) => {
                            if (id) { setActiveId(id); setView('detail'); }
                            else setView('list');
                            fetchMine();
                        }}
                    />
                </div>
            )}

            {view === 'detail' && activeId && (
                <div className="rounded-xl border overflow-hidden h-[640px] max-h-[80vh] flex flex-col"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                    <ThreadDetail
                        threadId={activeId}
                        onBack={() => { setView('list'); fetchMine(); }}
                        onChanged={fetchMine}
                    />
                </div>
            )}
        </div>
    );
}
